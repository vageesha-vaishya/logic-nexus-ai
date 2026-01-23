-- Add tier column to quotation_version_options
ALTER TABLE public.quotation_version_options
ADD COLUMN IF NOT EXISTS tier TEXT;
