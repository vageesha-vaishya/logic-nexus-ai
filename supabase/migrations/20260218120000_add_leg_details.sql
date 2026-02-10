-- Add detailed tracking fields to quote_option_legs
ALTER TABLE public.quotation_version_option_legs
  ADD COLUMN IF NOT EXISTS carrier_id uuid REFERENCES public.carriers(id),
  ADD COLUMN IF NOT EXISTS flight_number text,
  ADD COLUMN IF NOT EXISTS voyage_number text,
  ADD COLUMN IF NOT EXISTS departure_date timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_date timestamptz;

-- Add index for carrier lookups
CREATE INDEX IF NOT EXISTS idx_quote_legs_carrier_id ON public.quotation_version_option_legs(carrier_id);
