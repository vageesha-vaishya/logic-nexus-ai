DO $$ BEGIN
  -- 2. Ensure account_id has Foreign Key constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'quotes' AND kcu.column_name = 'account_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
      ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_account_id_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_account_id_fkey FOREIGN KEY (account_id)
      REFERENCES public.accounts(id)
      ON DELETE SET NULL;
  END IF;

  -- 3. Ensure franchise_id has Foreign Key constraint
  -- This is likely the cause of "franchises:franchise_id(name)" failure if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'quotes' AND kcu.column_name = 'franchise_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_franchise_id_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_franchise_id_fkey FOREIGN KEY (franchise_id)
    REFERENCES public.franchises(id)
    ON DELETE SET NULL;
  END IF;

  -- 4. Ensure service_type_id exists and has Foreign Key constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'quotes' AND kcu.column_name = 'service_type_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_service_type_id_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_service_type_id_fkey FOREIGN KEY (service_type_id)
    REFERENCES public.service_types(id)
    ON DELETE SET NULL;
  END IF;

  -- 5. Ensure opportunity_id has Foreign Key constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'quotes' AND kcu.column_name = 'opportunity_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_opportunity_id_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_opportunity_id_fkey FOREIGN KEY (opportunity_id)
    REFERENCES public.opportunities(id)
    ON DELETE SET NULL;
  END IF;

END $$;
-- Add detailed attributes to transport_modes for dynamic UI and validation
ALTER TABLE public.transport_modes 
ADD COLUMN IF NOT EXISTS validation_rules JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS supported_units JSONB DEFAULT '[]'::jsonb;

-- Seed update for existing modes
-- Air
UPDATE public.transport_modes 
SET 
  validation_rules = '{
    "origin_type": ["airport"],
    "destination_type": ["airport"],
    "weight_limit_kg": 100000,
    "required_fields": ["weight", "commodity"]
  }'::jsonb,
  supported_units = '["kg", "lbs"]'::jsonb
WHERE code = 'air';

-- Ocean
UPDATE public.transport_modes 
SET 
  validation_rules = '{
    "origin_type": ["seaport", "terminal", "inland_port"],
    "destination_type": ["seaport", "terminal", "inland_port"],
    "required_fields": ["volume", "container_type", "commodity"]
  }'::jsonb,
  supported_units = '["cbm", "teu", "feu"]'::jsonb
WHERE code = 'ocean';

-- Road
UPDATE public.transport_modes 
SET 
  validation_rules = '{
    "origin_type": ["city", "zip"],
    "destination_type": ["city", "zip"],
    "required_fields": ["weight", "commodity", "distance"]
  }'::jsonb,
  supported_units = '["kg", "lbs", "ton"]'::jsonb
WHERE code = 'road';

-- Rail
UPDATE public.transport_modes 
SET 
  validation_rules = '{
    "origin_type": ["rail_terminal"],
    "destination_type": ["rail_terminal"],
    "required_fields": ["weight", "container_type"]
  }'::jsonb,
  supported_units = '["container"]'::jsonb
WHERE code = 'rail';
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
DROP FUNCTION IF EXISTS public.calculate_container_teu();
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
DROP FUNCTION IF EXISTS drop_policy_if_exists(table_name text, policy_name text);
CREATE OR REPLACE FUNCTION drop_policy_if_exists(table_name text, policy_name text) RETURNS void AS $$
BEGIN
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.container_tracking ENABLE ROW LEVEL SECURITY;

SELECT drop_policy_if_exists('container_tracking', 'Tenants can view their own container tracking');
DROP POLICY IF EXISTS "Tenants can view their own container tracking" ON public.container_tracking;
CREATE POLICY "Tenants can view their own container tracking" ON public.container_tracking FOR SELECT
USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

SELECT drop_policy_if_exists('container_tracking', 'Tenants can insert their own container tracking');
DROP POLICY IF EXISTS "Tenants can insert their own container tracking" ON public.container_tracking;
CREATE POLICY "Tenants can insert their own container tracking" ON public.container_tracking FOR INSERT
WITH CHECK (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

-- Reference tables
ALTER TABLE public.container_types ENABLE ROW LEVEL SECURITY;
SELECT drop_policy_if_exists('container_types', 'Public read container types');
DROP POLICY IF EXISTS "Public read container types" ON public.container_types;
CREATE POLICY "Public read container types" ON public.container_types FOR SELECT TO authenticated USING (true);

ALTER TABLE public.container_sizes ENABLE ROW LEVEL SECURITY;
SELECT drop_policy_if_exists('container_sizes', 'Public read container sizes');
DROP POLICY IF EXISTS "Public read container sizes" ON public.container_sizes;
CREATE POLICY "Public read container sizes" ON public.container_sizes FOR SELECT TO authenticated USING (true);

ALTER TABLE public.vessel_types ENABLE ROW LEVEL SECURITY;
SELECT drop_policy_if_exists('vessel_types', 'Public read vessel types');
DROP POLICY IF EXISTS "Public read vessel types" ON public.vessel_types;
CREATE POLICY "Public read vessel types" ON public.vessel_types FOR SELECT TO authenticated USING (true);

ALTER TABLE public.vessel_classes ENABLE ROW LEVEL SECURITY;
SELECT drop_policy_if_exists('vessel_classes', 'Public read vessel classes');
DROP POLICY IF EXISTS "Public read vessel classes" ON public.vessel_classes;
CREATE POLICY "Public read vessel classes" ON public.vessel_classes FOR SELECT TO authenticated USING (true);

ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;
SELECT drop_policy_if_exists('vessels', 'Public read vessels');
DROP POLICY IF EXISTS "Public read vessels" ON public.vessels;
CREATE POLICY "Public read vessels" ON public.vessels FOR SELECT TO authenticated USING (true);

--------------------------------------------------------------------------------
-- Views for Drill-Down Reporting
--------------------------------------------------------------------------------

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
-- Migration: Fix Container Types Schema
-- Description: Adds missing 'description' column to container_types if it doesn't exist (legacy schema support)
-- Author: Trae AI
-- Date: 2026-01-21

BEGIN;

DO $$
BEGIN
    ALTER TABLE public.container_types ADD COLUMN IF NOT EXISTS description TEXT;
END $$;

COMMIT;
-- Rename customer_id to account_id in carrier_rates table
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carrier_rates' AND column_name = 'customer_id') THEN
        ALTER TABLE carrier_rates RENAME COLUMN customer_id TO account_id;
    END IF;
END $$;
-- Enhanced Container Logic Migration

-- 1. Container Transactions Table (History/Granular Tracking)
CREATE TABLE IF NOT EXISTS public.container_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
    size_id UUID REFERENCES public.container_sizes(id) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'AUDIT')),
    quantity_change INTEGER NOT NULL,
    location_name TEXT NOT NULL,
    status TEXT DEFAULT 'AVAILABLE', -- Status of containers (Empty, Loaded, etc.)
    reference_id TEXT, -- Shipment ID, Order ID, etc.
    notes TEXT,
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_container_transactions_tenant_date ON public.container_transactions(tenant_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_container_transactions_size ON public.container_transactions(size_id);
CREATE INDEX IF NOT EXISTS idx_container_transactions_location ON public.container_transactions(location_name);

-- 2. Vessel Hierarchy Enhancements
-- Vessel Class Capacities (Specific limits per container size if needed, beyond just TEU)
CREATE TABLE IF NOT EXISTS public.vessel_class_capacities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.vessel_classes(id) ON DELETE CASCADE,
    container_size_id UUID REFERENCES public.container_sizes(id) ON DELETE CASCADE,
    max_slots INTEGER, -- specific limit for this container size
    weight_limit_per_slot_kg NUMERIC,
    tenant_id UUID REFERENCES public.tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Policies
ALTER TABLE public.container_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vessel_class_capacities ENABLE ROW LEVEL SECURITY;

-- Transactions Policy
DROP POLICY IF EXISTS "Tenant Access Transactions" ON public.container_transactions;
CREATE POLICY "Tenant Access Transactions" ON public.container_transactions
    USING (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::UUID));

