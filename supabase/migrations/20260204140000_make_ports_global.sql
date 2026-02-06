-- Make ports_locations a truly global resource
-- 1. Remove franchise_id dependency
-- 2. Update RLS policies for global access

-- Drop existing policies first to avoid dependency issues
DROP POLICY IF EXISTS "Allow read access to global and franchise ports" ON public.ports_locations;
DROP POLICY IF EXISTS "Allow write access to franchise ports" ON public.ports_locations;
DROP POLICY IF EXISTS "Read access for ports_locations" ON public.ports_locations;
DROP POLICY IF EXISTS "Write access for ports_locations" ON public.ports_locations;
DROP POLICY IF EXISTS "Users can view global ports" ON public.ports_locations;

-- Remove franchise_id if it exists (it might not, based on user report, but good to be safe)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ports_locations' AND column_name = 'franchise_id') THEN
        ALTER TABLE public.ports_locations DROP COLUMN franchise_id;
    END IF;
END $$;

-- Create new global policies

-- 1. Read Access: All authenticated users can read all ports
CREATE POLICY "Global read access for ports_locations"
ON public.ports_locations
FOR SELECT
TO authenticated
USING (true);

-- 2. Write Access: Only Platform Admins can modify ports
-- (Assuming we want to restrict global data management to platform admins)
CREATE POLICY "Platform Admin write access for ports_locations"
ON public.ports_locations
FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));
