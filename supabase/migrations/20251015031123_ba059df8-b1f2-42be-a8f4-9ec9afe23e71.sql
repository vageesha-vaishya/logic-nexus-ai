-- Add code field to service_types table
ALTER TABLE service_types ADD COLUMN IF NOT EXISTS code TEXT;

-- Create unique index on code
CREATE UNIQUE INDEX IF NOT EXISTS service_types_code_unique 
ON service_types(code) 
WHERE code IS NOT NULL;

-- Populate code field based on name (convert to lowercase with underscores)
UPDATE service_types 
SET code = LOWER(REPLACE(name, ' ', '_'))
WHERE code IS NULL;