DROP POLICY IF EXISTS "Tenant Insert Transactions" ON public.container_transactions;
CREATE POLICY "Tenant Insert Transactions" ON public.container_transactions
    WITH CHECK (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::UUID));

-- Vessel Capacities Policy
DROP POLICY IF EXISTS "Tenant Access Vessel Capacities" ON public.vessel_class_capacities;
CREATE POLICY "Tenant Access Vessel Capacities" ON public.vessel_class_capacities
    USING (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::UUID));

-- 4. Constraint for Summary Table Upsert
-- We need to ensure container_tracking allows unique identification for upserts
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'container_tracking_unique_key'
    ) THEN
        ALTER TABLE public.container_tracking DROP CONSTRAINT IF EXISTS container_tracking_unique_key;
ALTER TABLE public.container_tracking ADD CONSTRAINT container_tracking_unique_key UNIQUE (tenant_id, size_id, location_name, status);
    END IF;
END $$;

-- 5. Trigger to Maintain Summary (Container Tracking)
DROP FUNCTION IF EXISTS public.update_container_inventory_summary();
CREATE OR REPLACE FUNCTION public.update_container_inventory_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the summary table (container_tracking)
    -- We assume container_tracking tracks current counts per size, location, and status
    
    INSERT INTO public.container_tracking (
        tenant_id, 
        size_id, 
        location_name, 
        status, 
        quantity, 
        teu_total, 
        recorded_at
    )
    VALUES (
        NEW.tenant_id, 
        NEW.size_id, 
        NEW.location_name, 
        NEW.status::public.container_status, -- Cast to enum if needed, assuming status maps to container_status enum
        NEW.quantity_change,
        0, -- Will calculate TEU below or let trigger handle it if exists
        NOW()
    )
    ON CONFLICT (tenant_id, size_id, location_name, status)
    DO UPDATE SET 
        quantity = public.container_tracking.quantity + NEW.quantity_change,
        recorded_at = NOW();
        
    -- Note: TEU calculation should ideally be done via join or separate trigger, 
    -- but for simplicity we'll leave TEU update to the application or a separate recalculation
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory ON public.container_transactions;
CREATE TRIGGER trigger_update_inventory
AFTER INSERT ON public.container_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_container_inventory_summary();

-- 6. Helper Function for TEU Calculation
DROP FUNCTION IF EXISTS public.calculate_teu(p_size_id UUID, p_quantity INTEGER);
CREATE OR REPLACE FUNCTION public.calculate_teu(
    p_size_id UUID,
    p_quantity INTEGER
)
RETURNS NUMERIC AS $$
DECLARE
    v_teu_factor NUMERIC;
BEGIN
    SELECT teu_factor INTO v_teu_factor
    FROM public.container_sizes
    WHERE id = p_size_id;
    
    RETURN COALESCE(v_teu_factor, 0) * p_quantity;
END;
$$ LANGUAGE plpgsql;

-- 7. View for Analytics
DROP VIEW IF EXISTS public.view_container_inventory_summary CASCADE;

CREATE OR REPLACE VIEW public.view_container_inventory_summary AS
SELECT 
    ct.id,
    ct.tenant_id,
    ct.size_id,
    ct.location_name,
    t.name as category,
    s.name as size,
    s.iso_code,
    ct.status,
    ct.quantity as total_quantity,
    (ct.quantity * COALESCE(s.teu_factor, 0)) as total_teu
FROM public.container_tracking ct
JOIN public.container_sizes s ON ct.size_id = s.id
LEFT JOIN public.container_types t ON s.type_id = t.id;

-- Grant access to view

-- Fix trigger logic to use UPDATE/INSERT pattern instead of ON CONFLICT
-- This resolves potential issues with unique constraint resolution in some contexts

DROP FUNCTION IF EXISTS public.update_container_inventory_summary();
CREATE OR REPLACE FUNCTION public.update_container_inventory_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_status public.container_status;
BEGIN
    -- Cast status explicitly
    v_status := NEW.status::public.container_status;

    -- Try UPDATE first
    UPDATE public.container_tracking
    SET 
        quantity = quantity + NEW.quantity_change,
        recorded_at = NOW()
    WHERE 
        tenant_id = NEW.tenant_id
        AND size_id = NEW.size_id
        AND location_name = NEW.location_name
        AND status = v_status;

    -- If no row updated, INSERT
    IF NOT FOUND THEN
        INSERT INTO public.container_tracking (
            tenant_id, 
            size_id, 
            location_name, 
            status, 
            quantity, 
            teu_total, 
            recorded_at
        )
        VALUES (
            NEW.tenant_id, 
            NEW.size_id, 
            NEW.location_name, 
            v_status,
            NEW.quantity_change,
            0, -- TEU calc trigger will handle this
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Extend quotes table to support multi-modal specific data
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS origin_code TEXT, -- Store raw code (e.g., USLAX)
  ADD COLUMN IF NOT EXISTS destination_code TEXT, -- Store raw code (e.g., CNSHA)
  ADD COLUMN IF NOT EXISTS transport_mode TEXT, -- air, ocean, road (denormalized for easy access)
  ADD COLUMN IF NOT EXISTS cargo_details JSONB DEFAULT '{}', -- HTS, Schedule B, Commodity Class
  ADD COLUMN IF NOT EXISTS unit_details JSONB DEFAULT '{}', -- Container Type, Dims, Weight, Special Handling
  ADD COLUMN IF NOT EXISTS compliance_checks JSONB DEFAULT '{}'; -- AI Validation results

-- Create indexes for JSONB fields to support searching if needed later
CREATE INDEX IF NOT EXISTS idx_quotes_transport_mode ON public.quotes(transport_mode);
CREATE INDEX IF NOT EXISTS idx_quotes_cargo_details ON public.quotes USING GIN (cargo_details);

-- Update rate_calculations to store more details if needed
ALTER TABLE public.rate_calculations
  ADD COLUMN IF NOT EXISTS input_parameters JSONB; -- Store what was sent to rate engine
create table if not exists public.quote_audit_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id),
    action text not null,
    payload jsonb,
    result_summary jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz default now()
);

