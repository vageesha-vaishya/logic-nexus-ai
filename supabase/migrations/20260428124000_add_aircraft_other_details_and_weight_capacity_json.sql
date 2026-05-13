-- Add JSON snapshots for Aircraft Other Details and Total Weight & Capacity sections.
ALTER TABLE IF EXISTS public.aircraft
ADD COLUMN IF NOT EXISTS aircraft_other_details_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS public.aircraft
ADD COLUMN IF NOT EXISTS aircraft_weight_and_capacity_json jsonb NOT NULL DEFAULT '{}'::jsonb;
