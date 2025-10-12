-- Retrofit carrier rates module tables to support quote versioning

-- Add missing columns to carrier_rates if they don't exist
DO $$ 
BEGIN
  -- Add carrier_id column for proper foreign key relationship
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'carrier_id'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN carrier_id UUID;
  END IF;

  -- Add origin_port_id for route-based rates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'origin_port_id'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN origin_port_id UUID;
  END IF;

  -- Add destination_port_id for route-based rates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'destination_port_id'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN destination_port_id UUID;
  END IF;

  -- Add mode for transportation type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'mode'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN mode TEXT;
  END IF;

  -- Add rate_reference_id for linking to quotes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'rate_reference_id'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN rate_reference_id TEXT;
  END IF;

  -- Add status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

-- Create carrier_rate_charges table for detailed charge breakdown
CREATE TABLE IF NOT EXISTS public.carrier_rate_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  carrier_rate_id UUID NOT NULL,
  charge_type TEXT NOT NULL,
  basis TEXT,
  quantity NUMERIC DEFAULT 1,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on carrier_rate_charges
ALTER TABLE public.carrier_rate_charges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for carrier_rate_charges
CREATE POLICY "Platform admins can manage all carrier rate charges"
  ON public.carrier_rate_charges FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage carrier rate charges"
  ON public.carrier_rate_charges FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can view tenant carrier rate charges"
  ON public.carrier_rate_charges FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
  -- Add FK from carrier_rates to carriers if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'carrier_rates_carrier_id_fkey'
  ) THEN
    ALTER TABLE public.carrier_rates 
    ADD CONSTRAINT carrier_rates_carrier_id_fkey 
    FOREIGN KEY (carrier_id) REFERENCES public.carriers(id) ON DELETE CASCADE;
  END IF;

  -- Add FK from carrier_rate_charges to carrier_rates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'carrier_rate_charges_carrier_rate_id_fkey'
  ) THEN
    ALTER TABLE public.carrier_rate_charges 
    ADD CONSTRAINT carrier_rate_charges_carrier_rate_id_fkey 
    FOREIGN KEY (carrier_rate_id) REFERENCES public.carrier_rates(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_carrier_rates_carrier_id ON public.carrier_rates(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_origin_port ON public.carrier_rates(origin_port_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_destination_port ON public.carrier_rates(destination_port_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_reference ON public.carrier_rates(rate_reference_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rate_charges_rate_id ON public.carrier_rate_charges(carrier_rate_id);