-- RLS
alter table public.quote_audit_logs enable row level security;

-- Drop policies if they exist to avoid errors on re-run
drop policy if exists "Admins can view all audit logs" on public.quote_audit_logs;
drop policy if exists "Users can view their own audit logs" on public.quote_audit_logs;
drop policy if exists "Service role can insert logs" on public.quote_audit_logs;

-- Admins can view all
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.quote_audit_logs;
CREATE POLICY "Admins can view all audit logs" ON public.quote_audit_logs
    for select
    using ( 
        (auth.jwt() ->> 'role')::text = 'service_role' 
        or 
        exists (
            select 1 from public.user_roles ur
            where ur.user_id = auth.uid()
            and ur.role::text = 'platform_admin'
        )
    );

-- Users can view their own
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.quote_audit_logs;
CREATE POLICY "Users can view their own audit logs" ON public.quote_audit_logs
    for select
    using ( auth.uid() = user_id );

-- Service role can insert (and authenticated users for now, controlled by app logic)
DROP POLICY IF EXISTS "Service role can insert logs" ON public.quote_audit_logs;
CREATE POLICY "Service role can insert logs" ON public.quote_audit_logs
    for insert
    with check ( true );
-- Create the AI Quote Cache table if it doesn't exist
create table if not exists public.ai_quote_cache (
    id uuid default gen_random_uuid() primary key,
    request_hash text not null,
    response_payload jsonb not null,
    created_at timestamptz default now(),
    expires_at timestamptz default (now() + interval '24 hours')
);

-- Add index for cache lookup
create index if not exists idx_ai_quote_cache_hash on public.ai_quote_cache(request_hash);
create index if not exists idx_ai_quote_cache_expires on public.ai_quote_cache(expires_at);

-- Enable RLS
alter table public.ai_quote_cache enable row level security;

-- Drop policies if they exist to avoid errors
drop policy if exists "Service role can manage cache" on public.ai_quote_cache;
drop policy if exists "Authenticated users can read cache" on public.ai_quote_cache;
drop policy if exists "Authenticated users can insert cache" on public.ai_quote_cache;

-- Service role can do everything
DROP POLICY IF EXISTS "Service role can manage cache" ON public.ai_quote_cache;
CREATE POLICY "Service role can manage cache" ON public.ai_quote_cache
    for all
    using ( (auth.jwt() ->> 'role')::text = 'service_role' )
    with check ( (auth.jwt() ->> 'role')::text = 'service_role' );

-- Authenticated users can read valid cache entries
DROP POLICY IF EXISTS "Authenticated users can read cache" ON public.ai_quote_cache;
CREATE POLICY "Authenticated users can read cache" ON public.ai_quote_cache
    for select
    using ( expires_at > now() );

-- Authenticated users can insert cache (needed if Edge Function uses user token)
DROP POLICY IF EXISTS "Authenticated users can insert cache" ON public.ai_quote_cache;
CREATE POLICY "Authenticated users can insert cache" ON public.ai_quote_cache
    for insert
    with check ( true );
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

-- Enhancement for Multi-Carrier and Ad-Hoc Rate Options
-- Date: 2026-01-22
-- Description: Allows storing rates without strict carrier_rates FK (e.g. AI/Spot), 
-- adds detailed metadata columns, and supports source attribution.

-- 1. Make carrier_rate_id nullable to support ad-hoc/AI rates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'carrier_rate_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.quotation_version_options
      ALTER COLUMN carrier_rate_id DROP NOT NULL;
  END IF;
END $$;

-- 2. Add enhanced metadata columns if they don't exist
ALTER TABLE public.quotation_version_options
ADD COLUMN IF NOT EXISTS carrier_name TEXT,
ADD COLUMN IF NOT EXISTS service_type TEXT,
ADD COLUMN IF NOT EXISTS transit_time TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS valid_until DATE,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'; -- 'ai', 'spot', 'contract', 'manual'

-- 3. Add comment for clarity

-- 4. Create index for faster filtering by source
CREATE INDEX IF NOT EXISTS idx_quotation_options_source ON public.quotation_version_options(source);
-- Fix broken trigger function that references non-existent column transit_time_days
-- This function is triggered BEFORE INSERT on quotation_version_options

DROP FUNCTION IF EXISTS public.populate_option_from_rate();
CREATE OR REPLACE FUNCTION public.populate_option_from_rate()
RETURNS trigger
AS $$
DECLARE
  v_total numeric;
BEGIN
  -- Only attempt to fetch if carrier_rate_id is provided and valid
  IF NEW.carrier_rate_id IS NOT NULL THEN
    -- carrier_rates does not have transit_time_days, so we only fetch total_amount
    -- We select into v_total to avoid overwriting if not found (though select into nulls if no row)
    
    SELECT r.total_amount INTO v_total
    FROM public.carrier_rates r WHERE r.id = NEW.carrier_rate_id;

    -- Only override if we actually found a value (and found the rate)
    -- If SELECT returns no rows, v_total is NULL.
    -- If rate exists but total_amount is NULL, v_total is NULL.
    -- In both cases we probably don't want to overwrite a potentially valid user-supplied total_amount 
    -- unless we are sure the rate exists.
    -- But existing logic was: NEW.total_amount := v_total; which overwrites.
    
    -- Improved logic: only overwrite if v_total is NOT NULL.
    IF v_total IS NOT NULL THEN
      NEW.total_amount := v_total;
    END IF;
    
    -- Removed: NEW.transit_days := v_transit; (Column transit_time_days does not exist in carrier_rates)
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Fix audit log triggers to handle FK constraints correctly
-- The issue: "BEFORE INSERT" trigger tries to log a row before it exists, causing FK violation in audit log
-- Solution: 
-- 1. INSERT must be AFTER (so row exists for FK check)
-- 2. DELETE must be BEFORE (so row still exists for FK check)
-- 3. UPDATE can be AFTER (to capture final state)

-- ==========================================
-- 1. Fix quotation_version_options trigger
-- ==========================================
DROP TRIGGER IF EXISTS log_option_changes_trigger ON quotation_version_options;

