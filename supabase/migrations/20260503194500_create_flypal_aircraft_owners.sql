-- DB-VERIFICATION: flypal-aircraft-owners-schema-overlap-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.aircraft_owners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  franchise_id uuid NULL,
  owner_code varchar(20) NOT NULL,
  owner_name varchar(255) NOT NULL,
  owner_type varchar(50) NOT NULL DEFAULT 'Corporate',
  contact_person varchar(100),
  contact_email varchar(255),
  phone_number varchar(20),
  address text,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT aircraft_owners_pkey PRIMARY KEY (id),
  CONSTRAINT aircraft_owners_owner_code_uk UNIQUE (owner_code),
  CONSTRAINT aircraft_owners_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants (id) ON DELETE CASCADE,
  CONSTRAINT aircraft_owners_franchise_id_fkey
    FOREIGN KEY (franchise_id) REFERENCES public.franchises (id) ON DELETE SET NULL,
  CONSTRAINT aircraft_owners_owner_code_ck
    CHECK (owner_code ~ '^[A-Z0-9_-]+$'),
  CONSTRAINT aircraft_owners_contact_email_ck
    CHECK (contact_email IS NULL OR contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_aircraft_owners_tenant_id
  ON public.aircraft_owners (tenant_id);

CREATE INDEX IF NOT EXISTS idx_aircraft_owners_franchise_id
  ON public.aircraft_owners (franchise_id);

-- UNIQUE(owner_code) already creates a btree index; this index is for case-insensitive lookups.
CREATE INDEX IF NOT EXISTS idx_aircraft_owners_owner_code_upper
  ON public.aircraft_owners (UPPER(owner_code));

COMMENT ON TABLE public.aircraft_owners IS
  'Master catalog of aircraft operator/owner entities for tenant-scoped AMRO and fleet workflows.';

COMMENT ON COLUMN public.aircraft_owners.owner_code IS
  'Stable external/business identifier for owner dropdowns and integrations; uppercase token expected.';

COMMENT ON COLUMN public.aircraft_owners.owner_name IS
  'Human-readable operator owner display name.';

COMMENT ON COLUMN public.aircraft_owners.tenant_id IS
  'Tenant isolation boundary for SaaS data segregation.';

DO $$
DECLARE
  v_tenant_id constant uuid := '157b8d12-c115-446e-a4dc-d12077751fe2';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants AS t
    WHERE t.id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant % not found in public.tenants. Seed tenant before applying public.aircraft_owners migration.', v_tenant_id;
  END IF;

  INSERT INTO public.aircraft_owners (
    tenant_id,
    franchise_id,
    owner_code,
    owner_name,
    owner_type
  )
  VALUES
    (v_tenant_id, NULL, 'DECCAN', 'Deccan Charters Pvt Ltd', 'Corporate'),
    (v_tenant_id, NULL, 'RELIANCE', 'Reliance Industries Ltd', 'Corporate'),
    (v_tenant_id, NULL, 'ESSAR', 'Essar Group', 'Corporate'),
    (v_tenant_id, NULL, 'GLOBAL_OPS_AIR', 'Global Ops Air', 'Corporate'),
    (v_tenant_id, NULL, 'LEASED_FLEET', 'Leased Fleet Holdings', 'Corporate')
  ON CONFLICT (owner_code) DO UPDATE
  SET
    tenant_id = EXCLUDED.tenant_id,
    franchise_id = EXCLUDED.franchise_id,
    owner_name = EXCLUDED.owner_name,
    owner_type = EXCLUDED.owner_type,
    updated_at = NOW();
END
$$;

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.aircraft_owners TO authenticated;
GRANT SELECT ON public.aircraft_owners TO anon;

-- Validation queries: execution output confirms migration success in deployment logs.
SELECT to_regclass('public.aircraft_owners') AS aircraft_owners_table;

SELECT COUNT(*) AS seeded_owner_count
FROM public.aircraft_owners
WHERE owner_code IN ('DECCAN', 'RELIANCE', 'ESSAR', 'GLOBAL_OPS_AIR', 'LEASED_FLEET');

SELECT owner_code, owner_name, owner_type, is_active
FROM public.aircraft_owners
WHERE owner_code IN ('DECCAN', 'RELIANCE', 'ESSAR', 'GLOBAL_OPS_AIR', 'LEASED_FLEET')
ORDER BY owner_code;

COMMIT;
