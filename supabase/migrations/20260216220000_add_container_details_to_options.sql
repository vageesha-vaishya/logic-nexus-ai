-- Add container size and type columns to quotation_version_options
-- This enables per-container-size options for Matrix Quotes (MGL Style)

ALTER TABLE public.quotation_version_options
ADD COLUMN IF NOT EXISTS container_size_id UUID REFERENCES public.container_sizes(id),
ADD COLUMN IF NOT EXISTS container_type_id UUID REFERENCES public.container_types(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotation_version_options_container_size ON public.quotation_version_options(container_size_id);
CREATE INDEX IF NOT EXISTS idx_quotation_version_options_container_type ON public.quotation_version_options(container_type_id);
