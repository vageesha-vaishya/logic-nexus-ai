-- Seed data for geography master tables: continents, countries, states, cities

BEGIN;

-- Continents (global)
INSERT INTO public.continents (tenant_id, name, code_international, code_national, is_active)
VALUES
  (NULL, 'Africa', 'AF', NULL, true),
  (NULL, 'Asia', 'AS', NULL, true),
  (NULL, 'Europe', 'EU', NULL, true),
  (NULL, 'North America', 'NA', NULL, true),
  (NULL, 'South America', 'SA', NULL, true),
  (NULL, 'Oceania', 'OC', NULL, true),
  (NULL, 'Antarctica', 'AN', NULL, true)
ON CONFLICT (code_international) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active;

-- Countries (global)
INSERT INTO public.countries (tenant_id, continent_id, name, code_iso2, code_iso3, code_national, phone_code, is_active)
VALUES
  (NULL, (SELECT id FROM public.continents WHERE code_international = 'NA'), 'United States', 'US', 'USA', NULL, '+1', true),
  (NULL, (SELECT id FROM public.continents WHERE code_international = 'NA'), 'Canada', 'CA', 'CAN', NULL, '+1', true),
  (NULL, (SELECT id FROM public.continents WHERE code_international = 'EU'), 'United Kingdom', 'GB', 'GBR', NULL, '+44', true),
  (NULL, (SELECT id FROM public.continents WHERE code_international = 'AS'), 'India', 'IN', 'IND', NULL, '+91', true),
  (NULL, (SELECT id FROM public.continents WHERE code_international = 'AS'), 'China', 'CN', 'CHN', NULL, '+86', true),
  (NULL, (SELECT id FROM public.continents WHERE code_international = 'OC'), 'Australia', 'AU', 'AUS', NULL, '+61', true)
ON CONFLICT (code_iso2) DO UPDATE SET name = EXCLUDED.name, continent_id = EXCLUDED.continent_id, is_active = EXCLUDED.is_active;

-- States / Provinces (insert if not exists)
DO $$
DECLARE
  v_us uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'US');
  v_ca uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'CA');
  v_gb uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'GB');
  v_in uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'IN');
  v_cn uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'CN');
  v_au uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'AU');
BEGIN
  -- United States
  IF v_us IS NOT NULL THEN
    INSERT INTO public.states (tenant_id, country_id, name, code_iso, code_national, is_active)
    SELECT NULL, v_us, s.name, s.code_iso, NULL, true FROM (VALUES
      ('California','CA'),
      ('New York','NY'),
      ('Texas','TX')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Canada
  IF v_ca IS NOT NULL THEN
    INSERT INTO public.states (tenant_id, country_id, name, code_iso, code_national, is_active)
    SELECT NULL, v_ca, s.name, s.code_iso, NULL, true FROM (VALUES
      ('Ontario','ON'),
      ('British Columbia','BC'),
      ('Quebec','QC')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- United Kingdom
  IF v_gb IS NOT NULL THEN
    INSERT INTO public.states (tenant_id, country_id, name, code_iso, code_national, is_active)
    SELECT NULL, v_gb, s.name, s.code_iso, NULL, true FROM (VALUES
      ('England','ENG'),
      ('Scotland','SCT'),
      ('Wales','WLS')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- India
  IF v_in IS NOT NULL THEN
    INSERT INTO public.states (tenant_id, country_id, name, code_iso, code_national, is_active)
    SELECT NULL, v_in, s.name, s.code_iso, NULL, true FROM (VALUES
      ('Maharashtra','MH'),
      ('Karnataka','KA'),
      ('Delhi','DL')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- China
  IF v_cn IS NOT NULL THEN
    INSERT INTO public.states (tenant_id, country_id, name, code_iso, code_national, is_active)
    SELECT NULL, v_cn, s.name, s.code_iso, NULL, true FROM (VALUES
      ('Guangdong','GD'),
      ('Beijing','BJ'),
      ('Shanghai','SH')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Australia
  IF v_au IS NOT NULL THEN
    INSERT INTO public.states (tenant_id, country_id, name, code_iso, code_national, is_active)
    SELECT NULL, v_au, s.name, s.code_iso, NULL, true FROM (VALUES
      ('New South Wales','NSW'),
      ('Victoria','VIC'),
      ('Queensland','QLD')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- Cities (insert if not exists)
DO $$
DECLARE
  c_us uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'US');
  c_ca uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'CA');
  c_gb uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'GB');
  c_in uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'IN');
  c_cn uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'CN');
  c_au uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'AU');
  s_ca uuid := (SELECT id FROM public.states WHERE name = 'California' AND country_id = c_us);
  s_ny uuid := (SELECT id FROM public.states WHERE name = 'New York' AND country_id = c_us);
  s_on uuid := (SELECT id FROM public.states WHERE name = 'Ontario' AND country_id = c_ca);
  s_bc uuid := (SELECT id FROM public.states WHERE name = 'British Columbia' AND country_id = c_ca);
  s_eng uuid := (SELECT id FROM public.states WHERE name = 'England' AND country_id = c_gb);
  s_mh uuid := (SELECT id FROM public.states WHERE name = 'Maharashtra' AND country_id = c_in);
  s_ka uuid := (SELECT id FROM public.states WHERE name = 'Karnataka' AND country_id = c_in);
  s_gd uuid := (SELECT id FROM public.states WHERE name = 'Guangdong' AND country_id = c_cn);
  s_bj uuid := (SELECT id FROM public.states WHERE name = 'Beijing' AND country_id = c_cn);
  s_nsw uuid := (SELECT id FROM public.states WHERE name = 'New South Wales' AND country_id = c_au);
  s_vic uuid := (SELECT id FROM public.states WHERE name = 'Victoria' AND country_id = c_au);
BEGIN
  -- US
  IF c_us IS NOT NULL THEN
    INSERT INTO public.cities (tenant_id, country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (NULL, c_us, s_ca, 'Los Angeles', NULL, 34.0522, -118.2437, true),
      (NULL, c_us, s_ny, 'New York', NULL, 40.7128, -74.0060, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Canada
  IF c_ca IS NOT NULL THEN
    INSERT INTO public.cities (tenant_id, country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (NULL, c_ca, s_on, 'Toronto', NULL, 43.6532, -79.3832, true),
      (NULL, c_ca, s_bc, 'Vancouver', NULL, 49.2827, -123.1207, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- UK
  IF c_gb IS NOT NULL THEN
    INSERT INTO public.cities (tenant_id, country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (NULL, c_gb, s_eng, 'London', NULL, 51.5074, -0.1278, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- India
  IF c_in IS NOT NULL THEN
    INSERT INTO public.cities (tenant_id, country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (NULL, c_in, s_mh, 'Mumbai', NULL, 19.0760, 72.8777, true),
      (NULL, c_in, s_ka, 'Bengaluru', NULL, 12.9716, 77.5946, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- China
  IF c_cn IS NOT NULL THEN
    INSERT INTO public.cities (tenant_id, country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (NULL, c_cn, s_gd, 'Guangzhou', NULL, 23.1291, 113.2644, true),
      (NULL, c_cn, s_bj, 'Beijing', NULL, 39.9042, 116.4074, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Australia
  IF c_au IS NOT NULL THEN
    INSERT INTO public.cities (tenant_id, country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (NULL, c_au, s_nsw, 'Sydney', NULL, -33.8688, 151.2093, true),
      (NULL, c_au, s_vic, 'Melbourne', NULL, -37.8136, 144.9631, true)
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

COMMIT;