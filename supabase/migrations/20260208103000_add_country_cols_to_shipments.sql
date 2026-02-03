
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS origin_country TEXT,
ADD COLUMN IF NOT EXISTS destination_country TEXT;

-- Update existing records if needed (optional, or set default)
-- For now, we leave them null or set defaults if appropriate
