-- Seed Logistics Domain Attributes
-- Depends on 20260131230000_cleanup_legacy_service_types.sql

BEGIN;

DO $$
DECLARE
    v_ocean_freight UUID;
    v_air_freight UUID;
    v_road_freight UUID;
    v_rail_freight UUID;
    v_courier_express UUID;
    v_freight_forwarding UUID;
BEGIN
    -- Get IDs
    SELECT id INTO v_ocean_freight FROM service_types WHERE code = 'ocean_freight';
    SELECT id INTO v_air_freight FROM service_types WHERE code = 'air_freight';
    SELECT id INTO v_road_freight FROM service_types WHERE code = 'road_freight';
    SELECT id INTO v_rail_freight FROM service_types WHERE code = 'rail_freight';
    SELECT id INTO v_courier_express FROM service_types WHERE code = 'courier_express';
    SELECT id INTO v_freight_forwarding FROM service_types WHERE code = 'freight_forwarding';

    -- 1. Ocean Freight Attributes
    IF v_ocean_freight IS NOT NULL THEN
        INSERT INTO service_attribute_definitions (service_type_id, attribute_key, label, data_type, validation_rules, is_required, display_order)
        VALUES
        (v_ocean_freight, 'container_type', 'Container Type', 'select', '{"options": ["20GP", "40GP", "40HC", "45HC", "20RF", "40RF", "LCL"]}', true, 10),
        (v_ocean_freight, 'shipping_line', 'Shipping Line', 'text', '{}', false, 20),
        (v_ocean_freight, 'transit_time_days', 'Transit Time (Days)', 'number', '{"min": 1}', false, 30),
        (v_ocean_freight, 'bl_type', 'Bill of Lading Type', 'select', '{"options": ["HBL", "MBL", "Express Release", "Original"]}', true, 40)
        ON CONFLICT (service_type_id, attribute_key) DO NOTHING;
    END IF;

    -- 2. Air Freight Attributes
    IF v_air_freight IS NOT NULL THEN
        INSERT INTO service_attribute_definitions (service_type_id, attribute_key, label, data_type, validation_rules, is_required, display_order)
        VALUES
        (v_air_freight, 'service_level', 'Service Level', 'select', '{"options": ["Express", "Standard", "Deferred", "Charter"]}', true, 10),
        (v_air_freight, 'airline_code', 'Airline Code', 'text', '{"pattern": "^[A-Z0-9]{2,3}$"}', false, 20),
        (v_air_freight, 'handling_codes', 'Handling Codes', 'json', '{"type": "array", "items": ["PER", "DGR", "VAL", "COL"]}', false, 30)
        ON CONFLICT (service_type_id, attribute_key) DO NOTHING;
    END IF;

    -- 3. Road Freight Attributes
    IF v_road_freight IS NOT NULL THEN
        INSERT INTO service_attribute_definitions (service_type_id, attribute_key, label, data_type, validation_rules, is_required, display_order)
        VALUES
        (v_road_freight, 'truck_type', 'Truck Type', 'select', '{"options": ["Dry Van", "Reefer", "Flatbed", "Lowboy", "Tanker"]}', true, 10),
        (v_road_freight, 'load_type', 'Load Type', 'select', '{"options": ["FTL", "LTL", "Partial"]}', true, 20),
        (v_road_freight, 'hazmat_class', 'Hazmat Class', 'text', '{}', false, 30)
        ON CONFLICT (service_type_id, attribute_key) DO NOTHING;
    END IF;
    
    -- 4. Courier Attributes
    IF v_courier_express IS NOT NULL THEN
        INSERT INTO service_attribute_definitions (service_type_id, attribute_key, label, data_type, validation_rules, is_required, display_order)
        VALUES
        (v_courier_express, 'courier_provider', 'Provider', 'select', '{"options": ["DHL", "FedEx", "UPS", "TNT", "Local"]}', true, 10),
        (v_courier_express, 'package_type', 'Package Type', 'select', '{"options": ["Document", "Parcel", "Pallet"]}', true, 20)
        ON CONFLICT (service_type_id, attribute_key) DO NOTHING;
    END IF;

END $$;

COMMIT;
