-- Migration: Consolidate Duplicate AMRO Domains
-- Purpose: Remove duplicate AMRO domain entry and consolidate all references to the canonical one
-- Date: 2026-04-11
-- 
-- Background:
-- - Old AMRO domain (8ee000a3): code='amro' (lowercase), key=NULL, outdated name
-- - New AMRO domain (2e65da7b): code='AMRO' (uppercase), key='amro', canonical name
-- - Application code uses code='AMRO' for lookups
-- - This migration reassigns all references from old to new domain and deletes the old one

BEGIN;

DO $$
DECLARE
  v_old_domain_id UUID := '8ee000a3-93a6-4bbc-9914-5382bba02cbd';
  v_new_domain_id UUID;
  v_affected_tenants INTEGER := 0;
  v_affected_users INTEGER := 0;
  v_affected_workpackages INTEGER := 0;
BEGIN
  -- Find the new/canonical AMRO domain
  SELECT id INTO v_new_domain_id
  FROM platform_domains
  WHERE code = 'AMRO' AND key = 'amro'
  LIMIT 1;

  IF v_new_domain_id IS NULL THEN
    RAISE EXCEPTION 'Canonical AMRO domain (code=AMRO, key=amro) not found!';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'AMRO Domain Consolidation';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Old AMRO domain ID: %', v_old_domain_id;
  RAISE NOTICE 'New AMRO domain ID: %', v_new_domain_id;

  -- Step 1: Reassign tenant_domain_assignments from old to new domain
  -- Use INSERT ... ON CONFLICT DO NOTHING to avoid duplicate assignments
  WITH reassigned_tenants AS (
    SELECT tenant_id
    FROM tenant_domain_assignments
    WHERE domain_id = v_old_domain_id
  )
  INSERT INTO tenant_domain_assignments (tenant_id, domain_id, is_active, subscription_status)
  SELECT 
    tda.tenant_id,
    v_new_domain_id,
    tda.is_active,
    COALESCE(tda.subscription_status, 'active')
  FROM tenant_domain_assignments tda
  WHERE tda.domain_id = v_old_domain_id
  ON CONFLICT (tenant_id, domain_id) DO UPDATE SET
    is_active = EXCLUDED.is_active,
    subscription_status = EXCLUDED.subscription_status,
    updated_at = NOW();

  GET DIAGNOSTICS v_affected_tenants = ROW_COUNT;
  RAISE NOTICE '✅ Reassigned % tenant assignments from old to new AMRO domain', v_affected_tenants;

  -- Step 2: Delete old tenant assignments pointing to old domain
  DELETE FROM tenant_domain_assignments
  WHERE domain_id = v_old_domain_id;

  RAISE NOTICE '✅ Deleted old tenant domain assignments';

  -- Step 3: Reassign user_domain_assignments if any exist
  UPDATE user_domain_assignments
  SET domain_id = v_new_domain_id
  WHERE domain_id = v_old_domain_id;

  GET DIAGNOSTICS v_affected_users = ROW_COUNT;
  IF v_affected_users > 0 THEN
    RAISE NOTICE '✅ Reassigned % user domain assignments', v_affected_users;
  END IF;

  -- Step 4: Reassign tenants.domain_id if any tenants reference the old domain
  UPDATE tenants
  SET domain_id = v_new_domain_id
  WHERE domain_id = v_old_domain_id;

  GET DIAGNOSTICS v_affected_tenants = ROW_COUNT;
  IF v_affected_tenants > 0 THEN
    RAISE NOTICE '✅ Reassigned % tenants from old to new AMRO domain', v_affected_tenants;
  END IF;

  -- Step 5: Check if there are any other tables referencing platform_domains
  -- (e.g., amro_work_packages, amro_aircraft, etc. might have domain_id references)
  -- For safety, we'll check common AMRO tables

  -- Update amro_work_packages if they have domain_id references
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'amro_work_packages' AND column_name = 'domain_id'
  ) THEN
    UPDATE amro_work_packages
    SET domain_id = v_new_domain_id
    WHERE domain_id = v_old_domain_id;
    
    GET DIAGNOSTICS v_affected_workpackages = ROW_COUNT;
    IF v_affected_workpackages > 0 THEN
      RAISE NOTICE '✅ Reassigned % work packages', v_affected_workpackages;
    END IF;
  END IF;

  -- Update amro_aircraft if they have domain_id references
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'amro_aircraft' AND column_name = 'domain_id'
  ) THEN
    UPDATE amro_aircraft
    SET domain_id = v_new_domain_id
    WHERE domain_id = v_old_domain_id;
    
    RAISE NOTICE '✅ Reassigned aircraft records';
  END IF;

  -- Step 6: Delete the old AMRO domain
  DELETE FROM platform_domains
  WHERE id = v_old_domain_id;

  RAISE NOTICE '✅ Deleted old AMRO domain from platform_domains';

  -- Step 7: Verify consolidation
  PERFORM id FROM platform_domains WHERE id = v_old_domain_id;
  IF FOUND THEN
    RAISE EXCEPTION 'Failed to delete old AMRO domain!';
  END IF;

  PERFORM id FROM tenant_domain_assignments WHERE domain_id = v_old_domain_id;
  IF FOUND THEN
    RAISE EXCEPTION 'Old tenant assignments still exist!';
  END IF;

  -- Final verification
  DECLARE
    v_new_count INTEGER;
    v_old_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_new_count 
    FROM tenant_domain_assignments 
    WHERE domain_id = v_new_domain_id;
    
    SELECT COUNT(*) INTO v_old_count 
    FROM tenant_domain_assignments 
    WHERE domain_id = v_old_domain_id;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Consolidation Summary';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tenant assignments migrated: %', v_affected_tenants;
    RAISE NOTICE 'User assignments migrated: %', v_affected_users;
    RAISE NOTICE 'Work packages migrated: %', v_affected_workpackages;
    RAISE NOTICE 'New AMRO domain assignments: %', v_new_count;
    RAISE NOTICE 'Old AMRO domain assignments: %', v_old_count;
    RAISE NOTICE 'Old domain deleted: ✅ YES';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ AMRO domain consolidation complete!';
    RAISE NOTICE '========================================';
  END;

END $$;

COMMIT;
