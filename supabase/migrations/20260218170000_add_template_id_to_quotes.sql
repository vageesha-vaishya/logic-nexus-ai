-- Add template_id column to quotes table
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.quote_templates(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_quotes_template_id ON public.quotes(template_id);
