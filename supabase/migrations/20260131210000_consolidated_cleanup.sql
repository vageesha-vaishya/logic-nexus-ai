-- Consolidated Cleanup and Seeding for Service Architecture
-- Defines the "Gold Standard" for Modes, Categories, Types, and Attributes.
-- Removes obsolete/duplicate data.

BEGIN;

-----------------------------------------------------------------------------
-- 0. Schema Fixes (FK Constraints)
-----------------------------------------------------------------------------
DO $$
BEGIN
  -- Fix service_types.mode_id FK
  -- It might be pointing to 'transport_modes_deprecated' due to rename.
  -- We need it to point to 'service_modes'.
  
  IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'service_types_mode_id_fkey'
  ) THEN
      ALTER TABLE service_types DROP CONSTRAINT service_types_mode_id_fkey;
  END IF;

  -- Attempt to repair data: map old mode_ids to new service_modes ids via code if possible
  -- (This assumes 'transport_modes_deprecated' exists and has 'code' column)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transport_modes_deprecated') THEN
      UPDATE service_types st
      SET mode_id = sm.id
      FROM service_modes sm, transport_modes_deprecated tmd
      WHERE st.mode_id = tmd.id 
      AND (tmd.code = sm.code OR tmd.name = sm.name);
  END IF;

  -- Add new constraint pointing to service_modes
  -- We use ON DELETE SET NULL to be safe, or CASCADE? Let's use SET NULL for now.
  ALTER TABLE service_types 
  ADD CONSTRAINT service_types_mode_id_fkey 
  FOREIGN KEY (mode_id) REFERENCES service_modes(id) ON DELETE SET NULL;

END $$;

