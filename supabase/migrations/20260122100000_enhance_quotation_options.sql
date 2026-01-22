-- Enhancement for Multi-Carrier and Ad-Hoc Rate Options
-- Date: 2026-01-22
-- Description: Allows storing rates without strict carrier_rates FK (e.g. AI/Spot), 
-- adds detailed metadata columns, and supports source attribution.

-- 1. Make carrier_rate_id nullable to support ad-hoc/AI rates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'carrier_rate_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.quotation_version_options
      ALTER COLUMN carrier_rate_id DROP NOT NULL;
  END IF;
END $$;

-- 2. Add enhanced metadata columns if they don't exist
ALTER TABLE public.quotation_version_options
ADD COLUMN IF NOT EXISTS carrier_name TEXT,
ADD COLUMN IF NOT EXISTS service_type TEXT,
ADD COLUMN IF NOT EXISTS transit_time TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS valid_until DATE,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'; -- 'ai', 'spot', 'contract', 'manual'

-- 3. Add comment for clarity
COMMENT ON COLUMN public.quotation_version_options.source IS 'Source of the rate: ai, spot, contract, or manual';
COMMENT ON COLUMN public.quotation_version_options.carrier_rate_id IS 'Link to master rate if available, null for ad-hoc/AI rates';

-- 4. Create index for faster filtering by source
CREATE INDEX IF NOT EXISTS idx_quotation_options_source ON public.quotation_version_options(source);
