-- Expand service_types table to be unbounded
-- Remove any length constraints and make it more flexible

-- Drop existing constraints if any
ALTER TABLE service_types 
  ALTER COLUMN name TYPE text,
  ALTER COLUMN description TYPE text;

-- Ensure the table is ready for any type of service type data
-- Add index for better performance on name lookups
CREATE INDEX IF NOT EXISTS idx_service_types_name ON service_types(name);
CREATE INDEX IF NOT EXISTS idx_service_types_active ON service_types(is_active) WHERE is_active = true;

-- Add a comment to document the unbounded nature
COMMENT ON TABLE service_types IS 'Unbounded service types table - accepts any service type without restrictions';