-- Seed Non-Logistics Domains (Trading, Insurance, Customs)
-- Depends on 20260131000000_service_architecture_overhaul.sql

BEGIN;

-----------------------------------------------------------------------------
-- 1. Ensure Categories Exist
-----------------------------------------------------------------------------
INSERT INTO service_categories (code, name, description, icon_name, display_order) VALUES
('trading', 'Trading & Procurement', 'Sourcing, inspection, and trade finance', 'Briefcase', 60),
('insurance', 'Insurance Services', 'Cargo and business liability insurance', 'ShieldCheck', 40), -- Ensure exists
('customs', 'Customs & Compliance', 'Regulatory compliance and clearance', 'Stamp', 30)     -- Ensure exists
ON CONFLICT (code) DO NOTHING;

-----------------------------------------------------------------------------
-- 2. Seed Service Types
-----------------------------------------------------------------------------
-- We need IDs for categories to link types
DO $$
DECLARE
  v_cat_trading UUID;
  v_cat_insurance UUID;
  v_cat_customs UUID;
  v_mode_digital UUID;
  v_type_procurement UUID;
  v_type_inspection UUID;
  v_type_insurance UUID;
  v_type_customs UUID;
  v_tenant_id UUID := '9e2686ba-ef3c-42df-aea6-dcc880436b9f'; -- Default Tenant
