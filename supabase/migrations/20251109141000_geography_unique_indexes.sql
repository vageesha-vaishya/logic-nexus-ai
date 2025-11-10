-- Unique indexes for idempotent upserts on geography tables

BEGIN;

-- Ensure states are unique per country by ISO code (if provided)
CREATE UNIQUE INDEX IF NOT EXISTS states_country_iso_unique
ON public.states (country_id, code_iso)
WHERE code_iso IS NOT NULL;

-- Optionally also unique by (country_id, name) to avoid duplicates by name
CREATE UNIQUE INDEX IF NOT EXISTS states_country_name_unique
ON public.states (country_id, name);

-- Ensure cities unique per (country, state, name)
CREATE UNIQUE INDEX IF NOT EXISTS cities_country_state_name_unique
ON public.cities (country_id, state_id, name);

COMMIT;