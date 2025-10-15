-- Add code field to service_types table
ALTER TABLE public.service_types 
ADD COLUMN IF NOT EXISTS code text;

-- Create unique index on code field
CREATE UNIQUE INDEX IF NOT EXISTS service_types_code_unique 
ON public.service_types (code);

-- Populate code field with existing name values (lowercase)
UPDATE public.service_types 
SET code = LOWER(name) 
WHERE code IS NULL;

-- Make code field NOT NULL after populating
ALTER TABLE public.service_types 
ALTER COLUMN code SET NOT NULL;

-- Add comment
COMMENT ON COLUMN public.service_types.code IS 'Unique code identifier for service type (e.g., ocean, air, trucking)';