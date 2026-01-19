-- Fix infinite recursion in email_accounts policies
-- This script:
-- 1. Re-creates the SECURITY DEFINER function to get delegated accounts (ensuring it exists and is correct)
-- 2. Drops the redundant and problematic "Users can view delegated email accounts" policy
-- 3. Updates the "Email accounts scope matrix - SELECT" policy to use the SD function
-- 4. Updates "Owners can manage delegations" to use SD function to prevent reverse recursion

-- 1. Ensure SECURITY DEFINER function for delegated accounts exists
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

-- Ensure SECURITY DEFINER function for owned accounts exists
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

-- 2. Drop the problematic policy that causes recursion
-- This policy was introduced in Phase 3 completion and duplicates logic but with direct table access causing recursion
DROP POLICY IF EXISTS "Users can view delegated email accounts" ON public.email_accounts;

-- 3. Update the main SELECT policy to use the SECURITY DEFINER function
DROP POLICY IF EXISTS "Email accounts scope matrix - SELECT" ON public.email_accounts;

CREATE POLICY "Email accounts scope matrix - SELECT"
ON public.email_accounts FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_platform_admin(auth.uid())
  OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
  OR (is_franchise_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()))
  OR id IN (SELECT public.get_delegated_email_account_ids(auth.uid()))
);

-- 4. Update email_account_delegations policies to be safe
DROP POLICY IF EXISTS "Owners can manage delegations" ON public.email_account_delegations;
DROP POLICY IF EXISTS "Delegation owners can manage" ON public.email_account_delegations;

CREATE POLICY "Owners can manage delegations"
ON public.email_account_delegations
FOR ALL
USING (
  account_id IN (SELECT public.get_user_email_account_ids(auth.uid()))
);

-- Force schema cache reload
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reload_postgrest_schema') THEN
    PERFORM public.reload_postgrest_schema();
  ELSE
    PERFORM pg_notify('pgrst', 'reload schema');
  END IF;
END $$;
