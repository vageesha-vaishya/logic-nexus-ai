
ALTER TABLE public.quotation_version_option_legs
ADD COLUMN IF NOT EXISTS flight_number text,
ADD COLUMN IF NOT EXISTS voyage_number text,
ADD COLUMN IF NOT EXISTS departure_date timestamptz,
ADD COLUMN IF NOT EXISTS arrival_date timestamptz,
ADD COLUMN IF NOT EXISTS transit_time_hours integer;
