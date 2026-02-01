-- Migration: Comprehensive Service Architecture Seeding
-- Description: Establishes a complete mapping between Service Types and Services with realistic seed data
-- for the Logistics & Supply Chain domain, plus examples for other domains.
-- Adheres to the platform's Service Architecture patterns (Domains > Categories > Types > Services).

BEGIN;

-----------------------------------------------------------------------------
-- 0. Schema Validation & Enhancements
-----------------------------------------------------------------------------

-- Ensure platform_domains table exists
CREATE TABLE IF NOT EXISTS platform_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure service_categories has domain_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_categories' AND column_name = 'domain_id') THEN
        ALTER TABLE service_categories ADD COLUMN domain_id UUID REFERENCES platform_domains(id);
    END IF;
END $$;

-----------------------------------------------------------------------------
-- 1. Seed Platform Domains
-----------------------------------------------------------------------------
INSERT INTO platform_domains (key, name, status) VALUES
('logistics', 'Logistics & Supply Chain', 'active'),
('banking', 'Banking & Finance', 'active'),
('ecommerce', 'E-commerce & Retail', 'active'),
('telecom', 'Telecommunications', 'active'),
('healthcare', 'Healthcare & Life Sciences', 'active')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name;

-----------------------------------------------------------------------------
-- 2. Seed Service Categories (Logistics)
-----------------------------------------------------------------------------
DO $$
DECLARE
    v_domain_logistics UUID;
    v_domain_banking UUID;
    v_domain_ecommerce UUID;
BEGIN
    SELECT id INTO v_domain_logistics FROM platform_domains WHERE key = 'logistics';
    SELECT id INTO v_domain_banking FROM platform_domains WHERE key = 'banking';
    SELECT id INTO v_domain_ecommerce FROM platform_domains WHERE key = 'ecommerce';

    -- Logistics Categories
    INSERT INTO service_categories (code, name, description, icon_name, display_order, domain_id) VALUES
    ('transport_mgmt', 'Transportation Management', 'Freight movement across all modes', 'Truck', 10, v_domain_logistics),
    ('warehousing', 'Warehousing & Storage', 'Inventory storage and management', 'Warehouse', 20, v_domain_logistics),
    ('last_mile', 'Last Mile Delivery', 'Final leg delivery services', 'Package', 30, v_domain_logistics),
    ('customs_compliance', 'Customs & Compliance', 'Regulatory clearance and documentation', 'FileCheck', 40, v_domain_logistics),
    ('supply_chain_vis', 'Supply Chain Visibility', 'Tracking and analytics', 'Eye', 50, v_domain_logistics)
    ON CONFLICT (code) DO UPDATE SET domain_id = v_domain_logistics;

    -- Banking Categories (Example)
    INSERT INTO service_categories (code, name, description, icon_name, display_order, domain_id) VALUES
    ('banking_accounts', 'Account Management', 'Checking and savings accounts', 'Landmark', 10, v_domain_banking),
    ('banking_lending', 'Lending Services', 'Loans and credit', 'CreditCard', 20, v_domain_banking)
    ON CONFLICT (code) DO UPDATE SET domain_id = v_domain_banking;

    -- Ecommerce Categories (Example)
    INSERT INTO service_categories (code, name, description, icon_name, display_order, domain_id) VALUES
    ('ecom_fulfillment', 'Order Fulfillment', 'Pick, pack, and ship', 'Box', 10, v_domain_ecommerce)
    ON CONFLICT (code) DO UPDATE SET domain_id = v_domain_ecommerce;
END $$;

-----------------------------------------------------------------------------
-- 3. Seed Service Types (Logistics)
-----------------------------------------------------------------------------
DO $$
DECLARE
    -- Categories
    v_cat_transport UUID;
    v_cat_warehousing UUID;
    v_cat_lastmile UUID;
    v_cat_customs UUID;
    v_cat_visibility UUID;
    -- Modes
    v_mode_ocean UUID;
    v_mode_air UUID;
    v_mode_road UUID;
    v_mode_rail UUID;
    v_mode_digital UUID;
