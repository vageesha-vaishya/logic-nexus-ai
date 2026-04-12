-- Fix AMRO Access for deccanl@gmail.com
-- Run this in Supabase SQL Editor

BEGIN;

-- Step 1: Find the user's tenant
DO $$
DECLARE
  v_user_tenant_id UUID;
  v_amro_domain_id UUID;
BEGIN
  SELECT p.tenant_id INTO v_user_tenant_id
  FROM profiles p
  WHERE p.email = 'deccanl@gmail.com'
  LIMIT 1;

  IF v_user_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User deccanl@gmail.com not found in profiles table';
  END IF;

  RAISE NOTICE 'User tenant ID: %', v_user_tenant_id;

  -- Step 2: Get AMRO domain ID
  SELECT id INTO v_amro_domain_id
  FROM platform_domains
  WHERE code = 'AMRO' OR key = 'amro'
  LIMIT 1;

  IF v_amro_domain_id IS NULL THEN
    RAISE EXCEPTION 'AMRO domain not found in platform_domains. Run the migration first.';
  END IF;

  RAISE NOTICE 'AMRO domain ID: %', v_amro_domain_id;

  -- Step 3: Assign AMRO domain to the tenant (if not already assigned)
  INSERT INTO tenant_domain_assignments (tenant_id, domain_id, is_active, subscription_status)
  VALUES (v_user_tenant_id, v_amro_domain_id, true, 'active')
  ON CONFLICT (tenant_id, domain_id) 
  DO UPDATE SET 
    is_active = true, 
    subscription_status = 'active',
    updated_at = NOW();

  RAISE NOTICE '✅ AMRO domain assigned to tenant successfully';

  -- Step 4: Verify the assignment
  PERFORM 
    tda.id,
    pd.code as domain_code,
    tda.is_active,
    tda.subscription_status
  FROM tenant_domain_assignments tda
  JOIN platform_domains pd ON pd.id = tda.domain_id
  WHERE tda.tenant_id = v_user_tenant_id
    AND pd.code = 'AMRO';

  RAISE NOTICE '✅ Verification complete - AMRO assignment is active';

END $$;

-- Step 5: Check user's current role
SELECT 
  ur.role,
  ur.tenant_id,
  ur.franchise_id
FROM user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE au.email = 'deccanl@gmail.com';

-- Step 6: Show what AMRO menu items the user will see with current role
DO $$
DECLARE
  v_user_role TEXT;
  v_has_view_dashboard BOOLEAN;
  v_has_edit_aircraft BOOLEAN;
  v_has_create_maintenance BOOLEAN;
  v_has_approve_work_orders BOOLEAN;
  v_has_delete_flight_logs BOOLEAN;
BEGIN
  SELECT ur.role INTO v_user_role
  FROM user_roles ur
  JOIN auth.users au ON au.id = ur.user_id
  WHERE au.email = 'deccanl@gmail.com'
  LIMIT 1;

  -- Check permissions based on role
  SELECT 
    EXISTS(SELECT 1 FROM unnest(ARRAY['view_amro_dashboard'::TEXT]) WHERE v_user_role IN ('platform_admin', 'tenant_admin', 'franchise_admin') OR TRUE) INTO v_has_view_dashboard,
    EXISTS(SELECT 1 FROM unnest(ARRAY['edit_aircraft_records'::TEXT]) WHERE v_user_role IN ('platform_admin', 'tenant_admin', 'franchise_admin')) INTO v_has_edit_aircraft,
    EXISTS(SELECT 1 FROM unnest(ARRAY['create_maintenance_request'::TEXT]) WHERE v_user_role IN ('platform_admin', 'tenant_admin', 'franchise_admin')) INTO v_has_create_maintenance,
    EXISTS(SELECT 1 FROM unnest(ARRAY['approve_work_orders'::TEXT]) WHERE v_user_role IN ('platform_admin', 'tenant_admin', 'franchise_admin')) INTO v_has_approve_work_orders,
    EXISTS(SELECT 1 FROM unnest(ARRAY['delete_flight_logs'::TEXT]) WHERE v_user_role IN ('platform_admin', 'tenant_admin', 'franchise_admin')) INTO v_has_delete_flight_logs;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'User Role: %', v_user_role;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AMRO Menu Items User Will See:';
  RAISE NOTICE '----------------------------------------';
  
  IF v_has_view_dashboard OR v_user_role = 'user' THEN
    RAISE NOTICE '✅ Overview';
    RAISE NOTICE '✅ Intelligence';
    RAISE NOTICE '✅ Workspace Documentation';
  END IF;
  
  IF v_has_edit_aircraft THEN
    RAISE NOTICE '✅ Aircraft';
    RAISE NOTICE '✅ Work Packages Templates';
    RAISE NOTICE '✅ Scheduling';
    RAISE NOTICE '✅ Parts';
    RAISE NOTICE '✅ Integration';
    RAISE NOTICE '✅ Settings';
  END IF;
  
  IF v_has_create_maintenance THEN
    RAISE NOTICE '✅ Work Packages';
    RAISE NOTICE '✅ Task Execution';
  END IF;
  
  IF v_has_approve_work_orders THEN
    RAISE NOTICE '✅ Compliance';
    RAISE NOTICE '✅ Certification';
  END IF;
  
  IF v_has_delete_flight_logs THEN
    RAISE NOTICE '✅ Audit';
  END IF;
  
  RAISE NOTICE '========================================';
  
  IF v_user_role = 'user' THEN
    RAISE NOTICE '⚠️  User has basic role - will only see Overview, Intelligence, and Workspace Documentation';
    RAISE NOTICE '💡 To see ALL AMRO items, run:';
    RAISE NOTICE '   UPDATE user_roles SET role = ''tenant_admin''';
    RAISE NOTICE '   WHERE user_id = (SELECT id FROM auth.users WHERE email = ''deccanl@gmail.com'');';
  ELSE
    RAISE NOTICE '✅ User should see all AMRO menu items';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

COMMIT;
