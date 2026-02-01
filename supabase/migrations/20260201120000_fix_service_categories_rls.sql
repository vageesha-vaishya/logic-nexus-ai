-- Fix RLS policies for Service Categories and related tables
-- Ensures authenticated users can view service architecture configuration

BEGIN;

-- 1. Service Categories
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active service categories" ON service_categories;
CREATE POLICY "Anyone can view active service categories" 
ON service_categories FOR SELECT 
USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users can view all service categories" ON service_categories;
CREATE POLICY "Authenticated users can view all service categories" 
ON service_categories FOR SELECT 
TO authenticated
USING (true);

-- 2. Service Types (Just in case)
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active service types" ON service_types;
CREATE POLICY "Anyone can view active service types" 
ON service_types FOR SELECT 
USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users can view all service types" ON service_types;
CREATE POLICY "Authenticated users can view all service types" 
ON service_types FOR SELECT 
TO authenticated
USING (true);

-- 3. Platform Domains (Just in case)
ALTER TABLE platform_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active platform domains" ON platform_domains;
CREATE POLICY "Anyone can view active platform domains" 
ON platform_domains FOR SELECT 
USING (status = 'active');

DROP POLICY IF EXISTS "Authenticated users can view all platform domains" ON platform_domains;
CREATE POLICY "Authenticated users can view all platform domains" 
ON platform_domains FOR SELECT 
TO authenticated
USING (true);

COMMIT;
