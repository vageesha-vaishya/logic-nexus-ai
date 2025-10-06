-- Seed sample services per tenant for Ocean, Air, Trucking, Courier, Railways, Movers & Packers
-- Also extend the services.service_type CHECK constraint to include railway_transport
BEGIN;

-- Ensure CHECK constraint allows railway_transport
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_service_type_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_service_type_check
  CHECK (service_type IN ('ocean', 'air', 'trucking', 'courier', 'moving', 'railway_transport'));

-- Helper CTE of tenants
WITH tenants AS (
  SELECT id FROM public.tenants
)

-- Ocean Freight - Standard
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.id, 'OCEAN_STD', 'Ocean Freight - Standard', 'ocean',
       'FCL/LCL general ocean freight service', 1200, 'per container', 25,
       true, '{"container":"20ft","incoterms":["FOB","CIF","EXW"]}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.id AND s.service_code = 'OCEAN_STD'
);

-- Air Freight - Express
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.id, 'AIR_EXP', 'Air Freight - Express', 'air',
       'Priority air freight for urgent shipments', 5, 'per kg', 3,
       true, '{"service_level":"express","iata_required":true}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.id AND s.service_code = 'AIR_EXP'
);

-- Inland Trucking - LTL
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.id, 'TRUCK_LTL', 'Inland Trucking - LTL', 'trucking',
       'Less-than-truckload domestic road transport', 2, 'per mile', 5,
       true, '{"equipment":"box_truck","hazmat_supported":false}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.id AND s.service_code = 'TRUCK_LTL'
);

-- Courier - Standard Parcel
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.id, 'COURIER_STD', 'Courier - Standard', 'courier',
       'Door-to-door parcel delivery', 10, 'per parcel', 2,
       true, '{"max_weight_kg":30,"tracking":true}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.id AND s.service_code = 'COURIER_STD'
);

-- Railways - Standard Container
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.id, 'RAIL_STD', 'Railways - Standard', 'railway_transport',
       'Intermodal rail transport for containers', 800, 'per container', 10,
       true, '{"container":"40ft","waybill_required":true}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.id AND s.service_code = 'RAIL_STD'
);

-- Movers & Packers - Residential Move
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.id, 'MOVE_PACK', 'Movers & Packers - Residential', 'moving',
       'Pack and move residential goods', 1500, 'per job', 3,
       true, '{"includes_packing":true,"insurance_available":true}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.id AND s.service_code = 'MOVE_PACK'
);

COMMIT;