-- Trigger for INSERT and UPDATE (AFTER)
DROP TRIGGER IF EXISTS log_option_changes_trigger_insert_update ON quotation_version_options;
CREATE TRIGGER log_option_changes_trigger_insert_update
  AFTER INSERT OR UPDATE ON quotation_version_options
  FOR EACH ROW
  EXECUTE FUNCTION log_option_changes();

-- Trigger for DELETE (BEFORE)
DROP TRIGGER IF EXISTS log_option_changes_trigger_delete ON quotation_version_options;
CREATE TRIGGER log_option_changes_trigger_delete
  BEFORE DELETE ON quotation_version_options
  FOR EACH ROW
  EXECUTE FUNCTION log_option_changes();

-- ==========================================
-- 2. Fix quotation_versions trigger (consistency)
-- ==========================================
DROP TRIGGER IF EXISTS log_version_changes_trigger ON quotation_versions;

-- Trigger for INSERT and UPDATE (AFTER)
DROP TRIGGER IF EXISTS log_version_changes_trigger_insert_update ON quotation_versions;
CREATE TRIGGER log_version_changes_trigger_insert_update
  AFTER INSERT OR UPDATE ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION log_version_changes();

-- Trigger for DELETE (BEFORE)
DROP TRIGGER IF EXISTS log_version_changes_trigger_delete ON quotation_versions;
CREATE TRIGGER log_version_changes_trigger_delete
  BEFORE DELETE ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION log_version_changes();
DROP FUNCTION IF EXISTS log_option_changes();
CREATE OR REPLACE FUNCTION log_option_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_changes JSONB;
BEGIN
  v_action := TG_OP;
  
  IF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := row_to_json(OLD)::JSONB;
  END IF;
  
  -- Wrap insert in exception block to handle potential FK race conditions
  BEGIN
    INSERT INTO quotation_audit_log (
      tenant_id,
      quotation_version_id,
      quotation_version_option_id,
      entity_type,
      entity_id,
      action,
      changes,
      user_id
    ) VALUES (
      COALESCE(NEW.tenant_id, OLD.tenant_id),
      COALESCE(NEW.quotation_version_id, OLD.quotation_version_id),
      COALESCE(NEW.id, OLD.id),
      'quotation_version_option',
      COALESCE(NEW.id, OLD.id),
      v_action,
      v_changes,
      auth.uid()
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      -- Silently ignore FK violations during insert
      -- This can happen if the parent record is not yet fully visible to the trigger
      NULL;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;
-- Fix missing foreign key relationship for PostgREST
-- This ensures quote_charges references quotation_version_option_legs correctly

DO $$
BEGIN
    -- 1. Drop potentially incorrect foreign keys on leg_id
    ALTER TABLE public.quote_charges DROP CONSTRAINT IF EXISTS fk_quote_charges_leg;
    ALTER TABLE public.quote_charges DROP CONSTRAINT IF EXISTS quote_charges_leg_id_fkey;

    -- 2. Add the correct foreign key pointing to quotation_version_option_legs
    -- This is required for the embedding: quotation_version_option_legs -> quote_charges
    ALTER TABLE public.quote_charges
      ADD CONSTRAINT quote_charges_leg_id_fkey
      FOREIGN KEY (leg_id)
      REFERENCES public.quotation_version_option_legs(id)
      ON DELETE CASCADE;

    -- 3. Ensure the quote_option_id FK is also correct (pointing to options, not quote_options)
    ALTER TABLE public.quote_charges DROP CONSTRAINT IF EXISTS quote_charges_quote_option_id_fkey;
    
    ALTER TABLE public.quote_charges
      ADD CONSTRAINT quote_charges_quote_option_id_fkey
      FOREIGN KEY (quote_option_id)
      REFERENCES public.quotation_version_options(id)
      ON DELETE CASCADE;

    -- 4. Notify PostgREST to reload schema cache (happens automatically on DDL, but good to be explicit in intent)
    NOTIFY pgrst, 'reload config';

END $$;
DROP FUNCTION IF EXISTS delete_quotes_cascade(quote_ids UUID[]);
CREATE OR REPLACE FUNCTION delete_quotes_cascade(quote_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Unlink Opportunities (set primary_quote_id to NULL)
  -- This is often the blocker for deletion if ON DELETE SET NULL is not configured
  UPDATE opportunities 
  SET primary_quote_id = NULL 
  WHERE primary_quote_id = ANY(quote_ids);

  -- 2. Explicitly delete dependent tables to ensure no orphans or FK violations
  -- Although many might have ON DELETE CASCADE, explicit deletion in correct order is safer
  -- and handles cases where CASCADE might be missing.
  
  -- Delete quote_charges linked to options of these quotes
  -- Using subqueries to traverse: quotes -> versions -> options -> charges
  DELETE FROM quote_charges 
  WHERE quote_option_id IN (
    SELECT id FROM quotation_version_options 
    WHERE quotation_version_id IN (
      SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids)
    )
  );

  -- Delete legs (quotation_version_option_legs)
  DELETE FROM quotation_version_option_legs 
  WHERE quotation_version_option_id IN (
    SELECT id FROM quotation_version_options 
    WHERE quotation_version_id IN (
      SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids)
    )
  );
  
  -- Delete legacy/other legs (quote_legs)
  -- Note: quote_legs references quote_option_id which maps to quotation_version_options.id
  DELETE FROM quote_legs 
  WHERE quote_option_id IN (
    SELECT id FROM quotation_version_options 
    WHERE quotation_version_id IN (
      SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids)
    )
  );

  -- Delete options
  DELETE FROM quotation_version_options 
  WHERE quotation_version_id IN (
    SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids)
  );

  -- Delete versions
  DELETE FROM quotation_versions 
  WHERE quote_id = ANY(quote_ids);

  -- Finally delete the quotes
  DELETE FROM quotes WHERE id = ANY(quote_ids);
END;
$$;
-- Grant execute permission to authenticated users and service_role

