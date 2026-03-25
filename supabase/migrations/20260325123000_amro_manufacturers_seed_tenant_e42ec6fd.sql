BEGIN;

-- Seed manufacturers for tenant e42ec6fd-6b88-4721-befe-4443d9743120.
-- Transaction ensures rollback on any failure.

-- McCAULEY
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'MCC',
  'McCAULEY',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('McCAULEY'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- Westland Agusta
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'AW',
  'Westland Agusta',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('Westland Agusta'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- AIRBUS
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'AIR',
  'AIRBUS',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('AIRBUS'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- BELL HELICOPTER TEXTRON
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'BELL',
  'BELL HELICOPTER TEXTRON',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('BELL HELICOPTER TEXTRON'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- ROLLS ROYCE
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'RR',
  'ROLLS ROYCE',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('ROLLS ROYCE'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- TURBOMECA
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'TURB',
  'TURBOMECA',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('TURBOMECA'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- EUROCOPTER
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'EC',
  'EUROCOPTER',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('EUROCOPTER'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- ATR
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'ATR',
  'ATR',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('ATR'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- HAWKER BEECHCRAFT
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'BEECH',
  'HAWKER BEECHCRAFT',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('HAWKER BEECHCRAFT'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- SUPER KING AIR
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'BEECH',
  'SUPER KING AIR',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('SUPER KING AIR'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- Beech Aircraft Corporation Wichita Kansas USA
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'BEECH',
  'Beech Aircraft Corporation Wichita Kansas USA',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('Beech Aircraft Corporation Wichita Kansas USA'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- BELL
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'BELL',
  'BELL',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('BELL'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- Pratt & Whittney
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'P&W',
  'Pratt & Whittney',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('Pratt & Whittney'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- Schweizer
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'SCH',
  'Schweizer',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('Schweizer'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- CESSNA AIRCRAFT COMPANY
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'CESSNA',
  'CESSNA AIRCRAFT COMPANY',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('CESSNA AIRCRAFT COMPANY'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- Keystone Helicopter
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'KEYSTONE',
  'Keystone Helicopter',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('Keystone Helicopter'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- HINDUSTAN AERONAUTICS LTD
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'HAL',
  'HINDUSTAN AERONAUTICS LTD',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('HINDUSTAN AERONAUTICS LTD'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- EMBRAER
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'EMB',
  'EMBRAER',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('EMBRAER'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- HONEYWELL
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'HON',
  'HONEYWELL',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('HONEYWELL'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- HARTZELL PROPELLER INC
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'HAR',
  'HARTZELL PROPELLER INC',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('HARTZELL PROPELLER INC'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- Lycoming Textron
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'LYC',
  'Lycoming Textron',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('Lycoming Textron'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- KING AIR
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'BEECH',
  'KING AIR',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('KING AIR'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- Bombardier
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'BOM',
  'Bombardier',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('Bombardier'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- Learjet Inc. (Bombardier)
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'LEAR',
  'Learjet Inc. (Bombardier)',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('Learjet Inc. (Bombardier)'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- PIAGGIO AERO
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'PIA',
  'PIAGGIO AERO',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('PIAGGIO AERO'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- TAAL
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'TAAL',
  'TAAL',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('TAAL'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- PILATUS
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'PIL',
  'PILATUS',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('PILATUS'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- De Havilland Aircraft Company of Canada
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'DHC',
  'De Havilland Aircraft Company of Canada',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('De Havilland Aircraft Company of Canada'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

-- WILLIAMS INTERNATIONAL
INSERT INTO public.manufacturers (tenant_id, franchise_id, manufacturer_code, name, is_active, metadata)
SELECT
  'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid,
  NULL,
  'WIL',
  'WILLIAMS INTERNATIONAL',
  true,
  jsonb_build_object('source', 'seed_list')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manufacturers
  WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
    AND deleted_at IS NULL
    AND lower(btrim(name)) = lower(btrim('WILLIAMS INTERNATIONAL'))
)
ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO NOTHING;

COMMIT;
