-- Create schema reload helper function for PostgREST cache management
CREATE OR REPLACE FUNCTION public.reload_postgrest_schema()
RETURNS void AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
  NOTIFY pgrst, 'reload config';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure custom_fields column exists in activities table
ALTER TABLE IF EXISTS public.activities 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Create index for better performance on JSONB queries
CREATE INDEX IF NOT EXISTS idx_activities_custom_fields 
  ON public.activities USING GIN (custom_fields);

-- Force immediate schema reload
SELECT public.reload_postgrest_schema();