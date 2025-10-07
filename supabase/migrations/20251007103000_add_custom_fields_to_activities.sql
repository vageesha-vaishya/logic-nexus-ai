-- Add custom_fields column to activities table for flexible data storage
BEGIN;

ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Helpful index for querying nested keys
CREATE INDEX IF NOT EXISTS idx_activities_custom_fields ON public.activities USING GIN (custom_fields);

COMMIT;