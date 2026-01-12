-- Create security definer function to get user's email account IDs
-- This prevents infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION public.get_user_email_account_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.email_accounts
  WHERE user_id = _user_id;
$$;

-- Create function to get delegated email account IDs
CREATE OR REPLACE FUNCTION public.get_delegated_email_account_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.email_account_delegations
  WHERE delegate_user_id = _user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
$$;

-- Drop existing email_accounts policies
DROP POLICY IF EXISTS "Email accounts scope matrix - SELECT" ON public.email_accounts;
DROP POLICY IF EXISTS "Email accounts scope matrix - INSERT" ON public.email_accounts;
DROP POLICY IF EXISTS "Email accounts scope matrix - UPDATE" ON public.email_accounts;
DROP POLICY IF EXISTS "Email accounts scope matrix - DELETE" ON public.email_accounts;

-- Recreate email_accounts policies using security definer functions
CREATE POLICY "Email accounts scope matrix - SELECT" ON public.email_accounts
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_platform_admin(auth.uid())
  OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
  OR (is_franchise_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()))
  OR id IN (SELECT get_delegated_email_account_ids(auth.uid()))
);

CREATE POLICY "Email accounts scope matrix - INSERT" ON public.email_accounts
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR is_platform_admin(auth.uid()));

CREATE POLICY "Email accounts scope matrix - UPDATE" ON public.email_accounts
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR is_platform_admin(auth.uid()));

CREATE POLICY "Email accounts scope matrix - DELETE" ON public.email_accounts
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR is_platform_admin(auth.uid()));

-- Drop existing emails policies
DROP POLICY IF EXISTS "Email scope matrix - SELECT" ON public.emails;
DROP POLICY IF EXISTS "Email scope matrix - INSERT" ON public.emails;
DROP POLICY IF EXISTS "Email scope matrix - UPDATE" ON public.emails;
DROP POLICY IF EXISTS "Email scope matrix - DELETE" ON public.emails;

-- Recreate emails policies using security definer functions
CREATE POLICY "Email scope matrix - SELECT" ON public.emails
FOR SELECT TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
  OR (is_franchise_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()))
  OR user_id = auth.uid()
  OR account_id IN (SELECT get_user_email_account_ids(auth.uid()))
  OR account_id IN (SELECT get_delegated_email_account_ids(auth.uid()))
);

CREATE POLICY "Email scope matrix - INSERT" ON public.emails
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR account_id IN (SELECT get_user_email_account_ids(auth.uid()))
  OR is_platform_admin(auth.uid())
);

CREATE POLICY "Email scope matrix - UPDATE" ON public.emails
FOR UPDATE TO authenticated
USING (
  NOT is_viewer(auth.uid())
  AND (
    user_id = auth.uid()
    OR account_id IN (SELECT get_user_email_account_ids(auth.uid()))
    OR is_platform_admin(auth.uid())
    OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
    OR (is_franchise_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()))
  )
);

CREATE POLICY "Email scope matrix - DELETE" ON public.emails
FOR DELETE TO authenticated
USING (
  NOT is_viewer(auth.uid())
  AND (
    user_id = auth.uid()
    OR account_id IN (SELECT get_user_email_account_ids(auth.uid()))
    OR is_platform_admin(auth.uid())
    OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
  )
);

-- Force PostgREST schema cache reload
SELECT public.reload_postgrest_schema();