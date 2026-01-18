-- Execute this SQL to fix all known migration issues in the current database
-- This creates/updates the required functions with proper search_path settings

-- 1. Create import_overrides table if not exists
CREATE TABLE IF NOT EXISTS public.import_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    issues TEXT[],
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.import_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_overrides' AND policyname = 'Users can view their overrides') THEN
        CREATE POLICY "Users can view their overrides" ON public.import_overrides
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_overrides' AND policyname = 'Users can insert overrides') THEN
        CREATE POLICY "Users can insert overrides" ON public.import_overrides
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_overrides' AND policyname = 'Platform admins can manage all overrides') THEN
        CREATE POLICY "Platform admins can manage all overrides" ON public.import_overrides
            FOR ALL USING (public.is_platform_admin(auth.uid()));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_import_overrides_user_id ON public.import_overrides(user_id);

-- 2. Fix assign_lead_with_transaction function (remove COMMIT/ROLLBACK)
CREATE OR REPLACE FUNCTION public.assign_lead_with_transaction(
  p_lead_id uuid,
  p_assigned_to uuid,
  p_assignment_method text,
  p_rule_id uuid,
  p_tenant_id uuid,
  p_franchise_id uuid
) RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE leads SET owner_id = p_assigned_to WHERE id = p_lead_id;

    INSERT INTO lead_assignment_history (
      lead_id, assigned_to, assignment_method, rule_id, tenant_id, franchise_id, assigned_by
    ) VALUES (
      p_lead_id, p_assigned_to, p_assignment_method, p_rule_id, p_tenant_id, p_franchise_id, NULL
    );

    UPDATE user_capacity
    SET current_leads = current_leads + 1, last_assigned_at = now()
    WHERE user_id = p_assigned_to AND tenant_id = p_tenant_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

-- 3. Fix logic_nexus_import_dry_run function (remove extensions from search_path)
CREATE OR REPLACE FUNCTION public.logic_nexus_import_dry_run(
  p_tables jsonb,
  p_schema text DEFAULT 'public'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table text;
  v_rows jsonb;
  v_count int;
  v_errors text[] := ARRAY[]::text[];
  v_total_success int := 0;
  v_table_count int := 0;
BEGIN
  FOR v_table, v_rows IN SELECT * FROM jsonb_each(p_tables)
  LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = p_schema AND table_name = v_table
      ) THEN
        v_errors := array_append(v_errors, format('Table "%s"."%s" not found', p_schema, v_table));
        CONTINUE;
      END IF;

      EXECUTE format(
        'INSERT INTO %I.%I SELECT * FROM jsonb_populate_recordset(null::%I.%I, $1)',
        p_schema, v_table, p_schema, v_table
      ) USING v_rows;
      
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_total_success := v_total_success + v_count;
      v_table_count := v_table_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, format('Error in "%s": %s', v_table, SQLERRM));
    END;
  END LOOP;

  IF array_length(v_errors, 1) > 0 THEN
    RAISE EXCEPTION 'DRY_RUN_FAILED: % errors found. Details: %', array_length(v_errors, 1), array_to_string(v_errors, '; ');
  ELSE
    RAISE EXCEPTION 'DRY_RUN_OK: Validated % rows across % tables', v_total_success, v_table_count;
  END IF;
END;
$$;

-- 4. Create schema_migrations tracking table for target database
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

-- Done
SELECT 'Migration fixes applied successfully' as status;
