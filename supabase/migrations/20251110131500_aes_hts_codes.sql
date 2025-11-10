-- Create AES HTS Codes management table
-- Includes:
-- - Required fields and types
-- - Format check constraint for hts_code
-- - Uniqueness enforcement for hts_code
-- - Helpful indexes for lookups and search

-- Ensure pgcrypto exists for gen_random_uuid (commonly present)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.aes_hts_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hts_code VARCHAR(15) NOT NULL,
  schedule_b VARCHAR(15),
  category VARCHAR(100) NOT NULL,
  sub_category VARCHAR(100),
  sub_sub_category VARCHAR(100),
  description TEXT NOT NULL,
  unit_of_measure VARCHAR(50),
  duty_rate VARCHAR(50),
  special_provisions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hts_code_format_check CHECK (hts_code ~ '^[0-9]{4}(\.[0-9]{2}){0,3}$')
);

-- Enforce uniqueness of hts_code to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'aes_hts_codes_hts_code_unique'
  ) THEN
    ALTER TABLE public.aes_hts_codes
      ADD CONSTRAINT aes_hts_codes_hts_code_unique UNIQUE (hts_code);
  END IF;
END$$;

-- Lookup and search indexes
CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_hts_code ON public.aes_hts_codes(hts_code);
CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_category ON public.aes_hts_codes(category);
CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_description_tsv ON public.aes_hts_codes USING GIN (to_tsvector('english', description));

COMMENT ON TABLE public.aes_hts_codes IS 'HTS/Schedule B codes master data for AES module.';
COMMENT ON COLUMN public.aes_hts_codes.hts_code IS 'Primary classification code (unique, validated format).';
COMMENT ON COLUMN public.aes_hts_codes.schedule_b IS 'US export classification (optional).';
COMMENT ON COLUMN public.aes_hts_codes.category IS 'High-level category (required).';
COMMENT ON COLUMN public.aes_hts_codes.description IS 'Detailed description (required).';