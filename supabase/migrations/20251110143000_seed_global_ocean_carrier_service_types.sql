-- Seed carrier_service_types for globally seeded ocean carriers
-- Ensures Service Provider list populates for Ocean Freight even without explicit mappings
BEGIN;

-- Create mappings for global carriers (tenant_id IS NULL) with carrier_type or mode indicating ocean
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, is_primary, is_active)
SELECT NULL AS tenant_id,
       c.id AS carrier_id,
       'ocean' AS service_type,
       true AS is_primary,
       true AS is_active
FROM public.carriers c
WHERE c.tenant_id IS NULL
  AND (
    lower(coalesce(c.mode::text, '')) = 'ocean'
    OR lower(coalesce(c.carrier_type, '')) = 'ocean'
  )
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

COMMIT;