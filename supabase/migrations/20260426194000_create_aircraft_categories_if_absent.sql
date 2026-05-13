-- DB-VERIFICATION: aircraft-categories-schema-overlap-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge
-- SCHEMA-OVERLAP-ANALYSIS:
--   - No canonical public.aircraft_categories table exists in current AMRO schema.
--   - Existing tables like public.assembly_types and public.assembly_models do not store
--     engine/wing category taxonomy values requested here.
-- EXTENSION-ASSESSMENT:
--   - public.assembly_types cannot be safely extended for this requirement because it models
--     structural assemblies, not propulsion/wing-type categories.
--   - A dedicated table is required for explicit aircraft category master data.

BEGIN;

DO $$
DECLARE
  v_exact_exists boolean := FALSE;
  v_similar_table text := NULL;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname = 'aircraft_categories'
  ) INTO v_exact_exists;

  SELECT c.relname
  INTO v_similar_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relname IN ('aircraft_category', 'aircraft_categroy')
  LIMIT 1;

  IF NOT v_exact_exists AND v_similar_table IS NULL THEN
    EXECUTE $create$
      CREATE TABLE public.aircraft_categories (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        franchise_id uuid NULL,
        code character varying(10) NOT NULL,
        name character varying(100) NOT NULL,
        description text NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT aircraft_categories_pkey PRIMARY KEY (id),
        CONSTRAINT uq_aircraft_categories_tenant_code UNIQUE (tenant_id, code),
        CONSTRAINT aircraft_categories_tenant_id_fkey
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
        CONSTRAINT aircraft_categories_franchise_id_fkey
          FOREIGN KEY (franchise_id) REFERENCES public.franchises(id) ON DELETE SET NULL,
        CONSTRAINT ck_aircraft_categories_code_non_empty CHECK (btrim(code) <> ''),
        CONSTRAINT ck_aircraft_categories_name_non_empty CHECK (btrim(name) <> '')
      ) TABLESPACE pg_default;
    $create$;
  ELSIF NOT v_exact_exists AND v_similar_table IS NOT NULL THEN
    RAISE NOTICE 'Skipping create of public.aircraft_categories because similar table "%" already exists.', v_similar_table;
  END IF;
END $$;

-- Safety net in case table pre-exists from other branch/state with partial definition.
ALTER TABLE IF EXISTS public.aircraft_categories
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS franchise_id uuid,
  ADD COLUMN IF NOT EXISTS code character varying(10),
  ADD COLUMN IF NOT EXISTS name character varying(100),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

DO $$
DECLARE
  v_has_primary_key boolean := FALSE;
BEGIN
  IF to_regclass('public.aircraft_categories') IS NOT NULL THEN
    ALTER TABLE public.aircraft_categories
      ALTER COLUMN tenant_id SET NOT NULL,
      ALTER COLUMN code SET NOT NULL,
      ALTER COLUMN name SET NOT NULL;

    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint con
      WHERE con.conrelid = 'public.aircraft_categories'::regclass
        AND con.contype = 'p'
    ) INTO v_has_primary_key;

    IF NOT v_has_primary_key THEN
      ALTER TABLE public.aircraft_categories
        ADD CONSTRAINT aircraft_categories_pkey PRIMARY KEY (id);
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL;
END $$;

DO $$
DECLARE
  v_has_unique_constraint boolean := FALSE;
  v_named_relation_exists boolean := FALSE;
BEGIN
  IF to_regclass('public.aircraft_categories') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint con
      WHERE con.conrelid = 'public.aircraft_categories'::regclass
        AND con.contype = 'u'
        AND con.conname = 'uq_aircraft_categories_tenant_code'
    ) INTO v_has_unique_constraint;

    SELECT to_regclass('public.uq_aircraft_categories_tenant_code') IS NOT NULL
    INTO v_named_relation_exists;

    IF NOT v_has_unique_constraint AND NOT v_named_relation_exists THEN
      ALTER TABLE public.aircraft_categories
        ADD CONSTRAINT uq_aircraft_categories_tenant_code UNIQUE (tenant_id, code);
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public.aircraft_categories') IS NOT NULL THEN
    ALTER TABLE public.aircraft_categories
      ADD CONSTRAINT aircraft_categories_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public.aircraft_categories') IS NOT NULL THEN
    ALTER TABLE public.aircraft_categories
      ADD CONSTRAINT aircraft_categories_franchise_id_fkey
      FOREIGN KEY (franchise_id) REFERENCES public.franchises(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public.aircraft_categories') IS NOT NULL THEN
    ALTER TABLE public.aircraft_categories
      ADD CONSTRAINT ck_aircraft_categories_code_non_empty CHECK (btrim(code) <> '');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public.aircraft_categories') IS NOT NULL THEN
    ALTER TABLE public.aircraft_categories
      ADD CONSTRAINT ck_aircraft_categories_name_non_empty CHECK (btrim(name) <> '');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_aircraft_categories_tenant_id
  ON public.aircraft_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_categories_franchise_id
  ON public.aircraft_categories(franchise_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_categories_active
  ON public.aircraft_categories(is_active);

ALTER TABLE IF EXISTS public.aircraft_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aircraft categories: platform admin full access" ON public.aircraft_categories;
CREATE POLICY "Aircraft categories: platform admin full access"
  ON public.aircraft_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "Aircraft categories: tenant users access own tenant data" ON public.aircraft_categories;
CREATE POLICY "Aircraft categories: tenant users access own tenant data"
  ON public.aircraft_categories
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  );

DROP TRIGGER IF EXISTS trg_aircraft_categories_updated_at ON public.aircraft_categories;
DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    CREATE TRIGGER trg_aircraft_categories_updated_at
      BEFORE UPDATE ON public.aircraft_categories
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

WITH category_seed(code, name) AS (
  VALUES
    ('PE-FW', 'Piston Engine-Fixed Wing Aircraft'),
    ('PE-RW', 'Piston Engine-Rotary Wing Aircraft'),
    ('TF-FW', 'Turbo Fan-Fixed Wing Aircraft'),
    ('TJ-FW', 'Turbo Jet-Fixed Wing Aircraft'),
    ('TP-FW', 'Turbo Propeller-Fixed Wing Aircraft'),
    ('TS-RW', 'Turbo Shaft-Rotary Wing Aircraft')
)
INSERT INTO public.aircraft_categories (
  tenant_id,
  franchise_id,
  code,
  name,
  description,
  is_active
)
SELECT
  '157b8d12-c115-446e-a4dc-d12077751fe2'::uuid AS tenant_id,
  NULL::uuid AS franchise_id,
  s.code,
  s.name,
  s.name AS description,
  true AS is_active
FROM category_seed s
ON CONFLICT (tenant_id, code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();

COMMENT ON TABLE public.aircraft_categories IS
  'Tenant-scoped AMRO aircraft category catalog for engine and wing-type classification.';
COMMENT ON COLUMN public.aircraft_categories.code IS
  'Short category code (max 10 chars), unique per tenant.';
COMMENT ON COLUMN public.aircraft_categories.name IS
  'Category display name (e.g. Turbo Fan-Fixed Wing Aircraft).';

COMMIT;
