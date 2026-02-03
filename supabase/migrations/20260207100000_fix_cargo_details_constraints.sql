
BEGIN;

-- 1. Update service_type check constraint to allow 'shipment' and 'quote'
ALTER TABLE public.cargo_details DROP CONSTRAINT IF EXISTS cargo_details_service_type_check;

ALTER TABLE public.cargo_details
  ADD CONSTRAINT cargo_details_service_type_check
  CHECK (service_type IN ('ocean', 'ocean_freight', 'air', 'air_freight', 'trucking', 'inland_trucking', 'courier', 'moving', 'movers_packers', 'railway_transport', 'shipment', 'quote'));

-- 2. Drop Foreign Key to services table if it exists (since service_id is polymorphic)
ALTER TABLE public.cargo_details DROP CONSTRAINT IF EXISTS cargo_details_service_id_fkey;

COMMIT;