-- Optional: verify function exists by replacing it (idempotent)
DROP FUNCTION IF EXISTS delete_quotes_cascade(quote_ids UUID[]);
CREATE OR REPLACE FUNCTION delete_quotes_cascade(quote_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Unlink Opportunities (set primary_quote_id to NULL)
  UPDATE opportunities 
  SET primary_quote_id = NULL 
  WHERE primary_quote_id = ANY(quote_ids);

  -- 2. Explicitly delete dependent tables
  
  -- Delete quote_charges linked to options of these quotes
  DELETE FROM quote_charges 
  WHERE quote_option_id IN (
    SELECT id FROM quotation_version_options 
    WHERE quotation_version_id IN (
      SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids)
    )
  );

  -- Delete legs (quotation_version_option_legs)
  DELETE FROM quotation_version_option_legs 
  WHERE quotation_version_option_id IN (
    SELECT id FROM quotation_version_options 
    WHERE quotation_version_id IN (
      SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids)
    )
  );
  
  -- Delete legacy/other legs (quote_legs)
  DELETE FROM quote_legs 
  WHERE quote_option_id IN (
    SELECT id FROM quotation_version_options 
    WHERE quotation_version_id IN (
      SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids)
    )
  );

  -- Delete options
  DELETE FROM quotation_version_options 
  WHERE quotation_version_id IN (
    SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids)
  );

  -- Delete versions
  DELETE FROM quotation_versions 
  WHERE quote_id = ANY(quote_ids);

  -- Finally delete the quotes
  DELETE FROM quotes WHERE id = ANY(quote_ids);
END;
$$;

-- Add AI and Analysis fields to quotation_versions (Global Context)
ALTER TABLE public.quotation_versions
ADD COLUMN IF NOT EXISTS market_analysis TEXT,
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC,
ADD COLUMN IF NOT EXISTS anomalies JSONB DEFAULT '[]'::jsonb;

-- Add AI and Analysis fields to quotation_version_options (Per Option)
ALTER TABLE public.quotation_version_options
ADD COLUMN IF NOT EXISTS reliability_score NUMERIC,
ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_explanation TEXT;

-- Ensure source column exists (if not already)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotation_version_options'
        AND column_name = 'source'
    ) THEN
        ALTER TABLE public.quotation_version_options ADD COLUMN IF NOT EXISTS source TEXT;
    END IF;
END $$;
-- Add total_co2_kg to quotation_version_options
ALTER TABLE public.quotation_version_options
ADD COLUMN IF NOT EXISTS total_co2_kg NUMERIC DEFAULT 0;
-- Add scac_code column to carriers to prevent 400 errors if requested
-- This aliases the existing 'scac' column logic
ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS scac_code TEXT;

-- Sync existing scac values to scac_code
UPDATE public.carriers
SET scac_code = scac
WHERE scac IS NOT NULL AND scac_code IS NULL;

-- Create a trigger to keep them in sync (optional, but good practice if we maintain both)
DROP FUNCTION IF EXISTS sync_scac_columns();
CREATE OR REPLACE FUNCTION sync_scac_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scac IS DISTINCT FROM OLD.scac THEN
    NEW.scac_code := NEW.scac;
  ELSIF NEW.scac_code IS DISTINCT FROM OLD.scac_code THEN
    NEW.scac := NEW.scac_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_scac ON public.carriers;
CREATE TRIGGER trg_sync_scac
BEFORE INSERT OR UPDATE ON public.carriers
FOR EACH ROW
EXECUTE FUNCTION sync_scac_columns();
-- Add tier column to quotation_version_options
ALTER TABLE public.quotation_version_options
ADD COLUMN IF NOT EXISTS tier TEXT;
CREATE TABLE IF NOT EXISTS public.ai_quote_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    request_payload JSONB NOT NULL,
    response_payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'generated', -- generated, converted
    quote_id UUID REFERENCES public.quotes(id) -- Linked if converted
);

-- Add RLS
ALTER TABLE public.ai_quote_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own AI requests" ON public.ai_quote_requests;
CREATE POLICY "Users can view their own AI requests" ON public.ai_quote_requests
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own AI requests" ON public.ai_quote_requests;
CREATE POLICY "Users can insert their own AI requests" ON public.ai_quote_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Grant permissions

-- Function to get user queues with counts
-- This is required by EmailClient.tsx and useQueueManagement.ts
-- It joins queues with emails to get accurate counts per queue for the current tenant

DROP FUNCTION IF EXISTS public.get_user_queues();
CREATE OR REPLACE FUNCTION public.get_user_queues()
RETURNS TABLE (
    queue_id UUID,
    queue_name TEXT,
    queue_type TEXT,
    description TEXT,
    email_count BIGINT,
    unread_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Get current user's tenant
    v_tenant_id := public.get_user_tenant_id(auth.uid());

    -- Fallback if get_user_tenant_id returns null (try user_roles directly)
    IF v_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id
        FROM public.user_roles
        WHERE user_id = auth.uid()
        LIMIT 1;
    END IF;

    -- If still no tenant, return empty
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- Check if user is tenant admin
    v_is_admin := public.has_role(auth.uid(), 'tenant_admin'::public.app_role);

    RETURN QUERY
    SELECT 
        q.id as queue_id,
        q.name as queue_name,
        q.type::text as queue_type, -- Cast enum/text to text to be safe
        q.description,
        COUNT(e.id)::BIGINT as email_count,
        COUNT(CASE WHEN e.is_read = false THEN 1 END)::BIGINT as unread_count
    FROM public.queues q
    LEFT JOIN public.emails e ON q.name = e.queue AND e.tenant_id = q.tenant_id
    WHERE q.tenant_id = v_tenant_id
    AND (
        v_is_admin 
        OR EXISTS (
            SELECT 1 FROM public.queue_members qm
            WHERE qm.queue_id = q.id AND qm.user_id = auth.uid()
        )
    )
    GROUP BY q.id, q.name, q.type, q.description
    ORDER BY q.name;
END;
$$;

-- Grant execute permission to authenticated users

-- Add AI fields to emails table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'ai_sentiment') THEN
        ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS ai_sentiment TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'ai_urgency') THEN
        ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS ai_urgency TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'intent') THEN
        ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS intent TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'category') THEN
        ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS category TEXT;
    END IF;
    -- Add queue column to emails for easier querying
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'queue') THEN
        ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS queue TEXT;
    END IF;
END $$;

-- Create routing_events table
CREATE TABLE IF NOT EXISTS public.routing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
    queue TEXT NOT NULL,
    sla_minutes INTEGER,
    routed_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.routing_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Tenant admins can view routing events" ON public.routing_events;
DROP POLICY IF EXISTS "Tenant admins can view routing events" ON public.routing_events;
CREATE POLICY "Tenant admins can view routing events" ON public.routing_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.emails e
      WHERE e.id = routing_events.email_id
      AND e.tenant_id = get_user_tenant_id(auth.uid())
      AND has_role(auth.uid(), 'tenant_admin')
    )
  );

