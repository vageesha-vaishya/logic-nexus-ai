-- Safe, idempotent setup for audit logs, document versioning, and import history

-- 1) Audit logs table, indexes, RLS, and policies
DO $$
BEGIN
  -- Create audit_logs table if missing
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
  ) THEN
    CREATE TABLE public.audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id),
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      details JSONB DEFAULT '{}'::jsonb,
      ip_address INET,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;

  -- Ensure core columns exist (schema drift tolerance)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'details'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD COLUMN details JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
    ON public.audit_logs(user_id);

  CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type
    ON public.audit_logs(resource_type);

  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON public.audit_logs(created_at);

  -- Enable RLS
  ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

  -- Reset policies to a known-good state
  DROP POLICY IF EXISTS "Platform admins view all logs" ON public.audit_logs;
  DROP POLICY IF EXISTS "Users view own logs" ON public.audit_logs;
  DROP POLICY IF EXISTS "Users can insert logs" ON public.audit_logs;

  -- Platform Admins can view all logs
  CREATE POLICY "Platform admins view all logs" ON public.audit_logs
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'platform_admin'
      )
    );

  -- Users can view their own logs
  CREATE POLICY "Users view own logs" ON public.audit_logs
    FOR SELECT
    USING (auth.uid() = user_id);

  -- Users can insert logs for themselves
  CREATE POLICY "Users can insert logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
END $$;


-- 2) Documents and document_versions for long-form docs
DO $$
BEGIN
  -- documents
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'documents'
  ) THEN
    CREATE TABLE public.documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      path TEXT NOT NULL UNIQUE,
      current_version TEXT NOT NULL DEFAULT '1.0.0',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;

  -- Tolerate existing schemas where documents table lacks expected columns
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'path'
  ) THEN
    ALTER TABLE public.documents
      ADD COLUMN path TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'current_version'
  ) THEN
    ALTER TABLE public.documents
      ADD COLUMN current_version TEXT DEFAULT '1.0.0';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.documents
      ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.documents
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Ensure a unique index supporting ON CONFLICT (path)
  CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_path_unique
    ON public.documents(path);

  -- document_versions
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'document_versions'
  ) THEN
    CREATE TABLE public.document_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
      version TEXT NOT NULL,
      content TEXT NOT NULL,
      diff_summary JSONB,
      change_type TEXT CHECK (change_type IN ('major', 'minor', 'patch')),
      change_notes TEXT,
      created_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(document_id, version)
    );
  END IF;

  -- Enable RLS
  ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

  -- Reset policies
  DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.documents;
  DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.document_versions;
  DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON public.documents;
  DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON public.document_versions;

  -- Read policies
  CREATE POLICY "Allow read access to authenticated users" ON public.documents
    FOR SELECT TO authenticated USING (true);

  CREATE POLICY "Allow read access to authenticated users" ON public.document_versions
    FOR SELECT TO authenticated USING (true);

  -- Write policies
  CREATE POLICY "Allow insert/update access to authenticated users" ON public.documents
    FOR ALL TO authenticated USING (true);

  CREATE POLICY "Allow insert/update access to authenticated users" ON public.document_versions
    FOR ALL TO authenticated USING (true);
END $$;


-- 3) Seed an initial document + version with compact, safely-quoted content
DO $$
DECLARE
  v_doc_id UUID;
  v_has_non_nullable_tenant_id BOOLEAN;
BEGIN
  -- If documents table enforces a non-null tenant_id, skip seeding to avoid constraint violations.
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'tenant_id'
      AND is_nullable = 'NO'
  ) INTO v_has_non_nullable_tenant_id;

  IF v_has_non_nullable_tenant_id THEN
    RAISE NOTICE 'Skipping seed for documents: tenant_id is non-nullable and not handled in this migration.';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.documents (path, current_version)
    VALUES ('docs/COMPETITIVE_ANALYSIS_AND_ROADMAP.md', '1.0.0')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_doc_id;
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'Skipping documents seed insert due to error: %', SQLERRM;
      RETURN;
  END;

  IF v_doc_id IS NULL THEN
    -- Either row already existed or insert failed; no need to seed a version here.
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.document_versions (document_id, version, content, change_type, change_notes)
    VALUES (
      v_doc_id,
      '1.0.0',
      'SOS Logistics Pro competitive analysis and strategic roadmap. Initial seeded version; full markdown can be updated via the application UI.',
      'major',
      'Initial version'
    )
    ON CONFLICT (document_id, version) DO NOTHING;
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'Skipping document_versions seed insert due to error: %', SQLERRM;
  END;
END $$;


-- 4) Ensure dashboards.view permission exists and is granted
INSERT INTO auth_permissions (id, category, description)
VALUES ('dashboards.view', 'Dashboard', 'View dashboards')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth_role_permissions (role_id, permission_id)
VALUES ('platform_admin', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO auth_role_permissions (role_id, permission_id)
VALUES ('tenant_admin', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO auth_role_permissions (role_id, permission_id)
VALUES ('franchise_admin', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO auth_role_permissions (role_id, permission_id)
VALUES ('user', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- 5) Import history and details tables + RLS/policies
DO $$
BEGIN
  -- import_history table
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'import_history'
  ) THEN
    CREATE TABLE public.import_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_name TEXT NOT NULL,
      table_name TEXT NOT NULL,
      file_name TEXT,
      imported_at TIMESTAMPTZ DEFAULT NOW(),
      imported_by UUID REFERENCES auth.users(id),
      status TEXT CHECK (status IN ('success', 'partial', 'failed', 'reverted')),
      summary JSONB,
      reverted_at TIMESTAMPTZ,
      reverted_by UUID REFERENCES auth.users(id)
    );
  END IF;

  -- import_history_details table
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'import_history_details'
  ) THEN
    CREATE TABLE public.import_history_details (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      import_id UUID REFERENCES public.import_history(id) ON DELETE CASCADE,
      record_id TEXT NOT NULL,
      operation_type TEXT CHECK (operation_type IN ('insert', 'update')),
      previous_data JSONB,
      new_data JSONB
    );
  END IF;

  -- Enable RLS if tables exist
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'import_history'
  ) THEN
    ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'import_history_details'
  ) THEN
    ALTER TABLE public.import_history_details ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Reset policies before recreating
  DROP POLICY IF EXISTS "Users can view import history" ON public.import_history;
  DROP POLICY IF EXISTS "Users can insert import history" ON public.import_history;
  DROP POLICY IF EXISTS "Users can update import history" ON public.import_history;
  DROP POLICY IF EXISTS "Users can delete import history" ON public.import_history;

  DROP POLICY IF EXISTS "Users can view import details" ON public.import_history_details;
  DROP POLICY IF EXISTS "Users can insert import details" ON public.import_history_details;

  -- Recreate policies
  CREATE POLICY "Users can view import history" ON public.import_history
    FOR SELECT
    USING (auth.role() = 'authenticated');

  CREATE POLICY "Users can insert import history" ON public.import_history
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

  CREATE POLICY "Users can update import history" ON public.import_history
    FOR UPDATE
    USING (auth.role() = 'authenticated');

  CREATE POLICY "Users can view import details" ON public.import_history_details
    FOR SELECT
    USING (auth.role() = 'authenticated');

  CREATE POLICY "Users can insert import details" ON public.import_history_details
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

  -- Index for details
  CREATE INDEX IF NOT EXISTS idx_import_history_details_import_id
    ON public.import_history_details(import_id);

  -- Grants for authenticated role
  GRANT SELECT, INSERT, UPDATE ON public.import_history TO authenticated;
  GRANT SELECT, INSERT ON public.import_history_details TO authenticated;
END $$;
