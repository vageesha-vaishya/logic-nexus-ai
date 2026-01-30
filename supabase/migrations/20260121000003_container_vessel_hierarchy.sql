-- Migration: Container and Vessel Hierarchy
-- Description: Implements comprehensive container shipping data management structure
-- Author: Trae AI
-- Date: 2026-01-21

BEGIN;

--------------------------------------------------------------------------------
-- 1. Container Category Level Implementation
--------------------------------------------------------------------------------

-- Container Types (Categories)
CREATE TABLE IF NOT EXISTS public.container_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add new columns safely
DO $$
BEGIN
    ALTER TABLE public.container_types ADD COLUMN IF NOT EXISTS requires_temperature BOOLEAN DEFAULT false;
    ALTER TABLE public.container_types ADD COLUMN IF NOT EXISTS requires_ventilation BOOLEAN DEFAULT false;
    ALTER TABLE public.container_types ADD COLUMN IF NOT EXISTS requires_power BOOLEAN DEFAULT false;
    ALTER TABLE public.container_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
END $$;

-- Container Type Attributes (for sub-category tracking)
CREATE TABLE IF NOT EXISTS public.container_type_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_id UUID REFERENCES public.container_types(id) ON DELETE CASCADE,
    attribute_key TEXT NOT NULL,
    attribute_label TEXT NOT NULL,
    data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'range')),
    validation_rule JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

--------------------------------------------------------------------------------
-- 2. Container Size Level Implementation
--------------------------------------------------------------------------------

-- Container Sizes (ISO Standards)
CREATE TABLE IF NOT EXISTS public.container_sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_id UUID REFERENCES public.container_types(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add new columns safely
DO $$
BEGIN
    ALTER TABLE public.container_sizes ADD COLUMN IF NOT EXISTS type_id UUID REFERENCES public.container_types(id) ON DELETE RESTRICT;
    ALTER TABLE public.container_sizes ADD COLUMN IF NOT EXISTS iso_code TEXT; -- Made nullable initially to avoid errors on existing rows
    ALTER TABLE public.container_sizes ADD COLUMN IF NOT EXISTS length_ft NUMERIC(10,2);
    ALTER TABLE public.container_sizes ADD COLUMN IF NOT EXISTS width_ft NUMERIC(10,2) DEFAULT 8.00;
    ALTER TABLE public.container_sizes ADD COLUMN IF NOT EXISTS height_ft NUMERIC(10,2) DEFAULT 8.50;
    ALTER TABLE public.container_sizes ADD COLUMN IF NOT EXISTS max_gross_weight_kg NUMERIC(10,2);
    ALTER TABLE public.container_sizes ADD COLUMN IF NOT EXISTS teu_factor NUMERIC(4,2) DEFAULT 1.00;
    ALTER TABLE public.container_sizes ADD COLUMN IF NOT EXISTS is_high_cube BOOLEAN DEFAULT false;
    ALTER TABLE public.container_sizes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
END $$;

--------------------------------------------------------------------------------
-- 3. Container Quantity Level Implementation (Transaction/Inventory)
--------------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE public.container_status AS ENUM (
        'empty', 'loaded', 'maintenance', 'reserved', 'in_transit'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Container Inventory/Transactions
CREATE TABLE IF NOT EXISTS public.container_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    size_id UUID REFERENCES public.container_sizes(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    status public.container_status NOT NULL DEFAULT 'empty',
    location_name TEXT,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Snapshot fields for historical integrity
    teu_total NUMERIC(10,2)
);

-- Trigger to calculate TEU total on insert/update
CREATE OR REPLACE FUNCTION public.calculate_container_teu()
RETURNS TRIGGER AS $$
DECLARE
    v_teu_factor NUMERIC;
BEGIN
    SELECT COALESCE(teu_factor, 1.0) INTO v_teu_factor
    FROM public.container_sizes
    WHERE id = NEW.size_id;

    NEW.teu_total := NEW.quantity * v_teu_factor;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_container_teu ON public.container_tracking;
CREATE TRIGGER trigger_calculate_container_teu
BEFORE INSERT OR UPDATE ON public.container_tracking
FOR EACH ROW
EXECUTE FUNCTION public.calculate_container_teu();

-- Index for historical trend analysis
CREATE INDEX IF NOT EXISTS idx_container_tracking_tenant_date 
ON public.container_tracking (tenant_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_container_tracking_size_status 
ON public.container_tracking (size_id, status);

--------------------------------------------------------------------------------
-- 4. Mother Mode of Transportation Hierarchy (Vessels)
--------------------------------------------------------------------------------

-- Vessel Types
CREATE TABLE IF NOT EXISTS public.vessel_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT
);

-- Vessel Classes
CREATE TABLE IF NOT EXISTS public.vessel_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_id UUID REFERENCES public.vessel_types(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    min_teu INTEGER,
    max_teu INTEGER,
    draft_limit_meters NUMERIC(5,2),
    beam_limit_meters NUMERIC(5,2)
);

-- Specific Vessels
CREATE TABLE IF NOT EXISTS public.vessels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    carrier_id UUID REFERENCES public.carriers(id),
    class_id UUID REFERENCES public.vessel_classes(id),
    name TEXT NOT NULL,
    imo_number TEXT UNIQUE,
    flag_country TEXT,
    built_year INTEGER,
    capacity_teu INTEGER,
    current_status TEXT DEFAULT 'active',
    metadata JSONB
);

-- Operational Metrics (Time-series data for vessels)
CREATE TABLE IF NOT EXISTS public.vessel_operational_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    transit_time_hours NUMERIC,
    fuel_efficiency_index NUMERIC,
    port_calls_count INTEGER,
    average_speed_knots NUMERIC
);

