ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low'));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_quotes_priority ON public.quotes(priority);

-- Update existing quotes to have a priority (random distribution for demo or based on value)
UPDATE public.quotes 
SET priority = CASE 
    WHEN sell_price > 10000 THEN 'high'
    WHEN sell_price > 2000 THEN 'medium'
    ELSE 'low'
END
WHERE priority IS NULL;
