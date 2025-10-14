-- Seed global carriers data
-- Note: This inserts carriers for each tenant in the system
-- Platform admins can see all, tenants can only see their own

INSERT INTO public.carriers (
  tenant_id,
  carrier_name,
  carrier_type,
  carrier_code,
  scac,
  iata,
  is_active
)
SELECT 
  t.id as tenant_id,
  c.carrier_name,
  c.carrier_type,
  c.carrier_code,
  c.scac,
  c.iata,
  true as is_active
FROM public.tenants t
CROSS JOIN (
  VALUES
    -- Ocean Carriers
    ('Mediterranean Shipping Company (MSC)', 'ocean', 'MSC', 'MSCU', NULL),
    ('Maersk', 'ocean', 'MAERSK', 'MAEU', NULL),
    ('CMA CGM', 'ocean', 'CMACGM', 'CMDU', NULL),
    ('COSCO Shipping Lines', 'ocean', 'COSCO', 'COSU', NULL),
    ('Hapag-Lloyd', 'ocean', 'HAPAG', 'HLCU', NULL),
    ('Ocean Network Express (ONE)', 'ocean', 'ONE', 'ONEY', NULL),
    ('Evergreen Marine Corporation', 'ocean', 'EVERGREEN', 'EGLV', NULL),
    ('HMM Co. Ltd.', 'ocean', 'HMM', 'HDMU', NULL),
    ('Zim Integrated Shipping Services', 'ocean', 'ZIM', 'ZIMU', NULL),
    ('Yang Ming Marine Transport Corporation', 'ocean', 'YANGMING', 'YMLU', NULL),
    
    -- Air Cargo Carriers
    ('FedEx Express', 'air', 'FEDEX', NULL, 'FX'),
    ('UPS Airlines', 'air', 'UPS', NULL, '5X'),
    ('DHL Aviation', 'air', 'DHL', NULL, 'D0'),
    ('Qatar Airways Cargo', 'air', 'QATAR', NULL, 'QR'),
    ('Emirates SkyCargo', 'air', 'EMIRATES', NULL, 'EK'),
    ('Cathay Pacific Cargo', 'air', 'CATHAY', NULL, 'CX'),
    ('Lufthansa Cargo', 'air', 'LUFTHANSA', NULL, 'LH'),
    ('Korean Air Cargo', 'air', 'KOREANAIR', NULL, 'KE'),
    ('Singapore Airlines Cargo', 'air', 'SINGAPORE', NULL, 'SQ'),
    ('Cargolux', 'air', 'CARGOLUX', NULL, 'CV'),
    
    -- Trucking Companies
    ('UPS', 'trucking', 'UPS', 'UPSS', NULL),
    ('FedEx', 'trucking', 'FEDEX', 'FDEG', NULL),
    ('XPO Logistics', 'trucking', 'XPO', 'XPOL', NULL),
    ('J.B. Hunt Transport Services', 'trucking', 'JBHUNT', 'JBHT', NULL),
    ('Knight-Swift Transportation', 'trucking', 'KNIGHTSWIFT', 'SWFT', NULL),
    ('Schneider National', 'trucking', 'SCHNEIDER', 'SNDR', NULL),
    ('Werner Enterprises', 'trucking', 'WERNER', 'WERN', NULL),
    ('U.S. Xpress Enterprises', 'trucking', 'USXPRESS', 'UACX', NULL),
    ('Old Dominion Freight Line', 'trucking', 'ODFL', 'ODFL', NULL),
    ('YRC Worldwide', 'trucking', 'YRC', 'YRCW', NULL)
) AS c(carrier_name, carrier_type, carrier_code, scac, iata)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers 
  WHERE carriers.carrier_name = c.carrier_name 
  AND carriers.tenant_id = t.id
);