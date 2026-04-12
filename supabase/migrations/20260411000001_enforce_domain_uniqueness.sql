-- Migration: Enforce Uniqueness Constraints for Platform Domains and Tenant Assignments
-- Purpose: Prevent duplicate domain entries and tenant-domain assignments at database level
-- Date: 2026-04-11

BEGIN;

-----------------------------------------------------------------------------
-- 1. Platform Domains - Core Field Uniqueness
-----------------------------------------------------------------------------

-- Ensure 'code' is unique (in addition to existing 'key' unique constraint)
-- This prevents duplicate domain codes which are core identifiers
DO $$
BEGIN
  -- First, handle any existing duplicates by appending a suffix
  WITH duplicates AS (
    SELECT id, code,
           ROW_NUMBER() OVER (PARTITION BY code ORDER BY created_at) as rn
    FROM platform_domains
    WHERE code IS NOT NULL
  )
  UPDATE platform_domains pd
  SET code = d.code || '_DUPLICATE_' || d.rn
  FROM duplicates d
  WHERE pd.id = d.id 
    AND d.rn > 1
    AND pd.code = d.code;

  -- Now add the unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'platform_domains_code_unique'
      AND table_name = 'platform_domains'
  ) THEN
    ALTER TABLE platform_domains 
    ADD CONSTRAINT platform_domains_code_unique UNIQUE (code);
    
    RAISE NOTICE '✅ Added UNIQUE constraint on platform_domains.code';
  ELSE
    RAISE NOTICE 'ℹ️  UNIQUE constraint on platform_domains.code already exists';
  END IF;
END $$;

-- Ensure 'name' is also unique to prevent duplicate domain names
DO $$
BEGIN
  -- Handle existing duplicates
  WITH duplicates AS (
    SELECT id, name,
           ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at) as rn
    FROM platform_domains
  )
  UPDATE platform_domains pd
  SET name = d.name || ' (Duplicate ' || d.rn || ')'
  FROM duplicates d
  WHERE pd.id = d.id 
    AND d.rn > 1
    AND pd.name = d.name;

  -- Add the unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'platform_domains_name_unique'
      AND table_name = 'platform_domains'
  ) THEN
    ALTER TABLE platform_domains 
    ADD CONSTRAINT platform_domains_name_unique UNIQUE (name);
    
    RAISE NOTICE '✅ Added UNIQUE constraint on platform_domains.name';
  ELSE
    RAISE NOTICE 'ℹ️  UNIQUE constraint on platform_domains.name already exists';
  END IF;
END $$;

-- Add check constraints to ensure core fields are not empty
ALTER TABLE platform_domains
  ADD CONSTRAINT platform_domains_code_not_empty
  CHECK (code IS NULL OR trim(code) <> '');

ALTER TABLE platform_domains
  ADD CONSTRAINT platform_domains_name_not_empty
  CHECK (trim(name) <> '');

DO $$
BEGIN
  RAISE NOTICE '✅ Added check constraints for non-empty code and name';
END $$;

-----------------------------------------------------------------------------
-- 2. Tenant Domain Assignments - Already Has UNIQUE Constraint
-----------------------------------------------------------------------------

-- The table already has: UNIQUE (tenant_id, domain_id)
-- This prevents a tenant from having duplicate domain assignments
-- Just verify it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tenant_domain_assignments_tenant_id_domain_id_key'
      AND table_name = 'tenant_domain_assignments'
  ) THEN
    RAISE NOTICE '✅ UNIQUE constraint on tenant_domain_assignments(tenant_id, domain_id) verified';
  ELSE
    RAISE WARNING '⚠️  UNIQUE constraint on tenant_domain_assignments(tenant_id, domain_id) is MISSING!';
    RAISE NOTICE 'Adding UNIQUE constraint now...';
    
    -- Handle any existing duplicates before adding constraint
    WITH duplicates AS (
      SELECT id, tenant_id, domain_id,
             ROW_NUMBER() OVER (PARTITION BY tenant_id, domain_id ORDER BY created_at) as rn
      FROM tenant_domain_assignments
    )
    DELETE FROM tenant_domain_assignments tda
    USING duplicates d
    WHERE tda.id = d.id AND d.rn > 1;
    
    ALTER TABLE tenant_domain_assignments
      ADD CONSTRAINT tenant_domain_assignments_tenant_id_domain_id_key 
      UNIQUE (tenant_id, domain_id);
      
    RAISE NOTICE '✅ Added UNIQUE constraint on tenant_domain_assignments(tenant_id, domain_id)';
  END IF;
END $$;

-----------------------------------------------------------------------------
-- 3. Add Trigger to Prevent Duplicate Insertions with Better Error Messages
-----------------------------------------------------------------------------

-- Function to provide better error messages for constraint violations
CREATE OR REPLACE FUNCTION public.check_domain_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for duplicate code
  IF NEW.code IS NOT NULL AND trim(NEW.code) <> '' THEN
    IF EXISTS (
      SELECT 1 FROM platform_domains 
      WHERE UPPER(trim(code)) = UPPER(trim(NEW.code))
        AND id != COALESCE(NEW.id, '')
    ) THEN
      RAISE EXCEPTION 'Domain with code "%" already exists. Please use a unique code.', NEW.code
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- Check for duplicate name
  IF EXISTS (
    SELECT 1 FROM platform_domains 
    WHERE UPPER(trim(name)) = UPPER(trim(NEW.name))
      AND id != COALESCE(NEW.id, '')
  ) THEN
    RAISE EXCEPTION 'Domain with name "%" already exists. Please use a unique name.', NEW.name
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_check_domain_uniqueness ON platform_domains;

-- Create trigger for INSERT operations
CREATE TRIGGER trg_check_domain_uniqueness
  BEFORE INSERT OR UPDATE ON platform_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.check_domain_uniqueness();

DO $$
BEGIN
  RAISE NOTICE '✅ Added uniqueness validation trigger';
END $$;

-----------------------------------------------------------------------------
-- 4. Verification
-----------------------------------------------------------------------------

DO $$
DECLARE
  v_domain_count INTEGER;
  v_assignment_count INTEGER;
  v_code_unique_exists BOOLEAN;
  v_name_unique_exists BOOLEAN;
  v_tenant_domain_unique_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_domain_count FROM platform_domains;
  SELECT COUNT(*) INTO v_assignment_count FROM tenant_domain_assignments;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'platform_domains_code_unique'
  ) INTO v_code_unique_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'platform_domains_name_unique'
  ) INTO v_name_unique_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tenant_domain_assignments_tenant_id_domain_id_key'
  ) INTO v_tenant_domain_unique_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Platform Domains Uniqueness Verification';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total platform domains: %', v_domain_count;
  RAISE NOTICE 'Total tenant assignments: %', v_assignment_count;
  RAISE NOTICE 'UNIQUE constraint on code: %', CASE WHEN v_code_unique_exists THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE 'UNIQUE constraint on name: %', CASE WHEN v_name_unique_exists THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE 'UNIQUE constraint on tenant_domain_assignments: %', CASE WHEN v_tenant_domain_unique_exists THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '========================================';

  IF NOT (v_code_unique_exists AND v_name_unique_exists AND v_tenant_domain_unique_exists) THEN
    RAISE EXCEPTION 'Some uniqueness constraints are still missing! Check the warnings above.';
  END IF;
END $$;

COMMIT;
