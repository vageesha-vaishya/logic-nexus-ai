-- Add custom_fields column to leads table for flexible data storage
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Add index for better performance on custom fields queries
CREATE INDEX IF NOT EXISTS idx_leads_custom_fields ON public.leads USING GIN (custom_fields);