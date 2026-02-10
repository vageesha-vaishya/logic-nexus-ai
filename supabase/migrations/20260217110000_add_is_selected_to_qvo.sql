
-- Add is_selected column to quotation_version_options
ALTER TABLE public.quotation_version_options 
ADD COLUMN IF NOT EXISTS is_selected BOOLEAN DEFAULT false;
