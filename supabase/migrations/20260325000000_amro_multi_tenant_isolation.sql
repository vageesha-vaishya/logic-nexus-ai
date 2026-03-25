-- DB-VERIFICATION: amro-manufacturers-assembly-multitenant-reviewed
-- DB-ARCH-APPROVAL: amro-manufacturers-assembly-multitenant-approved
-- SCHEMA-OVERLAP-ANALYSIS: Existing manufacturers/assembly_types/assembly_models are global; tenant isolation required for AMRO tenant/franchise separation.
-- EXTENSION-ASSESSMENT: Extending global tables without tenant_id/franchise_id cannot enforce tenant isolation or tenant-aware foreign keys.
-- EXTENSION-RATIONALE: Recreate master data tables with tenant_id/franchise_id and tenant-aware relationships per AMRO multi-tenant governance.

BEGIN;

ALTER TABLE public.aircraft DROP CONSTRAINT IF EXISTS aircraft_manufacturer_id_fkey;

DROP TABLE IF EXISTS public.assembly_models;
DROP TABLE IF EXISTS public.assembly_types;
DROP TABLE IF EXISTS public.manufacturers;

CREATE TABLE IF NOT EXISTS public.manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE DEFAULT 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  manufacturer_code text NOT NULL,
  name text NOT NULL,
  country text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz
 
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_manufacturers_code_active
  ON public.manufacturers(tenant_id, manufacturer_code)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_manufacturers_name_active
  ON public.manufacturers(tenant_id, lower(name))
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_manufacturers_id_tenant
  ON public.manufacturers(id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_manufacturers_is_active ON public.manufacturers(is_active);
CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON public.manufacturers(lower(name));
CREATE INDEX IF NOT EXISTS idx_manufacturers_tenant_id ON public.manufacturers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_manufacturers_franchise_id ON public.manufacturers(franchise_id);

ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manufacturers: platform admin full access" ON public.manufacturers;
CREATE POLICY "Manufacturers: platform admin full access"
  ON public.manufacturers
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

DROP POLICY IF EXISTS "Manufacturers: tenant users access own tenant data" ON public.manufacturers;
CREATE POLICY "Manufacturers: tenant users access own tenant data"
  ON public.manufacturers
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

CREATE TABLE IF NOT EXISTS public.assembly_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE DEFAULT 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET  NULL,
  assembly_code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL

);

