
-- Extend quotes table to support multi-modal specific data
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS origin_code TEXT, -- Store raw code (e.g., USLAX)
  ADD COLUMN IF NOT EXISTS destination_code TEXT, -- Store raw code (e.g., CNSHA)
  ADD COLUMN IF NOT EXISTS transport_mode TEXT, -- air, ocean, road (denormalized for easy access)
  ADD COLUMN IF NOT EXISTS cargo_details JSONB DEFAULT '{}', -- HTS, Schedule B, Commodity Class
  ADD COLUMN IF NOT EXISTS unit_details JSONB DEFAULT '{}', -- Container Type, Dims, Weight, Special Handling
  ADD COLUMN IF NOT EXISTS compliance_checks JSONB DEFAULT '{}'; -- AI Validation results

-- Create indexes for JSONB fields to support searching if needed later
CREATE INDEX IF NOT EXISTS idx_quotes_transport_mode ON public.quotes(transport_mode);
CREATE INDEX IF NOT EXISTS idx_quotes_cargo_details ON public.quotes USING GIN (cargo_details);

-- Update rate_calculations to store more details if needed
ALTER TABLE public.rate_calculations
  ADD COLUMN IF NOT EXISTS input_parameters JSONB; -- Store what was sent to rate engine
