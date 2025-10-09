-- Make service_types table publicly readable for all users
-- This is useful for lookup/reference data that should be accessible everywhere

DROP POLICY IF EXISTS "All users can view service types" ON public.service_types;

CREATE POLICY "Anyone can view service types"
ON public.service_types
FOR SELECT
TO public
USING (true);

-- Also ensure services can be viewed by authenticated users with proper tenant access
-- (policies already exist, just documenting the expected behavior)
