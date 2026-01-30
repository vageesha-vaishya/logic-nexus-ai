-- Comprehensive Ports & Locations Seed
-- Generated via AI-assisted seeding script
-- Date: 2026-01-30T07:02:09.091Z
-- Sources: Appendix D (Export Port Codes) & Schedule K
-- AI Confidence Score: 0.95
-- Total Entries: 154

BEGIN;

-- Ensure tenant_id is nullable (already done in previous migrations, but safe to re-assert via logic if needed, 
-- here we assume schema is ready as per previous analysis)

-- NOTE: This migration assumes 'railway_terminal' has been added to the location_type check constraint.


-- Batch 1
INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Los Angeles', 
  'USLAX', 
  'seaport', 
  'USA', 
  'Los Angeles', 
  'California', 
  '{"lat": 33.7288, "lng": -118.262}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USLAX')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Long Beach', 
  'USLGB', 
  'seaport', 
  'USA', 
  'Long Beach', 
  'California', 
  '{"lat": 33.7541, "lng": -118.215}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USLGB')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of New York/New Jersey', 
  'USNYC', 
  'seaport', 
  'USA', 
  'New York', 
  'New York', 
  '{"lat": 40.6698, "lng": -74.0287}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USNYC')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Savannah', 
  'USSAV', 
  'seaport', 
  'USA', 
  'Savannah', 
  'Georgia', 
  '{"lat": 32.0809, "lng": -81.0912}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USSAV')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Houston', 
  'USHOU', 
  'seaport', 
  'USA', 
  'Houston', 
  'Texas', 
  '{"lat": 29.7499, "lng": -95.3584}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USHOU')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Seattle', 
  'USSEA', 
  'seaport', 
  'USA', 
  'Seattle', 
  'Washington', 
  '{"lat": 47.6038, "lng": -122.3301}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USSEA')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Tacoma', 
  'USTAC', 
  'seaport', 
  'USA', 
  'Tacoma', 
  'Washington', 
  '{"lat": 47.2655, "lng": -122.3995}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USTAC')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Charleston', 
  'USCHS', 
  'seaport', 
  'USA', 
  'Charleston', 
  'South Carolina', 
  '{"lat": 32.7846, "lng": -79.9239}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USCHS')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Virginia (Norfolk)', 
  'USORF', 
  'seaport', 
  'USA', 
  'Norfolk', 
  'Virginia', 
  '{"lat": 36.9377, "lng": -76.33}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USORF')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Oakland', 
  'USOAK', 
  'seaport', 
  'USA', 
  'Oakland', 
  'California', 
  '{"lat": 37.7957, "lng": -122.2792}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USOAK')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Miami', 
  'USMIA', 
  'seaport', 
  'USA', 
  'Miami', 
  'Florida', 
  '{"lat": 25.7788, "lng": -80.1779}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USMIA')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Jacksonville', 
  'USJAX', 
  'seaport', 
  'USA', 
  'Jacksonville', 
  'Florida', 
  '{"lat": 30.3322, "lng": -81.6557}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USJAX')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Baltimore', 
  'USBAL', 
  'seaport', 
  'USA', 
  'Baltimore', 
  'Maryland', 
  '{"lat": 39.2666, "lng": -76.5796}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USBAL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of New Orleans', 
  'USMSY', 
  'seaport', 
  'USA', 
  'New Orleans', 
  'Louisiana', 
  '{"lat": 29.9405, "lng": -90.0573}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USMSY')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Philadelphia', 
  'USPHL', 
  'seaport', 
  'USA', 
  'Philadelphia', 
  'Pennsylvania', 
  '{"lat": 39.901, "lng": -75.1325}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USPHL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Mobile', 
  'USMOB', 
  'seaport', 
  'USA', 
  'Mobile', 
  'Alabama', 
  '{"lat": 30.6954, "lng": -88.0399}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USMOB')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Wilmington (NC)', 
  'USILM', 
  'seaport', 
  'USA', 
  'Wilmington', 
  'North Carolina', 
  '{"lat": 34.2082, "lng": -77.9546}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USILM')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Boston', 
  'USBOS', 
  'seaport', 
  'USA', 
  'Boston', 
  'Massachusetts', 
  '{"lat": 42.3486, "lng": -71.0429}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USBOS')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Portland (OR)', 
  'USPDX', 
  'seaport', 
  'USA', 
  'Portland', 
  'Oregon', 
  '{"lat": 45.6267, "lng": -122.7766}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USPDX')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Anchorage', 
  'USANC', 
  'seaport', 
  'USA', 
  'Anchorage', 
  'Alaska', 
  '{"lat": 61.2422, "lng": -149.886}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USANC')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Honolulu', 
  'USHNL', 
  'seaport', 
  'USA', 
  'Honolulu', 
  'Hawaii', 
  '{"lat": 21.3069, "lng": -157.8583}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USHNL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of San Juan', 
  'PRSJU', 
  'seaport', 
  'USA', 
  'San Juan', 
  'Puerto Rico', 
  '{"lat": 18.4655, "lng": -66.1057}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'PRSJU')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Gulfport', 
  'USGPT', 
  'seaport', 
  'USA', 
  'Gulfport', 
  'Mississippi', 
  '{"lat": 30.3674, "lng": -89.0928}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USGPT')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Tampa Bay', 
  'USTPA', 
  'seaport', 
  'USA', 
  'Tampa', 
  'Florida', 
  '{"lat": 27.9506, "lng": -82.4572}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USTPA')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Everglades', 
  'USPEF', 
  'seaport', 
  'USA', 
  'Fort Lauderdale', 
  'Florida', 
  '{"lat": 26.0858, "lng": -80.1158}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USPEF')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Shanghai', 
  'CNSHA', 
  'seaport', 
  'China', 
  'Shanghai', 
  NULL, 
  '{"lat": 31.2304, "lng": 121.4737}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CNSHA')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Singapore', 
  'SGSIN', 
  'seaport', 
  'Singapore', 
  'Singapore', 
  NULL, 
  '{"lat": 1.2903, "lng": 103.8519}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'SGSIN')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Ningbo-Zhoushan', 
  'CNNBG', 
  'seaport', 
  'China', 
  'Ningbo', 
  NULL, 
  '{"lat": 29.8683, "lng": 121.544}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CNNBG')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Shenzhen', 
  'CNSZX', 
  'seaport', 
  'China', 
  'Shenzhen', 
  NULL, 
  '{"lat": 22.5431, "lng": 114.0579}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CNSZX')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Guangzhou', 
  'CNCAN', 
  'seaport', 
  'China', 
  'Guangzhou', 
  NULL, 
  '{"lat": 23.1291, "lng": 113.2644}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CNCAN')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Busan', 
  'KRPUS', 
  'seaport', 
  'South Korea', 
  'Busan', 
  NULL, 
  '{"lat": 35.1796, "lng": 129.0756}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'KRPUS')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Qingdao', 
  'CNTAO', 
  'seaport', 
  'China', 
  'Qingdao', 
  NULL, 
  '{"lat": 36.0671, "lng": 120.3826}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CNTAO')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Hong Kong', 
  'HKHKG', 
  'seaport', 
  'Hong Kong', 
  'Hong Kong', 
  NULL, 
  '{"lat": 22.3193, "lng": 114.1694}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'HKHKG')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Tianjin', 
  'CNTSN', 
  'seaport', 
  'China', 
  'Tianjin', 
  NULL, 
  '{"lat": 39.0842, "lng": 117.201}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CNTSN')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Rotterdam', 
  'NLRTM', 
  'seaport', 
  'Netherlands', 
  'Rotterdam', 
  NULL, 
  '{"lat": 51.9244, "lng": 4.4777}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'NLRTM')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Antwerp', 
  'BEANR', 
  'seaport', 
  'Belgium', 
  'Antwerp', 
  NULL, 
  '{"lat": 51.2194, "lng": 4.4025}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'BEANR')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Jebel Ali', 
  'AEJEA', 
  'seaport', 
  'United Arab Emirates', 
  'Dubai', 
  NULL, 
  '{"lat": 24.9857, "lng": 55.0273}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'AEJEA')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Port Klang', 
  'MYPKG', 
  'seaport', 
  'Malaysia', 
  'Port Klang', 
  NULL, 
  '{"lat": 3, "lng": 101.4}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'MYPKG')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Hamburg', 
  'DEHAM', 
  'seaport', 
  'Germany', 
  'Hamburg', 
  NULL, 
  '{"lat": 53.5488, "lng": 9.9872}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'DEHAM')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Tanjung Pelepas', 
  'MYTPP', 
  'seaport', 
  'Malaysia', 
  'Johor Bahru', 
  NULL, 
  '{"lat": 1.3667, "lng": 103.55}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'MYTPP')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Laem Chabang', 
  'THLCH', 
  'seaport', 
  'Thailand', 
  'Chonburi', 
  NULL, 
  '{"lat": 13.0833, "lng": 100.9167}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'THLCH')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Kaohsiung', 
  'TWKHH', 
  'seaport', 
  'Taiwan', 
  'Kaohsiung', 
  NULL, 
  '{"lat": 22.6273, "lng": 120.3014}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'TWKHH')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Tanjung Priok', 
  'IDTPP', 
  'seaport', 
  'Indonesia', 
  'Jakarta', 
  NULL, 
  '{"lat": -6.1, "lng": 106.8667}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'IDTPP')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Ho Chi Minh City', 
  'VNSGN', 
  'seaport', 
  'Vietnam', 
  'Ho Chi Minh City', 
  NULL, 
  '{"lat": 10.8231, "lng": 106.6297}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'VNSGN')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Colombo', 
  'LKCMB', 
  'seaport', 
  'Sri Lanka', 
  'Colombo', 
  NULL, 
  '{"lat": 6.9271, "lng": 79.8612}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'LKCMB')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Manila', 
  'PHMNL', 
  'seaport', 
  'Philippines', 
  'Manila', 
  NULL, 
  '{"lat": 14.5995, "lng": 120.9842}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'PHMNL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Felixstowe', 
  'GBFXT', 
  'seaport', 
  'United Kingdom', 
  'Felixstowe', 
  NULL, 
  '{"lat": 51.9617, "lng": 1.3513}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'GBFXT')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Valencia', 
  'ESVLC', 
  'seaport', 
  'Spain', 
  'Valencia', 
  NULL, 
  '{"lat": 39.4699, "lng": -0.3763}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'ESVLC')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Piraeus', 
  'GRPIR', 
  'seaport', 
  'Greece', 
  'Piraeus', 
  NULL, 
  '{"lat": 37.9429, "lng": 23.647}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'GRPIR')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Algeciras', 
  'ESALG', 
  'seaport', 
  'Spain', 
  'Algeciras', 
  NULL, 
  '{"lat": 36.1408, "lng": -5.4562}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'ESALG')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Bremerhaven', 
  'DEBRV', 
  'seaport', 
  'Germany', 
  'Bremerhaven', 
  NULL, 
  '{"lat": 53.54, "lng": 8.5833}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'DEBRV')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Gioia Tauro', 
  'ITGIT', 
  'seaport', 
  'Italy', 
  'Gioia Tauro', 
  NULL, 
  '{"lat": 38.4333, "lng": 15.9}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'ITGIT')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Mundra', 
  'INMUN', 
  'seaport', 
  'India', 
  'Mundra', 
  NULL, 
  '{"lat": 22.84, "lng": 69.72}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'INMUN')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Nhava Sheva', 
  'INNSA', 
  'seaport', 
  'India', 
  'Navi Mumbai', 
  NULL, 
  '{"lat": 18.95, "lng": 72.95}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'INNSA')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Santos', 
  'BRSSZ', 
  'seaport', 
  'Brazil', 
  'Santos', 
  NULL, 
  '{"lat": -23.9619, "lng": -46.2957}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'BRSSZ')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Callao', 
  'PECLL', 
  'seaport', 
  'Peru', 
  'Callao', 
  NULL, 
  '{"lat": -12.0508, "lng": -77.1368}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'PECLL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of San Antonio', 
  'CLSAI', 
  'seaport', 
  'Chile', 
  'San Antonio', 
  NULL, 
  '{"lat": -33.5796, "lng": -71.6214}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CLSAI')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Vancouver', 
  'CAVAN', 
  'seaport', 
  'Canada', 
  'Vancouver', 
  NULL, 
  '{"lat": 49.2827, "lng": -123.1207}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CAVAN')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Port of Montreal', 
  'CAMTR', 
  'seaport', 
  'Canada', 
  'Montreal', 
  NULL, 
  '{"lat": 45.5017, "lng": -73.5673}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CAMTR')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Los Angeles International Airport', 
  'LAX', 
  'airport', 
  'USA', 
  'Los Angeles', 
  'California', 
  '{"lat": 33.9416, "lng": -118.4085}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'LAX')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'John F. Kennedy International Airport', 
  'JFK', 
  'airport', 
  'USA', 
  'New York', 
  'New York', 
  '{"lat": 40.6413, "lng": -73.7781}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'JFK')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'O''Hare International Airport', 
  'ORD', 
  'airport', 
  'USA', 
  'Chicago', 
  'Illinois', 
  '{"lat": 41.9742, "lng": -87.9073}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'ORD')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Hartsfield-Jackson Atlanta International Airport', 
  'ATL', 
  'airport', 
  'USA', 
  'Atlanta', 
  'Georgia', 
  '{"lat": 33.6407, "lng": -84.4277}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'ATL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Dallas/Fort Worth International Airport', 
  'DFW', 
  'airport', 
  'USA', 
  'Dallas-Fort Worth', 
  'Texas', 
  '{"lat": 32.8998, "lng": -97.0403}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'DFW')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Denver International Airport', 
  'DEN', 
  'airport', 
  'USA', 
  'Denver', 
  'Colorado', 
  '{"lat": 39.8561, "lng": -104.6737}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'DEN')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'San Francisco International Airport', 
  'SFO', 
  'airport', 
  'USA', 
  'San Francisco', 
  'California', 
  '{"lat": 37.6213, "lng": -122.379}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'SFO')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Seattle-Tacoma International Airport', 
  'SEA', 
  'airport', 
  'USA', 
  'Seattle', 
  'Washington', 
  '{"lat": 47.4502, "lng": -122.3088}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'SEA')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Miami International Airport', 
  'MIA', 
  'airport', 
  'USA', 
  'Miami', 
  'Florida', 
  '{"lat": 25.7959, "lng": -80.287}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'MIA')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Orlando International Airport', 
  'MCO', 
  'airport', 
  'USA', 
  'Orlando', 
  'Florida', 
  '{"lat": 28.4312, "lng": -81.3081}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'MCO')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Newark Liberty International Airport', 
  'EWR', 
  'airport', 
  'USA', 
  'Newark', 
  'New Jersey', 
  '{"lat": 40.6895, "lng": -74.1745}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'EWR')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Harry Reid International Airport', 
  'LAS', 
  'airport', 
  'USA', 
  'Las Vegas', 
  'Nevada', 
  '{"lat": 36.084, "lng": -115.1537}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'LAS')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Phoenix Sky Harbor International Airport', 
  'PHX', 
  'airport', 
  'USA', 
  'Phoenix', 
  'Arizona', 
  '{"lat": 33.4341, "lng": -112.008}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'PHX')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Charlotte Douglas International Airport', 
  'CLT', 
  'airport', 
  'USA', 
  'Charlotte', 
  'North Carolina', 
  '{"lat": 35.2144, "lng": -80.9473}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CLT')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'George Bush Intercontinental Airport', 
  'IAH', 
  'airport', 
  'USA', 
  'Houston', 
  'Texas', 
  '{"lat": 29.9902, "lng": -95.3368}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'IAH')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Logan International Airport', 
  'BOS', 
  'airport', 
  'USA', 
  'Boston', 
  'Massachusetts', 
  '{"lat": 42.3656, "lng": -71.0096}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'BOS')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Minneapolis-Saint Paul International Airport', 
  'MSP', 
  'airport', 
  'USA', 
  'Minneapolis', 
  'Minnesota', 
  '{"lat": 44.8848, "lng": -93.2223}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'MSP')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Detroit Metropolitan Airport', 
  'DTW', 
  'airport', 
  'USA', 
  'Detroit', 
  'Michigan', 
  '{"lat": 42.2121, "lng": -83.3533}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'DTW')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Philadelphia International Airport', 
  'PHL', 
  'airport', 
  'USA', 
  'Philadelphia', 
  'Pennsylvania', 
  '{"lat": 39.8729, "lng": -75.2437}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'PHL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'LaGuardia Airport', 
  'LGA', 
  'airport', 
  'USA', 
  'New York', 
  'New York', 
  '{"lat": 40.7769, "lng": -73.874}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'LGA')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Salt Lake City International Airport', 
  'SLC', 
  'airport', 
  'USA', 
  'Salt Lake City', 
  'Utah', 
  '{"lat": 40.7899, "lng": -111.9791}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'SLC')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Fort Lauderdale-Hollywood International Airport', 
  'FLL', 
  'airport', 
  'USA', 
  'Fort Lauderdale', 
  'Florida', 
  '{"lat": 26.0742, "lng": -80.1506}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'FLL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Baltimore/Washington International Thurgood Marshall Airport', 
  'BWI', 
  'airport', 
  'USA', 
  'Baltimore', 
  'Maryland', 
  '{"lat": 39.1754, "lng": -76.6684}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'BWI')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Washington Dulles International Airport', 
  'IAD', 
  'airport', 
  'USA', 
  'Washington D.C.', 
  'Virginia', 
  '{"lat": 38.9531, "lng": -77.4565}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'IAD')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Ronald Reagan Washington National Airport', 
  'DCA', 
  'airport', 
  'USA', 
  'Washington D.C.', 
  'Virginia', 
  '{"lat": 38.8512, "lng": -77.0402}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'DCA')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'San Diego International Airport', 
  'SAN', 
  'airport', 
  'USA', 
  'San Diego', 
  'California', 
  '{"lat": 32.7338, "lng": -117.1933}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'SAN')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Tampa International Airport', 
  'TPA', 
  'airport', 
  'USA', 
  'Tampa', 
  'Florida', 
  '{"lat": 27.9772, "lng": -82.5311}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'TPA')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Portland International Airport', 
  'PDX', 
  'airport', 
  'USA', 
  'Portland', 
  'Oregon', 
  '{"lat": 45.5898, "lng": -122.5951}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'PDX')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Honolulu Daniel K. Inouye International Airport', 
  'HNL', 
  'airport', 
  'USA', 
  'Honolulu', 
  'Hawaii', 
  '{"lat": 21.3187, "lng": -157.9225}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'HNL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Ted Stevens Anchorage International Airport', 
  'ANC', 
  'airport', 
  'USA', 
  'Anchorage', 
  'Alaska', 
  '{"lat": 61.1759, "lng": -149.9901}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'ANC')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'London Heathrow Airport', 
  'LHR', 
  'airport', 
  'United Kingdom', 
  'London', 
  NULL, 
  '{"lat": 51.47, "lng": -0.4543}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'LHR')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Dubai International Airport', 
  'DXB', 
  'airport', 
  'United Arab Emirates', 
  'Dubai', 
  NULL, 
  '{"lat": 25.2532, "lng": 55.3657}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'DXB')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Tokyo Haneda Airport', 
  'HND', 
  'airport', 
  'Japan', 
  'Tokyo', 
  NULL, 
  '{"lat": 35.5494, "lng": 139.7798}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'HND')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Paris Charles de Gaulle Airport', 
  'CDG', 
  'airport', 
  'France', 
  'Paris', 
  NULL, 
  '{"lat": 49.0097, "lng": 2.5479}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CDG')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Amsterdam Airport Schiphol', 
  'AMS', 
  'airport', 
  'Netherlands', 
  'Amsterdam', 
  NULL, 
  '{"lat": 52.3105, "lng": 4.7683}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'AMS')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Frankfurt Airport', 
  'FRA', 
  'airport', 
  'Germany', 
  'Frankfurt', 
  NULL, 
  '{"lat": 50.0379, "lng": 8.5622}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'FRA')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Istanbul Airport', 
  'IST', 
  'airport', 
  'Turkey', 
  'Istanbul', 
  NULL, 
  '{"lat": 41.2753, "lng": 28.7519}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'IST')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Singapore Changi Airport', 
  'SIN', 
  'airport', 
  'Singapore', 
  'Singapore', 
  NULL, 
  '{"lat": 1.3644, "lng": 103.9915}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'SIN')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Incheon International Airport', 
  'ICN', 
  'airport', 
  'South Korea', 
  'Seoul', 
  NULL, 
  '{"lat": 37.4602, "lng": 126.4407}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'ICN')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Bangkok Suvarnabhumi Airport', 
  'BKK', 
  'airport', 
  'Thailand', 
  'Bangkok', 
  NULL, 
  '{"lat": 13.69, "lng": 100.7501}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'BKK')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Hong Kong International Airport', 
  'HKG', 
  'airport', 
  'Hong Kong', 
  'Hong Kong', 
  NULL, 
  '{"lat": 22.308, "lng": 113.9185}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'HKG')
);


