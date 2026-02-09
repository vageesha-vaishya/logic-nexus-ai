-- Seed carriers for all tenants if they don't exist
INSERT INTO public.carriers (
  tenant_id,
  carrier_name,
  carrier_type,
  scac,
  iata,
  mode,
  is_active
)
SELECT 
  t.id as tenant_id,
  c.carrier_name,
  c.carrier_type,
  c.scac,
  c.iata,
  c.mode,
  true as is_active
FROM public.tenants t
CROSS JOIN (
  VALUES
    -- Ocean
    ('Maersk', 'ocean', 'MAEU', NULL, 'ocean'),
    ('MSC', 'ocean', 'MSCU', NULL, 'ocean'),
    ('CMA CGM', 'ocean', 'CMACGM', NULL, 'ocean'),
    -- Air Cargo
    ('Lufthansa Cargo', 'air_cargo', NULL, 'LH', 'air'),
    ('Emirates SkyCargo', 'air_cargo', NULL, 'EK', 'air'),
    ('FedEx Express', 'air_cargo', NULL, 'FX', 'air'),
    -- Trucking
    ('J.B. Hunt', 'trucking', 'JBHT', NULL, 'road'),
    ('XPO Logistics', 'trucking', 'XPO', NULL, 'road'),
    -- Courier
    ('DHL Express', 'courier', NULL, 'DHL', 'air'),
    ('FedEx Ground', 'courier', NULL, 'FDXG', 'road'),
    -- Rail
    ('Union Pacific', 'rail', NULL, NULL, 'rail'),
    ('CSX', 'rail', NULL, NULL, 'rail')
) AS c(carrier_name, carrier_type, scac, iata, mode)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers 
  WHERE carriers.carrier_name = c.carrier_name 
  AND carriers.tenant_id = t.id
);
