-- DB-VERIFICATION: amro-manufacturers-global-reset-reviewed
-- DB-ARCH-APPROVAL: amro-manufacturers-global-reset-approved
-- SCHEMA-OVERLAP-ANALYSIS: Verified manufacturers no longer require tenant/franchise scope; global registry needed for aircraft/helicopter uniqueness.
-- EXTENSION-ASSESSMENT: Global manufacturers cannot be represented by extending tenant-scoped tables due to cross-tenant uniqueness requirements.
-- EXTENSION-RATIONALE: Recreate manufacturers as a global table with unique manufacturer names and codes.

BEGIN;

ALTER TABLE public.aircraft DROP CONSTRAINT IF EXISTS aircraft_manufacturer_id_fkey;

DROP TABLE IF EXISTS public.manufacturers;

CREATE TABLE IF NOT EXISTS public.manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_code text NOT NULL,
  name text NOT NULL,
  country text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_manufacturers_code_active
  ON public.manufacturers(manufacturer_code)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_manufacturers_name_active
  ON public.manufacturers(lower(name))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manufacturers_is_active ON public.manufacturers(is_active);
CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON public.manufacturers(lower(name));

ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amro_platform_admin_access ON public.manufacturers;
CREATE POLICY amro_platform_admin_access
  ON public.manufacturers
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_authenticated_access ON public.manufacturers;
CREATE POLICY amro_authenticated_access
  ON public.manufacturers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS manufacturer_id uuid;

ALTER TABLE public.aircraft
  ADD CONSTRAINT aircraft_manufacturer_id_fkey
  FOREIGN KEY (manufacturer_id)
  REFERENCES public.manufacturers(id)
  ON DELETE SET NULL;

WITH input(name, order_key) AS (
  VALUES
    ('AIRBUS', 1),
    ('ATR', 2),
    ('ATR 72', 3),
    ('Beech Aircraft Corporation, Wichita, Kansas, USA', 4),
    ('BELL HELICOPTER TEXTRON', 5),
    ('Bombardier', 6),
    ('CENTRAL GEARBOX', 7),
    ('CESSNA AIRCRAFT COMPANY', 8),
    ('CESSNA CARAVAN 208B', 9),
    ('CESSNA CITATION', 10),
    ('DASSAULT AVIATION', 11),
    ('De Havilland Aircraft Company of Canada', 12),
    ('EMBRAER', 13),
    ('EUROCOPTER', 14),
    ('FZM', 15),
    ('Hartzell', 16),
    ('HARTZELL PROPELLER INC', 17),
    ('HAWKER BEECHCRAFT', 18),
    ('HINDUSTAN AERONAUTICS LTD', 19),
    ('HONEYWELL', 20),
    ('Keystone Helicopter', 21),
    ('KING AIR', 22),
    ('Learjet Inc. (Bombardier)', 23),
    ('Lycoming Textron', 24),
    ('McCAULEY', 25),
    ('PARTHENAVIA', 26),
    ('PIAGGIO AERO', 27),
    ('Pilatus', 28),
    ('PILATUS PC-12', 29),
    ('Pratt & Whittney', 30),
    ('RAYTHEON AIRCRAFT COMPANY', 31),
    ('ROLLS ROYCE', 32),
    ('Schweizer', 33),
    ('SGST', 34),
    ('SUPER KING AIR', 35),
    ('TAAL', 36),
    ('TURBOMECA', 37),
    ('VULCAN AIR', 38),
    ('Westland Agusta', 39),
    ('WESTLAND AUGUSTA', 40),
    ('WILLIAMS INTERNATIONAL', 41)
),
normalized AS (
  SELECT
    name,
    order_key,
    lower(btrim(name)) AS normalized_name,
    left(regexp_replace(upper(lower(btrim(name))), '[^A-Z0-9]+', '_', 'g'), 18) || '-' || substring(md5(lower(btrim(name))), 1, 4) AS manufacturer_code
  FROM input
  WHERE btrim(name) <> ''
),
deduped AS (
  SELECT DISTINCT ON (manufacturer_code)
    name,
    normalized_name,
    manufacturer_code,
    order_key
  FROM normalized
  ORDER BY manufacturer_code, order_key
),
seeded AS (
  INSERT INTO public.manufacturers (manufacturer_code, name, is_active, metadata)
  SELECT
    manufacturer_code,
    name,
    true,
    jsonb_build_object('source', 'seed_list')
  FROM deduped
  ON CONFLICT (manufacturer_code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id, name
),
aircraft_source AS (
  SELECT
    lower(btrim(manufacturer)) AS normalized_name,
    manufacturer,
    left(regexp_replace(upper(lower(btrim(manufacturer))), '[^A-Z0-9]+', '_', 'g'), 18) || '-' || substring(md5(lower(btrim(manufacturer))), 1, 4) AS manufacturer_code
  FROM public.aircraft
  WHERE manufacturer IS NOT NULL AND btrim(manufacturer) <> ''
  GROUP BY lower(btrim(manufacturer)), manufacturer
),
aircraft_deduped AS (
  SELECT DISTINCT ON (manufacturer_code)
    normalized_name,
    manufacturer,
    manufacturer_code
  FROM aircraft_source
  ORDER BY manufacturer_code, manufacturer
),
aircraft_insert AS (
  INSERT INTO public.manufacturers (manufacturer_code, name, is_active, metadata)
  SELECT
    manufacturer_code,
    manufacturer,
    true,
    jsonb_build_object('source', 'aircraft_backfill')
  FROM aircraft_deduped
  ON CONFLICT (manufacturer_code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id, name
)
UPDATE public.aircraft AS aircraft
SET manufacturer_id = manufacturers.id
FROM public.manufacturers AS manufacturers
WHERE aircraft.manufacturer_id IS NULL
  AND lower(btrim(aircraft.manufacturer)) = lower(btrim(manufacturers.name));

CREATE INDEX IF NOT EXISTS idx_aircraft_manufacturer_id ON public.aircraft(manufacturer_id);

COMMIT;