DROP POLICY IF EXISTS "Users can view routing events for accessible emails" ON public.routing_events;
DROP POLICY IF EXISTS "Users can view routing events for accessible emails" ON public.routing_events;
CREATE POLICY "Users can view routing events for accessible emails" ON public.routing_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.emails e
      WHERE e.id = routing_events.email_id
      AND (
          e.account_id IN (SELECT id FROM public.email_accounts WHERE user_id = auth.uid())
          OR
          e.tenant_id = get_user_tenant_id(auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Service role can manage all" ON public.routing_events;
DROP POLICY IF EXISTS "Service role can manage all" ON public.routing_events;
CREATE POLICY "Service role can manage all" ON public.routing_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to get queue counts
-- Now we can just count from emails table directly which is faster and simpler
DROP FUNCTION IF EXISTS get_queue_counts();
CREATE OR REPLACE FUNCTION get_queue_counts()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_object_agg(queue, count)
  FROM (
    SELECT queue, count(*) as count
    FROM emails
    WHERE queue IS NOT NULL
    GROUP BY queue
  ) t;
$$;

-- BACKFILL LOGIC FOR EXISTING EMAILS
DO $$
DECLARE
    r RECORD;
    v_category TEXT;
    v_sentiment TEXT;
    v_intent TEXT;
    v_queue TEXT;
    v_sla INTEGER;
    v_combined TEXT;
BEGIN
    FOR r IN SELECT id, subject, body_text FROM emails WHERE queue IS NULL LOOP
        v_combined := LOWER(COALESCE(r.subject, '') || ' ' || COALESCE(r.body_text, ''));
        
        -- 1. Classification
        -- Category
        IF v_combined LIKE '%feedback%' OR v_combined LIKE '%survey%' OR v_combined LIKE '%nps%' THEN
            v_category := 'feedback';
        ELSIF v_combined LIKE '%support%' OR v_combined LIKE '%help%' OR v_combined LIKE '%issue%' OR v_combined LIKE '%quote%' THEN
            v_category := 'crm';
        ELSE
            v_category := 'non_crm';
        END IF;

        -- Sentiment
        IF v_combined LIKE '%angry%' OR v_combined LIKE '%upset%' OR v_combined LIKE '%terrible%' OR v_combined LIKE '%worst%' THEN
            v_sentiment := 'very_negative';
        ELSIF v_combined LIKE '%bad%' OR v_combined LIKE '%poor%' OR v_combined LIKE '%disappointed%' THEN
            v_sentiment := 'negative';
        ELSIF v_combined LIKE '%great%' OR v_combined LIKE '%excellent%' OR v_combined LIKE '%love%' THEN
            v_sentiment := 'positive';
        ELSE
            v_sentiment := 'neutral';
        END IF;

        -- Intent
        IF v_combined LIKE '%price%' OR v_combined LIKE '%cost%' OR v_combined LIKE '%buy%' OR v_combined LIKE '%purchase%' THEN
            v_intent := 'sales';
        ELSIF v_combined LIKE '%broken%' OR v_combined LIKE '%error%' OR v_combined LIKE '%bug%' OR v_combined LIKE '%fail%' THEN
            v_intent := 'support';
        ELSE
            v_intent := 'other';
        END IF;

        -- 2. Routing
        v_queue := 'support_general';
        v_sla := 60;

        IF v_category = 'feedback' AND (v_sentiment = 'negative' OR v_sentiment = 'very_negative') THEN
            v_queue := 'cfm_negative';
            v_sla := 30;
        ELSIF v_category = 'crm' AND v_sentiment = 'very_negative' THEN
            v_queue := 'support_priority';
            v_sla := 15;
        ELSIF v_intent = 'sales' THEN
            v_queue := 'sales_inbound';
            v_sla := 120;
        END IF;

        -- 3. Update Email
        UPDATE emails 
        SET 
            category = v_category,
            ai_sentiment = v_sentiment,
            intent = v_intent,
            queue = v_queue,
            ai_urgency = CASE WHEN v_sla <= 30 THEN 'high' ELSE 'medium' END
        WHERE id = r.id;

        -- 4. Insert Routing Event
        INSERT INTO routing_events (email_id, queue, sla_minutes, metadata)
        VALUES (r.id, v_queue, v_sla, jsonb_build_object('source', 'backfill'));
        
    END LOOP;
END $$;
-- ==============================================================================
-- STRICT QUEUE SYSTEM IMPLEMENTATION
-- 1. Queue Rules & Auto-Assignment
-- 2. Strict RLS Enforcement (Emails & Queues)
-- 3. Robust Queue Counts
-- ==============================================================================

-- 1. Create Queue Assignment Rules Table
CREATE TABLE IF NOT EXISTS public.queue_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 0, -- Higher number = higher priority
    criteria JSONB NOT NULL, -- e.g., {"subject_contains": "urgent", "from_domain": "vip.com"}
    target_queue_name TEXT NOT NULL, -- Target queue name (must exist in queues table)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_queue_rules_tenant_priority ON public.queue_rules(tenant_id, priority DESC);

-- Enable RLS on rules
ALTER TABLE public.queue_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can manage queue rules" ON public.queue_rules;
CREATE POLICY "Tenant admins can manage queue rules" ON public.queue_rules
    FOR ALL
    USING (
        public.has_role(auth.uid(), 'tenant_admin'::public.app_role) 
        AND tenant_id = public.get_user_tenant_id(auth.uid())
    )
    WITH CHECK (
        public.has_role(auth.uid(), 'tenant_admin'::public.app_role) 
        AND tenant_id = public.get_user_tenant_id(auth.uid())
    );

-- 2. Auto-Assignment Function
DROP FUNCTION IF EXISTS public.process_email_queue_assignment();
CREATE OR REPLACE FUNCTION public.process_email_queue_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rule RECORD;
    criteria JSONB;
    match_found BOOLEAN;
BEGIN
    -- Only process if queue is not already set
    IF NEW.queue IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Iterate through active rules for this tenant, ordered by priority
    FOR rule IN 
        SELECT * FROM public.queue_rules 
        WHERE tenant_id = NEW.tenant_id 
        AND is_active = true 
        ORDER BY priority DESC
    LOOP
        criteria := rule.criteria;
        match_found := TRUE;

        -- Check Subject
        IF criteria ? 'subject_contains' AND 
           NOT (NEW.subject ILIKE '%' || (criteria->>'subject_contains') || '%') THEN
            match_found := FALSE;
        END IF;

        -- Check From Email
        IF match_found AND criteria ? 'from_email' AND 
           NOT (NEW.from_address ILIKE (criteria->>'from_email')) THEN
            match_found := FALSE;
        END IF;
        
        -- Check Body (if available)
        IF match_found AND criteria ? 'body_contains' AND 
           NOT (COALESCE(NEW.body_text, '') ILIKE '%' || (criteria->>'body_contains') || '%') THEN
            match_found := FALSE;
        END IF;

        -- If all criteria match, assign queue and exit
        IF match_found THEN
            NEW.queue := rule.target_queue_name;
            -- Optionally log/tag
            RETURN NEW;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

-- 3. Attach Trigger to Emails
DROP TRIGGER IF EXISTS trg_assign_email_queue ON public.emails;
CREATE TRIGGER trg_assign_email_queue
    BEFORE INSERT ON public.emails
    FOR EACH ROW
    EXECUTE FUNCTION public.process_email_queue_assignment();

-- 4. Robust Get Queue Counts (Updated)
DROP FUNCTION IF EXISTS get_queue_counts();
CREATE OR REPLACE FUNCTION get_queue_counts()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_result JSON;
BEGIN
    v_tenant_id := public.get_user_tenant_id(auth.uid());

    -- Fallback mechanism for tenant ID
    IF v_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id
        FROM public.user_roles
        WHERE user_id = auth.uid()
        LIMIT 1;
    END IF;

    IF v_tenant_id IS NULL THEN
        RETURN '{}'::json;
    END IF;

    -- Aggregate counts:
    -- 1. Start with ALL queues defined for the tenant (so we get 0 counts)
    -- 2. Join with emails that match queue AND user has access to
    SELECT json_object_agg(name, count) INTO v_result
    FROM (
        SELECT q.name, COUNT(e.id) as count
        FROM public.queues q
        LEFT JOIN public.emails e ON q.name = e.queue 
            AND e.tenant_id = q.tenant_id
            -- STRICT VISIBILITY CHECK IN COUNTING:
            -- Only count emails if the user is a member of the queue OR is an admin
            AND (
                EXISTS (
                    SELECT 1 FROM public.queue_members qm 
                    WHERE qm.queue_id::uuid = q.id::uuid AND qm.user_id::uuid = auth.uid()
                )
                OR public.has_role(auth.uid(), 'tenant_admin'::public.app_role)
            )
        WHERE q.tenant_id = v_tenant_id
        GROUP BY q.name
    ) t;

    RETURN COALESCE(v_result, '{}'::json);
END;
$$;

-- 5. Strict RLS Policy for Email Queues
DROP POLICY IF EXISTS "Users can view emails in their queues" ON public.emails;

DROP POLICY IF EXISTS "Users can view emails in their queues" ON public.emails;
CREATE POLICY "Users can view emails in their queues" ON public.emails
FOR SELECT
TO authenticated
USING (
  queue IS NOT NULL AND (
    -- STRICT: User MUST be a member of the queue
    EXISTS (
      SELECT 1 FROM public.queues q
      JOIN public.queue_members qm ON q.id = qm.queue_id
      WHERE q.name = emails.queue
      AND q.tenant_id = emails.tenant_id
      AND qm.user_id = auth.uid()
    )
    OR
    -- OR User is a tenant admin
    (
      public.has_role(auth.uid(), 'tenant_admin'::public.app_role) 
      AND emails.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  )
);

-- 6. Ensure Queue Members Table Exists & RLS
CREATE TABLE IF NOT EXISTS public.queue_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(queue_id, user_id)
);

ALTER TABLE public.queue_members ENABLE ROW LEVEL SECURITY;

-- 7. Ensure Queues Table RLS (Strict Visibility)
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view queues they are members of" ON public.queues;
DROP POLICY IF EXISTS "Users can view queues they are members of" ON public.queues;
CREATE POLICY "Users can view queues they are members of" ON public.queues FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.queue_members qm
    WHERE qm.queue_id::uuid = id::uuid AND qm.user_id::uuid = auth.uid()
  )
  OR public.has_role(auth.uid(), 'tenant_admin'::public.app_role)
);

