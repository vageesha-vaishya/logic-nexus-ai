-- Add frequency column to quotation_version_options for MGL Template support
-- This enables specifying service frequency (e.g., "Weekly", "Bi-Weekly") per option

ALTER TABLE public.quotation_version_options
ADD COLUMN IF NOT EXISTS frequency TEXT;

COMMENT ON COLUMN public.quotation_version_options.frequency IS 'Service frequency (e.g., Weekly, Daily)';
