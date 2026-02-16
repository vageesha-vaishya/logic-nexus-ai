
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS currency_id UUID REFERENCES public.currencies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_currency_id ON public.quotes(currency_id);
