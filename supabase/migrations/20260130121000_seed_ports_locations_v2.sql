-- Comprehensive Ports & Locations Seed
-- Generated via AI-assisted seeding script
-- Date: 2026-01-30T07:52:30.276Z
-- Sources: Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE
-- AI Confidence Score: 0.99
-- Total Entries: 202

BEGIN;

-- Ensure tenant_id is nullable (already done in previous migrations, but safe to re-assert via logic if needed)

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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Port of Prince Rupert',
  'CAPRR',
  'seaport',
  'Canada',
  'CA',
  'Prince Rupert',
  NULL,
  NULL,
  '{"lat": 54.315, "lng": -130.3208}'::jsonb,
  NULL,
  NULL,
  'CAPRR',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Canada') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Prince Rupert'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'CAPRR')
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
  'Port of Halifax',
  'CAHAL',
  'seaport',
  'Canada',
  'CA',
  'Halifax',
  NULL,
  NULL,
  '{"lat": 44.6488, "lng": -63.5752}'::jsonb,
  NULL,
  NULL,
  'CAHAL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Canada') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Halifax'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'CAHAL')
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
  'Port of Veracruz',
  'MXVER',
  'seaport',
  'Mexico',
  'MX',
  'Veracruz',
  NULL,
  NULL,
  '{"lat": 19.1738, "lng": -96.1342}'::jsonb,
  NULL,
  NULL,
  'MXVER',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Mexico') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Veracruz'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'MXVER')
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
  'Port of Manzanillo',
  'MXZLO',
  'seaport',
  'Mexico',
  'MX',
  'Manzanillo',
  NULL,
  NULL,
  '{"lat": 19.0522, "lng": -104.3158}'::jsonb,
  NULL,
  NULL,
  'MXZLO',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Mexico') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Manzanillo'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'MXZLO')
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
  'Port of Lazaro Cardenas',
  'MXLZC',
  'seaport',
  'Mexico',
  'MX',
  'Lazaro Cardenas',
  NULL,
  NULL,
  '{"lat": 17.9492, "lng": -102.1793}'::jsonb,
  NULL,
  NULL,
  'MXLZC',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Mexico') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Lazaro Cardenas'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'MXLZC')
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
  'Port of Altamira',
  'MXATM',
  'seaport',
  'Mexico',
  'MX',
  'Altamira',
  NULL,
  NULL,
  '{"lat": 22.4, "lng": -97.9333}'::jsonb,
  NULL,
  NULL,
  'MXATM',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Mexico') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Altamira'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'MXATM')
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Port of Xiamen',
  'CNXMN',
  'seaport',
  'China',
  'CN',
  'Xiamen',
  NULL,
  NULL,
  '{"lat": 24.4798, "lng": 118.0894}'::jsonb,
  NULL,
  NULL,
  'CNXMN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('China') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Xiamen'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'CNXMN')
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Port of Hai Phong',
  'VNHPH',
  'seaport',
  'Vietnam',
  'VN',
  'Hai Phong',
  NULL,
  NULL,
  '{"lat": 20.8648, "lng": 106.6834}'::jsonb,
  NULL,
  NULL,
  'VNHPH',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Vietnam') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Hai Phong'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'VNHPH')
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Port of Tokyo',
  'JPTYO',
  'seaport',
  'Japan',
  'JP',
  'Tokyo',
  NULL,
  NULL,
  '{"lat": 35.6895, "lng": 139.6917}'::jsonb,
  NULL,
  NULL,
  'JPTYO',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Japan') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Tokyo'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'JPTYO')
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
  'Port of Yokohama',
  'JPYOK',
  'seaport',
  'Japan',
  'JP',
  'Yokohama',
  NULL,
  NULL,
  '{"lat": 35.4437, "lng": 139.638}'::jsonb,
  NULL,
  NULL,
  'JPYOK',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Japan') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Yokohama'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'JPYOK')
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
  'Port of Kobe',
  'JPUKB',
  'seaport',
  'Japan',
  'JP',
  'Kobe',
  NULL,
  NULL,
  '{"lat": 34.6901, "lng": 135.1955}'::jsonb,
  NULL,
  NULL,
  'JPUKB',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Japan') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Kobe'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'JPUKB')
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
  'Port of Osaka',
  'JPOSA',
  'seaport',
  'Japan',
  'JP',
  'Osaka',
  NULL,
  NULL,
  '{"lat": 34.6937, "lng": 135.5023}'::jsonb,
  NULL,
  NULL,
  'JPOSA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Japan') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Osaka'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'JPOSA')
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
  'Port of Nagoya',
  'JPNGO',
  'seaport',
  'Japan',
  'JP',
  'Nagoya',
  NULL,
  NULL,
  '{"lat": 35.0833, "lng": 136.8833}'::jsonb,
  NULL,
  NULL,
  'JPNGO',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Japan') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Nagoya'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'JPNGO')
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
  'Port of Nhava Sheva (Jawaharlal Nehru)',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Port of Chennai',
  'INMAA',
  'seaport',
  'India',
  'IN',
  'Chennai',
  NULL,
  NULL,
  '{"lat": 13.0827, "lng": 80.2707}'::jsonb,
  NULL,
  NULL,
  'INMAA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('India') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Chennai'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'INMAA')
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
  'Port of Chittagong',
  'BDCGP',
  'seaport',
  'Bangladesh',
  'BD',
  'Chittagong',
  NULL,
  NULL,
  '{"lat": 22.3569, "lng": 91.7832}'::jsonb,
  NULL,
  NULL,
  'BDCGP',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Bangladesh') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Chittagong'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'BDCGP')
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
  'Port of Karachi',
  'PKKHI',
  'seaport',
  'Pakistan',
  'PK',
  'Karachi',
  NULL,
  NULL,
  '{"lat": 24.843, "lng": 66.9631}'::jsonb,
  NULL,
  NULL,
  'PKKHI',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Pakistan') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Karachi'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'PKKHI')
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Port of Southampton',
  'GBSOU',
  'seaport',
  'United Kingdom',
  'GB',
  'Southampton',
  NULL,
  NULL,
  '{"lat": 50.9097, "lng": -1.4044}'::jsonb,
  NULL,
  NULL,
  'GBSOU',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United Kingdom') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Southampton'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'GBSOU')
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
  'Port of London Gateway',
  'GBLGP',
  'seaport',
  'United Kingdom',
  'GB',
  'London',
  NULL,
  NULL,
  '{"lat": 51.5048, "lng": 0.4578}'::jsonb,
  NULL,
  NULL,
  'GBLGP',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United Kingdom') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('London'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'GBLGP')
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
  'Port of Liverpool',
  'GBLIV',
  'seaport',
  'United Kingdom',
  'GB',
  'Liverpool',
  NULL,
  NULL,
  '{"lat": 53.4084, "lng": -2.9916}'::jsonb,
  NULL,
  NULL,
  'GBLIV',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United Kingdom') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Liverpool'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'GBLIV')
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
  'Port of Le Havre',
  'FRLEH',
  'seaport',
  'France',
  'FR',
  'Le Havre',
  NULL,
  NULL,
  '{"lat": 49.4944, "lng": 0.1079}'::jsonb,
  NULL,
  NULL,
  'FRLEH',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('France') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Le Havre'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'FRLEH')
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
  'Port of Marseille',
  'FRMRS',
  'seaport',
  'France',
  'FR',
  'Marseille',
  NULL,
  NULL,
  '{"lat": 43.2965, "lng": 5.3698}'::jsonb,
  NULL,
  NULL,
  'FRMRS',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('France') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Marseille'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'FRMRS')
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Port of Barcelona',
  'ESBCN',
  'seaport',
  'Spain',
  'ES',
  'Barcelona',
  NULL,
  NULL,
  '{"lat": 41.3851, "lng": 2.1734}'::jsonb,
  NULL,
  NULL,
  'ESBCN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Spain') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Barcelona'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'ESBCN')
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Port of Genoa',
  'ITGOA',
  'seaport',
  'Italy',
  'IT',
  'Genoa',
  NULL,
  NULL,
  '{"lat": 44.4056, "lng": 8.9463}'::jsonb,
  NULL,
  NULL,
  'ITGOA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Italy') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Genoa'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'ITGOA')
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
  'Port of La Spezia',
  'ITSPE',
  'seaport',
  'Italy',
  'IT',
  'La Spezia',
  NULL,
  NULL,
  '{"lat": 44.1167, "lng": 9.8167}'::jsonb,
  NULL,
  NULL,
  'ITSPE',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Italy') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('La Spezia'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'ITSPE')
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Port of Gdansk',
  'PLGDN',
  'seaport',
  'Poland',
  'PL',
  'Gdansk',
  NULL,
  NULL,
  '{"lat": 54.352, "lng": 18.6466}'::jsonb,
  NULL,
  NULL,
  'PLGDN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Poland') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Gdansk'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'PLGDN')
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
  'Port of Sines',
  'PTSIE',
  'seaport',
  'Portugal',
  'PT',
  'Sines',
  NULL,
  NULL,
  '{"lat": 37.95, "lng": -8.8667}'::jsonb,
  NULL,
  NULL,
  'PTSIE',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Portugal') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Sines'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'PTSIE')
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Port of Jeddah',
  'SAJED',
  'seaport',
  'Saudi Arabia',
  'SA',
  'Jeddah',
  NULL,
  NULL,
  '{"lat": 21.4858, "lng": 39.1925}'::jsonb,
  NULL,
  NULL,
  'SAJED',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Saudi Arabia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Jeddah'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'SAJED')
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
  'Port of Dammam',
  'SADMM',
  'seaport',
  'Saudi Arabia',
  'SA',
  'Dammam',
  NULL,
  NULL,
  '{"lat": 26.4207, "lng": 50.0888}'::jsonb,
  NULL,
  NULL,
  'SADMM',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Saudi Arabia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Dammam'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'SADMM')
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
  'Port of Salalah',
  'OMSLL',
  'seaport',
  'Oman',
  'OM',
  'Salalah',
  NULL,
  NULL,
  '{"lat": 17.0151, "lng": 54.0924}'::jsonb,
  NULL,
  NULL,
  'OMSLL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Oman') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Salalah'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'OMSLL')
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
  'Port of Tanger Med',
  'MATNG',
  'seaport',
  'Morocco',
  'MA',
  'Tangier',
  NULL,
  NULL,
  '{"lat": 35.7667, "lng": -5.8}'::jsonb,
  NULL,
  NULL,
  'MATNG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Morocco') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Tangier'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'MATNG')
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
  'Port of Casablanca',
  'MACAS',
  'seaport',
  'Morocco',
  'MA',
  'Casablanca',
  NULL,
  NULL,
  '{"lat": 33.5956, "lng": -7.615}'::jsonb,
  NULL,
  NULL,
  'MACAS',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Morocco') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Casablanca'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'MACAS')
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
  'Port of Durban',
  'ZADUR',
  'seaport',
  'South Africa',
  'ZA',
  'Durban',
  NULL,
  NULL,
  '{"lat": -29.8587, "lng": 31.0218}'::jsonb,
  NULL,
  NULL,
  'ZADUR',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('South Africa') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Durban'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'ZADUR')
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
  'Port of Cape Town',
  'ZACPT',
  'seaport',
  'South Africa',
  'ZA',
  'Cape Town',
  NULL,
  NULL,
  '{"lat": -33.9249, "lng": 18.4241}'::jsonb,
  NULL,
  NULL,
  'ZACPT',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('South Africa') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Cape Town'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'ZACPT')
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
  'Port of Mombasa',
  'KEMBA',
  'seaport',
  'Kenya',
  'KE',
  'Mombasa',
  NULL,
  NULL,
  '{"lat": -4.0435, "lng": 39.6682}'::jsonb,
  NULL,
  NULL,
  'KEMBA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Kenya') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Mombasa'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'KEMBA')
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
  'Port of Lagos (Apapa)',
  'NGLOS',
  'seaport',
  'Nigeria',
  'NG',
  'Lagos',
  NULL,
  NULL,
  '{"lat": 6.5244, "lng": 3.3792}'::jsonb,
  NULL,
  NULL,
  'NGLOS',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Nigeria') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Lagos'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'NGLOS')
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
  'Port of Port Said',
  'EGPSD',
  'seaport',
  'Egypt',
  'EG',
  'Port Said',
  NULL,
  NULL,
  '{"lat": 31.2653, "lng": 32.3019}'::jsonb,
  NULL,
  NULL,
  'EGPSD',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Egypt') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Port Said'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'EGPSD')
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
  'Port of Alexandria',
  'EGALY',
  'seaport',
  'Egypt',
  'EG',
  'Alexandria',
  NULL,
  NULL,
  '{"lat": 31.2001, "lng": 29.9187}'::jsonb,
  NULL,
  NULL,
  'EGALY',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Egypt') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Alexandria'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'EGALY')
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
  'Port of Tema',
  'GHTMA',
  'seaport',
  'Ghana',
  NULL,
  'Tema',
  NULL,
  NULL,
  '{"lat": 5.6431, "lng": -0.0167}'::jsonb,
  NULL,
  NULL,
  'GHTMA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Ghana') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Tema'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'GHTMA')
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
  'Port of Abidjan',
  'CIABJ',
  'seaport',
  'Ivory Coast',
  NULL,
  'Abidjan',
  NULL,
  NULL,
  '{"lat": 5.25, "lng": -4.0167}'::jsonb,
  NULL,
  NULL,
  'CIABJ',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Ivory Coast') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Abidjan'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'CIABJ')
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
  'Port of Haifa',
  'ILHFA',
  'seaport',
  'Israel',
  'IL',
  'Haifa',
  NULL,
  NULL,
  '{"lat": 32.8191, "lng": 35.0036}'::jsonb,
  NULL,
  NULL,
  'ILHFA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Israel') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Haifa'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'ILHFA')
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
  'Port of Ashdod',
  'ILASH',
  'seaport',
  'Israel',
  'IL',
  'Ashdod',
  NULL,
  NULL,
  '{"lat": 31.8466, "lng": 34.646}'::jsonb,
  NULL,
  NULL,
  'ILASH',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Israel') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Ashdod'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'ILASH')
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Port of Paranagua',
  'BRPNG',
  'seaport',
  'Brazil',
  'BR',
  'Paranagua',
  NULL,
  NULL,
  '{"lat": -25.5205, "lng": -48.509}'::jsonb,
  NULL,
  NULL,
  'BRPNG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Brazil') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Paranagua'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'BRPNG')
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
  'Port of Rio Grande',
  'BRRIG',
  'seaport',
  'Brazil',
  'BR',
  'Rio Grande',
  NULL,
  NULL,
  '{"lat": -32.0526, "lng": -52.0863}'::jsonb,
  NULL,
  NULL,
  'BRRIG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Brazil') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Rio Grande'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'BRRIG')
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Port of Valparaiso',
  'CLVAP',
  'seaport',
  'Chile',
  'CL',
  'Valparaiso',
  NULL,
  NULL,
  '{"lat": -33.0472, "lng": -71.6127}'::jsonb,
  NULL,
  NULL,
  'CLVAP',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Chile') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Valparaiso'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'CLVAP')
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
  'Port of Buenos Aires',
  'ARBUE',
  'seaport',
  'Argentina',
  'AR',
  'Buenos Aires',
  NULL,
  NULL,
  '{"lat": -34.6037, "lng": -58.3816}'::jsonb,
  NULL,
  NULL,
  'ARBUE',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Argentina') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Buenos Aires'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'ARBUE')
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
  'Port of Cartagena',
  'COCTG',
  'seaport',
  'Colombia',
  'CO',
  'Cartagena',
  NULL,
  NULL,
  '{"lat": 10.391, "lng": -75.4794}'::jsonb,
  NULL,
  NULL,
  'COCTG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Colombia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Cartagena'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'COCTG')
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
  'Port of Buenaventura',
  'COBUN',
  'seaport',
  'Colombia',
  'CO',
  'Buenaventura',
  NULL,
  NULL,
  '{"lat": 3.8833, "lng": -77.0667}'::jsonb,
  NULL,
  NULL,
  'COBUN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Colombia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Buenaventura'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'COBUN')
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
  'Port of Colon (Cristobal)',
  'PACTB',
  'seaport',
  'Panama',
  'PA',
  'Colon',
  NULL,
  NULL,
  '{"lat": 9.3598, "lng": -79.9001}'::jsonb,
  NULL,
  NULL,
  'PACTB',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Panama') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Colon'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'PACTB')
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
  'Port of Balboa',
  'PABLB',
  'seaport',
  'Panama',
  'PA',
  'Panama City',
  NULL,
  NULL,
  '{"lat": 8.9593, "lng": -79.5604}'::jsonb,
  NULL,
  NULL,
  'PABLB',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Panama') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Panama City'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'PABLB')
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
  'Port of Montevideo',
  'UYMVD',
  'seaport',
  'Uruguay',
  NULL,
  'Montevideo',
  NULL,
  NULL,
  '{"lat": -34.9, "lng": -56.2}'::jsonb,
  NULL,
  NULL,
  'UYMVD',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Uruguay') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Montevideo'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'UYMVD')
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
  'Port of Melbourne',
  'AUMEL',
  'seaport',
  'Australia',
  'AU',
  'Melbourne',
  NULL,
  NULL,
  '{"lat": -37.8136, "lng": 144.9631}'::jsonb,
  NULL,
  NULL,
  'AUMEL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Australia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Melbourne'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'AUMEL')
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
  'Port of Sydney (Botany)',
  'AUSYD',
  'seaport',
  'Australia',
  'AU',
  'Sydney',
  NULL,
  NULL,
  '{"lat": -33.95, "lng": 151.2167}'::jsonb,
  NULL,
  NULL,
  'AUSYD',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Australia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Sydney'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'AUSYD')
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
  'Port of Brisbane',
  'AUBNE',
  'seaport',
  'Australia',
  'AU',
  'Brisbane',
  NULL,
  NULL,
  '{"lat": -27.3842, "lng": 153.1675}'::jsonb,
  NULL,
  NULL,
  'AUBNE',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Australia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Brisbane'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'AUBNE')
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
  'Port of Fremantle',
  'AUFRE',
  'seaport',
  'Australia',
  'AU',
  'Perth',
  NULL,
  NULL,
  '{"lat": -32.0515, "lng": 115.7431}'::jsonb,
  NULL,
  NULL,
  'AUFRE',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Australia') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Perth'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'AUFRE')
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
  'Port of Auckland',
  'NZAKL',
  'seaport',
  'New Zealand',
  'NZ',
  'Auckland',
  NULL,
  NULL,
  '{"lat": -36.8485, "lng": 174.7633}'::jsonb,
  NULL,
  NULL,
  'NZAKL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('New Zealand') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Auckland'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'NZAKL')
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
  'Port of Tauranga',
  'NZTRG',
  'seaport',
  'New Zealand',
  'NZ',
  'Tauranga',
  NULL,
  NULL,
  '{"lat": -37.6878, "lng": 176.1651}'::jsonb,
  NULL,
  NULL,
  'NZTRG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('New Zealand') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Tauranga'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'NZTRG')
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
  'Memphis International Airport',
  'MEM',
  'airport',
  'United States',
  'US',
  'Memphis',
  'Tennessee',
  'Tennessee',
  '{"lat": 35.0424, "lng": -89.9767}'::jsonb,
  'MEM',
  'KMEM',
  'USMEM',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Memphis'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'MEM')
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
  'PANC',
  'USANC',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Louisville Muhammad Ali International Airport',
  'SDF',
  'airport',
  'United States',
  'US',
  'Louisville',
  'Kentucky',
  'Kentucky',
  '{"lat": 38.1744, "lng": -85.736}'::jsonb,
  'SDF',
  'KSDF',
  'USSDF',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Louisville'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'SDF')
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
  'KLAX',
  'USLAX',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'KMIA',
  'USMIA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'KORD',
  'USORD',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'KJFK',
  'USJFK',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Indianapolis International Airport',
  'IND',
  'airport',
  'United States',
  'US',
  'Indianapolis',
  'Indiana',
  'Indiana',
  '{"lat": 39.7173, "lng": -86.2944}'::jsonb,
  'IND',
  'KIND',
  'USIND',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Indianapolis'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'IND')
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
  'Cincinnati/Northern Kentucky International Airport',
  'CVG',
  'airport',
  'United States',
  'US',
  'Cincinnati',
  'Ohio',
  'Ohio',
  '{"lat": 39.0461, "lng": -84.6621}'::jsonb,
  'CVG',
  'KCVG',
  'USCVG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Cincinnati'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'CVG')
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
  'Dallas',
  'Texas',
  'Texas',
  '{"lat": 32.8998, "lng": -97.0403}'::jsonb,
  'DFW',
  'KDFW',
  'USDFW',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Dallas'::text) LIMIT 1)
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
  'KATL',
  'USATL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'San Francisco International Airport',
  'SFO',
  'airport',
  'United States',
  'US',
  'San Francisco',
  'California',
  'California',
  '{"lat": 37.6188, "lng": -122.3758}'::jsonb,
  'SFO',
  'KSFO',
  'USSFO',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'KSEA',
  'USSEA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'KEWR',
  'USEWR',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Ontario International Airport',
  'ONT',
  'airport',
  'United States',
  'US',
  'Ontario',
  'California',
  'California',
  '{"lat": 34.056, "lng": -117.6012}'::jsonb,
  'ONT',
  'KONT',
  'USONT',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Ontario'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'ONT')
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
  'Rickenbacker International Airport',
  'LCK',
  'airport',
  'United States',
  'US',
  'Columbus',
  'Ohio',
  'Ohio',
  '{"lat": 39.8138, "lng": -82.9278}'::jsonb,
  'LCK',
  'KLCK',
  'USLCK',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Columbus'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'LCK')
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
  'KBOS',
  'USBOS',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Washington Dulles International Airport',
  'IAD',
  'airport',
  'United States',
  'US',
  'Washington',
  'District of Columbia',
  'District of Columbia',
  '{"lat": 38.9531, "lng": -77.4565}'::jsonb,
  'IAD',
  'KIAD',
  'USIAD',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Washington'::text) LIMIT 1)
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
  'KIAH',
  'USIAH',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'CYVR',
  'CAYVR',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'CYYZ',
  'CAYYZ',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'CYUL',
  'CAYUL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Calgary International Airport',
  'YYC',
  'airport',
  'Canada',
  'CA',
  'Calgary',
  NULL,
  NULL,
  '{"lat": 51.1215, "lng": -114.0076}'::jsonb,
  'YYC',
  'CYYC',
  'CAYYC',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Canada') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Calgary'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'YYC')
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
  'MMMX',
  'MXMEX',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Guadalajara International Airport',
  'GDL',
  'airport',
  'Mexico',
  'MX',
  'Guadalajara',
  NULL,
  NULL,
  '{"lat": 20.5218, "lng": -103.311}'::jsonb,
  'GDL',
  'MMGL',
  'MXGDL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Mexico') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Guadalajara'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'GDL')
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
  'VHHH',
  'HKHKG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Hong Kong') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Hong Kong'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'HKG')
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
  'ZSPD',
  'CNPVG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'RKSI',
  'KRICN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Taiwan Taoyuan International Airport',
  'TPE',
  'airport',
  'Taiwan',
  'TW',
  'Taipei',
  NULL,
  NULL,
  '{"lat": 25.0797, "lng": 121.2342}'::jsonb,
  'TPE',
  'RCTP',
  'TWTPE',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Taiwan') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Taipei'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'TPE')
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
  'Narita International Airport',
  'NRT',
  'airport',
  'Japan',
  'JP',
  'Tokyo',
  NULL,
  NULL,
  '{"lat": 35.772, "lng": 140.3929}'::jsonb,
  'NRT',
  'RJAA',
  'JPNRT',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Japan') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Tokyo'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'NRT')
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
  'RJTT',
  'JPHND',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'WSSS',
  'SGSIN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'ZGGG',
  'CNCAN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'ZBAA',
  'CNPEK',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Shenzhen Bao''an International Airport',
  'SZX',
  'airport',
  'China',
  'CN',
  'Shenzhen',
  NULL,
  NULL,
  '{"lat": 22.6393, "lng": 113.8107}'::jsonb,
  'SZX',
  'ZGSZ',
  'CNSZX',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('China') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Shenzhen'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'SZX')
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
  'Suvarnabhumi Airport',
  'BKK',
  'airport',
  'Thailand',
  'TH',
  'Bangkok',
  NULL,
  NULL,
  '{"lat": 13.69, "lng": 100.7501}'::jsonb,
  'BKK',
  'VTBS',
  'THBKK',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Kansai International Airport',
  'KIX',
  'airport',
  'Japan',
  'JP',
  'Osaka',
  NULL,
  NULL,
  '{"lat": 34.432, "lng": 135.2304}'::jsonb,
  'KIX',
  'RJBB',
  'JPKIX',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Japan') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Osaka'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'KIX')
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
  'Indira Gandhi International Airport',
  'DEL',
  'airport',
  'India',
  'IN',
  'New Delhi',
  NULL,
  NULL,
  '{"lat": 28.5562, "lng": 77.1}'::jsonb,
  'DEL',
  'VIDP',
  'INDEL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Chhatrapati Shivaji Maharaj International Airport',
  'BOM',
  'airport',
  'India',
  'IN',
  'Mumbai',
  NULL,
  NULL,
  '{"lat": 19.0896, "lng": 72.8656}'::jsonb,
  'BOM',
  'VABB',
  'INBOM',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'OMDB',
  'AEDXB',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Al Maktoum International Airport',
  'DWC',
  'airport',
  'United Arab Emirates',
  'AE',
  'Dubai',
  NULL,
  NULL,
  '{"lat": 24.8961, "lng": 55.1714}'::jsonb,
  'DWC',
  'OMDW',
  'AEDWC',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United Arab Emirates') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Dubai'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'DWC')
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
  'Hamad International Airport',
  'DOH',
  'airport',
  'Qatar',
  'QA',
  'Doha',
  NULL,
  NULL,
  '{"lat": 25.2611, "lng": 51.608}'::jsonb,
  'DOH',
  'OTHH',
  'QADOH',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'EDDF',
  'DEFRA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'LFPG',
  'FRCDG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'EHAM',
  'NLAMS',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'EGLL',
  'GBLHR',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Leipzig/Halle Airport',
  'LEJ',
  'airport',
  'Germany',
  'DE',
  'Leipzig',
  NULL,
  NULL,
  '{"lat": 51.4239, "lng": 12.2364}'::jsonb,
  'LEJ',
  'EDDP',
  'DELEJ',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Germany') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Leipzig'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'LEJ')
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
  'Luxembourg Airport',
  'LUX',
  'airport',
  'Luxembourg',
  'LU',
  'Luxembourg',
  NULL,
  NULL,
  '{"lat": 49.6233, "lng": 6.2044}'::jsonb,
  'LUX',
  'ELLX',
  'LULUX',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Luxembourg') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Luxembourg'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'LUX')
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
  'Liege Airport',
  'LGG',
  'airport',
  'Belgium',
  'BE',
  'Liege',
  NULL,
  NULL,
  '{"lat": 50.6374, "lng": 5.4432}'::jsonb,
  'LGG',
  'EBLG',
  'BELGG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Belgium') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Liege'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'LGG')
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
  'Cologne Bonn Airport',
  'CGN',
  'airport',
  'Germany',
  'DE',
  'Cologne',
  NULL,
  NULL,
  '{"lat": 50.8659, "lng": 7.1427}'::jsonb,
  'CGN',
  'EDDK',
  'DECGN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Germany') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Cologne'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'CGN')
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
  'LIMC',
  'ITMXP',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'LTFM',
  'TRIST',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'LEMD',
  'ESMAD',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'LSZH',
  'CHZRH',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'EBBR',
  'BEBRU',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'SBGR',
  'BRGRU',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Viracopos International Airport',
  'VCP',
  'airport',
  'Brazil',
  'BR',
  'Campinas',
  NULL,
  NULL,
  '{"lat": -23.0074, "lng": -47.1345}'::jsonb,
  'VCP',
  'SBKP',
  'BRVCP',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Brazil') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Campinas'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'VCP')
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
  'CO',
  'Bogota',
  NULL,
  NULL,
  '{"lat": 4.7016, "lng": -74.1469}'::jsonb,
  'BOG',
  'SKBO',
  'COBOG',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Santiago Arturo Merino Benitez Airport',
  'SCL',
  'airport',
  'Chile',
  'CL',
  'Santiago',
  NULL,
  NULL,
  '{"lat": -33.393, "lng": -70.7858}'::jsonb,
  'SCL',
  'SCEL',
  'CLSCL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'YSSY',
  'AUSYD',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'YMML',
  'AUMEL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'FAOR',
  'ZAJNB',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'HECA',
  'EGCAI',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'Nairobi Jomo Kenyatta International Airport',
  'NBO',
  'airport',
  'Kenya',
  'KE',
  'Nairobi',
  NULL,
  NULL,
  '{"lat": -1.3192, "lng": 36.9275}'::jsonb,
  'NBO',
  'HKJK',
  'KENBO',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Kenya') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Nairobi'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'NBO')
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
  'USCHI',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USMKC',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USMEM',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USSTL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USATL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USDAL',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USHOU',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USMSP',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USDTW',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USDEN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USSLC',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USPDX',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USSEA',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USLAX',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USEWR',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USJAX',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USSAV',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USCHS',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USMSY',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
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
  'USELP',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('United States') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('El Paso'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'USELP-RL')
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
  'Toronto Rail Terminal',
  'CATOR-RL',
  'railway_terminal',
  'Canada',
  'CA',
  'Toronto',
  'Ontario',
  'Ontario',
  '{"lat": 43.7, "lng": -79.4}'::jsonb,
  NULL,
  NULL,
  'CATOR',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Canada') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Toronto'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'CATOR-RL')
);


-- Batch 3
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
  'Montreal Rail Terminal',
  'CAMTR-RL',
  'railway_terminal',
  'Canada',
  'CA',
  'Montreal',
  'Quebec',
  'Quebec',
  '{"lat": 45.5017, "lng": -73.5673}'::jsonb,
  NULL,
  NULL,
  'CAMTR',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Canada') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Montreal'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'CAMTR-RL')
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
  'Vancouver Rail Terminal',
  'CAVAN-RL',
  'railway_terminal',
  'Canada',
  'CA',
  'Vancouver',
  'British Columbia',
  'British Columbia',
  '{"lat": 49.2827, "lng": -123.1207}'::jsonb,
  NULL,
  NULL,
  'CAVAN',
  TRUE,
  TRUE,
  'Global seed - AI Generated - Appendix D (USA), Schedule K (Foreign), IATA, UN/LOCODE',
  (SELECT id FROM public.countries co WHERE lower(co.name) = lower('Canada') LIMIT 1),
  (SELECT id FROM public.cities ci WHERE lower(ci.name) = lower('Vancouver'::text) LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ports_locations
  WHERE (tenant_id IS NULL) AND (location_code = 'CAVAN-RL')
);

COMMIT;
