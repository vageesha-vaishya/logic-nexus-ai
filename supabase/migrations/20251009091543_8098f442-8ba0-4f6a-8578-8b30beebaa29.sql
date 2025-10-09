-- Ensure platform admins have full access to service_types
DROP POLICY IF EXISTS "Platform admins can manage all service types" ON public.service_types;

CREATE POLICY "Platform admins can manage all service types"
ON public.service_types
FOR ALL
TO public
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- Ensure platform admins have full access to services
DROP POLICY IF EXISTS "Platform admins can manage all services" ON public.services;

CREATE POLICY "Platform admins can manage all services"
ON public.services
FOR ALL
TO public
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));
