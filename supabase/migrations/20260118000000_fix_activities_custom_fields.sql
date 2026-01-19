-- Ensure custom_fields column exists in activities table
BEGIN;

ALTER TABLE IF EXISTS public.activities 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Create index for better performance on JSONB queries
CREATE INDEX IF NOT EXISTS idx_activities_custom_fields ON public.activities USING GIN (custom_fields);

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

COMMIT;
