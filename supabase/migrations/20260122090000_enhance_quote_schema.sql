-- Enhancement for Multi-Modal Quotation Module (v10.0.0 Support)

-- 1. Enhance quotation_version_options to store route summary data
ALTER TABLE public.quotation_version_options
ADD COLUMN IF NOT EXISTS route_type TEXT CHECK (route_type IN ('Direct', 'Transshipment', 'Multi-Modal')),
ADD COLUMN IF NOT EXISTS total_co2_kg NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_transit_days NUMERIC,
ADD COLUMN IF NOT EXISTS total_stops INTEGER DEFAULT 0;

-- 2. Enhance quotation_version_option_legs to support detailed multi-leg routing
-- Ensure table exists first (it should, based on previous migrations)
CREATE TABLE IF NOT EXISTS public.quotation_version_option_legs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_version_option_id UUID REFERENCES public.quotation_version_options(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    mode TEXT NOT NULL,
    origin_location_id UUID REFERENCES public.ports_locations(id),
    destination_location_id UUID REFERENCES public.ports_locations(id),
    carrier_id UUID REFERENCES public.carriers(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns for enhanced leg details
ALTER TABLE public.quotation_version_option_legs
ADD COLUMN IF NOT EXISTS carrier_name TEXT, -- Fallback if carrier_id is null (e.g. ad-hoc carrier)
ADD COLUMN IF NOT EXISTS co2_kg NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS transit_time_hours INTEGER,
ADD COLUMN IF NOT EXISTS distance_km NUMERIC,
ADD COLUMN IF NOT EXISTS voyage_number TEXT,
ADD COLUMN IF NOT EXISTS transport_mode TEXT; -- 'road', 'rail', 'sea', 'air' (redundant if 'mode' exists, but ensuring consistency)

-- 3. Add carrier_rates enhancement for 10+ options logic (optional, if we want to store simulated rates permanently)
-- For now, we keep simulated rates in memory or ephemeral, but we might want to flag them if stored.
ALTER TABLE public.carrier_rates
ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN DEFAULT FALSE;

-- 4. Create index for faster leg retrieval
CREATE INDEX IF NOT EXISTS idx_quote_legs_option_id ON public.quotation_version_option_legs(quotation_version_option_id);

-- 5. Comments
COMMENT ON COLUMN public.quotation_version_options.route_type IS 'Direct, Transshipment, or Multi-Modal';
COMMENT ON COLUMN public.quotation_version_options.total_co2_kg IS 'Total CO2 emissions for this option in kg (ISO 14083)';
