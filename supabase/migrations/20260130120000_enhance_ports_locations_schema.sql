-- Enhance ports_locations schema for standardized codes and hierarchy
BEGIN;

-- Add standard code columns (nullable to avoid breaking existing data)
ALTER TABLE public.ports_locations
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS iata_code text,
  ADD COLUMN IF NOT EXISTS icao_code text,
  ADD COLUMN IF NOT EXISTS un_locode text,
  ADD COLUMN IF NOT EXISTS region_name text,
  ADD COLUMN IF NOT EXISTS country_id uuid,
  ADD COLUMN IF NOT EXISTS city_id uuid;

-- Optional: link to countries/cities tables if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'countries') THEN
    ALTER TABLE public.ports_locations
      ADD CONSTRAINT ports_locations_country_fk
      FOREIGN KEY (country_id) REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cities') THEN
    ALTER TABLE public.ports_locations
      ADD CONSTRAINT ports_locations_city_fk
      FOREIGN KEY (city_id) REFERENCES public.cities(id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- Code format checks (only when provided)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.ports_locations
      ADD CONSTRAINT ports_locations_iata_format_chk
      CHECK (iata_code IS NULL OR iata_code ~ '^[A-Z]{3}$');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.ports_locations
      ADD CONSTRAINT ports_locations_icao_format_chk
      CHECK (icao_code IS NULL OR icao_code ~ '^[A-Z]{4}$');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.ports_locations
      ADD CONSTRAINT ports_locations_unlocode_format_chk
      CHECK (un_locode IS NULL OR un_locode ~ '^[A-Z]{2}[A-Z0-9]{3}$');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.ports_locations
      ADD CONSTRAINT ports_locations_country_code_chk
      CHECK (country_code IS NULL OR char_length(country_code) BETWEEN 2 AND 3);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Note: We intentionally avoid adding a UNIQUE constraint now to prevent failure if duplicates exist.
-- Deduplication is handled in seed script and can be enforced later with an index.

COMMIT;