-- 8. Seed Default Queues and Rules (Idempotent)
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        -- Seed Queues
        INSERT INTO public.queues (tenant_id, name, description, type)
        VALUES 
            (t.id, 'support_general', 'General Support Queue', 'round_robin'),
            (t.id, 'sales_inbound', 'Inbound Sales Queue', 'round_robin'),
            (t.id, 'support_priority', 'Priority Support Queue', 'holding'),
            (t.id, 'cfm_negative', 'Negative Feedback Queue', 'holding')
        ON CONFLICT DO NOTHING;

        -- Seed Sample Rule (Priority Support)
        INSERT INTO public.queue_rules (tenant_id, name, description, criteria, target_queue_name, priority)
        VALUES 
            (t.id, 'Detect Urgent', 'Routes urgent emails to priority support', '{"subject_contains": "urgent"}', 'support_priority', 10)
        ON CONFLICT DO NOTHING; -- Assuming ID won't conflict, but this is safe for new entries
    END LOOP;
END $$;
-- Allow users to view emails assigned to queues they are members of
DROP POLICY IF EXISTS "Users can view emails in their queues" ON public.emails;
DROP POLICY IF EXISTS "Users can view emails in their queues" ON public.emails;
CREATE POLICY "Users can view emails in their queues" ON public.emails
FOR SELECT
TO authenticated
USING (
  queue IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.queues q
    JOIN public.queue_members qm ON q.id = qm.queue_id
    WHERE q.name = emails.queue
    AND q.tenant_id = emails.tenant_id
    AND qm.user_id = auth.uid()
  )
);
-- Fix restore_table_data function by dropping it first to allow return type changes
-- and ensuring idempotent creation.

