
-- Migration to add quote_cargo_configurations table
-- Supports multi-modal cargo units (Containers, ULDs, etc.)

CREATE TABLE IF NOT EXISTS public.quote_cargo_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Classification
    transport_mode TEXT NOT NULL, -- 'ocean', 'air', 'road', 'rail'
    cargo_type TEXT NOT NULL, -- 'FCL', 'LCL', 'Breakbulk', 'RoRo'
    
    -- Equipment/Unit Details
    container_type TEXT, -- 'Standard', 'High Cube', 'Open Top', 'Flat Rack', 'Reefer', 'Tank', 'ULD', 'Trailer'
    container_size TEXT, -- '20', '40', '45', 'LD3', 'LD7', '53'
    quantity INTEGER NOT NULL DEFAULT 1,
    
    -- Weight & Volume (Per Unit)
    unit_weight_kg NUMERIC,
    unit_volume_cbm NUMERIC,
    
    -- Dimensions (Per Unit - relevant for LCL/OOG)
    length_cm NUMERIC,
    width_cm NUMERIC,
    height_cm NUMERIC,
    
    -- Special Handling
    is_hazardous BOOLEAN DEFAULT false,
    hazardous_class TEXT,
    un_number TEXT,
    is_temperature_controlled BOOLEAN DEFAULT false,
    temperature_min NUMERIC,
    temperature_max NUMERIC,
    temperature_unit TEXT DEFAULT 'C', -- 'C' or 'F'
    
    -- References
    package_category_id UUID REFERENCES public.package_categories(id),
    package_size_id UUID REFERENCES public.package_sizes(id),
    
    remarks TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_quote_cargo_quote_id ON public.quote_cargo_configurations(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_cargo_tenant_id ON public.quote_cargo_configurations(tenant_id);

-- Enable RLS
ALTER TABLE public.quote_cargo_configurations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenant read cargo configs" ON public.quote_cargo_configurations
    FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant write cargo configs" ON public.quote_cargo_configurations
    FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Add triggers for updated_at
CREATE TRIGGER update_quote_cargo_modtime
    BEFORE UPDATE ON public.quote_cargo_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
