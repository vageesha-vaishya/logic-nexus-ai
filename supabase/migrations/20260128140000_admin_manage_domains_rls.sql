
-- Migration: Add CRUD policies for platform_domains (Admin Management)

-- Allow platform_admins to insert, update, and delete platform_domains
-- (Assuming is_platform_admin() function exists and is reliable)

CREATE POLICY "Platform admins can insert platform domains"
  ON public.platform_domains
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update platform domains"
  ON public.platform_domains
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete platform domains"
  ON public.platform_domains
  FOR DELETE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));
