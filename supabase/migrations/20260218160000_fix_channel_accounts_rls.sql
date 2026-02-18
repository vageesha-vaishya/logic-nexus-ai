-- Fix RLS for channel_accounts to allow Platform Admin management
-- Enables Platform Admins to SELECT/INSERT/UPDATE/DELETE across all rows
-- Keeps existing Tenant Admin scoped policy intact

ALTER TABLE public.channel_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can manage channel accounts" ON public.channel_accounts;
CREATE POLICY "Platform admins can manage channel accounts"
ON public.channel_accounts
FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));
