-- Seed USA and International services and map to service types per tenant
BEGIN;

-- Ensure base services have scope metadata (idempotent updates)
UPDATE public.services s
SET metadata = COALESCE(s.metadata, '{}'::jsonb) || '{"scope":"international","region":"global"}'::jsonb
WHERE s.service_code IN ('OCEAN_STD','AIR_EXP')
  AND (s.metadata IS NULL OR NOT (s.metadata ? 'scope'));

UPDATE public.services s
SET metadata = COALESCE(s.metadata, '{}'::jsonb) || '{"scope":"domestic","country":"US"}'::jsonb
WHERE s.service_code IN ('TRUCK_LTL','COURIER_STD','MOVE_PACK','RAIL_STD')
  AND (s.metadata IS NULL OR NOT (s.metadata ? 'scope'));

-- Insert additional USA/International service variants per tenant (idempotent)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
-- USA Domestic Courier (explicit)
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.tenant_id, 'COURIER_US_STD', 'Courier - USA Standard', 'courier',
       'Domestic USA parcel delivery', 12, 'per parcel', 2,
       true, '{"scope":"domestic","country":"US","tracking":true}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.tenant_id AND s.service_code = 'COURIER_US_STD'
);

-- International Courier
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.tenant_id, 'COURIER_INT_STD', 'Courier - International Standard', 'courier',
       'International parcel delivery', 15, 'per parcel', 5,
       true, '{"scope":"international","tracking":true}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.tenant_id AND s.service_code = 'COURIER_INT_STD'
);

-- USA Domestic Trucking (explicit)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.tenant_id, 'TRUCK_US_LTL', 'Inland Trucking - USA LTL', 'trucking',
       'Domestic USA road transport (LTL)', 2.0, 'per mile', 5,
       true, '{"scope":"domestic","country":"US","equipment":"box_truck"}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.tenant_id AND s.service_code = 'TRUCK_US_LTL'
);

-- International Trucking (Cross-border NA)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.services (
  tenant_id, service_code, service_name, service_type,
  description, base_price, pricing_unit, transit_time_days,
  is_active, metadata
)
SELECT t.tenant_id, 'TRUCK_INT_XB', 'Inland Trucking - Cross-border NA', 'trucking',
       'International cross-border trucking (US/CA/MX)', 2.5, 'per mile', 7,
       true, '{"scope":"international","region":"North America","equipment":"dry van"}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.tenant_id = t.tenant_id AND s.service_code = 'TRUCK_INT_XB'
);

-- Map service types to services with USA/International rules (idempotent)
-- Ocean: default International
WITH svc AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'OCEAN_STD'
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT svc.tenant_id, 'ocean', svc.id, true, 100, '{"scope":"international"}'::jsonb, true
FROM svc
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_type_mappings m
  WHERE m.tenant_id = svc.tenant_id AND m.service_type = 'ocean' AND m.is_default = true
)
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- Air: default International
WITH svc AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'AIR_EXP'
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT svc.tenant_id, 'air', svc.id, true, 100, '{"scope":"international"}'::jsonb, true
FROM svc
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_type_mappings m
  WHERE m.tenant_id = svc.tenant_id AND m.service_type = 'air' AND m.is_default = true
)
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- Trucking: default USA Domestic, plus International non-default
WITH us AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'TRUCK_US_LTL'
), intl AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'TRUCK_INT_XB'
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT us.tenant_id, 'trucking', us.id, true, 100, '{"scope":"domestic","country":"US"}'::jsonb, true
FROM us
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_type_mappings m
  WHERE m.tenant_id = us.tenant_id AND m.service_type = 'trucking' AND m.is_default = true
)
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT intl.tenant_id, 'trucking', intl.id, false, 50, '{"scope":"international","region":"North America"}'::jsonb, true
FROM intl
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- Courier: default USA Domestic, plus International non-default
WITH us AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code IN ('COURIER_US_STD','COURIER_STD') -- prefer explicit USA service, fallback to existing std
), intl AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'COURIER_INT_STD'
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT us.tenant_id, 'courier', us.id, true, 100, '{"scope":"domestic","country":"US"}'::jsonb, true
FROM us
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_type_mappings m
  WHERE m.tenant_id = us.tenant_id AND m.service_type = 'courier' AND m.is_default = true
)
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT intl.tenant_id, 'courier', intl.id, false, 50, '{"scope":"international"}'::jsonb, true
FROM intl
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- Moving: default USA Domestic
WITH svc AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'MOVE_PACK'
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT svc.tenant_id, 'moving', svc.id, true, 100, '{"scope":"domestic","country":"US"}'::jsonb, true
FROM svc
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_type_mappings m
  WHERE m.tenant_id = svc.tenant_id AND m.service_type = 'moving' AND m.is_default = true
)
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- Railways: default USA Domestic
WITH svc AS (
  SELECT s.tenant_id, s.id
  FROM public.services s
  WHERE s.service_code = 'RAIL_STD'
)
INSERT INTO public.service_type_mappings (
  tenant_id, service_type, service_id, is_default, priority, conditions, is_active
)
SELECT svc.tenant_id, 'railway_transport', svc.id, true, 100, '{"scope":"domestic","country":"US"}'::jsonb, true
FROM svc
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_type_mappings m
  WHERE m.tenant_id = svc.tenant_id AND m.service_type = 'railway_transport' AND m.is_default = true
)
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

COMMIT;