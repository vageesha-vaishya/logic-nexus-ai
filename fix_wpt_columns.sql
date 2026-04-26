-- ============================================================================
-- CRITICAL FIX: Add enterprise data columns to work_order_templates
-- ============================================================================
-- The Materials+, Tooling+, and Compliance+ data must exist on the physical
-- work-order template table used by runtime APIs.
-- NOTE: work_package_templates may be an updatable compatibility VIEW, so
-- ALTER TABLE operations must target public.work_order_templates directly.
-- ============================================================================

-- Add missing enterprise JSON columns on the physical table.
DO $$
BEGIN
    IF to_regclass('public.work_order_templates') IS NULL THEN
        RAISE EXCEPTION 'public.work_order_templates does not exist';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'work_order_templates'
          AND column_name = 'materials_json'
    ) THEN
        ALTER TABLE public.work_order_templates
        ADD COLUMN materials_json JSONB NOT NULL DEFAULT '[]';
        RAISE NOTICE 'Added materials_json column to public.work_order_templates';
    ELSE
        RAISE NOTICE 'materials_json column already exists on public.work_order_templates';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'work_order_templates'
          AND column_name = 'tooling_json'
    ) THEN
        ALTER TABLE public.work_order_templates
        ADD COLUMN tooling_json JSONB NOT NULL DEFAULT '[]';
        RAISE NOTICE 'Added tooling_json column to public.work_order_templates';
    ELSE
        RAISE NOTICE 'tooling_json column already exists on public.work_order_templates';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'work_order_templates'
          AND column_name = 'compliance_requirements_json'
    ) THEN
        ALTER TABLE public.work_order_templates
        ADD COLUMN compliance_requirements_json JSONB NOT NULL DEFAULT '[]';
        RAISE NOTICE 'Added compliance_requirements_json column to public.work_order_templates';
    ELSE
        RAISE NOTICE 'compliance_requirements_json column already exists on public.work_order_templates';
    END IF;
END $$;

-- Normalize/ensure CHECK constraints for valid JSON arrays.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_work_package_templates_materials_json_is_array'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_work_order_templates_materials_json_is_array'
    ) THEN
        ALTER TABLE public.work_order_templates
        RENAME CONSTRAINT chk_work_package_templates_materials_json_is_array
        TO chk_work_order_templates_materials_json_is_array;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_work_order_templates_materials_json_is_array'
    ) THEN
        ALTER TABLE public.work_order_templates
        ADD CONSTRAINT chk_work_order_templates_materials_json_is_array
        CHECK (jsonb_typeof(materials_json) = 'array');
        RAISE NOTICE 'Added CHECK constraint for materials_json';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_work_package_templates_tooling_json_is_array'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_work_order_templates_tooling_json_is_array'
    ) THEN
        ALTER TABLE public.work_order_templates
        RENAME CONSTRAINT chk_work_package_templates_tooling_json_is_array
        TO chk_work_order_templates_tooling_json_is_array;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_work_order_templates_tooling_json_is_array'
    ) THEN
        ALTER TABLE public.work_order_templates
        ADD CONSTRAINT chk_work_order_templates_tooling_json_is_array
        CHECK (jsonb_typeof(tooling_json) = 'array');
        RAISE NOTICE 'Added CHECK constraint for tooling_json';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_work_package_templates_compliance_requirements_json_is_array'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_work_order_templates_compliance_requirements_json_is_array'
    ) THEN
        ALTER TABLE public.work_order_templates
        RENAME CONSTRAINT chk_work_package_templates_compliance_requirements_json_is_array
        TO chk_work_order_templates_compliance_requirements_json_is_array;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_work_order_templates_compliance_requirements_json_is_array'
    ) THEN
        ALTER TABLE public.work_order_templates
        ADD CONSTRAINT chk_work_order_templates_compliance_requirements_json_is_array
        CHECK (jsonb_typeof(compliance_requirements_json) = 'array');
        RAISE NOTICE 'Added CHECK constraint for compliance_requirements_json';
    END IF;
END $$;

-- Verify the columns now exist on the canonical table.
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'work_order_templates'
  AND column_name IN ('materials_json', 'tooling_json', 'compliance_requirements_json')
ORDER BY column_name;

-- If the query above returns 3 rows, the fix is successful.
