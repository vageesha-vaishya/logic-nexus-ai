-- Migration: Create container_types and container_sizes tables
-- Description: Establishes a normalized schema for container configuration matrix

-- DROP existing tables to ensure clean slate (since schema changed)
DROP TABLE IF EXISTS container_sizes CASCADE;
DROP TABLE IF EXISTS container_types CASCADE;

-- 1. Create container_types table
-- Holds high-level definitions (e.g., "20' General Purpose")
CREATE TABLE container_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID, -- Nullable for global types
    code VARCHAR(10) NOT NULL UNIQUE, -- ISO Code e.g., 22G1
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Standard', 'Reefer', 'Specialized', 'Tank', 'Flat Rack', 'Open Top')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create container_sizes table
-- Holds physical specifications linked to a type
CREATE TABLE container_sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    container_type_id UUID NOT NULL REFERENCES container_types(id) ON DELETE CASCADE,
    
    -- Nominal Dimensions
    length_ft DECIMAL(4,1) NOT NULL,
    height_ft DECIMAL(4,1),
    width_ft DECIMAL(4,1) DEFAULT 8.0,

    -- Internal Dimensions (mm)
    internal_length_mm INTEGER NOT NULL,
    internal_width_mm INTEGER NOT NULL,
    internal_height_mm INTEGER NOT NULL,

    -- Door Opening (mm)
    door_width_mm INTEGER NOT NULL,
    door_height_mm INTEGER NOT NULL,

    -- Capacity & Weight
    capacity_cbm DECIMAL(5,2) NOT NULL,
    max_payload_kg INTEGER NOT NULL,
    tare_weight_kg INTEGER NOT NULL,
    max_stack_weight_kg INTEGER,

    -- Flags
    is_high_cube BOOLEAN DEFAULT FALSE,
    is_pallet_wide BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique size config per type
    CONSTRAINT uq_container_size_config UNIQUE (container_type_id, length_ft, is_high_cube)
);

-- 3. Create Indexes for performance
CREATE INDEX idx_container_types_category ON container_types(category);
CREATE INDEX idx_container_types_code ON container_types(code);
CREATE INDEX idx_container_sizes_type_id ON container_sizes(container_type_id);
CREATE INDEX idx_container_types_tenant_id ON container_types(tenant_id);

-- 4. Enable RLS
ALTER TABLE container_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_sizes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (Read-only for most, Admin write)
-- Policy: Everyone can view
CREATE POLICY "Allow public read access to container_types" ON container_types FOR SELECT USING (true);
CREATE POLICY "Allow public read access to container_sizes" ON container_sizes FOR SELECT USING (true);

-- 6. Seed Initial Data (Container Matrix)
INSERT INTO container_types (code, name, category, description) VALUES
('20GP', '20'' General Purpose', 'Standard', 'Standard dry cargo container'),
('40GP', '40'' General Purpose', 'Standard', 'Standard dry cargo container'),
('40HC', '40'' High Cube', 'Standard', 'High volume dry cargo'),
('45HC', '45'' High Cube', 'Standard', 'Extra volume dry cargo'),
('20RF', '20'' Reefer', 'Reefer', 'Refrigerated container'),
('40RF', '40'' Reefer', 'Reefer', 'Refrigerated container'),
('40HR', '40'' High Cube Reefer', 'Reefer', 'High volume refrigerated'),
('20OT', '20'' Open Top', 'Specialized', 'Open top for over-height cargo'),
('40OT', '40'' Open Top', 'Specialized', 'Open top for over-height cargo'),
('20FR', '20'' Flat Rack', 'Specialized', 'Flat rack for heavy/oversized'),
('40FR', '40'' Flat Rack', 'Specialized', 'Flat rack for heavy/oversized')
ON CONFLICT (code) DO NOTHING;

-- Seed Sizes (Linking via subquery)
-- 20GP
INSERT INTO container_sizes (container_type_id, length_ft, height_ft, internal_length_mm, internal_width_mm, internal_height_mm, door_width_mm, door_height_mm, capacity_cbm, max_payload_kg, tare_weight_kg, is_high_cube)
SELECT id, 20, 8.5, 5898, 2352, 2393, 2340, 2280, 33.2, 28200, 2300, false FROM container_types WHERE code = '20GP'
ON CONFLICT DO NOTHING;

-- 40GP
INSERT INTO container_sizes (container_type_id, length_ft, height_ft, internal_length_mm, internal_width_mm, internal_height_mm, door_width_mm, door_height_mm, capacity_cbm, max_payload_kg, tare_weight_kg, is_high_cube)
SELECT id, 40, 8.5, 12025, 2352, 2393, 2340, 2280, 67.7, 26600, 3750, false FROM container_types WHERE code = '40GP'
ON CONFLICT DO NOTHING;

-- 40HC
INSERT INTO container_sizes (container_type_id, length_ft, height_ft, internal_length_mm, internal_width_mm, internal_height_mm, door_width_mm, door_height_mm, capacity_cbm, max_payload_kg, tare_weight_kg, is_high_cube)
SELECT id, 40, 9.5, 12025, 2352, 2698, 2340, 2585, 76.4, 26500, 3900, true FROM container_types WHERE code = '40HC'
ON CONFLICT DO NOTHING;
