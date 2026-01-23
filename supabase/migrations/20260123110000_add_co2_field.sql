-- Add total_co2_kg to quotation_version_options
ALTER TABLE public.quotation_version_options
ADD COLUMN IF NOT EXISTS total_co2_kg NUMERIC DEFAULT 0;
