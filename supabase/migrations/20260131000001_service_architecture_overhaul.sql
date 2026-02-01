-- Service Architecture Overhaul: Domain-Agnostic Normalization
-- Addresses: Service Modes, Categories, Types, Attributes, and Details

BEGIN;

-----------------------------------------------------------------------------
-- 1. Service Modes (Standardization)
-----------------------------------------------------------------------------
-- Rename transport_modes to service_modes if it exists, otherwise create it
DO $$
BEGIN
  -- Check if transport_modes exists and is a base table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transport_modes' AND table_type = 'BASE TABLE') THEN
    -- Check if service_modes also exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_modes') THEN
      -- Both exist. Rename transport_modes to avoid conflict with the view we want to create
      ALTER TABLE transport_modes RENAME TO transport_modes_deprecated;
    ELSE
      -- Only transport_modes exists. Rename it to service_modes.
      ALTER TABLE transport_modes RENAME TO service_modes;
    END IF;
  END IF;

  -- Ensure service_modes exists (if we didn't just rename it)
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
END $$;

-- Ensure columns exist (in case table existed but was missing columns)
ALTER TABLE service_modes 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS icon_name TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure tenant_id is nullable for global modes (if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_modes' AND column_name = 'tenant_id') THEN
    ALTER TABLE service_modes ALTER COLUMN tenant_id DROP NOT NULL;
  END IF;
END $$;

-- DEDUPLICATE: Remove duplicate codes if any exist, keeping the most recently updated/created one
-- This ensures the UNIQUE constraint can be applied successfully.
DELETE FROM service_modes
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY code ORDER BY updated_at DESC, created_at DESC, id ASC) as rnum
    FROM service_modes
  ) t
  WHERE t.rnum > 1
);

-- Ensure UNIQUE constraint on code exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'service_modes_code_key' 
    OR (conrelid = 'service_modes'::regclass AND contype = 'u' AND conkey = ARRAY[2::int2]) -- Assuming code is 2nd column
  ) THEN
    -- Try to add unique constraint if it doesn't exist.
    -- First, check if there is ANY unique constraint on 'code'
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'service_modes'::regclass 
        AND i.indisunique = true 
        AND a.attname = 'code'
    ) THEN
        ALTER TABLE service_modes ADD CONSTRAINT service_modes_code_key UNIQUE (code);
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- If we still fail (e.g. race condition), we log it. The INSERT ON CONFLICT might fail if this failed.
  RAISE NOTICE 'Could not add unique constraint to service_modes.code: %', SQLERRM;
END $$;

-- BACKWARD COMPATIBILITY: Create a view for legacy code querying 'transport_modes'
-- This will fail if transport_modes is still a table, but our block above should have handled it.
CREATE OR REPLACE VIEW transport_modes AS
SELECT * FROM service_modes;

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

-- Ensure tenant_id is nullable for global categories (if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_categories' AND column_name = 'tenant_id') THEN
    ALTER TABLE service_categories ALTER COLUMN tenant_id DROP NOT NULL;
  END IF;
END $$;

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

COMMIT;
