-- Migration: Create Cargo Simulations Table
-- Description: Stores results of Digital Twin packing simulations
-- Date: 2026-02-18

BEGIN;

CREATE TABLE IF NOT EXISTS public.cargo_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Inputs
    cargo_items JSONB NOT NULL, -- Array of CargoItem
    container_size_id UUID REFERENCES public.container_sizes(id),
    
    -- Results
    packing_method TEXT DEFAULT 'standard', -- 'standard', 'optimized', 'palletized'
    quantity_fit INTEGER,
    utilization_volume_percent NUMERIC(5,2),
    utilization_weight_percent NUMERIC(5,2),
    layout_plan JSONB, -- 3D coordinates or layout metadata
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE public.cargo_simulations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view simulations for their tenant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cargo_simulations' 
        AND policyname = 'Users can view simulations for their tenant'
    ) THEN
        CREATE POLICY "Users can view simulations for their tenant"
            ON public.cargo_simulations FOR SELECT
            USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- Policy: Users can create simulations for their tenant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cargo_simulations' 
        AND policyname = 'Users can create simulations for their tenant'
    ) THEN
        CREATE POLICY "Users can create simulations for their tenant"
            ON public.cargo_simulations FOR INSERT
            WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- Policy: Users can update their simulations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cargo_simulations' 
        AND policyname = 'Users can update their simulations'
    ) THEN
        CREATE POLICY "Users can update their simulations"
            ON public.cargo_simulations FOR UPDATE
            USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- Policy: Users can delete their simulations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cargo_simulations' 
        AND policyname = 'Users can delete their simulations'
    ) THEN
        CREATE POLICY "Users can delete their simulations"
            ON public.cargo_simulations FOR DELETE
            USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;

COMMIT;
