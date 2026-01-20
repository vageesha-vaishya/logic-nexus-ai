-- Phase 1 Schema Updates for Quotation Module
-- Adds support for 3-Tier Rate Engine and enhanced Quote details

BEGIN;

-- 1. Enhance 'quotes' table
ALTER TABLE public.quotes 
  ADD COLUMN IF NOT EXISTS incoterms TEXT,
  ADD COLUMN IF NOT EXISTS ready_date DATE,
  ADD COLUMN IF NOT EXISTS service_level TEXT, -- e.g., 'Standard', 'Express', 'Saver'
  ADD COLUMN IF NOT EXISTS is_hazmat BOOLEAN DEFAULT false;

-- 2. Enhance 'quote_items' table
ALTER TABLE public.quote_items 
  ADD COLUMN IF NOT EXISTS hazmat_class TEXT,
  ADD COLUMN IF NOT EXISTS un_number TEXT; -- United Nations number for hazmat

-- 3. Enhance 'carrier_rates' to support 3-Tier Rate Engine
-- Tier 1: Contract (Customer specific)
-- Tier 2: Spot (Carrier specific, standard)
-- Tier 3: Market (General averages)

DO $$
BEGIN
  -- Add 'tier' column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'tier'
  ) THEN
    ALTER TABLE public.carrier_rates 
      ADD COLUMN tier TEXT CHECK (tier IN ('contract', 'spot', 'market')) DEFAULT 'spot';
  END IF;

  -- Add 'customer_id' for Contract rates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.carrier_rates 
      ADD COLUMN customer_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;
  
  -- Add 'effective_date' and 'expiry_date' if not present (carrier_rates might not have them, 'rates' did)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'valid_from'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN valid_from DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'valid_to'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN valid_to DATE;
  END IF;
END $$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_carrier_rates_tier ON public.carrier_rates(tier);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_customer ON public.carrier_rates(customer_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_validity ON public.carrier_rates(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_quotes_ready_date ON public.quotes(ready_date);

COMMIT;
