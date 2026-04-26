-- ============================================================================
-- CRITICAL FIX: Add enterprise data columns to work_package_templates
-- ============================================================================
-- The Materials+, Tooling+, and Compliance+ data cannot be saved because
-- these columns don't exist in the main work_package_templates table.
-- They only exist in the amro_work_order_template_versions table.
-- 
-- RUN THIS SQL in your Supabase SQL Editor immediately!
-- ============================================================================

-- Check if columns exist before adding them
DO $$ 
BEGIN
    -- Add materials_json column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'work_package_templates' 
        AND column_name = 'materials_json'
    ) THEN
        ALTER TABLE work_package_templates
        ADD COLUMN materials_json JSONB NOT NULL DEFAULT '[]';
        RAISE NOTICE 'Added materials_json column to work_package_templates';
    ELSE
        RAISE NOTICE 'materials_json column already exists';
    END IF;

    -- Add tooling_json column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'work_package_templates' 
        AND column_name = 'tooling_json'
    ) THEN
        ALTER TABLE work_package_templates
        ADD COLUMN tooling_json JSONB NOT NULL DEFAULT '[]';
        RAISE NOTICE 'Added tooling_json column to work_package_templates';
    ELSE
        RAISE NOTICE 'tooling_json column already exists';
    END IF;

    -- Add compliance_requirements_json column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'work_package_templates' 
        AND column_name = 'compliance_requirements_json'
    ) THEN
        ALTER TABLE work_package_templates
        ADD COLUMN compliance_requirements_json JSONB NOT NULL DEFAULT '[]';
        RAISE NOTICE 'Added compliance_requirements_json column to work_package_templates';
    ELSE
        RAISE NOTICE 'compliance_requirements_json column already exists';
    END IF;
END $$;

-- Add CHECK constraints to ensure valid JSON arrays (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_work_package_templates_materials_json_is_array'
    ) THEN
        ALTER TABLE work_package_templates
        ADD CONSTRAINT chk_work_package_templates_materials_json_is_array
        CHECK (jsonb_typeof(materials_json) = 'array');
        RAISE NOTICE 'Added CHECK constraint for materials_json';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_work_package_templates_tooling_json_is_array'
    ) THEN
        ALTER TABLE work_package_templates
        ADD CONSTRAINT chk_work_package_templates_tooling_json_is_array
        CHECK (jsonb_typeof(tooling_json) = 'array');
        RAISE NOTICE 'Added CHECK constraint for tooling_json';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_work_package_templates_compliance_requirements_json_is_array'
    ) THEN
        ALTER TABLE work_package_templates
        ADD CONSTRAINT chk_work_package_templates_compliance_requirements_json_is_array
        CHECK (jsonb_typeof(compliance_requirements_json) = 'array');
        RAISE NOTICE 'Added CHECK constraint for compliance_requirements_json';
    END IF;
END $$;

-- Verify the columns now exist
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'work_package_templates'
  AND column_name IN ('materials_json', 'tooling_json', 'compliance_requirements_json')
ORDER BY column_name;

-- If the query above returns 3 rows, the fix is successful!
-- Expected output:
-- column_name              | data_type | column_default | is_nullable
-- -------------------------|-----------|----------------|-------------
-- compliance_requirements_json | jsonb   | '[]'::jsonb    | NO
-- materials_json            | jsonb     | '[]'::jsonb    | NO
-- tooling_json              | jsonb     | '[]'::jsonb    | NO