BEGIN
    -- Fetch IDs
    SELECT id INTO v_cat_transport FROM service_categories WHERE code = 'transport_mgmt';
    SELECT id INTO v_cat_warehousing FROM service_categories WHERE code = 'warehousing';
    SELECT id INTO v_cat_lastmile FROM service_categories WHERE code = 'last_mile';
    SELECT id INTO v_cat_customs FROM service_categories WHERE code = 'customs_compliance';
    SELECT id INTO v_cat_visibility FROM service_categories WHERE code = 'supply_chain_vis';

    SELECT id INTO v_mode_ocean FROM service_modes WHERE code = 'ocean';
    SELECT id INTO v_mode_air FROM service_modes WHERE code = 'air';
    SELECT id INTO v_mode_road FROM service_modes WHERE code = 'road';
    SELECT id INTO v_mode_rail FROM service_modes WHERE code = 'rail';
    SELECT id INTO v_mode_digital FROM service_modes WHERE code = 'digital';

    -- Transportation Types
    INSERT INTO service_types (code, name, description, category_id, mode_id, is_active) VALUES
    ('ocean_fcl', 'Ocean FCL', 'Full Container Load', v_cat_transport, v_mode_ocean, true),
    ('ocean_lcl', 'Ocean LCL', 'Less than Container Load', v_cat_transport, v_mode_ocean, true),
    ('air_express', 'Air Express', 'Expedited air freight', v_cat_transport, v_mode_air, true),
    ('air_standard', 'Air Standard', 'Standard air freight', v_cat_transport, v_mode_air, true),
    ('road_ftl', 'Road FTL', 'Full Truck Load', v_cat_transport, v_mode_road, true),
    ('road_ltl', 'Road LTL', 'Less than Truck Load', v_cat_transport, v_mode_road, true),
    ('rail_intermodal', 'Rail Intermodal', 'Containerized rail transport', v_cat_transport, v_mode_rail, true)
    ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id, mode_id = EXCLUDED.mode_id;

    -- Warehousing Types
    INSERT INTO service_types (code, name, description, category_id, mode_id, is_active) VALUES
    ('bonded_warehouse', 'Bonded Warehouse', 'Customs bonded storage', v_cat_warehousing, v_mode_road, true),
    ('cold_storage', 'Cold Storage', 'Temperature controlled storage', v_cat_warehousing, v_mode_road, true),
    ('distribution_center', 'Distribution Center', 'General merchandise storage', v_cat_warehousing, v_mode_road, true)
    ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id, mode_id = EXCLUDED.mode_id;

    -- Last Mile Types
    INSERT INTO service_types (code, name, description, category_id, mode_id, is_active) VALUES
    ('same_day_delivery', 'Same Day Delivery', 'Urgent local delivery', v_cat_lastmile, v_mode_road, true),
    ('next_day_delivery', 'Next Day Delivery', 'Standard overnight delivery', v_cat_lastmile, v_mode_road, true)
    ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id, mode_id = EXCLUDED.mode_id;

    -- Customs Types
    INSERT INTO service_types (code, name, description, category_id, mode_id, is_active) VALUES
    ('import_filing', 'Import Filing', 'Customs entry filing', v_cat_customs, v_mode_digital, true),
    ('export_declaration', 'Export Declaration', 'AES/Export filing', v_cat_customs, v_mode_digital, true)
    ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id, mode_id = EXCLUDED.mode_id;

    -- Visibility Types
    INSERT INTO service_types (code, name, description, category_id, mode_id, is_active) VALUES
    ('real_time_tracking', 'Real-time Tracking', 'GPS container tracking', v_cat_visibility, v_mode_digital, true),
    ('temp_monitoring', 'Temperature Monitoring', 'IoT sensor monitoring', v_cat_visibility, v_mode_digital, true)
    ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id, mode_id = EXCLUDED.mode_id;

END $$;

-----------------------------------------------------------------------------
-- 4. Seed Services (Linked to Demo Tenant)
-----------------------------------------------------------------------------
DO $$
DECLARE
    v_tenant_id UUID;
    v_type_ocean_fcl UUID;
    v_type_air_express UUID;
    v_type_warehouse_cold UUID;
    v_type_tracking UUID;
BEGIN
    -- 1. Create/Get Demo Tenant
    -- We'll assume a tenant exists or create a dummy one if the table allows.
    -- Since we can't easily query a valid tenant without knowing the data,
    -- we'll try to find one or insert a system tenant.
    -- Strategy: Look for a tenant named 'Global Logistics Demo', if not found, create it.
    
    -- Check if tenants table exists and has name column
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        SELECT id INTO v_tenant_id FROM tenants WHERE name = 'Global Logistics Demo' LIMIT 1;
        
        IF v_tenant_id IS NULL THEN
             -- Try to insert if we have permission and structure matches (id, name, etc.)
             -- This is risky without knowing exact schema constraints (e.g. required users).
             -- Fallback: Use the first available tenant.
             SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
        END IF;
    END IF;

    -- If no tenant found (empty table?), skip service creation to avoid FK error
    IF v_tenant_id IS NOT NULL THEN
        
        -- Get Service Type IDs
        SELECT id INTO v_type_ocean_fcl FROM service_types WHERE code = 'ocean_fcl';
        SELECT id INTO v_type_air_express FROM service_types WHERE code = 'air_express';
        SELECT id INTO v_type_warehouse_cold FROM service_types WHERE code = 'cold_storage';
        SELECT id INTO v_type_tracking FROM service_types WHERE code = 'real_time_tracking';

        -- Create Services
        
        -- Ocean FCL Service
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_ocean_fcl, 'OC-FCL-STD-20', 'Ocean FCL Standard 20ft', 'ocean', 'Standard 20ft Container Shipping', 'container', 1200.00, 25, true, '{"container_size": "20ft", "container_type": "Standard"}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO NOTHING;

        -- Air Express Service
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_air_express, 'AIR-EXP-PRI', 'Priority Air Freight', 'air', 'Next flight out priority service', 'kg', 8.50, 2, true, '{"priority": "high", "guaranteed": true}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO NOTHING;

        -- Cold Storage Service
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_warehouse_cold, 'WH-COLD-EUR', 'European Cold Chain Storage', 'road', 'Temperature controlled storage -18C to 4C', 'pallet_day', 15.00, 0, true, '{"temp_range": "-18C to 4C", "location": "Rotterdam"}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO NOTHING;

        -- Tracking Service
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_tracking, 'DIG-TRACK-RT', 'Real-time Container Tracking', 'digital', 'IoT based real-time location tracking', 'shipment', 50.00, 0, true, '{"technology": "GPS/IoT", "interval": "15min"}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO NOTHING;
        
    END IF;
END $$;

COMMIT;
