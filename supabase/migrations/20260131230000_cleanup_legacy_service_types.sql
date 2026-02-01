-- Migration: Cleanup and standardize legacy service types

-- 1. Ensure 'multimodal' mode exists
INSERT INTO service_modes (code, name, description)
VALUES ('multimodal', 'Multimodal Transport', 'Transportation involving multiple modes')
ON CONFLICT (code) DO NOTHING;

-- 2. Consolidate and standardize Service Types
DO $$
DECLARE
    v_transport_id UUID;
    v_storage_id UUID;
    v_customs_id UUID;
    v_insurance_id UUID;
    v_handling_id UUID;
    v_trading_id UUID;
    
    v_ocean_id UUID;
    v_air_id UUID;
    v_road_id UUID;
    v_rail_id UUID;
    v_multimodal_id UUID;
    v_digital_id UUID;
    
    v_rail_freight_id UUID;
    v_target_id UUID;
BEGIN
    -- Fetch Category IDs
    SELECT id INTO v_transport_id FROM service_categories WHERE code = 'transport';
    SELECT id INTO v_storage_id FROM service_categories WHERE code = 'storage';
    SELECT id INTO v_customs_id FROM service_categories WHERE code = 'customs';
    
    -- Fetch Mode IDs
    SELECT id INTO v_road_id FROM service_modes WHERE code = 'road';
    SELECT id INTO v_rail_id FROM service_modes WHERE code = 'rail';
    SELECT id INTO v_multimodal_id FROM service_modes WHERE code = 'multimodal';
    SELECT id INTO v_digital_id FROM service_modes WHERE code = 'digital';
    
    -- A. Handle 'railway_transport' -> 'rail_freight'
    SELECT id INTO v_rail_freight_id FROM service_types WHERE code = 'rail_freight';
    
    -- If rail_freight exists, move services from railway_transport to it
    IF v_rail_freight_id IS NOT NULL THEN
        UPDATE services SET service_type_id = v_rail_freight_id 
        WHERE service_type_id IN (SELECT id FROM service_types WHERE code = 'railway_transport');
        
        DELETE FROM service_types WHERE code = 'railway_transport';
    END IF;

    -- B. Standardize 'courier' / 'courier service' -> 'courier_express'
    -- First, try to rename one of them to 'courier_express' if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM service_types WHERE code = 'courier_express') THEN
        UPDATE service_types SET code = 'courier_express', name = 'Courier Express', category_id = v_transport_id, mode_id = v_multimodal_id
        WHERE code = 'courier';
    END IF;
    -- Move any remaining 'courier' or 'courier service' to 'courier_express'
    SELECT id INTO v_target_id FROM service_types WHERE code = 'courier_express';
    IF v_target_id IS NOT NULL THEN
        UPDATE services SET service_type_id = v_target_id 
        WHERE service_type_id IN (SELECT id FROM service_types WHERE code IN ('courier', 'courier service'));
        
        DELETE FROM service_types WHERE code IN ('courier', 'courier service') AND id != v_target_id;
    END IF;

    -- C. Standardize 'moving' / 'moving services' -> 'relocation_services'
    IF NOT EXISTS (SELECT 1 FROM service_types WHERE code = 'relocation_services') THEN
        UPDATE service_types SET code = 'relocation_services', name = 'Relocation Services', category_id = v_transport_id, mode_id = v_road_id
        WHERE code = 'moving';
    END IF;
    SELECT id INTO v_target_id FROM service_types WHERE code = 'relocation_services';
    IF v_target_id IS NOT NULL THEN
        UPDATE services SET service_type_id = v_target_id 
        WHERE service_type_id IN (SELECT id FROM service_types WHERE code IN ('moving', 'moving services'));
        DELETE FROM service_types WHERE code IN ('moving', 'moving services') AND id != v_target_id;
    END IF;

    -- D. Standardize 'freight forwarding' -> 'freight_forwarding'
    UPDATE service_types SET category_id = v_transport_id, mode_id = v_multimodal_id, name = 'Freight Forwarding'
    WHERE code = 'freight forwarding';
    -- Normalize code to snake_case if it isn't
    UPDATE service_types SET code = 'freight_forwarding' WHERE code = 'freight forwarding';

    -- E. Standardize 'warehousing' -> 'warehousing_storage'
    UPDATE service_types SET code = 'warehousing_storage', name = 'Warehousing & Storage', category_id = v_storage_id, mode_id = v_road_id
    WHERE code = 'warehousing';

    -- F. Standardize 'customs clearance' -> 'customs_brokerage'
    -- Only if customs_brokerage doesn't exist
    IF NOT EXISTS (SELECT 1 FROM service_types WHERE code = 'customs_brokerage') THEN
         UPDATE service_types SET code = 'customs_brokerage', name = 'Customs Brokerage', category_id = v_customs_id, mode_id = v_digital_id
         WHERE code = 'customs clearance';
    ELSE
         -- If it exists, merge
         SELECT id INTO v_target_id FROM service_types WHERE code = 'customs_brokerage';
         UPDATE services SET service_type_id = v_target_id 
         WHERE service_type_id IN (SELECT id FROM service_types WHERE code = 'customs clearance');
         DELETE FROM service_types WHERE code = 'customs clearance';
    END IF;

END $$;