CREATE UNIQUE INDEX IF NOT EXISTS uq_assembly_types_code ON public.assembly_types(tenant_id, assembly_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assembly_types_name ON public.assembly_types(tenant_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_assembly_types_id_tenant ON public.assembly_types(id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_assembly_types_active ON public.assembly_types(is_active);
CREATE INDEX IF NOT EXISTS idx_assembly_types_tenant_id ON public.assembly_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assembly_types_franchise_id ON public.assembly_types(franchise_id);

ALTER TABLE public.assembly_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Assembly types: platform admin full access" ON public.assembly_types;
CREATE POLICY "Assembly types: platform admin full access"
  ON public.assembly_types
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

DROP POLICY IF EXISTS "Assembly types: tenant users access own tenant data" ON public.assembly_types;
CREATE POLICY "Assembly types: tenant users access own tenant data"
  ON public.assembly_types
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

CREATE TABLE IF NOT EXISTS public.assembly_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE DEFAULT 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET  NULL,
  manufacturer_id uuid NOT NULL,
  assembly_type_id uuid NOT NULL,
  model_code text NOT NULL,
  name text NOT NULL,
  primary_model text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT fk_assembly_models_manufacturer_tenant
    FOREIGN KEY (manufacturer_id, tenant_id)
    REFERENCES public.manufacturers(id, tenant_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_assembly_models_assembly_type_tenant
    FOREIGN KEY (assembly_type_id, tenant_id)
    REFERENCES public.assembly_types(id, tenant_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_assembly_models_code
  ON public.assembly_models(tenant_id, manufacturer_id, assembly_type_id, model_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assembly_models_name
  ON public.assembly_models(tenant_id, manufacturer_id, assembly_type_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_assembly_models_active ON public.assembly_models(is_active);
CREATE INDEX IF NOT EXISTS idx_assembly_models_manufacturer_id ON public.assembly_models(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_assembly_models_assembly_type_id ON public.assembly_models(assembly_type_id);
CREATE INDEX IF NOT EXISTS idx_assembly_models_tenant_id ON public.assembly_models(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assembly_models_franchise_id ON public.assembly_models(franchise_id);

ALTER TABLE public.assembly_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Assembly models: platform admin full access" ON public.assembly_models;
CREATE POLICY "Assembly models: platform admin full access"
  ON public.assembly_models
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

DROP POLICY IF EXISTS "Assembly models: tenant users access own tenant data" ON public.assembly_models;
CREATE POLICY "Assembly models: tenant users access own tenant data"
  ON public.assembly_models
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

ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL;

WITH source AS (
  SELECT
    manufacturer,
    left(regexp_replace(upper(manufacturer), '[^A-Z0-9]+', '_', 'g'), 18) || '-' || substring(md5(manufacturer), 1, 4) AS manufacturer_code
  FROM public.aircraft
  WHERE manufacturer IS NOT NULL AND btrim(manufacturer) <> ''
  GROUP BY manufacturer
),
deduped AS (
  SELECT DISTINCT ON (manufacturer_code)
    manufacturer,
    manufacturer_code
  FROM source
  ORDER BY manufacturer_code, manufacturer
),
inserted AS (
  INSERT INTO public.manufacturers (manufacturer_code, name, is_active, metadata)
  SELECT
    manufacturer_code,
    manufacturer,
    true,
    jsonb_build_object('source', 'aircraft_backfill')
  FROM deduped
  ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO UPDATE
  SET
    name = EXCLUDED.name,
    is_active = true,
    updated_at = now(),
    deleted_at = NULL
  RETURNING id, name
)
UPDATE public.aircraft AS aircraft
SET manufacturer_id = manufacturers.id
FROM public.manufacturers AS manufacturers
WHERE aircraft.manufacturer_id IS NULL
  AND lower(btrim(aircraft.manufacturer)) = lower(btrim(manufacturers.name));

CREATE INDEX IF NOT EXISTS idx_aircraft_manufacturer_id ON public.aircraft(manufacturer_id);

UPDATE public.manufacturers
SET tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
WHERE tenant_id IS NULL;
UPDATE public.assembly_types
SET tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
WHERE tenant_id IS NULL;
UPDATE public.assembly_models
SET tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
WHERE tenant_id IS NULL;

COMMIT;

-- ROLLBACK (manual):
-- BEGIN;
-- DROP TABLE IF EXISTS public.assembly_models;
-- DROP TABLE IF EXISTS public.assembly_types;
-- DROP TABLE IF EXISTS public.manufacturers;
-- CREATE TABLE IF NOT EXISTS public.manufacturers (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   manufacturer_code text NOT NULL,
--   name text NOT NULL,
--   country text,
--   is_active boolean NOT NULL DEFAULT true,
--   metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now(),
--   created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
--   updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
--   deleted_at timestamptz
-- );
-- CREATE TABLE IF NOT EXISTS public.assembly_types (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   assembly_code text NOT NULL,
--   name text NOT NULL,
--   description text NOT NULL,
--   is_active boolean NOT NULL DEFAULT true,
--   metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now(),
--   created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
--   updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
-- );
-- CREATE TABLE IF NOT EXISTS public.assembly_models (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   manufacturer_id uuid NOT NULL REFERENCES public.manufacturers(id) ON DELETE RESTRICT,
--   assembly_type_id uuid NOT NULL REFERENCES public.assembly_types(id) ON DELETE RESTRICT,
--   model_code text NOT NULL,
--   name text NOT NULL,
--   primary_model text,
--   description text,
--   is_active boolean NOT NULL DEFAULT true,
--   metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now(),
--   created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
--   updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
-- );
-- COMMIT;
