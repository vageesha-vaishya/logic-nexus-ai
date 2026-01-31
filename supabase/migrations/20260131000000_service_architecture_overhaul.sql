-- Service Architecture Overhaul: Domain-Agnostic Normalization
-- Addresses: Service Modes, Categories, Types, Attributes, and Details

BEGIN;

-----------------------------------------------------------------------------
-- 1. Service Modes (Standardization)
-----------------------------------------------------------------------------
-- Rename transport_modes to service_modes if it exists, otherwise create it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transport_modes') THEN
    ALTER TABLE transport_modes RENAME TO service_modes;
  ELSE
    CREATE TABLE IF NOT EXISTS service_modes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      icon_name TEXT,
      color TEXT,
      display_order INTEGER DEFAULT 1000,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- Enable RLS
ALTER TABLE service_modes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active service modes" ON service_modes;
CREATE POLICY "Anyone can view active service modes" ON service_modes FOR SELECT USING (is_active = true);

-- Seed basic modes if empty
INSERT INTO service_modes (code, name, description, icon_name, display_order) VALUES
('ocean', 'Ocean Freight', 'Maritime transport services', 'Ship', 10),
('air', 'Air Freight', 'Air transport services', 'Plane', 20),
('road', 'Road Transport', 'Overland trucking services', 'Truck', 30),
('rail', 'Rail Transport', 'Railway transport services', 'Train', 40),
('digital', 'Digital Services', 'Non-physical services (Insurance, Customs)', 'FileDigit', 90)
ON CONFLICT (code) DO NOTHING;


-----------------------------------------------------------------------------
-- 2. Service Categories (Unification)
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon_name TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Migrate data from service_leg_categories if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_leg_categories') THEN
    INSERT INTO service_categories (code, name, description, icon_name, display_order)
    SELECT code, name, description, icon_name, sort_order
    FROM service_leg_categories
    ON CONFLICT (code) DO NOTHING;
  END IF;
END $$;

-- Add standard categories
INSERT INTO service_categories (code, name, description, display_order) VALUES
('transport', 'Transportation', 'Movement of goods', 10),
('storage', 'Warehousing & Storage', 'Storage services', 20),
('customs', 'Customs & Compliance', 'Regulatory services', 30),
('insurance', 'Insurance', 'Cargo insurance', 40),
('handling', 'Handling & Labor', 'Packing, loading, labor', 50)
ON CONFLICT (code) DO NOTHING;


-----------------------------------------------------------------------------
-- 3. Service Types (Enhancement)
-----------------------------------------------------------------------------
-- Ensure mode_id exists (renamed from transport_modes reference)
-- If we renamed the table, the FK constraint usually follows, but let's verify logic
ALTER TABLE service_types 
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES service_categories(id);

-- Update service_types to link to 'transport' category by default if they have a mode
UPDATE service_types 
SET category_id = (SELECT id FROM service_categories WHERE code = 'transport')
WHERE mode_id IS NOT NULL AND category_id IS NULL;

-- Update known non-transport types
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE code = 'storage') WHERE name ILIKE '%warehous%';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE code = 'customs') WHERE name ILIKE '%customs%';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE code = 'handling') WHERE name ILIKE '%moving%' OR name ILIKE '%packing%';


-----------------------------------------------------------------------------
-- 4. Service Attribute Definitions (Configuration)
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_attribute_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id UUID REFERENCES service_types(id) ON DELETE CASCADE,
  attribute_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  data_type TEXT NOT NULL CHECK (data_type IN ('text', 'number', 'boolean', 'select', 'date', 'json')),
  validation_rules JSONB DEFAULT '{}'::jsonb, -- e.g. { "min": 0, "max": 100, "options": ["A", "B"] }
  default_value JSONB,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(service_type_id, attribute_key)
);

COMMENT ON TABLE service_attribute_definitions IS 'Defines the schema for service_details attributes per service type';


-----------------------------------------------------------------------------
-- 5. Service Details (Data Storage)
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(service_id)
);

COMMENT ON TABLE service_details IS 'Stores domain-specific attributes for a service, validated against service_attribute_definitions';

-- Migration: Move services.metadata to service_details
INSERT INTO service_details (service_id, attributes)
SELECT id, COALESCE(metadata, '{}'::jsonb)
FROM services
WHERE metadata IS NOT NULL AND metadata != '{}'::jsonb
ON CONFLICT (service_id) DO UPDATE
SET attributes = EXCLUDED.attributes;


-----------------------------------------------------------------------------
-- 6. Validation Logic (Data Integrity)
-----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_service_details()
RETURNS TRIGGER AS $$
DECLARE
  v_service_type_id UUID;
  v_def RECORD;
  v_value JSONB;
  v_key TEXT;
BEGIN
  -- Get Service Type
  SELECT service_type_id INTO v_service_type_id
  FROM services
  WHERE id = NEW.service_id;

  IF v_service_type_id IS NULL THEN
    RETURN NEW; -- Can't validate without service type
  END IF;

  -- Iterate through definitions for this type
  FOR v_def IN 
    SELECT * FROM service_attribute_definitions 
    WHERE service_type_id = v_service_type_id
  LOOP
    v_key := v_def.attribute_key;
    v_value := NEW.attributes -> v_key;

    -- Check Required
    IF v_def.is_required AND (v_value IS NULL OR v_value = 'null'::jsonb) THEN
      RAISE EXCEPTION 'Attribute % is required for this service type', v_def.label;
    END IF;

    -- Basic Type Checking (Simplified)
    IF v_value IS NOT NULL THEN
        IF v_def.data_type = 'number' AND jsonb_typeof(v_value) != 'number' THEN
             RAISE EXCEPTION 'Attribute % must be a number', v_def.label;
        END IF;
        IF v_def.data_type = 'boolean' AND jsonb_typeof(v_value) != 'boolean' THEN
             RAISE EXCEPTION 'Attribute % must be a boolean', v_def.label;
        END IF;
        -- Add more checks (select options, etc.) as needed
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_service_details_trigger ON service_details;
CREATE TRIGGER check_service_details_trigger
  BEFORE INSERT OR UPDATE ON service_details
  FOR EACH ROW
  EXECUTE FUNCTION validate_service_details();

COMMIT;
