-- Add franchise_id column to ports_locations table to support scoped data access
-- This fixes the "Failed to load ports/locations" error for franchise users by adding the missing column
-- and enables RLS policies for hybrid access (Global + Franchise specific)

ALTER TABLE public.ports_locations
ADD COLUMN IF NOT EXISTS franchise_id uuid REFERENCES public.franchises(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_ports_locations_franchise_id ON public.ports_locations(franchise_id);

-- Enable RLS
ALTER TABLE public.ports_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to global ports (franchise_id IS NULL) and ports belonging to the user's franchise
-- Updated to use public.get_user_franchise_id and support Platform Admins
DROP POLICY IF EXISTS "Allow read access to global and franchise ports" ON public.ports_locations;
CREATE POLICY "Allow read access to global and franchise ports"
ON public.ports_locations
FOR SELECT
USING (
  (public.is_platform_admin(auth.uid())) OR
  (franchise_id IS NULL) OR
  (franchise_id = public.get_user_franchise_id(auth.uid()))
);

-- Policy: Allow insert/update/delete only for franchise-specific ports (if user has permission)
-- This prevents franchise users from modifying global ports
DROP POLICY IF EXISTS "Allow write access to franchise ports" ON public.ports_locations;
CREATE POLICY "Allow write access to franchise ports"
ON public.ports_locations
FOR ALL
USING (
  (public.is_platform_admin(auth.uid())) OR
  (
    franchise_id = public.get_user_franchise_id(auth.uid()) AND
    franchise_id IS NOT NULL
  )
)
WITH CHECK (
  (public.is_platform_admin(auth.uid())) OR
  (
    franchise_id = public.get_user_franchise_id(auth.uid()) AND
    franchise_id IS NOT NULL
  )
);
