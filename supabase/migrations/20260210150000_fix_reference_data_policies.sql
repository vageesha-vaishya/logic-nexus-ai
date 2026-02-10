
-- Fix RLS policies for reference data to ensure frontend visibility

-- 1. Ports Locations (Global Resource)
ALTER TABLE IF EXISTS ports_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON ports_locations;
DROP POLICY IF EXISTS "Enable read access for all users" ON ports_locations;

CREATE POLICY "Allow read access for authenticated users"
ON ports_locations
FOR SELECT
TO authenticated
USING (true);

-- 2. Service Type Mappings (Global or Tenant Scoped)
ALTER TABLE IF EXISTS service_type_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON service_type_mappings;

CREATE POLICY "Allow read access for authenticated users"
ON service_type_mappings
FOR SELECT
TO authenticated
USING (
    tenant_id IS NULL 
    OR 
    tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
);

-- 3. Services (Often linked via mappings)
ALTER TABLE IF EXISTS services ENABLE ROW LEVEL SECURITY;

-- Ensure services are readable if they are active (assuming global services for now, or check schema)
-- If services are global, allow read.
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON services;

CREATE POLICY "Allow read access for authenticated users"
ON services
FOR SELECT
TO authenticated
USING (is_active = true);

-- 4. Carriers (Global)
ALTER TABLE IF EXISTS carriers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON carriers;

CREATE POLICY "Allow read access for authenticated users"
ON carriers
FOR SELECT
TO authenticated
USING (is_active = true);