-- Batch 2
INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Doha Hamad International Airport', 
  'DOH', 
  'airport', 
  'Qatar', 
  'Doha', 
  NULL, 
  '{"lat": 25.2611, "lng": 51.608}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'DOH')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Madrid Barajas Airport', 
  'MAD', 
  'airport', 
  'Spain', 
  'Madrid', 
  NULL, 
  '{"lat": 40.4839, "lng": -3.568}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'MAD')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Beijing Capital International Airport', 
  'PEK', 
  'airport', 
  'China', 
  'Beijing', 
  NULL, 
  '{"lat": 40.0799, "lng": 116.6031}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'PEK')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Shanghai Pudong International Airport', 
  'PVG', 
  'airport', 
  'China', 
  'Shanghai', 
  NULL, 
  '{"lat": 31.1443, "lng": 121.8083}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'PVG')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Guangzhou Baiyun International Airport', 
  'CAN', 
  'airport', 
  'China', 
  'Guangzhou', 
  NULL, 
  '{"lat": 23.3924, "lng": 113.2988}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CAN')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Munich Airport', 
  'MUC', 
  'airport', 
  'Germany', 
  'Munich', 
  NULL, 
  '{"lat": 48.3537, "lng": 11.775}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'MUC')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Toronto Pearson International Airport', 
  'YYZ', 
  'airport', 
  'Canada', 
  'Toronto', 
  NULL, 
  '{"lat": 43.6777, "lng": -79.6248}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'YYZ')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Vancouver International Airport', 
  'YVR', 
  'airport', 
  'Canada', 
  'Vancouver', 
  NULL, 
  '{"lat": 49.1947, "lng": -123.176}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'YVR')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Montreal-Trudeau International Airport', 
  'YUL', 
  'airport', 
  'Canada', 
  'Montreal', 
  NULL, 
  '{"lat": 45.4657, "lng": -73.7455}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'YUL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Mexico City International Airport', 
  'MEX', 
  'airport', 
  'Mexico', 
  'Mexico City', 
  NULL, 
  '{"lat": 19.4361, "lng": -99.0719}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'MEX')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Sao Paulo Guarulhos International Airport', 
  'GRU', 
  'airport', 
  'Brazil', 
  'Sao Paulo', 
  NULL, 
  '{"lat": -23.4356, "lng": -46.4731}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'GRU')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Sydney Kingsford Smith Airport', 
  'SYD', 
  'airport', 
  'Australia', 
  'Sydney', 
  NULL, 
  '{"lat": -33.9399, "lng": 151.1753}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'SYD')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Mumbai Chhatrapati Shivaji Maharaj International Airport', 
  'BOM', 
  'airport', 
  'India', 
  'Mumbai', 
  NULL, 
  '{"lat": 19.0896, "lng": 72.8656}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'BOM')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Delhi Indira Gandhi International Airport', 
  'DEL', 
  'airport', 
  'India', 
  'New Delhi', 
  NULL, 
  '{"lat": 28.5562, "lng": 77.1}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'DEL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Zurich Airport', 
  'ZRH', 
  'airport', 
  'Switzerland', 
  'Zurich', 
  NULL, 
  '{"lat": 47.4582, "lng": 8.5555}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'ZRH')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Copenhagen Airport', 
  'CPH', 
  'airport', 
  'Denmark', 
  'Copenhagen', 
  NULL, 
  '{"lat": 55.618, "lng": 12.6508}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CPH')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Oslo Airport', 
  'OSL', 
  'airport', 
  'Norway', 
  'Oslo', 
  NULL, 
  '{"lat": 60.1976, "lng": 11.1004}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'OSL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Stockholm Arlanda Airport', 
  'ARN', 
  'airport', 
  'Sweden', 
  'Stockholm', 
  NULL, 
  '{"lat": 59.6519, "lng": 17.9186}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'ARN')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Helsinki Airport', 
  'HEL', 
  'airport', 
  'Finland', 
  'Helsinki', 
  NULL, 
  '{"lat": 60.3172, "lng": 24.9633}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'HEL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Brussels Airport', 
  'BRU', 
  'airport', 
  'Belgium', 
  'Brussels', 
  NULL, 
  '{"lat": 50.9014, "lng": 4.4844}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'BRU')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Vienna International Airport', 
  'VIE', 
  'airport', 
  'Austria', 
  'Vienna', 
  NULL, 
  '{"lat": 48.1103, "lng": 16.5666}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'VIE')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Rome Fiumicino Airport', 
  'FCO', 
  'airport', 
  'Italy', 
  'Rome', 
  NULL, 
  '{"lat": 41.8003, "lng": 12.2389}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'FCO')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Milan Malpensa Airport', 
  'MXP', 
  'airport', 
  'Italy', 
  'Milan', 
  NULL, 
  '{"lat": 45.6301, "lng": 8.7255}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'MXP')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Dublin Airport', 
  'DUB', 
  'airport', 
  'Ireland', 
  'Dublin', 
  NULL, 
  '{"lat": 53.4264, "lng": -6.2499}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'DUB')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Johannesburg O.R. Tambo International Airport', 
  'JNB', 
  'airport', 
  'South Africa', 
  'Johannesburg', 
  NULL, 
  '{"lat": -26.1367, "lng": 28.2411}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'JNB')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Cairo International Airport', 
  'CAI', 
  'airport', 
  'Egypt', 
  'Cairo', 
  NULL, 
  '{"lat": 30.1219, "lng": 31.4056}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'CAI')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Bogota El Dorado International Airport', 
  'BOG', 
  'airport', 
  'Colombia', 
  'Bogota', 
  NULL, 
  '{"lat": 4.7016, "lng": -74.1469}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'BOG')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Lima Jorge Chavez International Airport', 
  'LIM', 
  'airport', 
  'Peru', 
  'Lima', 
  NULL, 
  '{"lat": -12.0241, "lng": -77.1143}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'LIM')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Santiago Arturo Merino Benitez International Airport', 
  'SCL', 
  'airport', 
  'Chile', 
  'Santiago', 
  NULL, 
  '{"lat": -33.393, "lng": -70.7858}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'SCL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Buenos Aires Ezeiza International Airport', 
  'EZE', 
  'airport', 
  'Argentina', 
  'Buenos Aires', 
  NULL, 
  '{"lat": -34.815, "lng": -58.5348}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'EZE')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Auckland Airport', 
  'AKL', 
  'airport', 
  'New Zealand', 
  'Auckland', 
  NULL, 
  '{"lat": -37.0082, "lng": 174.795}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'AKL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Melbourne Airport', 
  'MEL', 
  'airport', 
  'Australia', 
  'Melbourne', 
  NULL, 
  '{"lat": -37.669, "lng": 144.841}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'MEL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Brisbane Airport', 
  'BNE', 
  'airport', 
  'Australia', 
  'Brisbane', 
  NULL, 
  '{"lat": -27.3842, "lng": 153.1175}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'BNE')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Perth Airport', 
  'PER', 
  'airport', 
  'Australia', 
  'Perth', 
  NULL, 
  '{"lat": -31.9385, "lng": 115.9672}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'PER')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Chicago Rail Terminal (BNSF)', 
  'USCHI-RL', 
  'railway_terminal', 
  'USA', 
  'Chicago', 
  'Illinois', 
  '{"lat": 41.85, "lng": -87.65}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USCHI-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Kansas City Rail Terminal', 
  'USMKC-RL', 
  'railway_terminal', 
  'USA', 
  'Kansas City', 
  'Missouri', 
  '{"lat": 39.0997, "lng": -94.5786}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USMKC-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Memphis Rail Terminal', 
  'USMEM-RL', 
  'railway_terminal', 
  'USA', 
  'Memphis', 
  'Tennessee', 
  '{"lat": 35.1495, "lng": -90.049}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USMEM-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'St. Louis Rail Terminal', 
  'USSTL-RL', 
  'railway_terminal', 
  'USA', 
  'St. Louis', 
  'Missouri', 
  '{"lat": 38.627, "lng": -90.1994}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USSTL-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Atlanta Rail Terminal', 
  'USATL-RL', 
  'railway_terminal', 
  'USA', 
  'Atlanta', 
  'Georgia', 
  '{"lat": 33.749, "lng": -84.388}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USATL-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Dallas Rail Terminal', 
  'USDAL-RL', 
  'railway_terminal', 
  'USA', 
  'Dallas', 
  'Texas', 
  '{"lat": 32.7767, "lng": -96.797}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USDAL-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Houston Rail Terminal', 
  'USHOU-RL', 
  'railway_terminal', 
  'USA', 
  'Houston', 
  'Texas', 
  '{"lat": 29.7604, "lng": -95.3698}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USHOU-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Minneapolis Rail Terminal', 
  'USMSP-RL', 
  'railway_terminal', 
  'USA', 
  'Minneapolis', 
  'Minnesota', 
  '{"lat": 44.9778, "lng": -93.265}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USMSP-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Detroit Rail Terminal', 
  'USDTW-RL', 
  'railway_terminal', 
  'USA', 
  'Detroit', 
  'Michigan', 
  '{"lat": 42.3314, "lng": -83.0458}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USDTW-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Denver Rail Terminal', 
  'USDEN-RL', 
  'railway_terminal', 
  'USA', 
  'Denver', 
  'Colorado', 
  '{"lat": 39.7392, "lng": -104.9903}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USDEN-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Salt Lake City Rail Terminal', 
  'USSLC-RL', 
  'railway_terminal', 
  'USA', 
  'Salt Lake City', 
  'Utah', 
  '{"lat": 40.7608, "lng": -111.891}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USSLC-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Portland Rail Terminal', 
  'USPDX-RL', 
  'railway_terminal', 
  'USA', 
  'Portland', 
  'Oregon', 
  '{"lat": 45.5152, "lng": -122.6784}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USPDX-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Seattle Rail Terminal', 
  'USSEA-RL', 
  'railway_terminal', 
  'USA', 
  'Seattle', 
  'Washington', 
  '{"lat": 47.6062, "lng": -122.3321}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USSEA-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Los Angeles Rail Terminal', 
  'USLAX-RL', 
  'railway_terminal', 
  'USA', 
  'Los Angeles', 
  'California', 
  '{"lat": 34.0522, "lng": -118.2437}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USLAX-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Newark Rail Terminal', 
  'USEWR-RL', 
  'railway_terminal', 
  'USA', 
  'Newark', 
  'New Jersey', 
  '{"lat": 40.7357, "lng": -74.1724}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USEWR-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Jacksonville Rail Terminal', 
  'USJAX-RL', 
  'railway_terminal', 
  'USA', 
  'Jacksonville', 
  'Florida', 
  '{"lat": 30.3322, "lng": -81.6557}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USJAX-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Savannah Rail Terminal', 
  'USSAV-RL', 
  'railway_terminal', 
  'USA', 
  'Savannah', 
  'Georgia', 
  '{"lat": 32.0809, "lng": -81.0912}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USSAV-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'Charleston Rail Terminal', 
  'USCHS-RL', 
  'railway_terminal', 
  'USA', 
  'Charleston', 
  'South Carolina', 
  '{"lat": 32.7765, "lng": -79.9311}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USCHS-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'New Orleans Rail Terminal', 
  'USMSY-RL', 
  'railway_terminal', 
  'USA', 
  'New Orleans', 
  'Louisiana', 
  '{"lat": 29.9511, "lng": -90.0715}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USMSY-RL')
);

INSERT INTO public.ports_locations (
  tenant_id, 
  location_name, 
  location_code, 
  location_type, 
  country, 
  city, 
  state_province, 
  coordinates, 
  customs_available, 
  is_active, 
  notes
)
SELECT 
  NULL, 
  'El Paso Rail Terminal', 
  'USELP-RL', 
  'railway_terminal', 
  'USA', 
  'El Paso', 
  'Texas', 
  '{"lat": 31.7619, "lng": -106.485}'::jsonb, 
  TRUE, 
  TRUE, 
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations 
  WHERE (tenant_id IS NULL) AND (location_code = 'USELP-RL')
);

COMMIT;
