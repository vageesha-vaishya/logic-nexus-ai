-- Relax service_type constraints to allow broader set from service_types table
BEGIN;

-- Drop hard-coded CHECK constraint on services.service_type
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_service_type_check;

-- Drop hard-coded CHECK constraint on service_type_mappings.service_type
ALTER TABLE public.service_type_mappings DROP CONSTRAINT IF EXISTS service_type_mappings_type_check;

COMMIT;