--------------------------------------------------------------------------------
-- Seed Data (Safe Upserts)
--------------------------------------------------------------------------------

-- Seed Container Types
INSERT INTO public.container_types (code, name, requires_temperature) VALUES
('STD', 'Standard Dry', false),
('RF', 'Refrigerated', true),
('OT', 'Open Top', false),
('FR', 'Flat Rack', false),
('TK', 'Tank', false)
ON CONFLICT (code) DO UPDATE SET 
    requires_temperature = EXCLUDED.requires_temperature;

-- Seed Vessel Types
INSERT INTO public.vessel_types (code, name) VALUES
('CONT', 'Container Ship'),
('BULK', 'Bulk Carrier'),
('TANK', 'Tanker')
ON CONFLICT (code) DO NOTHING;

--------------------------------------------------------------------------------
-- RLS Policies
--------------------------------------------------------------------------------

-- Helper function to drop policy if exists
CREATE OR REPLACE FUNCTION drop_policy_if_exists(table_name text, policy_name text) RETURNS void AS $$
BEGIN
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.container_tracking ENABLE ROW LEVEL SECURITY;

SELECT drop_policy_if_exists('container_tracking', 'Tenants can view their own container tracking');
CREATE POLICY "Tenants can view their own container tracking"
ON public.container_tracking FOR SELECT
USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

SELECT drop_policy_if_exists('container_tracking', 'Tenants can insert their own container tracking');
CREATE POLICY "Tenants can insert their own container tracking"
ON public.container_tracking FOR INSERT
WITH CHECK (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

-- Reference tables
ALTER TABLE public.container_types ENABLE ROW LEVEL SECURITY;
SELECT drop_policy_if_exists('container_types', 'Public read container types');
CREATE POLICY "Public read container types" ON public.container_types FOR SELECT TO authenticated USING (true);

ALTER TABLE public.container_sizes ENABLE ROW LEVEL SECURITY;
SELECT drop_policy_if_exists('container_sizes', 'Public read container sizes');
CREATE POLICY "Public read container sizes" ON public.container_sizes FOR SELECT TO authenticated USING (true);

ALTER TABLE public.vessel_types ENABLE ROW LEVEL SECURITY;
SELECT drop_policy_if_exists('vessel_types', 'Public read vessel types');
CREATE POLICY "Public read vessel types" ON public.vessel_types FOR SELECT TO authenticated USING (true);

ALTER TABLE public.vessel_classes ENABLE ROW LEVEL SECURITY;
SELECT drop_policy_if_exists('vessel_classes', 'Public read vessel classes');
CREATE POLICY "Public read vessel classes" ON public.vessel_classes FOR SELECT TO authenticated USING (true);

ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;
SELECT drop_policy_if_exists('vessels', 'Public read vessels');
CREATE POLICY "Public read vessels" ON public.vessels FOR SELECT TO authenticated USING (true);

--------------------------------------------------------------------------------
-- Views for Drill-Down Reporting
--------------------------------------------------------------------------------

DROP VIEW IF EXISTS public.view_container_inventory_summary;
CREATE OR REPLACE VIEW public.view_container_inventory_summary AS
SELECT 
    ct.tenant_id,
    c_type.name as category,
    c_size.name as size,
    c_size.iso_code,
    sum(ct.quantity) as total_quantity,
    sum(ct.teu_total) as total_teu,
    ct.status
FROM public.container_tracking ct
JOIN public.container_sizes c_size ON ct.size_id = c_size.id
JOIN public.container_types c_type ON c_size.type_id = c_type.id
GROUP BY ct.tenant_id, c_type.name, c_size.name, c_size.iso_code, ct.status;

COMMIT;
