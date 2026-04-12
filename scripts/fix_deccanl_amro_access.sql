-- Fix: Assign deccanl@gmail.com to Deccan tenant and AMRO domain
-- Purpose: User has tenant_id=NULL which prevents AMRO module from appearing
-- Date: 2026-04-11

BEGIN;

DO $$
DECLARE
  v_user_id UUID := 'fec985aa-a07c-41c2-9e6e-d6db2605d146';
  v_tenant_id UUID;
  v_amro_domain_id UUID;
BEGIN
  -- Step 1: Find the "Deccan" tenant (main Deccan tenant)
  SELECT id INTO v_tenant_id
  FROM tenants
  WHERE name = 'Deccan'
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Deccan tenant not found!';
  END IF;

  RAISE NOTICE 'Deccan tenant ID: %', v_tenant_id;

  -- Step 2: Update user's profile to assign them to Deccan tenant
  UPDATE profiles
  SET tenant_id = v_tenant_id
  WHERE id = v_user_id AND tenant_id IS NULL;

  IF FOUND THEN
    RAISE NOTICE '✅ Assigned deccanl@gmail.com to Deccan tenant';
  ELSE
    RAISE NOTICE 'ℹ️  User already has a tenant assignment';
  END IF;

  -- Step 3: Find the AMRO domain
  SELECT id INTO v_amro_domain_id
  FROM platform_domains
  WHERE code = 'AMRO' AND key = 'amro'
  LIMIT 1;

  IF v_amro_domain_id IS NULL THEN
    RAISE EXCEPTION 'AMRO domain not found! Run the AMRO seeding migration first.';
  END IF;

  RAISE NOTICE 'AMRO domain ID: %', v_amro_domain_id;

  -- Step 4: Assign AMRO domain to Deccan tenant (if not already assigned)
  INSERT INTO tenant_domain_assignments (tenant_id, domain_id, is_active, subscription_status)
  VALUES (v_tenant_id, v_amro_domain_id, true, 'active')
  ON CONFLICT (tenant_id, domain_id) DO UPDATE SET
    is_active = true,
    subscription_status = 'active',
    updated_at = NOW();

  RAISE NOTICE '✅ Assigned AMRO domain to Deccan tenant';

  -- Step 5: Verify the assignment
  DECLARE
    v_user_tenant UUID;
    v_amro_assigned BOOLEAN;
  BEGIN
    -- Verify user has tenant
    SELECT tenant_id INTO v_user_tenant
    FROM profiles
    WHERE id = v_user_id;

    IF v_user_tenant IS NULL THEN
      RAISE EXCEPTION 'Failed to assign tenant to user!';
    END IF;

    -- Verify AMRO is assigned to tenant
    SELECT EXISTS (
      SELECT 1 FROM tenant_domain_assignments tda
      WHERE tda.tenant_id = v_tenant_id
        AND tda.domain_id = v_amro_domain_id
        AND tda.is_active = true
    ) INTO v_amro_assigned;

    IF NOT v_amro_assigned THEN
      RAISE EXCEPTION 'Failed to assign AMRO domain to tenant!';
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Fix Verification';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'User email: deccanl@gmail.com';
    RAISE NOTICE 'User tenant: %', v_user_tenant;
    RAISE NOTICE 'AMRO assigned to tenant: %', CASE WHEN v_amro_assigned THEN '✅ YES' ELSE '❌ NO' END;
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ deccanl@gmail.com should now see AMRO module!';
    RAISE NOTICE '💡 User needs to LOG OUT and LOG IN again to refresh session';
    RAISE NOTICE '========================================';
  END;

END $$;

COMMIT;
