-- Add missing columns to quotation_version_option_legs to support save_quote_atomic function
ALTER TABLE public.quotation_version_option_legs
ADD COLUMN IF NOT EXISTS transit_time TEXT,
ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.carriers(id);

-- Add index for provider_id for performance
CREATE INDEX IF NOT EXISTS idx_quotation_version_option_legs_provider_id ON public.quotation_version_option_legs(provider_id);
