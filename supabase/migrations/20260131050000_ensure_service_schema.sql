-- Fix/Ensure Service Architecture Schema Exists
-- This handles cases where 20260131000000 failed halfway

BEGIN;

-----------------------------------------------------------------------------
-- 1. Service Categories
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

-- Seed standard categories (idempotent)
INSERT INTO service_categories (code, name, description, display_order) VALUES
('transport', 'Transportation', 'Movement of goods', 10),
('storage', 'Warehousing & Storage', 'Storage services', 20),
('customs', 'Customs & Compliance', 'Regulatory services', 30),
('insurance', 'Insurance', 'Cargo insurance', 40),
('handling', 'Handling & Labor', 'Packing, loading, labor', 50)
ON CONFLICT (code) DO NOTHING;

-----------------------------------------------------------------------------
-- 2. Service Types (Enhancement)
-----------------------------------------------------------------------------
-- Ensure category_id exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_types' AND column_name = 'category_id') THEN
    ALTER TABLE service_types ADD COLUMN category_id UUID REFERENCES service_categories(id);
  END IF;
END $$;

-----------------------------------------------------------------------------
-- 3. Service Attribute Definitions
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_attribute_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id UUID REFERENCES service_types(id) ON DELETE CASCADE,
  attribute_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  data_type TEXT NOT NULL CHECK (data_type IN ('text', 'number', 'boolean', 'select', 'date', 'json')),
  validation_rules JSONB DEFAULT '{}'::jsonb,
  default_value JSONB,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(service_type_id, attribute_key)
);

-----------------------------------------------------------------------------
-- 4. Service Details
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(service_id)
);

-- Trigger function (replace to ensure latest logic)
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
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_service_details_trigger ON service_details;
CREATE TRIGGER check_service_details_trigger
  BEFORE INSERT OR UPDATE ON service_details
  FOR EACH ROW EXECUTE FUNCTION validate_service_details();

COMMIT;
