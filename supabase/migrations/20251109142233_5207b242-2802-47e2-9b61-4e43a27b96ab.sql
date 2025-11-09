-- Add unique constraints to geography tables for proper ON CONFLICT handling

-- Add unique constraint to states (country_id + code_iso should be unique)
ALTER TABLE public.states ADD CONSTRAINT states_country_code_key UNIQUE (country_id, code_iso);

-- Add unique constraint to cities (country_id + state_id + name should be unique)
ALTER TABLE public.cities ADD CONSTRAINT cities_country_state_name_key UNIQUE (country_id, state_id, name);