BEGIN

  -- Get Category IDs
  SELECT id INTO v_cat_trading FROM service_categories WHERE code = 'trading';
  SELECT id INTO v_cat_insurance FROM service_categories WHERE code = 'insurance';
  SELECT id INTO v_cat_customs FROM service_categories WHERE code = 'customs';

  -- Get Mode ID (Digital)
  SELECT id INTO v_mode_digital FROM service_modes WHERE code = 'digital';

  -- A. Trading Types
  INSERT INTO service_types (code, name, description, is_active, category_id, mode_id)
  VALUES 
    ('procurement_agent', 'Procurement Agent', 'Sourcing and supplier management services', true, v_cat_trading, v_mode_digital)
  ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id
  RETURNING id INTO v_type_procurement;

  INSERT INTO service_types (code, name, description, is_active, category_id, mode_id)
  VALUES 
    ('quality_inspection', 'Quality Inspection', 'Product quality verification and audit', true, v_cat_trading, v_mode_digital)
  ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id
  RETURNING id INTO v_type_inspection;

  -- B. Insurance Types
  INSERT INTO service_types (code, name, description, is_active, category_id, mode_id)
  VALUES 
    ('cargo_insurance', 'Cargo Insurance', 'Insurance for goods in transit', true, v_cat_insurance, v_mode_digital)
  ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id
  RETURNING id INTO v_type_insurance;

  -- C. Customs Types
  INSERT INTO service_types (code, name, description, is_active, category_id, mode_id)
  VALUES 
    ('import_clearance', 'Import Clearance', 'Customs clearance for inbound goods', true, v_cat_customs, v_mode_digital)
  ON CONFLICT (code) DO UPDATE SET category_id = EXCLUDED.category_id
  RETURNING id INTO v_type_customs;

  -----------------------------------------------------------------------------
  -- 3. Attribute Definitions
  -----------------------------------------------------------------------------

  -- Procurement Attributes
  INSERT INTO service_attribute_definitions (service_type_id, attribute_key, label, data_type, validation_rules, is_required, display_order)
  VALUES
    (v_type_procurement, 'market_region', 'Market Region', 'select', '{"options": ["Asia", "Europe", "North America", "Global"]}', true, 10),
    (v_type_procurement, 'commission_rate_percent', 'Commission Rate (%)', 'number', '{"min": 0, "max": 100}', true, 20),
    (v_type_procurement, 'specialties', 'Specialties', 'json', '{"type": "array", "items": ["Electronics", "Textiles", "Machinery", "Raw Materials"]}', false, 30)
  ON CONFLICT (service_type_id, attribute_key) DO NOTHING;

  -- Quality Inspection Attributes
  INSERT INTO service_attribute_definitions (service_type_id, attribute_key, label, data_type, validation_rules, is_required, display_order)
  VALUES
    (v_type_inspection, 'inspection_standard', 'Inspection Standard', 'select', '{"options": ["ISO9001", "AQL Level II", "Custom"]}', true, 10),
    (v_type_inspection, 'report_format', 'Report Format', 'select', '{"options": ["PDF", "Video", "Live Stream"]}', true, 20)
  ON CONFLICT (service_type_id, attribute_key) DO NOTHING;

  -- Insurance Attributes
  INSERT INTO service_attribute_definitions (service_type_id, attribute_key, label, data_type, validation_rules, is_required, display_order)
  VALUES
    (v_type_insurance, 'coverage_type', 'Coverage Type', 'select', '{"options": ["All Risk", "Total Loss Only", "General Average"]}', true, 10),
    (v_type_insurance, 'deductible_percent', 'Deductible (%)', 'number', '{"min": 0, "max": 100}', true, 20),
    (v_type_insurance, 'max_insured_value', 'Max Insured Value (USD)', 'number', '{"min": 0}', true, 30)
  ON CONFLICT (service_type_id, attribute_key) DO NOTHING;

  -- Customs Attributes
  INSERT INTO service_attribute_definitions (service_type_id, attribute_key, label, data_type, validation_rules, is_required, display_order)
  VALUES
    (v_type_customs, 'customs_regime', 'Customs Regime', 'select', '{"options": ["Home Use", "Temporary Admission", "Bonded Warehouse", "Transit"]}', true, 10),
    (v_type_customs, 'requires_poa', 'Requires Power of Attorney', 'boolean', '{}', true, 20)
  ON CONFLICT (service_type_id, attribute_key) DO NOTHING;

  -----------------------------------------------------------------------------
  -- 4. Sample Services & Details
  -----------------------------------------------------------------------------
  
  -- Only insert if tenant exists (skip if not found, to avoid errors in fresh envs)
  IF EXISTS (SELECT 1 FROM tenants WHERE id = v_tenant_id) THEN
    
    -- Service 1: Global Electronics Sourcing (Procurement)
    WITH new_svc AS (
      INSERT INTO services (tenant_id, service_code, service_name, service_type, service_type_id, description, base_price, pricing_unit, is_active)
      VALUES (v_tenant_id, 'TRD-PROC-ELEC', 'Global Electronics Sourcing', 'procurement', v_type_procurement, 'Expert sourcing for consumer electronics', 500.00, 'retainer', true)
      ON CONFLICT (tenant_id, service_code) DO NOTHING
      RETURNING id
    )
    INSERT INTO service_details (service_id, attributes)
    SELECT id, '{
      "market_region": "Asia", 
      "commission_rate_percent": 5, 
      "specialties": ["Electronics"]
    }'::jsonb
    FROM new_svc;

    -- Service 2: AQL Inspection (Inspection)
    WITH new_svc AS (
      INSERT INTO services (tenant_id, service_code, service_name, service_type, service_type_id, description, base_price, pricing_unit, is_active)
      VALUES (v_tenant_id, 'TRD-INSP-AQL', 'Standard AQL Inspection', 'inspection', v_type_inspection, 'Standard AQL Level II inspection', 299.00, 'man_day', true)
      ON CONFLICT (tenant_id, service_code) DO NOTHING
      RETURNING id
    )
    INSERT INTO service_details (service_id, attributes)
    SELECT id, '{
      "inspection_standard": "AQL Level II", 
      "report_format": "PDF"
    }'::jsonb
    FROM new_svc;

    -- Service 3: Marine Cargo All Risk (Insurance)
    WITH new_svc AS (
      INSERT INTO services (tenant_id, service_code, service_name, service_type, service_type_id, description, base_price, pricing_unit, is_active)
      VALUES (v_tenant_id, 'INS-CARGO-AR', 'Marine Cargo All Risk', 'insurance', v_type_insurance, 'Comprehensive cargo insurance', 50.00, 'premium_min', true)
      ON CONFLICT (tenant_id, service_code) DO NOTHING
      RETURNING id
    )
    INSERT INTO service_details (service_id, attributes)
    SELECT id, '{
      "coverage_type": "All Risk", 
      "deductible_percent": 1, 
      "max_insured_value": 1000000
    }'::jsonb
    FROM new_svc;

    -- Service 4: US Import Clearance (Customs)
    WITH new_svc AS (
      INSERT INTO services (tenant_id, service_code, service_name, service_type, service_type_id, description, base_price, pricing_unit, is_active)
      VALUES (v_tenant_id, 'CUST-IMP-US', 'US Import Clearance', 'customs', v_type_customs, 'Standard US import filing', 125.00, 'entry', true)
      ON CONFLICT (tenant_id, service_code) DO NOTHING
      RETURNING id
    )
    INSERT INTO service_details (service_id, attributes)
    SELECT id, '{
      "customs_regime": "Home Use", 
      "requires_poa": true
    }'::jsonb
    FROM new_svc;

  END IF;

END $$;

COMMIT;
