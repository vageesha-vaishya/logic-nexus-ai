-- Fix RLS policies for ports_locations
-- 1. Use correct helper function public.get_user_franchise_id(auth.uid())
-- 2. Add explicit Platform Admin access

-- Drop existing policies to be clean
DROP POLICY IF EXISTS "Allow read access to global and franchise ports" ON public.ports_locations;
DROP POLICY IF EXISTS "Allow write access to franchise ports" ON public.ports_locations;

-- Create comprehensive Read policy
CREATE POLICY "Read access for ports_locations"
ON public.ports_locations
FOR SELECT
USING (
  -- Platform Admins can see everything
  (public.is_platform_admin(auth.uid()))
  OR
  -- Everyone sees Global ports
  (franchise_id IS NULL)
  OR
  -- Franchise users see their franchise ports
  (franchise_id = public.get_user_franchise_id(auth.uid()))
);

-- Create comprehensive Write policy
CREATE POLICY "Write access for ports_locations"
ON public.ports_locations
FOR ALL
USING (
  -- Platform Admins can manage everything
  (public.is_platform_admin(auth.uid()))
  OR
  -- Franchise Admins can manage their franchise ports
  (
    public.has_role(auth.uid(), 'franchise_admin') 
    AND 
    franchise_id = public.get_user_franchise_id(auth.uid())
    AND
    franchise_id IS NOT NULL -- Safety: Franchise admins cannot touch global ports
  )
)
WITH CHECK (
  -- Platform Admins can manage everything
  (public.is_platform_admin(auth.uid()))
  OR
  -- Franchise Admins can manage their franchise ports
  (
    public.has_role(auth.uid(), 'franchise_admin') 
    AND 
    franchise_id = public.get_user_franchise_id(auth.uid())
    AND
    franchise_id IS NOT NULL
  )
);
