-- Comprehensive Ports & Locations Seed
-- Generated via AI-assisted seeding script
-- Date: 2026-01-30T07:36:39.285Z
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Los Angeles',
  'USLAX',
  'seaport',
  'United States',
  'US',
  'Los Angeles',
  'California',
  'California',
  '{"lat": 33.7288, "lng": -118.262}'::jsonb,
  NULL,
  NULL,
  'USLAX',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Los Angeles'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Long Beach',
  'USLGB',
  'seaport',
  'United States',
  'US',
  'Long Beach',
  'California',
  'California',
  '{"lat": 33.7541, "lng": -118.215}'::jsonb,
  NULL,
  NULL,
  'USLGB',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Long Beach'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of New York/New Jersey',
  'USNYC',
  'seaport',
  'United States',
  'US',
  'New York',
  'New York',
  'New York',
  '{"lat": 40.6698, "lng": -74.0287}'::jsonb,
  NULL,
  NULL,
  'USNYC',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('New York'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Savannah',
  'USSAV',
  'seaport',
  'United States',
  'US',
  'Savannah',
  'Georgia',
  'Georgia',
  '{"lat": 32.0809, "lng": -81.0912}'::jsonb,
  NULL,
  NULL,
  'USSAV',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Savannah'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Houston',
  'USHOU',
  'seaport',
  'United States',
  'US',
  'Houston',
  'Texas',
  'Texas',
  '{"lat": 29.7499, "lng": -95.3584}'::jsonb,
  NULL,
  NULL,
  'USHOU',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Houston'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Seattle',
  'USSEA',
  'seaport',
  'United States',
  'US',
  'Seattle',
  'Washington',
  'Washington',
  '{"lat": 47.6038, "lng": -122.3301}'::jsonb,
  NULL,
  NULL,
  'USSEA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Seattle'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Tacoma',
  'USTAC',
  'seaport',
  'United States',
  'US',
  'Tacoma',
  'Washington',
  'Washington',
  '{"lat": 47.2655, "lng": -122.3995}'::jsonb,
  NULL,
  NULL,
  'USTAC',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Tacoma'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Charleston',
  'USCHS',
  'seaport',
  'United States',
  'US',
  'Charleston',
  'South Carolina',
  'South Carolina',
  '{"lat": 32.7846, "lng": -79.9239}'::jsonb,
  NULL,
  NULL,
  'USCHS',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Charleston'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Virginia (Norfolk)',
  'USORF',
  'seaport',
  'United States',
  'US',
  'Norfolk',
  'Virginia',
  'Virginia',
  '{"lat": 36.9377, "lng": -76.33}'::jsonb,
  NULL,
  NULL,
  'USORF',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Norfolk'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Oakland',
  'USOAK',
  'seaport',
  'United States',
  'US',
  'Oakland',
  'California',
  'California',
  '{"lat": 37.7957, "lng": -122.2792}'::jsonb,
  NULL,
  NULL,
  'USOAK',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Oakland'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Miami',
  'USMIA',
  'seaport',
  'United States',
  'US',
  'Miami',
  'Florida',
  'Florida',
  '{"lat": 25.7788, "lng": -80.1779}'::jsonb,
  NULL,
  NULL,
  'USMIA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Miami'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Jacksonville',
  'USJAX',
  'seaport',
  'United States',
  'US',
  'Jacksonville',
  'Florida',
  'Florida',
  '{"lat": 30.3322, "lng": -81.6557}'::jsonb,
  NULL,
  NULL,
  'USJAX',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Jacksonville'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Baltimore',
  'USBAL',
  'seaport',
  'United States',
  'US',
  'Baltimore',
  'Maryland',
  'Maryland',
  '{"lat": 39.2666, "lng": -76.5796}'::jsonb,
  NULL,
  NULL,
  'USBAL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Baltimore'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of New Orleans',
  'USMSY',
  'seaport',
  'United States',
  'US',
  'New Orleans',
  'Louisiana',
  'Louisiana',
  '{"lat": 29.9405, "lng": -90.0573}'::jsonb,
  NULL,
  NULL,
  'USMSY',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('New Orleans'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Philadelphia',
  'USPHL',
  'seaport',
  'United States',
  'US',
  'Philadelphia',
  'Pennsylvania',
  'Pennsylvania',
  '{"lat": 39.901, "lng": -75.1325}'::jsonb,
  NULL,
  NULL,
  'USPHL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Philadelphia'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Mobile',
  'USMOB',
  'seaport',
  'United States',
  'US',
  'Mobile',
  'Alabama',
  'Alabama',
  '{"lat": 30.6954, "lng": -88.0399}'::jsonb,
  NULL,
  NULL,
  'USMOB',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Mobile'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Wilmington (NC)',
  'USILM',
  'seaport',
  'United States',
  'US',
  'Wilmington',
  'North Carolina',
  'North Carolina',
  '{"lat": 34.2082, "lng": -77.9546}'::jsonb,
  NULL,
  NULL,
  'USILM',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Wilmington'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Boston',
  'USBOS',
  'seaport',
  'United States',
  'US',
  'Boston',
  'Massachusetts',
  'Massachusetts',
  '{"lat": 42.3486, "lng": -71.0429}'::jsonb,
  NULL,
  NULL,
  'USBOS',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Boston'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Portland (OR)',
  'USPDX',
  'seaport',
  'United States',
  'US',
  'Portland',
  'Oregon',
  'Oregon',
  '{"lat": 45.6267, "lng": -122.7766}'::jsonb,
  NULL,
  NULL,
  'USPDX',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Portland'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Anchorage',
  'USANC',
  'seaport',
  'United States',
  'US',
  'Anchorage',
  'Alaska',
  'Alaska',
  '{"lat": 61.2422, "lng": -149.886}'::jsonb,
  NULL,
  NULL,
  'USANC',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Anchorage'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Honolulu',
  'USHNL',
  'seaport',
  'United States',
  'US',
  'Honolulu',
  'Hawaii',
  'Hawaii',
  '{"lat": 21.3069, "lng": -157.8583}'::jsonb,
  NULL,
  NULL,
  'USHNL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Honolulu'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of San Juan',
  'PRSJU',
  'seaport',
  'United States',
  'US',
  'San Juan',
  'Puerto Rico',
  'Puerto Rico',
  '{"lat": 18.4655, "lng": -66.1057}'::jsonb,
  NULL,
  NULL,
  'PRSJU',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('San Juan'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Gulfport',
  'USGPT',
  'seaport',
  'United States',
  'US',
  'Gulfport',
  'Mississippi',
  'Mississippi',
  '{"lat": 30.3674, "lng": -89.0928}'::jsonb,
  NULL,
  NULL,
  'USGPT',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Gulfport'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Tampa Bay',
  'USTPA',
  'seaport',
  'United States',
  'US',
  'Tampa',
  'Florida',
  'Florida',
  '{"lat": 27.9506, "lng": -82.4572}'::jsonb,
  NULL,
  NULL,
  'USTPA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Tampa'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Everglades',
  'USPEF',
  'seaport',
  'United States',
  'US',
  'Fort Lauderdale',
  'Florida',
  'Florida',
  '{"lat": 26.0858, "lng": -80.1158}'::jsonb,
  NULL,
  NULL,
  'USPEF',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Fort Lauderdale'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Shanghai',
  'CNSHA',
  'seaport',
  'China',
  'CN',
  'Shanghai',
  NULL,
  NULL,
  '{"lat": 31.2304, "lng": 121.4737}'::jsonb,
  NULL,
  NULL,
  'CNSHA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('China') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Shanghai'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Singapore',
  'SGSIN',
  'seaport',
  'Singapore',
  'SG',
  'Singapore',
  NULL,
  NULL,
  '{"lat": 1.2903, "lng": 103.8519}'::jsonb,
  NULL,
  NULL,
  'SGSIN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Singapore') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Singapore'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Ningbo-Zhoushan',
  'CNNBG',
  'seaport',
  'China',
  'CN',
  'Ningbo',
  NULL,
  NULL,
  '{"lat": 29.8683, "lng": 121.544}'::jsonb,
  NULL,
  NULL,
  'CNNBG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('China') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Ningbo'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Shenzhen',
  'CNSZX',
  'seaport',
  'China',
  'CN',
  'Shenzhen',
  NULL,
  NULL,
  '{"lat": 22.5431, "lng": 114.0579}'::jsonb,
  NULL,
  NULL,
  'CNSZX',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('China') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Shenzhen'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Guangzhou',
  'CNCAN',
  'seaport',
  'China',
  'CN',
  'Guangzhou',
  NULL,
  NULL,
  '{"lat": 23.1291, "lng": 113.2644}'::jsonb,
  NULL,
  NULL,
  'CNCAN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('China') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Guangzhou'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Busan',
  'KRPUS',
  'seaport',
  'South Korea',
  'KR',
  'Busan',
  NULL,
  NULL,
  '{"lat": 35.1796, "lng": 129.0756}'::jsonb,
  NULL,
  NULL,
  'KRPUS',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('South Korea') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Busan'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Qingdao',
  'CNTAO',
  'seaport',
  'China',
  'CN',
  'Qingdao',
  NULL,
  NULL,
  '{"lat": 36.0671, "lng": 120.3826}'::jsonb,
  NULL,
  NULL,
  'CNTAO',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('China') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Qingdao'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Hong Kong',
  'HKHKG',
  'seaport',
  'Hong Kong',
  'HK',
  'Hong Kong',
  NULL,
  NULL,
  '{"lat": 22.3193, "lng": 114.1694}'::jsonb,
  NULL,
  NULL,
  'HKHKG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Hong Kong') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Hong Kong'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Tianjin',
  'CNTSN',
  'seaport',
  'China',
  'CN',
  'Tianjin',
  NULL,
  NULL,
  '{"lat": 39.0842, "lng": 117.201}'::jsonb,
  NULL,
  NULL,
  'CNTSN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('China') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Tianjin'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Rotterdam',
  'NLRTM',
  'seaport',
  'Netherlands',
  'NL',
  'Rotterdam',
  NULL,
  NULL,
  '{"lat": 51.9244, "lng": 4.4777}'::jsonb,
  NULL,
  NULL,
  'NLRTM',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Netherlands') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Rotterdam'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Antwerp',
  'BEANR',
  'seaport',
  'Belgium',
  'BE',
  'Antwerp',
  NULL,
  NULL,
  '{"lat": 51.2194, "lng": 4.4025}'::jsonb,
  NULL,
  NULL,
  'BEANR',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Belgium') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Antwerp'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Jebel Ali',
  'AEJEA',
  'seaport',
  'United Arab Emirates',
  'AE',
  'Dubai',
  NULL,
  NULL,
  '{"lat": 24.9857, "lng": 55.0273}'::jsonb,
  NULL,
  NULL,
  'AEJEA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United Arab Emirates') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Dubai'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Port Klang',
  'MYPKG',
  'seaport',
  'Malaysia',
  'MY',
  'Port Klang',
  NULL,
  NULL,
  '{"lat": 3, "lng": 101.4}'::jsonb,
  NULL,
  NULL,
  'MYPKG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Malaysia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Port Klang'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Hamburg',
  'DEHAM',
  'seaport',
  'Germany',
  'DE',
  'Hamburg',
  NULL,
  NULL,
  '{"lat": 53.5488, "lng": 9.9872}'::jsonb,
  NULL,
  NULL,
  'DEHAM',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Germany') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Hamburg'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Tanjung Pelepas',
  'MYTPP',
  'seaport',
  'Malaysia',
  'MY',
  'Johor Bahru',
  NULL,
  NULL,
  '{"lat": 1.3667, "lng": 103.55}'::jsonb,
  NULL,
  NULL,
  'MYTPP',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Malaysia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Johor Bahru'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Laem Chabang',
  'THLCH',
  'seaport',
  'Thailand',
  'TH',
  'Chonburi',
  NULL,
  NULL,
  '{"lat": 13.0833, "lng": 100.9167}'::jsonb,
  NULL,
  NULL,
  'THLCH',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Thailand') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Chonburi'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Kaohsiung',
  'TWKHH',
  'seaport',
  'Taiwan',
  'TW',
  'Kaohsiung',
  NULL,
  NULL,
  '{"lat": 22.6273, "lng": 120.3014}'::jsonb,
  NULL,
  NULL,
  'TWKHH',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Taiwan') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Kaohsiung'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Tanjung Priok',
  'IDTPP',
  'seaport',
  'Indonesia',
  'ID',
  'Jakarta',
  NULL,
  NULL,
  '{"lat": -6.1, "lng": 106.8667}'::jsonb,
  NULL,
  NULL,
  'IDTPP',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Indonesia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Jakarta'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Ho Chi Minh City',
  'VNSGN',
  'seaport',
  'Vietnam',
  'VN',
  'Ho Chi Minh City',
  NULL,
  NULL,
  '{"lat": 10.8231, "lng": 106.6297}'::jsonb,
  NULL,
  NULL,
  'VNSGN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Vietnam') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Ho Chi Minh City'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Colombo',
  'LKCMB',
  'seaport',
  'Sri Lanka',
  'LK',
  'Colombo',
  NULL,
  NULL,
  '{"lat": 6.9271, "lng": 79.8612}'::jsonb,
  NULL,
  NULL,
  'LKCMB',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Sri Lanka') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Colombo'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Manila',
  'PHMNL',
  'seaport',
  'Philippines',
  'PH',
  'Manila',
  NULL,
  NULL,
  '{"lat": 14.5995, "lng": 120.9842}'::jsonb,
  NULL,
  NULL,
  'PHMNL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Philippines') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Manila'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Felixstowe',
  'GBFXT',
  'seaport',
  'United Kingdom',
  'GB',
  'Felixstowe',
  NULL,
  NULL,
  '{"lat": 51.9617, "lng": 1.3513}'::jsonb,
  NULL,
  NULL,
  'GBFXT',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United Kingdom') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Felixstowe'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Valencia',
  'ESVLC',
  'seaport',
  'Spain',
  'ES',
  'Valencia',
  NULL,
  NULL,
  '{"lat": 39.4699, "lng": -0.3763}'::jsonb,
  NULL,
  NULL,
  'ESVLC',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Spain') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Valencia'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Piraeus',
  'GRPIR',
  'seaport',
  'Greece',
  'GR',
  'Piraeus',
  NULL,
  NULL,
  '{"lat": 37.9429, "lng": 23.647}'::jsonb,
  NULL,
  NULL,
  'GRPIR',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Greece') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Piraeus'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Algeciras',
  'ESALG',
  'seaport',
  'Spain',
  'ES',
  'Algeciras',
  NULL,
  NULL,
  '{"lat": 36.1408, "lng": -5.4562}'::jsonb,
  NULL,
  NULL,
  'ESALG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Spain') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Algeciras'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Bremerhaven',
  'DEBRV',
  'seaport',
  'Germany',
  'DE',
  'Bremerhaven',
  NULL,
  NULL,
  '{"lat": 53.54, "lng": 8.5833}'::jsonb,
  NULL,
  NULL,
  'DEBRV',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Germany') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Bremerhaven'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Gioia Tauro',
  'ITGIT',
  'seaport',
  'Italy',
  'IT',
  'Gioia Tauro',
  NULL,
  NULL,
  '{"lat": 38.4333, "lng": 15.9}'::jsonb,
  NULL,
  NULL,
  'ITGIT',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Italy') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Gioia Tauro'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Mundra',
  'INMUN',
  'seaport',
  'India',
  'IN',
  'Mundra',
  NULL,
  NULL,
  '{"lat": 22.84, "lng": 69.72}'::jsonb,
  NULL,
  NULL,
  'INMUN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('India') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Mundra'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Nhava Sheva',
  'INNSA',
  'seaport',
  'India',
  'IN',
  'Navi Mumbai',
  NULL,
  NULL,
  '{"lat": 18.95, "lng": 72.95}'::jsonb,
  NULL,
  NULL,
  'INNSA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('India') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Navi Mumbai'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Santos',
  'BRSSZ',
  'seaport',
  'Brazil',
  'BR',
  'Santos',
  NULL,
  NULL,
  '{"lat": -23.9619, "lng": -46.2957}'::jsonb,
  NULL,
  NULL,
  'BRSSZ',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Brazil') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Santos'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Callao',
  'PECLL',
  'seaport',
  'Peru',
  'PE',
  'Callao',
  NULL,
  NULL,
  '{"lat": -12.0508, "lng": -77.1368}'::jsonb,
  NULL,
  NULL,
  'PECLL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Peru') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Callao'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of San Antonio',
  'CLSAI',
  'seaport',
  'Chile',
  'CL',
  'San Antonio',
  NULL,
  NULL,
  '{"lat": -33.5796, "lng": -71.6214}'::jsonb,
  NULL,
  NULL,
  'CLSAI',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Chile') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('San Antonio'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Vancouver',
  'CAVAN',
  'seaport',
  'Canada',
  'CA',
  'Vancouver',
  NULL,
  NULL,
  '{"lat": 49.2827, "lng": -123.1207}'::jsonb,
  NULL,
  NULL,
  'CAVAN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Canada') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Vancouver'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Port of Montreal',
  'CAMTR',
  'seaport',
  'Canada',
  'CA',
  'Montreal',
  NULL,
  NULL,
  '{"lat": 45.5017, "lng": -73.5673}'::jsonb,
  NULL,
  NULL,
  'CAMTR',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Canada') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Montreal'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Los Angeles International Airport',
  'LAX',
  'airport',
  'United States',
  'US',
  'Los Angeles',
  'California',
  'California',
  '{"lat": 33.9416, "lng": -118.4085}'::jsonb,
  'LAX',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Los Angeles'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'John F. Kennedy International Airport',
  'JFK',
  'airport',
  'United States',
  'US',
  'New York',
  'New York',
  'New York',
  '{"lat": 40.6413, "lng": -73.7781}'::jsonb,
  'JFK',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('New York'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'O''Hare International Airport',
  'ORD',
  'airport',
  'United States',
  'US',
  'Chicago',
  'Illinois',
  'Illinois',
  '{"lat": 41.9742, "lng": -87.9073}'::jsonb,
  'ORD',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Chicago'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Hartsfield-Jackson Atlanta International Airport',
  'ATL',
  'airport',
  'United States',
  'US',
  'Atlanta',
  'Georgia',
  'Georgia',
  '{"lat": 33.6407, "lng": -84.4277}'::jsonb,
  'ATL',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Atlanta'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Dallas/Fort Worth International Airport',
  'DFW',
  'airport',
  'United States',
  'US',
  'Dallas-Fort Worth',
  'Texas',
  'Texas',
  '{"lat": 32.8998, "lng": -97.0403}'::jsonb,
  'DFW',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Dallas-Fort Worth'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Denver International Airport',
  'DEN',
  'airport',
  'United States',
  'US',
  'Denver',
  'Colorado',
  'Colorado',
  '{"lat": 39.8561, "lng": -104.6737}'::jsonb,
  'DEN',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Denver'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'San Francisco International Airport',
  'SFO',
  'airport',
  'United States',
  'US',
  'San Francisco',
  'California',
  'California',
  '{"lat": 37.6213, "lng": -122.379}'::jsonb,
  'SFO',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('San Francisco'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Seattle-Tacoma International Airport',
  'SEA',
  'airport',
  'United States',
  'US',
  'Seattle',
  'Washington',
  'Washington',
  '{"lat": 47.4502, "lng": -122.3088}'::jsonb,
  'SEA',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Seattle'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Miami International Airport',
  'MIA',
  'airport',
  'United States',
  'US',
  'Miami',
  'Florida',
  'Florida',
  '{"lat": 25.7959, "lng": -80.287}'::jsonb,
  'MIA',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Miami'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Orlando International Airport',
  'MCO',
  'airport',
  'United States',
  'US',
  'Orlando',
  'Florida',
  'Florida',
  '{"lat": 28.4312, "lng": -81.3081}'::jsonb,
  'MCO',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Orlando'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Newark Liberty International Airport',
  'EWR',
  'airport',
  'United States',
  'US',
  'Newark',
  'New Jersey',
  'New Jersey',
  '{"lat": 40.6895, "lng": -74.1745}'::jsonb,
  'EWR',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Newark'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Harry Reid International Airport',
  'LAS',
  'airport',
  'United States',
  'US',
  'Las Vegas',
  'Nevada',
  'Nevada',
  '{"lat": 36.084, "lng": -115.1537}'::jsonb,
  'LAS',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Las Vegas'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Phoenix Sky Harbor International Airport',
  'PHX',
  'airport',
  'United States',
  'US',
  'Phoenix',
  'Arizona',
  'Arizona',
  '{"lat": 33.4341, "lng": -112.008}'::jsonb,
  'PHX',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Phoenix'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Charlotte Douglas International Airport',
  'CLT',
  'airport',
  'United States',
  'US',
  'Charlotte',
  'North Carolina',
  'North Carolina',
  '{"lat": 35.2144, "lng": -80.9473}'::jsonb,
  'CLT',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Charlotte'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'George Bush Intercontinental Airport',
  'IAH',
  'airport',
  'United States',
  'US',
  'Houston',
  'Texas',
  'Texas',
  '{"lat": 29.9902, "lng": -95.3368}'::jsonb,
  'IAH',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Houston'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Logan International Airport',
  'BOS',
  'airport',
  'United States',
  'US',
  'Boston',
  'Massachusetts',
  'Massachusetts',
  '{"lat": 42.3656, "lng": -71.0096}'::jsonb,
  'BOS',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Boston'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Minneapolis-Saint Paul International Airport',
  'MSP',
  'airport',
  'United States',
  'US',
  'Minneapolis',
  'Minnesota',
  'Minnesota',
  '{"lat": 44.8848, "lng": -93.2223}'::jsonb,
  'MSP',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Minneapolis'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Detroit Metropolitan Airport',
  'DTW',
  'airport',
  'United States',
  'US',
  'Detroit',
  'Michigan',
  'Michigan',
  '{"lat": 42.2121, "lng": -83.3533}'::jsonb,
  'DTW',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Detroit'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Philadelphia International Airport',
  'PHL',
  'airport',
  'United States',
  'US',
  'Philadelphia',
  'Pennsylvania',
  'Pennsylvania',
  '{"lat": 39.8729, "lng": -75.2437}'::jsonb,
  'PHL',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Philadelphia'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'LaGuardia Airport',
  'LGA',
  'airport',
  'United States',
  'US',
  'New York',
  'New York',
  'New York',
  '{"lat": 40.7769, "lng": -73.874}'::jsonb,
  'LGA',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('New York'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Salt Lake City International Airport',
  'SLC',
  'airport',
  'United States',
  'US',
  'Salt Lake City',
  'Utah',
  'Utah',
  '{"lat": 40.7899, "lng": -111.9791}'::jsonb,
  'SLC',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Salt Lake City'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Fort Lauderdale-Hollywood International Airport',
  'FLL',
  'airport',
  'United States',
  'US',
  'Fort Lauderdale',
  'Florida',
  'Florida',
  '{"lat": 26.0742, "lng": -80.1506}'::jsonb,
  'FLL',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Fort Lauderdale'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Baltimore/Washington International Thurgood Marshall Airport',
  'BWI',
  'airport',
  'United States',
  'US',
  'Baltimore',
  'Maryland',
  'Maryland',
  '{"lat": 39.1754, "lng": -76.6684}'::jsonb,
  'BWI',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Baltimore'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Washington Dulles International Airport',
  'IAD',
  'airport',
  'United States',
  'US',
  'Washington D.C.',
  'Virginia',
  'Virginia',
  '{"lat": 38.9531, "lng": -77.4565}'::jsonb,
  'IAD',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Washington D.C.'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Ronald Reagan Washington National Airport',
  'DCA',
  'airport',
  'United States',
  'US',
  'Washington D.C.',
  'Virginia',
  'Virginia',
  '{"lat": 38.8512, "lng": -77.0402}'::jsonb,
  'DCA',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Washington D.C.'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'San Diego International Airport',
  'SAN',
  'airport',
  'United States',
  'US',
  'San Diego',
  'California',
  'California',
  '{"lat": 32.7338, "lng": -117.1933}'::jsonb,
  'SAN',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('San Diego'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Tampa International Airport',
  'TPA',
  'airport',
  'United States',
  'US',
  'Tampa',
  'Florida',
  'Florida',
  '{"lat": 27.9772, "lng": -82.5311}'::jsonb,
  'TPA',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Tampa'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Portland International Airport',
  'PDX',
  'airport',
  'United States',
  'US',
  'Portland',
  'Oregon',
  'Oregon',
  '{"lat": 45.5898, "lng": -122.5951}'::jsonb,
  'PDX',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Portland'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Honolulu Daniel K. Inouye International Airport',
  'HNL',
  'airport',
  'United States',
  'US',
  'Honolulu',
  'Hawaii',
  'Hawaii',
  '{"lat": 21.3187, "lng": -157.9225}'::jsonb,
  'HNL',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Honolulu'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Ted Stevens Anchorage International Airport',
  'ANC',
  'airport',
  'United States',
  'US',
  'Anchorage',
  'Alaska',
  'Alaska',
  '{"lat": 61.1759, "lng": -149.9901}'::jsonb,
  'ANC',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Anchorage'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'London Heathrow Airport',
  'LHR',
  'airport',
  'United Kingdom',
  'GB',
  'London',
  NULL,
  NULL,
  '{"lat": 51.47, "lng": -0.4543}'::jsonb,
  'LHR',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United Kingdom') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('London'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Dubai International Airport',
  'DXB',
  'airport',
  'United Arab Emirates',
  'AE',
  'Dubai',
  NULL,
  NULL,
  '{"lat": 25.2532, "lng": 55.3657}'::jsonb,
  'DXB',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United Arab Emirates') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Dubai'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Tokyo Haneda Airport',
  'HND',
  'airport',
  'Japan',
  'JP',
  'Tokyo',
  NULL,
  NULL,
  '{"lat": 35.5494, "lng": 139.7798}'::jsonb,
  'HND',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Japan') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Tokyo'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Paris Charles de Gaulle Airport',
  'CDG',
  'airport',
  'France',
  'FR',
  'Paris',
  NULL,
  NULL,
  '{"lat": 49.0097, "lng": 2.5479}'::jsonb,
  'CDG',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('France') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Paris'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Amsterdam Airport Schiphol',
  'AMS',
  'airport',
  'Netherlands',
  'NL',
  'Amsterdam',
  NULL,
  NULL,
  '{"lat": 52.3105, "lng": 4.7683}'::jsonb,
  'AMS',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Netherlands') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Amsterdam'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Frankfurt Airport',
  'FRA',
  'airport',
  'Germany',
  'DE',
  'Frankfurt',
  NULL,
  NULL,
  '{"lat": 50.0379, "lng": 8.5622}'::jsonb,
  'FRA',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Germany') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Frankfurt'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Istanbul Airport',
  'IST',
  'airport',
  'Turkey',
  'TR',
  'Istanbul',
  NULL,
  NULL,
  '{"lat": 41.2753, "lng": 28.7519}'::jsonb,
  'IST',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Turkey') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Istanbul'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Singapore Changi Airport',
  'SIN',
  'airport',
  'Singapore',
  'SG',
  'Singapore',
  NULL,
  NULL,
  '{"lat": 1.3644, "lng": 103.9915}'::jsonb,
  'SIN',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Singapore') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Singapore'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Incheon International Airport',
  'ICN',
  'airport',
  'South Korea',
  'KR',
  'Seoul',
  NULL,
  NULL,
  '{"lat": 37.4602, "lng": 126.4407}'::jsonb,
  'ICN',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('South Korea') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Seoul'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Bangkok Suvarnabhumi Airport',
  'BKK',
  'airport',
  'Thailand',
  'TH',
  'Bangkok',
  NULL,
  NULL,
  '{"lat": 13.69, "lng": 100.7501}'::jsonb,
  'BKK',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Thailand') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Bangkok'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Hong Kong International Airport',
  'HKG',
  'airport',
  'Hong Kong',
  'HK',
  'Hong Kong',
  NULL,
  NULL,
  '{"lat": 22.308, "lng": 113.9185}'::jsonb,
  'HKG',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Hong Kong') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Hong Kong'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Doha Hamad International Airport',
  'DOH',
  'airport',
  'Qatar',
  'QA',
  'Doha',
  NULL,
  NULL,
  '{"lat": 25.2611, "lng": 51.608}'::jsonb,
  'DOH',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Qatar') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Doha'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Madrid Barajas Airport',
  'MAD',
  'airport',
  'Spain',
  'ES',
  'Madrid',
  NULL,
  NULL,
  '{"lat": 40.4839, "lng": -3.568}'::jsonb,
  'MAD',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Spain') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Madrid'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Beijing Capital International Airport',
  'PEK',
  'airport',
  'China',
  'CN',
  'Beijing',
  NULL,
  NULL,
  '{"lat": 40.0799, "lng": 116.6031}'::jsonb,
  'PEK',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('China') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Beijing'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Shanghai Pudong International Airport',
  'PVG',
  'airport',
  'China',
  'CN',
  'Shanghai',
  NULL,
  NULL,
  '{"lat": 31.1443, "lng": 121.8083}'::jsonb,
  'PVG',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('China') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Shanghai'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Guangzhou Baiyun International Airport',
  'CAN',
  'airport',
  'China',
  'CN',
  'Guangzhou',
  NULL,
  NULL,
  '{"lat": 23.3924, "lng": 113.2988}'::jsonb,
  'CAN',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('China') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Guangzhou'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Munich Airport',
  'MUC',
  'airport',
  'Germany',
  'DE',
  'Munich',
  NULL,
  NULL,
  '{"lat": 48.3537, "lng": 11.775}'::jsonb,
  'MUC',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Germany') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Munich'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Toronto Pearson International Airport',
  'YYZ',
  'airport',
  'Canada',
  'CA',
  'Toronto',
  NULL,
  NULL,
  '{"lat": 43.6777, "lng": -79.6248}'::jsonb,
  'YYZ',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Canada') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Toronto'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Vancouver International Airport',
  'YVR',
  'airport',
  'Canada',
  'CA',
  'Vancouver',
  NULL,
  NULL,
  '{"lat": 49.1947, "lng": -123.176}'::jsonb,
  'YVR',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Canada') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Vancouver'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Montreal-Trudeau International Airport',
  'YUL',
  'airport',
  'Canada',
  'CA',
  'Montreal',
  NULL,
  NULL,
  '{"lat": 45.4657, "lng": -73.7455}'::jsonb,
  'YUL',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Canada') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Montreal'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Mexico City International Airport',
  'MEX',
  'airport',
  'Mexico',
  'MX',
  'Mexico City',
  NULL,
  NULL,
  '{"lat": 19.4361, "lng": -99.0719}'::jsonb,
  'MEX',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Mexico') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Mexico City'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Sao Paulo Guarulhos International Airport',
  'GRU',
  'airport',
  'Brazil',
  'BR',
  'Sao Paulo',
  NULL,
  NULL,
  '{"lat": -23.4356, "lng": -46.4731}'::jsonb,
  'GRU',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Brazil') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Sao Paulo'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Sydney Kingsford Smith Airport',
  'SYD',
  'airport',
  'Australia',
  'AU',
  'Sydney',
  NULL,
  NULL,
  '{"lat": -33.9399, "lng": 151.1753}'::jsonb,
  'SYD',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Australia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Sydney'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Mumbai Chhatrapati Shivaji Maharaj International Airport',
  'BOM',
  'airport',
  'India',
  'IN',
  'Mumbai',
  NULL,
  NULL,
  '{"lat": 19.0896, "lng": 72.8656}'::jsonb,
  'BOM',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('India') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Mumbai'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Delhi Indira Gandhi International Airport',
  'DEL',
  'airport',
  'India',
  'IN',
  'New Delhi',
  NULL,
  NULL,
  '{"lat": 28.5562, "lng": 77.1}'::jsonb,
  'DEL',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('India') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('New Delhi'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Zurich Airport',
  'ZRH',
  'airport',
  'Switzerland',
  'CH',
  'Zurich',
  NULL,
  NULL,
  '{"lat": 47.4582, "lng": 8.5555}'::jsonb,
  'ZRH',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Switzerland') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Zurich'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Copenhagen Airport',
  'CPH',
  'airport',
  'Denmark',
  'DK',
  'Copenhagen',
  NULL,
  NULL,
  '{"lat": 55.618, "lng": 12.6508}'::jsonb,
  'CPH',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Denmark') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Copenhagen'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Oslo Airport',
  'OSL',
  'airport',
  'Norway',
  'NO',
  'Oslo',
  NULL,
  NULL,
  '{"lat": 60.1976, "lng": 11.1004}'::jsonb,
  'OSL',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Norway') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Oslo'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Stockholm Arlanda Airport',
  'ARN',
  'airport',
  'Sweden',
  'SE',
  'Stockholm',
  NULL,
  NULL,
  '{"lat": 59.6519, "lng": 17.9186}'::jsonb,
  'ARN',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Sweden') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Stockholm'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Helsinki Airport',
  'HEL',
  'airport',
  'Finland',
  'FI',
  'Helsinki',
  NULL,
  NULL,
  '{"lat": 60.3172, "lng": 24.9633}'::jsonb,
  'HEL',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Finland') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Helsinki'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Brussels Airport',
  'BRU',
  'airport',
  'Belgium',
  'BE',
  'Brussels',
  NULL,
  NULL,
  '{"lat": 50.9014, "lng": 4.4844}'::jsonb,
  'BRU',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Belgium') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Brussels'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Vienna International Airport',
  'VIE',
  'airport',
  'Austria',
  'AT',
  'Vienna',
  NULL,
  NULL,
  '{"lat": 48.1103, "lng": 16.5666}'::jsonb,
  'VIE',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Austria') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Vienna'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Rome Fiumicino Airport',
  'FCO',
  'airport',
  'Italy',
  'IT',
  'Rome',
  NULL,
  NULL,
  '{"lat": 41.8003, "lng": 12.2389}'::jsonb,
  'FCO',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Italy') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Rome'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Milan Malpensa Airport',
  'MXP',
  'airport',
  'Italy',
  'IT',
  'Milan',
  NULL,
  NULL,
  '{"lat": 45.6301, "lng": 8.7255}'::jsonb,
  'MXP',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Italy') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Milan'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Dublin Airport',
  'DUB',
  'airport',
  'Ireland',
  'IE',
  'Dublin',
  NULL,
  NULL,
  '{"lat": 53.4264, "lng": -6.2499}'::jsonb,
  'DUB',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Ireland') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Dublin'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Johannesburg O.R. Tambo International Airport',
  'JNB',
  'airport',
  'South Africa',
  'ZA',
  'Johannesburg',
  NULL,
  NULL,
  '{"lat": -26.1367, "lng": 28.2411}'::jsonb,
  'JNB',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('South Africa') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Johannesburg'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Cairo International Airport',
  'CAI',
  'airport',
  'Egypt',
  'EG',
  'Cairo',
  NULL,
  NULL,
  '{"lat": 30.1219, "lng": 31.4056}'::jsonb,
  'CAI',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Egypt') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Cairo'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Bogota El Dorado International Airport',
  'BOG',
  'airport',
  'Colombia',
  NULL,
  'Bogota',
  NULL,
  NULL,
  '{"lat": 4.7016, "lng": -74.1469}'::jsonb,
  'BOG',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Colombia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Bogota'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Lima Jorge Chavez International Airport',
  'LIM',
  'airport',
  'Peru',
  'PE',
  'Lima',
  NULL,
  NULL,
  '{"lat": -12.0241, "lng": -77.1143}'::jsonb,
  'LIM',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Peru') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Lima'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Santiago Arturo Merino Benitez International Airport',
  'SCL',
  'airport',
  'Chile',
  'CL',
  'Santiago',
  NULL,
  NULL,
  '{"lat": -33.393, "lng": -70.7858}'::jsonb,
  'SCL',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Chile') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Santiago'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Buenos Aires Ezeiza International Airport',
  'EZE',
  'airport',
  'Argentina',
  NULL,
  'Buenos Aires',
  NULL,
  NULL,
  '{"lat": -34.815, "lng": -58.5348}'::jsonb,
  'EZE',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Argentina') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Buenos Aires'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Auckland Airport',
  'AKL',
  'airport',
  'New Zealand',
  NULL,
  'Auckland',
  NULL,
  NULL,
  '{"lat": -37.0082, "lng": 174.795}'::jsonb,
  'AKL',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('New Zealand') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Auckland'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Melbourne Airport',
  'MEL',
  'airport',
  'Australia',
  'AU',
  'Melbourne',
  NULL,
  NULL,
  '{"lat": -37.669, "lng": 144.841}'::jsonb,
  'MEL',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Australia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Melbourne'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Brisbane Airport',
  'BNE',
  'airport',
  'Australia',
  'AU',
  'Brisbane',
  NULL,
  NULL,
  '{"lat": -27.3842, "lng": 153.1175}'::jsonb,
  'BNE',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Australia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Brisbane'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Perth Airport',
  'PER',
  'airport',
  'Australia',
  'AU',
  'Perth',
  NULL,
  NULL,
  '{"lat": -31.9385, "lng": 115.9672}'::jsonb,
  'PER',
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Australia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Perth'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Chicago Rail Terminal (BNSF)',
  'USCHI-RL',
  'railway_terminal',
  'United States',
  'US',
  'Chicago',
  'Illinois',
  'Illinois',
  '{"lat": 41.85, "lng": -87.65}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Chicago'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Kansas City Rail Terminal',
  'USMKC-RL',
  'railway_terminal',
  'United States',
  'US',
  'Kansas City',
  'Missouri',
  'Missouri',
  '{"lat": 39.0997, "lng": -94.5786}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Kansas City'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Memphis Rail Terminal',
  'USMEM-RL',
  'railway_terminal',
  'United States',
  'US',
  'Memphis',
  'Tennessee',
  'Tennessee',
  '{"lat": 35.1495, "lng": -90.049}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Memphis'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'St. Louis Rail Terminal',
  'USSTL-RL',
  'railway_terminal',
  'United States',
  'US',
  'St. Louis',
  'Missouri',
  'Missouri',
  '{"lat": 38.627, "lng": -90.1994}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('St. Louis'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Atlanta Rail Terminal',
  'USATL-RL',
  'railway_terminal',
  'United States',
  'US',
  'Atlanta',
  'Georgia',
  'Georgia',
  '{"lat": 33.749, "lng": -84.388}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Atlanta'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Dallas Rail Terminal',
  'USDAL-RL',
  'railway_terminal',
  'United States',
  'US',
  'Dallas',
  'Texas',
  'Texas',
  '{"lat": 32.7767, "lng": -96.797}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Dallas'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Houston Rail Terminal',
  'USHOU-RL',
  'railway_terminal',
  'United States',
  'US',
  'Houston',
  'Texas',
  'Texas',
  '{"lat": 29.7604, "lng": -95.3698}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Houston'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Minneapolis Rail Terminal',
  'USMSP-RL',
  'railway_terminal',
  'United States',
  'US',
  'Minneapolis',
  'Minnesota',
  'Minnesota',
  '{"lat": 44.9778, "lng": -93.265}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Minneapolis'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Detroit Rail Terminal',
  'USDTW-RL',
  'railway_terminal',
  'United States',
  'US',
  'Detroit',
  'Michigan',
  'Michigan',
  '{"lat": 42.3314, "lng": -83.0458}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Detroit'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Denver Rail Terminal',
  'USDEN-RL',
  'railway_terminal',
  'United States',
  'US',
  'Denver',
  'Colorado',
  'Colorado',
  '{"lat": 39.7392, "lng": -104.9903}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Denver'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Salt Lake City Rail Terminal',
  'USSLC-RL',
  'railway_terminal',
  'United States',
  'US',
  'Salt Lake City',
  'Utah',
  'Utah',
  '{"lat": 40.7608, "lng": -111.891}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Salt Lake City'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Portland Rail Terminal',
  'USPDX-RL',
  'railway_terminal',
  'United States',
  'US',
  'Portland',
  'Oregon',
  'Oregon',
  '{"lat": 45.5152, "lng": -122.6784}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Portland'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Seattle Rail Terminal',
  'USSEA-RL',
  'railway_terminal',
  'United States',
  'US',
  'Seattle',
  'Washington',
  'Washington',
  '{"lat": 47.6062, "lng": -122.3321}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Seattle'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Los Angeles Rail Terminal',
  'USLAX-RL',
  'railway_terminal',
  'United States',
  'US',
  'Los Angeles',
  'California',
  'California',
  '{"lat": 34.0522, "lng": -118.2437}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Los Angeles'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Newark Rail Terminal',
  'USEWR-RL',
  'railway_terminal',
  'United States',
  'US',
  'Newark',
  'New Jersey',
  'New Jersey',
  '{"lat": 40.7357, "lng": -74.1724}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Newark'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Jacksonville Rail Terminal',
  'USJAX-RL',
  'railway_terminal',
  'United States',
  'US',
  'Jacksonville',
  'Florida',
  'Florida',
  '{"lat": 30.3322, "lng": -81.6557}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Jacksonville'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Savannah Rail Terminal',
  'USSAV-RL',
  'railway_terminal',
  'United States',
  'US',
  'Savannah',
  'Georgia',
  'Georgia',
  '{"lat": 32.0809, "lng": -81.0912}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Savannah'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'Charleston Rail Terminal',
  'USCHS-RL',
  'railway_terminal',
  'United States',
  'US',
  'Charleston',
  'South Carolina',
  'South Carolina',
  '{"lat": 32.7765, "lng": -79.9311}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Charleston'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'New Orleans Rail Terminal',
  'USMSY-RL',
  'railway_terminal',
  'United States',
  'US',
  'New Orleans',
  'Louisiana',
  'Louisiana',
  '{"lat": 29.9511, "lng": -90.0715}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('New Orleans'::text) LIMIT 1)
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
  country_code,
  city,
  state_province,
  region_name,
  coordinates,
  iata_code,
  icao_code,
  un_locode,
  customs_available,
  is_active,
  notes,
  country_id,
  city_id
)
SELECT
  NULL,
  'El Paso Rail Terminal',
  'USELP-RL',
  'railway_terminal',
  'United States',
  'US',
  'El Paso',
  'Texas',
  'Texas',
  '{"lat": 31.7619, "lng": -106.485}'::jsonb,
  NULL,
  NULL,
  NULL,
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (Export Port Codes) & Schedule K',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('El Paso'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'USELP-RL')
);
COMMIT;