DROP FUNCTION IF EXISTS public.restore_table_data(target_schema text, target_table text, data jsonb, mode text, -- 'insert' or 'upsert' conflict_target text[]);
CREATE OR REPLACE FUNCTION public.restore_table_data(
    target_schema text,
    target_table text,
    data jsonb,
    mode text DEFAULT 'insert', -- 'insert' or 'upsert'
    conflict_target text[] DEFAULT NULL -- Array of column names for ON CONFLICT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    record jsonb;
    row_number int := 0;
    keys text[];
    values text[];
    query text;
    inserted_count int := 0;
    error_count int := 0;
    errors text[] := ARRAY[]::text[];
    error_rows jsonb := '[]'::jsonb;
    col text;
    val text;
    conflict_clause text;
    err_code text;
    err_constraint text;
BEGIN
    -- Validate schema
    IF target_schema NOT IN ('public', 'auth', 'storage', 'extensions', 'vault') THEN
        RAISE EXCEPTION 'Invalid schema: %', target_schema;
    END IF;

    -- Process each record
    FOR record IN SELECT * FROM jsonb_array_elements(data)
    LOOP
        row_number := row_number + 1;
        BEGIN
            -- Extract keys and values
            SELECT array_agg(key), array_agg(value)
            INTO keys, values
            FROM jsonb_each_text(record);

            -- Build INSERT query
            query := format(
                'INSERT INTO %I.%I (%s) VALUES (%s)',
                target_schema,
                target_table,
                array_to_string(array(SELECT format('%I', k) FROM unnest(keys) k), ','),
                array_to_string(array(SELECT format('%L', v) FROM unnest(values) v), ',')
            );

            -- Handle UPSERT
            IF mode = 'upsert' THEN
                IF conflict_target IS NOT NULL AND array_length(conflict_target, 1) > 0 THEN
                    -- Use provided conflict target
                    conflict_clause := array_to_string(array(SELECT format('%I', c) FROM unnest(conflict_target) c), ',');
                    
                    query := query || format(' ON CONFLICT (%s) DO UPDATE SET ', conflict_clause);
                    
                    -- Build SET clause for update
                    query := query || array_to_string(
                        array(
                            SELECT format('%I = EXCLUDED.%I', k, k) 
                            FROM unnest(keys) k 
                            WHERE NOT (k = ANY(conflict_target)) -- Exclude conflict columns from update
                        ), 
                        ','
                    );
                ELSE
                    -- Fallback to simplistic 'id' if exists, else DO NOTHING
                    IF 'id' = ANY(keys) THEN
                        query := query || ' ON CONFLICT (id) DO UPDATE SET ';
                         query := query || array_to_string(
                            array(
                                SELECT format('%I = EXCLUDED.%I', k, k) 
                                FROM unnest(keys) k 
                                WHERE k != 'id'
                            ), 
                            ','
                        );
                    ELSE
                         query := query || ' ON CONFLICT DO NOTHING';
                    END IF;
                END IF;
            END IF;

            EXECUTE query;
            inserted_count := inserted_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            GET STACKED DIAGNOSTICS err_code = RETURNED_SQLSTATE,
                                   err_constraint = CONSTRAINT_NAME;
            errors := array_append(errors, SQLERRM);
            error_rows := error_rows || jsonb_build_array(
                jsonb_build_object(
                    'row_number', row_number,
                    'error', SQLERRM,
                    'code', err_code,
                    'constraint', err_constraint
                )
            );
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', inserted_count,
        'failed', error_count,
        'errors', errors[1:5],
        'error_rows', error_rows
    );
END;
$$;
-- Fix infinite recursion in email_accounts policies
-- This script:
-- 1. Re-creates the SECURITY DEFINER function to get delegated accounts (ensuring it exists and is correct)
-- 2. Drops the redundant and problematic "Users can view delegated email accounts" policy
-- 3. Updates the "Email accounts scope matrix - SELECT" policy to use the SD function
-- 4. Updates "Owners can manage delegations" to use SD function to prevent reverse recursion

-- 1. Ensure SECURITY DEFINER function for delegated accounts exists
DROP FUNCTION IF EXISTS public.get_delegated_email_account_ids(_user_id uuid);
CREATE OR REPLACE FUNCTION public.get_delegated_email_account_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.email_account_delegations
  WHERE delegate_user_id = _user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
$$;

-- Ensure SECURITY DEFINER function for owned accounts exists
DROP FUNCTION IF EXISTS public.get_user_email_account_ids(_user_id uuid);
CREATE OR REPLACE FUNCTION public.get_user_email_account_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.email_accounts
  WHERE user_id = _user_id;
$$;

-- 2. Drop the problematic policy that causes recursion
-- This policy was introduced in Phase 3 completion and duplicates logic but with direct table access causing recursion
DROP POLICY IF EXISTS "Users can view delegated email accounts" ON public.email_accounts;

-- 3. Update the main SELECT policy to use the SECURITY DEFINER function
DROP POLICY IF EXISTS "Email accounts scope matrix - SELECT" ON public.email_accounts;

DROP POLICY IF EXISTS "Email accounts scope matrix - SELECT" ON public.email_accounts;
CREATE POLICY "Email accounts scope matrix - SELECT" ON public.email_accounts FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_platform_admin(auth.uid())
  OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
  OR (is_franchise_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()))
  OR id IN (SELECT public.get_delegated_email_account_ids(auth.uid()))
);

-- 4. Update email_account_delegations policies to be safe
DROP POLICY IF EXISTS "Owners can manage delegations" ON public.email_account_delegations;
DROP POLICY IF EXISTS "Delegation owners can manage" ON public.email_account_delegations;

DROP POLICY IF EXISTS "Owners can manage delegations" ON public.email_account_delegations;
CREATE POLICY "Owners can manage delegations" ON public.email_account_delegations
FOR ALL
USING (
  account_id IN (SELECT public.get_user_email_account_ids(auth.uid()))
);

-- Force schema cache reload
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reload_postgrest_schema') THEN
    PERFORM public.reload_postgrest_schema();
  ELSE
    PERFORM pg_notify('pgrst', 'reload schema');
  END IF;
END $$;
-- Fix infinite recursion in queue policies by using SECURITY DEFINER functions
-- to break the circular dependency between queues and queue_members RLS.

-- 1. Helper function to check queue membership (Bypasses RLS)
DROP FUNCTION IF EXISTS public.is_queue_member_secure(p_queue_id UUID, p_user_id UUID);
CREATE OR REPLACE FUNCTION public.is_queue_member_secure(p_queue_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.queue_members
    WHERE queue_id = p_queue_id
    AND user_id = p_user_id
  );
END;
$$;

-- 2. Helper function to get queue tenant (Bypasses RLS)
DROP FUNCTION IF EXISTS public.get_queue_tenant_id_secure(p_queue_id UUID);
CREATE OR REPLACE FUNCTION public.get_queue_tenant_id_secure(p_queue_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.queues
  WHERE id = p_queue_id;
  RETURN v_tenant_id;
END;
$$;

-- 3. Fix policies on public.queues
-- Drop potential conflicting policies
DROP POLICY IF EXISTS "Users can view queues they are members of" ON public.queues;

-- Recreate with secure function to avoid recursion
DROP POLICY IF EXISTS "Users can view queues they are members of" ON public.queues;
CREATE POLICY "Users can view queues they are members of" ON public.queues FOR SELECT
TO authenticated
USING (
  public.is_queue_member_secure(id, auth.uid())
  OR public.has_role(auth.uid(), 'tenant_admin'::public.app_role)
);

-- 4. Fix policies on public.queue_members
-- Cleanup old potentially duplicate policies
DROP POLICY IF EXISTS "Tenant admins can manage queue members" ON public.queue_members;
DROP POLICY IF EXISTS "Tenant admins can manage queue memberships" ON public.queue_members;

-- Recreate consistent policy using secure function to avoid recursion
DROP POLICY IF EXISTS "Tenant admins can manage queue memberships" ON public.queue_members;
CREATE POLICY "Tenant admins can manage queue memberships" ON public.queue_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'tenant_admin'
    AND ur.tenant_id = public.get_queue_tenant_id_secure(queue_members.queue_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'tenant_admin'
    AND ur.tenant_id = public.get_queue_tenant_id_secure(queue_members.queue_id)
  )
);
ALTER TABLE public.franchises ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.franchises DROP COLUMN IF EXISTS account_id;