-- Align allowed service_type values in services with mappings and service_types
BEGIN;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_service_type_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_service_type_check
  CHECK (service_type IN ('ocean','air','trucking','courier','moving','railway_transport'));

COMMIT;