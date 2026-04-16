-- Add enterprise data columns to work_package_templates
-- These columns store Materials+, Tooling+, and Compliance+ data

-- Add materials_json column (Bill of Materials)
ALTER TABLE work_package_templates
ADD COLUMN IF NOT EXISTS materials_json JSONB NOT NULL DEFAULT '[]';

-- Add tooling_json column (Tooling & Equipment)
ALTER TABLE work_package_templates
ADD COLUMN IF NOT EXISTS tooling_json JSONB NOT NULL DEFAULT '[]';

-- Add compliance_requirements_json column (Regulatory Requirements)
ALTER TABLE work_package_templates
ADD COLUMN IF NOT EXISTS compliance_requirements_json JSONB NOT NULL DEFAULT '[]';

-- Add comments for documentation
COMMENT ON COLUMN work_package_templates.materials_json IS 'Bill of Materials - Array of material line items with part numbers, quantities, costs, and supplier info';
COMMENT ON COLUMN work_package_templates.tooling_json IS 'Tooling & Equipment - Array of required tools with calibration and availability data';
COMMENT ON COLUMN work_package_templates.compliance_requirements_json IS 'Compliance Requirements - Array of AD/SB and regulatory requirements with sign-off tracking';

-- Add CHECK constraints to ensure valid JSON arrays (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_work_package_templates_materials_json_is_array'
      AND conrelid = 'public.work_package_templates'::regclass
  ) THEN
    ALTER TABLE work_package_templates
      ADD CONSTRAINT chk_work_package_templates_materials_json_is_array
      CHECK (jsonb_typeof(materials_json) = 'array');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_work_package_templates_tooling_json_is_array'
      AND conrelid = 'public.work_package_templates'::regclass
  ) THEN
    ALTER TABLE work_package_templates
      ADD CONSTRAINT chk_work_package_templates_tooling_json_is_array
      CHECK (jsonb_typeof(tooling_json) = 'array');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_work_package_templates_compliance_requirements_json_is_array'
      AND conrelid = 'public.work_package_templates'::regclass
  ) THEN
    ALTER TABLE work_package_templates
      ADD CONSTRAINT chk_work_package_templates_compliance_requirements_json_is_array
      CHECK (jsonb_typeof(compliance_requirements_json) = 'array');
  END IF;
END
$$;

-- Create indexes for JSON querying (optional but recommended for future analytics)
CREATE INDEX IF NOT EXISTS idx_work_package_templates_materials_count
ON work_package_templates USING btree (jsonb_array_length(materials_json));

CREATE INDEX IF NOT EXISTS idx_work_package_templates_tooling_count
ON work_package_templates USING btree (jsonb_array_length(tooling_json));

CREATE INDEX IF NOT EXISTS idx_work_package_templates_compliance_count
ON work_package_templates USING btree (jsonb_array_length(compliance_requirements_json));
