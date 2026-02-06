-- Create shipment_containers table for tracking actual container execution details
-- Links to shipment_cargo_configurations to fulfill the requested capacity

BEGIN;

CREATE TABLE IF NOT EXISTS public.shipment_containers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Identification
    container_number TEXT NOT NULL,
    seal_number TEXT,
    
    -- Type (Denormalized or linked)
    container_type TEXT, -- e.g. '40HC', '20GP'
    
    -- Weights
    gross_weight_kg NUMERIC,
    tare_weight_kg NUMERIC,
    net_weight_kg NUMERIC,
    
    -- Volume
    volume_cbm NUMERIC,
    
    -- Link to the configuration request this container fulfills
    cargo_configuration_id UUID REFERENCES public.shipment_cargo_configurations(id),
    
    -- Metadata
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipment_containers_shipment_id ON public.shipment_containers(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_containers_tenant_id ON public.shipment_containers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipment_containers_config_id ON public.shipment_containers(cargo_configuration_id);

-- RLS
ALTER TABLE public.shipment_containers ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'shipment_containers' AND policyname = 'Tenant read shipment containers'
    ) THEN
        CREATE POLICY "Tenant read shipment containers" ON public.shipment_containers
            FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'shipment_containers' AND policyname = 'Tenant write shipment containers'
    ) THEN
        CREATE POLICY "Tenant write shipment containers" ON public.shipment_containers
            FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));
    END IF;
END $$;

-- Triggers
DROP TRIGGER IF EXISTS update_shipment_containers_modtime ON public.shipment_containers;
CREATE TRIGGER update_shipment_containers_modtime
    BEFORE UPDATE ON public.shipment_containers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