-----------------------------------------------------------------------------
-- 1. Service Modes (Canonical List)
-----------------------------------------------------------------------------
-- Ensure the 5 canonical modes exist
INSERT INTO service_modes (code, name, description, icon_name, display_order, is_active) VALUES
('ocean', 'Ocean Freight', 'Maritime transport services', 'Ship', 10, true),
('air', 'Air Freight', 'Air transport services', 'Plane', 20, true),
('road', 'Road Transport', 'Overland trucking services', 'Truck', 30, true),
('rail', 'Rail Transport', 'Railway transport services', 'Train', 40, true),
('digital', 'Digital Services', 'Non-physical services (Insurance, Customs, Trading)', 'FileDigit', 90, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_name = EXCLUDED.icon_name,
  display_order = EXCLUDED.display_order,
  is_active = true;

-- Deprecate obsolete modes (e.g., 'trucking' if it exists separately from 'road')
-- We migrate 'trucking' to 'road' if possible, or disable it.
UPDATE service_modes SET is_active = false WHERE code NOT IN ('ocean', 'air', 'road', 'rail', 'digital');

-----------------------------------------------------------------------------
-- 2. Service Categories (Canonical List)
-----------------------------------------------------------------------------
INSERT INTO service_categories (code, name, description, icon_name, display_order) VALUES
('transport', 'Transportation', 'Movement of goods', 'Truck', 10),
('storage', 'Warehousing & Storage', 'Storage services', 'Warehouse', 20),
('customs', 'Customs & Compliance', 'Regulatory services', 'Stamp', 30),
('insurance', 'Insurance', 'Cargo insurance', 'ShieldCheck', 40),
('handling', 'Handling & Labor', 'Packing, loading, labor', 'Package', 50),
('trading', 'Trading & Procurement', 'Sourcing, inspection, and trade finance', 'Briefcase', 60)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_name = EXCLUDED.icon_name,
  display_order = EXCLUDED.display_order;

-- Remove/Disable unknown categories
-- Safe delete: only delete if not referenced
DELETE FROM service_categories 
WHERE code NOT IN ('transport', 'storage', 'customs', 'insurance', 'handling', 'trading')
  AND id NOT IN (SELECT category_id FROM service_types WHERE category_id IS NOT NULL);

-----------------------------------------------------------------------------
-- 3. Service Types (Canonical List)
-----------------------------------------------------------------------------
-- Helper to get IDs
DO $$
DECLARE
  v_cat_transport UUID;
  v_cat_trading UUID;
  v_cat_insurance UUID;
  v_cat_customs UUID;
  v_mode_ocean UUID;
  v_mode_air UUID;
  v_mode_road UUID;
  v_mode_rail UUID;
  v_mode_digital UUID;
  
  v_type_procurement UUID;
  v_type_inspection UUID;
  v_type_insurance UUID;
  v_type_customs UUID;
BEGIN
  SELECT id INTO v_cat_transport FROM service_categories WHERE code = 'transport';
  SELECT id INTO v_cat_trading FROM service_categories WHERE code = 'trading';
  SELECT id INTO v_cat_insurance FROM service_categories WHERE code = 'insurance';
  SELECT id INTO v_cat_customs FROM service_categories WHERE code = 'customs';

  SELECT id INTO v_mode_ocean FROM service_modes WHERE code = 'ocean';
  SELECT id INTO v_mode_air FROM service_modes WHERE code = 'air';
  SELECT id INTO v_mode_road FROM service_modes WHERE code = 'road';
  SELECT id INTO v_mode_rail FROM service_modes WHERE code = 'rail';
  SELECT id INTO v_mode_digital FROM service_modes WHERE code = 'digital';

  -- CLEANUP: Normalize legacy codes to prevent name collision
  -- Ocean
  UPDATE service_types SET code = 'ocean_freight' WHERE code = 'ocean' AND NOT EXISTS (SELECT 1 FROM service_types WHERE code = 'ocean_freight');
  DELETE FROM service_types WHERE code = 'ocean'; -- Delete if duplicate remains
  DELETE FROM service_types WHERE lower(trim(name)) = 'ocean freight' AND code != 'ocean_freight';

  -- Air
  UPDATE service_types SET code = 'air_freight' WHERE code = 'air' AND NOT EXISTS (SELECT 1 FROM service_types WHERE code = 'air_freight');
  DELETE FROM service_types WHERE code = 'air';
  DELETE FROM service_types WHERE lower(trim(name)) = 'air freight' AND code != 'air_freight';

  -- Road/Trucking
  UPDATE service_types SET code = 'road_freight' WHERE code = 'road' AND NOT EXISTS (SELECT 1 FROM service_types WHERE code = 'road_freight');
  UPDATE service_types SET code = 'road_freight' WHERE code = 'trucking' AND NOT EXISTS (SELECT 1 FROM service_types WHERE code = 'road_freight');
  DELETE FROM service_types WHERE code IN ('road', 'trucking');
  DELETE FROM service_types WHERE lower(trim(name)) IN ('road freight', 'trucking') AND code != 'road_freight';

  -- Rail
  UPDATE service_types SET code = 'rail_freight' WHERE code = 'rail' AND NOT EXISTS (SELECT 1 FROM service_types WHERE code = 'rail_freight');
  DELETE FROM service_types WHERE code = 'rail';
  DELETE FROM service_types WHERE lower(trim(name)) = 'rail freight' AND code != 'rail_freight';


  -- A. Transport Types (Logistics)
  -- Standardize codes. 2025 migration used names like 'ocean' as code? Let's ensure 'ocean_freight' style codes or keep simple.
  -- The 2025 migration inserted name='ocean'. Let's stick to explicit codes.
  
  -- Ocean
  INSERT INTO service_types (code, name, description, is_active, category_id, mode_id)
  VALUES ('ocean_freight', 'Ocean Freight', 'General ocean freight', true, v_cat_transport, v_mode_ocean)
  ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id, mode_id = EXCLUDED.mode_id;
  
  -- Handle legacy 'ocean' name -> update to code 'ocean_freight' if possible, or just insert new.
  -- To be safe, we rely on the new codes.

  -- Air
  INSERT INTO service_types (code, name, description, is_active, category_id, mode_id)
  VALUES ('air_freight', 'Air Freight', 'General air freight', true, v_cat_transport, v_mode_air)
  ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id, mode_id = EXCLUDED.mode_id;

  -- Road (Trucking)
  INSERT INTO service_types (code, name, description, is_active, category_id, mode_id)
  VALUES ('road_freight', 'Road Freight', 'General road transport', true, v_cat_transport, v_mode_road)
  ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id, mode_id = EXCLUDED.mode_id;

  -- Rail
  INSERT INTO service_types (code, name, description, is_active, category_id, mode_id)
  VALUES ('rail_freight', 'Rail Freight', 'General rail transport', true, v_cat_transport, v_mode_rail)
  ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id, mode_id = EXCLUDED.mode_id;

  -- B. Non-Logistics Types (Trading, Insurance, Customs)
  INSERT INTO service_types (code, name, description, is_active, category_id, mode_id)
  VALUES 
    ('procurement_agent', 'Procurement Agent', 'Sourcing and supplier management services', true, v_cat_trading, v_mode_digital)
  ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id, mode_id = EXCLUDED.mode_id
  RETURNING id INTO v_type_procurement;

  INSERT INTO service_types (code, name, description, is_active, category_id, mode_id)
  VALUES 
    ('quality_inspection', 'Quality Inspection', 'Product quality verification and audit', true, v_cat_trading, v_mode_digital)
  ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id, mode_id = EXCLUDED.mode_id
  RETURNING id INTO v_type_inspection;

  INSERT INTO service_types (code, name, description, is_active, category_id, mode_id)
  VALUES 
    ('cargo_insurance', 'Cargo Insurance', 'Insurance for goods in transit', true, v_cat_insurance, v_mode_digital)
  ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id, mode_id = EXCLUDED.mode_id
  RETURNING id INTO v_type_insurance;

  INSERT INTO service_types (code, name, description, is_active, category_id, mode_id)
  VALUES 
    ('import_clearance', 'Import Clearance', 'Customs clearance for inbound goods', true, v_cat_customs, v_mode_digital)
  ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id, mode_id = EXCLUDED.mode_id
  RETURNING id INTO v_type_customs;

  -----------------------------------------------------------------------------
  -- 4. Attribute Definitions (Canonical List)
  -----------------------------------------------------------------------------
  -- Procurement
  INSERT INTO service_attribute_definitions (service_type_id, attribute_key, label, data_type, validation_rules, is_required, display_order)
  VALUES
    (v_type_procurement, 'market_region', 'Market Region', 'select', '{"options": ["Asia", "Europe", "North America", "Global"]}', true, 10),
    (v_type_procurement, 'commission_rate_percent', 'Commission Rate (%)', 'number', '{"min": 0, "max": 100}', true, 20),
    (v_type_procurement, 'specialties', 'Specialties', 'json', '{"type": "array", "items": ["Electronics", "Textiles", "Machinery", "Raw Materials"]}', false, 30)
  ON CONFLICT (service_type_id, attribute_key) DO UPDATE SET
    label = EXCLUDED.label,
    data_type = EXCLUDED.data_type,
    validation_rules = EXCLUDED.validation_rules,
    is_required = EXCLUDED.is_required,
    display_order = EXCLUDED.display_order;

  -- Quality Inspection
  INSERT INTO service_attribute_definitions (service_type_id, attribute_key, label, data_type, validation_rules, is_required, display_order)
  VALUES
    (v_type_inspection, 'inspection_standard', 'Inspection Standard', 'select', '{"options": ["ISO9001", "AQL Level II", "Custom"]}', true, 10),
    (v_type_inspection, 'report_format', 'Report Format', 'select', '{"options": ["PDF", "Video", "Live Stream"]}', true, 20)
  ON CONFLICT (service_type_id, attribute_key) DO UPDATE SET
    label = EXCLUDED.label,
    data_type = EXCLUDED.data_type,
    validation_rules = EXCLUDED.validation_rules,
    is_required = EXCLUDED.is_required,
    display_order = EXCLUDED.display_order;

  -- Insurance
  INSERT INTO service_attribute_definitions (service_type_id, attribute_key, label, data_type, validation_rules, is_required, display_order)
  VALUES
    (v_type_insurance, 'coverage_type', 'Coverage Type', 'select', '{"options": ["All Risk", "Total Loss Only", "General Average"]}', true, 10),
    (v_type_insurance, 'deductible_percent', 'Deductible (%)', 'number', '{"min": 0, "max": 100}', true, 20),
    (v_type_insurance, 'max_insured_value', 'Max Insured Value (USD)', 'number', '{"min": 0}', true, 30)
  ON CONFLICT (service_type_id, attribute_key) DO UPDATE SET
    label = EXCLUDED.label,
    data_type = EXCLUDED.data_type,
    validation_rules = EXCLUDED.validation_rules,
    is_required = EXCLUDED.is_required,
    display_order = EXCLUDED.display_order;

  -- Customs
  INSERT INTO service_attribute_definitions (service_type_id, attribute_key, label, data_type, validation_rules, is_required, display_order)
  VALUES
    (v_type_customs, 'customs_regime', 'Customs Regime', 'select', '{"options": ["Home Use", "Temporary Admission", "Bonded Warehouse", "Transit"]}', true, 10),
    (v_type_customs, 'requires_poa', 'Requires Power of Attorney', 'boolean', '{}', true, 20)
  ON CONFLICT (service_type_id, attribute_key) DO UPDATE SET
    label = EXCLUDED.label,
    data_type = EXCLUDED.data_type,
    validation_rules = EXCLUDED.validation_rules,
    is_required = EXCLUDED.is_required,
    display_order = EXCLUDED.display_order;

END $$;

COMMIT;
