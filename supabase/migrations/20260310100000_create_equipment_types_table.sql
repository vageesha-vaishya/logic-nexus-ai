-- Create equipment_types table for container and equipment specifications
-- This table defines the various equipment types used in freight transportation

CREATE TABLE IF NOT EXISTS public.equipment_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    equipment_code text NOT NULL,
    description text NOT NULL,
    equipment_category text NOT NULL CHECK (equipment_category IN ('dry', 'reefer', 'tank', 'flat_rack', 'open_top', 'special')),
    max_payload_kg numeric(10,2) NOT NULL,
    tare_weight_kg numeric(10,2) NOT NULL,
    internal_length_mm integer NOT NULL,
    internal_width_mm integer NOT NULL,
    internal_height_mm integer NOT NULL,
    door_width_mm integer,
    door_height_mm integer,
    temperature_range text,
    special_features jsonb DEFAULT '[]'::jsonb,
    is_reefer boolean NOT NULL DEFAULT false,
    requires_power boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    
    -- Ensure unique equipment codes per tenant
    CONSTRAINT equipment_types_unique_code UNIQUE (tenant_id, equipment_code)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.equipment_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view equipment_types within their tenant" 
    ON public.equipment_types 
    FOR SELECT 
    USING (tenant_id = auth.uid() OR auth.jwt() ->> 'tenant_id' = tenant_id::text);

CREATE POLICY "Users can insert equipment_types within their tenant" 
    ON public.equipment_types 
    FOR INSERT 
    WITH CHECK (tenant_id = auth.uid() OR auth.jwt() ->> 'tenant_id' = tenant_id::text);

CREATE POLICY "Users can update equipment_types within their tenant" 
    ON public.equipment_types 
    FOR UPDATE 
    USING (tenant_id = auth.uid() OR auth.jwt() ->> 'tenant_id' = tenant_id::text);

CREATE POLICY "Users can delete equipment_types within their tenant" 
    ON public.equipment_types 
    FOR DELETE 
    USING (tenant_id = auth.uid() OR auth.jwt() ->> 'tenant_id' = tenant_id::text);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_equipment_types_tenant_id ON public.equipment_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_equipment_types_equipment_code ON public.equipment_types(equipment_code);
CREATE INDEX IF NOT EXISTS idx_equipment_types_category ON public.equipment_types(equipment_category);
CREATE INDEX IF NOT EXISTS idx_equipment_types_is_reefer ON public.equipment_types(is_reefer);

-- Add comment for documentation
COMMENT ON TABLE public.equipment_types IS 'Defines various equipment and container types used in freight transportation with detailed specifications';
COMMENT ON COLUMN public.equipment_types.equipment_code IS 'Standard equipment code (e.g., 20ST, 40HC, 20RF)';
COMMENT ON COLUMN public.equipment_types.equipment_category IS 'Equipment category: dry, reefer, tank, flat_rack, open_top, special';
COMMENT ON COLUMN public.equipment_types.max_payload_kg IS 'Maximum payload capacity in kilograms';
COMMENT ON COLUMN public.equipment_types.tare_weight_kg IS 'Empty weight of the equipment in kilograms';
COMMENT ON COLUMN public.equipment_types.temperature_range IS 'Temperature range for reefer containers (e.g., [-35°C, +30°C])';
COMMENT ON COLUMN public.equipment_types.special_features IS 'JSON array of special features and capabilities';
COMMENT ON COLUMN public.equipment_types.is_reefer IS 'Indicates if this is a refrigerated container';
COMMENT ON COLUMN public.equipment_types.requires_power IS 'Indicates if this equipment requires external power';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_equipment_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_equipment_types_updated_at
    BEFORE UPDATE ON public.equipment_types
    FOR EACH ROW
    EXECUTE FUNCTION public.update_equipment_types_updated_at();