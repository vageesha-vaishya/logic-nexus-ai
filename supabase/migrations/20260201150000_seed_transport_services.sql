-- Migration: Seed Comprehensive Transportation Services
-- Description: Populates the services table with a detailed hierarchy for Transportation Management.
-- Focuses on Ocean, Air, Road, and Rail variations.

BEGIN;

DO $$
DECLARE
    v_tenant_id UUID;
    
    -- Service Types
    v_type_ocean_fcl UUID;
    v_type_ocean_lcl UUID;
    v_type_air_express UUID;
    v_type_air_standard UUID;
    v_type_road_ftl UUID;
    v_type_road_ltl UUID;
    v_type_rail_intermodal UUID;
BEGIN
    -------------------------------------------------------------------------
    -- 1. Tenant Resolution
    -------------------------------------------------------------------------
    -- Try to find the Demo Tenant, otherwise fallback to the first available
    SELECT id INTO v_tenant_id FROM tenants WHERE name = 'Global Logistics Demo' LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    END IF;

    -- If no tenant exists, we cannot seed services
    IF v_tenant_id IS NULL THEN
        RAISE NOTICE 'No tenant found. Skipping service seeding.';
        RETURN;
    END IF;

    -------------------------------------------------------------------------
    -- 2. Service Type Resolution
    -------------------------------------------------------------------------
    SELECT id INTO v_type_ocean_fcl FROM service_types WHERE code = 'ocean_fcl';
    SELECT id INTO v_type_ocean_lcl FROM service_types WHERE code = 'ocean_lcl';
    SELECT id INTO v_type_air_express FROM service_types WHERE code = 'air_express';
    SELECT id INTO v_type_air_standard FROM service_types WHERE code = 'air_standard';
    SELECT id INTO v_type_road_ftl FROM service_types WHERE code = 'road_ftl';
    SELECT id INTO v_type_road_ltl FROM service_types WHERE code = 'road_ltl';
    SELECT id INTO v_type_rail_intermodal FROM service_types WHERE code = 'rail_intermodal';

    -------------------------------------------------------------------------
    -- 3. Seed Ocean FCL Services
    -------------------------------------------------------------------------
    IF v_type_ocean_fcl IS NOT NULL THEN
        -- 20' Standard
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_ocean_fcl, 'OC-FCL-20SD', 'Ocean FCL 20'' Standard', 'ocean', 'Standard 20ft dry container', 'container', 1200.00, 25, true, 
        '{"container_size": "20ft", "container_type": "Standard", "is_reefer": false}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;

        -- 40' Standard
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_ocean_fcl, 'OC-FCL-40SD', 'Ocean FCL 40'' Standard', 'ocean', 'Standard 40ft dry container', 'container', 1800.00, 25, true, 
        '{"container_size": "40ft", "container_type": "Standard", "is_reefer": false}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;

        -- 40' High Cube
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_ocean_fcl, 'OC-FCL-40HC', 'Ocean FCL 40'' High Cube', 'ocean', '40ft High Cube container for extra volume', 'container', 1950.00, 25, true, 
        '{"container_size": "40ft", "container_type": "High Cube", "is_reefer": false}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;

        -- 20' Reefer
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_ocean_fcl, 'OC-FCL-20RF', 'Ocean FCL 20'' Reefer', 'ocean', '20ft Refrigerated container', 'container', 2500.00, 23, true, 
        '{"container_size": "20ft", "container_type": "Reefer", "is_reefer": true, "temp_control": true}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;

        -- 40' Flat Rack
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_ocean_fcl, 'OC-FCL-40FR', 'Ocean FCL 40'' Flat Rack', 'ocean', '40ft Flat Rack for OOG cargo', 'container', 3200.00, 28, true, 
        '{"container_size": "40ft", "container_type": "Flat Rack", "is_oog": true}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;
    END IF;

    -------------------------------------------------------------------------
    -- 4. Seed Ocean LCL Services
    -------------------------------------------------------------------------
    IF v_type_ocean_lcl IS NOT NULL THEN
        -- General Cargo
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_ocean_lcl, 'OC-LCL-GEN', 'Ocean LCL General', 'ocean', 'Consolidated general cargo', 'cbm', 45.00, 30, true, 
        '{"cargo_type": "General", "consolidation": true}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;

        -- Hazardous
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_ocean_lcl, 'OC-LCL-HAZ', 'Ocean LCL Hazardous', 'ocean', 'LCL for IMO/DG cargo', 'cbm', 85.00, 32, true, 
        '{"cargo_type": "Hazardous", "consolidation": true, "requires_imo": true}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;
    END IF;

    -------------------------------------------------------------------------
    -- 5. Seed Air Services
    -------------------------------------------------------------------------
    IF v_type_air_express IS NOT NULL THEN
        -- Next Flight Out
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_air_express, 'AIR-EXP-NFO', 'Air Next Flight Out', 'air', 'Urgent NFO service', 'kg', 12.50, 1, true, 
        '{"priority": "Critical", "guaranteed": true}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;
        
        -- Priority
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_air_express, 'AIR-EXP-PRI', 'Air Priority', 'air', 'Priority air freight (1-2 days)', 'kg', 8.50, 2, true, 
        '{"priority": "High", "guaranteed": false}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;
    END IF;

    IF v_type_air_standard IS NOT NULL THEN
        -- Consolidated
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_air_standard, 'AIR-STD-CON', 'Air Consolidated', 'air', 'Standard consolidated air freight', 'kg', 4.25, 5, true, 
        '{"priority": "Standard", "consolidation": true}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;
    END IF;

    -------------------------------------------------------------------------
    -- 6. Seed Road Services
    -------------------------------------------------------------------------
    IF v_type_road_ftl IS NOT NULL THEN
        -- Dry Van
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_road_ftl, 'RD-FTL-DRY', 'Road FTL Dry Van', 'road', 'Standard 53ft Dry Van', 'mile', 2.50, 3, true, 
        '{"equipment": "Dry Van", "length": "53ft"}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;

        -- Reefer
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_road_ftl, 'RD-FTL-REF', 'Road FTL Reefer', 'road', 'Temperature controlled FTL', 'mile', 3.20, 3, true, 
        '{"equipment": "Reefer", "length": "53ft", "temp_control": true}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;
    END IF;

    IF v_type_road_ltl IS NOT NULL THEN
        -- Standard LTL
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_road_ltl, 'RD-LTL-STD', 'Road LTL Standard', 'road', 'Standard Less than Truckload', 'cwt', 15.00, 5, true, 
        '{"service_level": "Standard"}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;
    END IF;

    -------------------------------------------------------------------------
    -- 7. Seed Rail Services
    -------------------------------------------------------------------------
    IF v_type_rail_intermodal IS NOT NULL THEN
        -- Intermodal 53
        INSERT INTO services (tenant_id, service_type_id, service_code, service_name, service_type, description, pricing_unit, base_price, transit_time_days, is_active, metadata)
        VALUES (v_tenant_id, v_type_rail_intermodal, 'RL-INT-53', 'Rail Intermodal 53''', 'rail', 'Domestic 53ft container rail move', 'container', 1800.00, 7, true, 
        '{"equipment": "53ft Container", "service_mode": "Intermodal"}'::jsonb)
        ON CONFLICT (tenant_id, service_code) DO UPDATE SET service_name = EXCLUDED.service_name, metadata = EXCLUDED.metadata;
    END IF;

END $$;

COMMIT;
