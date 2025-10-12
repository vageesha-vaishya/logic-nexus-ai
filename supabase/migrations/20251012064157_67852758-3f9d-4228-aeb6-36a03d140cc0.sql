-- Add status column to quotation_versions
ALTER TABLE public.quotation_versions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';