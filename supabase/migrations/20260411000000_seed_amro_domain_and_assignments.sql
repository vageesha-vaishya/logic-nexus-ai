-- Migration: Seed AMRO Domain and Assign Existing Tenants
-- Purpose: Fix "Failed to load work orders" by ensuring AMRO domain exists
--          and tenants have proper domain assignments
-- Date: 2026-04-11

BEGIN;

-----------------------------------------------------------------------------
-- 1. Seed AMRO Domain in platform_domains
-----------------------------------------------------------------------------

INSERT INTO public.platform_domains (key, code, name, description, owner, status, is_active)
VALUES (
  'amro',
  'AMRO',
  'Aircraft Maintenance & Repair Operations',
  'Aviation maintenance, repair, and overhaul management system',
  'Platform Admin',
  'active',
  true
)
ON CONFLICT (key) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-----------------------------------------------------------------------------
-- 2. Assign All Active Tenants to AMRO Domain
-----------------------------------------------------------------------------

-- Get the AMRO domain ID
DO $$
DECLARE
  v_amro_domain_id UUID;
  v_tenant RECORD;
BEGIN
  SELECT id INTO v_amro_domain_id
  FROM public.platform_domains
  WHERE code = 'AMRO' OR key = 'amro'
  LIMIT 1;

  IF v_amro_domain_id IS NULL THEN
    RAISE EXCEPTION 'AMRO domain not found in platform_domains after seeding';
  END IF;

  -- Assign all active tenants that don't already have AMRO assignment
  FOR v_tenant IN
    SELECT t.id as tenant_id
    FROM public.tenants t
    WHERE t.is_active = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.tenant_domain_assignments tda
        WHERE tda.tenant_id = t.id
          AND tda.domain_id = v_amro_domain_id
          AND tda.is_active = true
      )
  LOOP
    INSERT INTO public.tenant_domain_assignments (
      tenant_id,
      domain_id,
      is_active,
      subscription_status,
      grace_until,
      created_at,
      updated_at
    ) VALUES (
      v_tenant.tenant_id,
      v_amro_domain_id,
      true,
      'active',
      NULL,
      NOW(),
      NOW()
    )
    ON CONFLICT (tenant_id, domain_id) DO UPDATE SET
      is_active = EXCLUDED.is_active,
      subscription_status = EXCLUDED.subscription_status,
      updated_at = NOW();
  END LOOP;
END $$;

-----------------------------------------------------------------------------
-- 3. Verify Seeding
-----------------------------------------------------------------------------

DO $$
DECLARE
  v_amro_count INTEGER;
  v_assignment_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_amro_count
  FROM public.platform_domains
  WHERE code = 'AMRO' AND is_active = true;

  SELECT COUNT(*) INTO v_assignment_count
  FROM public.tenant_domain_assignments tda
  JOIN public.platform_domains pd ON pd.id = tda.domain_id
  WHERE (pd.code = 'AMRO' OR pd.key = 'amro')
    AND tda.is_active = true;

  RAISE NOTICE 'AMRO domain exists: %', v_amro_count > 0;
  RAISE NOTICE 'Active AMRO tenant assignments: %', v_assignment_count;

  IF v_amro_count = 0 THEN
    RAISE EXCEPTION 'AMRO domain seeding failed';
  END IF;
END $$;

COMMIT;
