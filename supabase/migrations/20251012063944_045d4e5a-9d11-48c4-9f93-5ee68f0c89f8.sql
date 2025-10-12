-- Add missing version_number and kind columns to quotation_versions

ALTER TABLE public.quotation_versions 
ADD COLUMN IF NOT EXISTS version_number INTEGER,
ADD COLUMN IF NOT EXISTS kind TEXT CHECK (kind IN ('minor', 'major'));

-- Create a computed version number based on major.minor format or use a simple counter
-- For now, we'll use a simple sequential version_number
UPDATE public.quotation_versions 
SET version_number = (major * 1000 + minor)
WHERE version_number IS NULL;

-- Set kind based on whether it's a major version bump
UPDATE public.quotation_versions 
SET kind = CASE 
  WHEN minor = 0 THEN 'major'
  ELSE 'minor'
END
WHERE kind IS NULL;

-- Make version_number NOT NULL after populating
ALTER TABLE public.quotation_versions 
ALTER COLUMN version_number SET NOT NULL;

-- Create index for version_number ordering
CREATE INDEX IF NOT EXISTS idx_quotation_versions_version_number 
ON public.quotation_versions(quote_id, version_number DESC);