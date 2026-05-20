-- Migration: Assign MARKETS Domain to All Active Tenants
-- Purpose: The MARKETS row in platform_domains was seeded earlier
--          (id d127c2d9-91f0-4b71-bc44-3697efec92e8, key='markets') but
--          tenant assignments were never created. As a result, the sidebar
--          gate `hasMarketsDomain` (CommandCenterNav.tsx:184-187) only
--          passes for platform admins via the isPlatformAdmin short-circuit;
--          regular tenant users do not see the Markets section because
--          their tenant has no entry in tenant_domain_assignments.
-- Approach: UPDATE-only — does NOT touch the existing platform_domains row
--          (avoids the check_domain_uniqueness() trigger). Loops active
--          tenants and inserts any missing tenant_domain_assignments rows.
--          Idempotent via ON CONFLICT.
-- Date: 2026-05-20
-- Related: src/components/navigation/CommandCenterNav.tsx:184-187

BEGIN;

DO $$
DECLARE
  v_markets_domain_id UUID;
  v_tenant RECORD;
  v_inserted INT := 0;
BEGIN
  SELECT id INTO v_markets_domain_id
  FROM public.platform_domains
  WHERE key = 'markets' OR UPPER(trim(code)) = 'MARKETS'
  LIMIT 1;

  IF v_markets_domain_id IS NULL THEN
    RAISE EXCEPTION 'MARKETS domain not found in platform_domains. '
      'Seed the domain row first (key=markets) before running this migration.';
  END IF;

  FOR v_tenant IN
    SELECT t.id AS tenant_id
    FROM public.tenants t
    WHERE t.is_active = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.tenant_domain_assignments tda
        WHERE tda.tenant_id = t.id
          AND tda.domain_id = v_markets_domain_id
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
      v_markets_domain_id,
      true,
      'active',
      NULL,
      NOW(),
      NOW()
    )
    ON CONFLICT (tenant_id, domain_id) DO UPDATE SET
      is_active = true,
      subscription_status = 'active',
      updated_at = NOW();
    v_inserted := v_inserted + 1;
  END LOOP;

  RAISE NOTICE 'Added/updated MARKETS assignments for % tenants', v_inserted;
END $$;

-- Verify
DO $$
DECLARE
  v_total_active_tenants INT;
  v_markets_assigned INT;
BEGIN
  SELECT COUNT(*) INTO v_total_active_tenants
  FROM public.tenants WHERE is_active = true;

  SELECT COUNT(*) INTO v_markets_assigned
  FROM public.tenant_domain_assignments tda
  JOIN public.platform_domains pd ON pd.id = tda.domain_id
  WHERE (pd.key = 'markets' OR UPPER(trim(pd.code)) = 'MARKETS')
    AND tda.is_active = true;

  RAISE NOTICE 'Active tenants: % | MARKETS assignments: %',
    v_total_active_tenants, v_markets_assigned;

  IF v_markets_assigned < v_total_active_tenants THEN
    RAISE WARNING 'Some active tenants still missing MARKETS assignment';
  END IF;
END $$;

COMMIT;
