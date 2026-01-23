
-- Add AI and Analysis fields to quotation_versions (Global Context)
ALTER TABLE public.quotation_versions
ADD COLUMN IF NOT EXISTS market_analysis TEXT,
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC,
ADD COLUMN IF NOT EXISTS anomalies JSONB DEFAULT '[]'::jsonb;

-- Add AI and Analysis fields to quotation_version_options (Per Option)
ALTER TABLE public.quotation_version_options
ADD COLUMN IF NOT EXISTS reliability_score NUMERIC,
ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_explanation TEXT;

-- Ensure source column exists (if not already)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotation_version_options'
        AND column_name = 'source'
    ) THEN
        ALTER TABLE public.quotation_version_options ADD COLUMN source TEXT;
    END IF;
END $$;
