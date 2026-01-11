-- ============================================================
-- Email Infrastructure: Phase 3B - Complete Email Scope Matrix
-- ============================================================

-- 1. Create email_account_delegations table for shared inbox support
CREATE TABLE IF NOT EXISTS public.email_account_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  delegate_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '["read"]'::jsonb,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, delegate_user_id)
);

-- Enable RLS
ALTER TABLE public.email_account_delegations ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_delegations_account_id ON public.email_account_delegations(account_id);
CREATE INDEX IF NOT EXISTS idx_email_delegations_delegate_user_id ON public.email_account_delegations(delegate_user_id);
CREATE INDEX IF NOT EXISTS idx_email_delegations_is_active ON public.email_account_delegations(is_active);

-- 2. Helper function: Check if user is a sales_manager
CREATE OR REPLACE FUNCTION public.is_sales_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'sales_manager'
  );
$$;

-- 3. Helper function: Check if user is a viewer (read-only)
CREATE OR REPLACE FUNCTION public.is_viewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'viewer'
  );
$$;

-- 4. Helper function: Get franchise user IDs (for franchise-level visibility)
CREATE OR REPLACE FUNCTION public.get_franchise_user_ids(_franchise_id uuid)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.franchise_id = _franchise_id;
$$;

-- 5. Helper function: Get direct reports for sales manager
CREATE OR REPLACE FUNCTION public.get_sales_manager_team_user_ids(_manager_id uuid)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.franchise_id IN (
    SELECT ur2.franchise_id 
    FROM public.user_roles ur2 
    WHERE ur2.user_id = _manager_id 
    AND ur2.role = 'sales_manager'
    AND ur2.franchise_id IS NOT NULL
  )
  AND ur.role IN ('user', 'sales_manager', 'viewer')
  UNION
  SELECT _manager_id;
$$;

-- 6. Drop existing email policies to recreate with complete scope matrix
DROP POLICY IF EXISTS "Hierarchical email visibility" ON public.emails;
DROP POLICY IF EXISTS "Platform admins can manage all emails" ON public.emails;
DROP POLICY IF EXISTS "Users can view emails from their accounts" ON public.emails;
DROP POLICY IF EXISTS "Users can create emails" ON public.emails;
DROP POLICY IF EXISTS "Users can update their emails" ON public.emails;

-- 7. Create comprehensive email SELECT policy implementing the full scope matrix
CREATE POLICY "Email scope matrix - SELECT"
ON public.emails FOR SELECT
TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
  OR (is_franchise_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()))
  OR (is_sales_manager(auth.uid()) AND (user_id = auth.uid() OR user_id IN (SELECT get_sales_manager_team_user_ids(auth.uid())) OR account_id IN (SELECT id FROM public.email_accounts WHERE user_id IN (SELECT get_sales_manager_team_user_ids(auth.uid())))))
  OR (user_id = auth.uid() OR account_id IN (SELECT id FROM public.email_accounts WHERE user_id = auth.uid()))
  OR account_id IN (SELECT account_id FROM public.email_account_delegations WHERE delegate_user_id = auth.uid() AND is_active = true AND (expires_at IS NULL OR expires_at > now()))
);

-- 8. Create INSERT policy for emails
CREATE POLICY "Email scope matrix - INSERT"
ON public.emails FOR INSERT
TO authenticated
WITH CHECK (
  NOT is_viewer(auth.uid())
  AND (
    account_id IN (SELECT id FROM public.email_accounts WHERE user_id = auth.uid())
    OR is_platform_admin(auth.uid())
    OR account_id IN (SELECT account_id FROM public.email_account_delegations WHERE delegate_user_id = auth.uid() AND is_active = true AND permissions ? 'send' AND (expires_at IS NULL OR expires_at > now()))
  )
);

-- 9. Create UPDATE policy for emails
CREATE POLICY "Email scope matrix - UPDATE"
ON public.emails FOR UPDATE
TO authenticated
USING (
  NOT is_viewer(auth.uid())
  AND (
    user_id = auth.uid()
    OR account_id IN (SELECT id FROM public.email_accounts WHERE user_id = auth.uid())
    OR is_platform_admin(auth.uid())
    OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
    OR (is_franchise_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()))
  )
);

-- 10. Create DELETE policy for emails
CREATE POLICY "Email scope matrix - DELETE"
ON public.emails FOR DELETE
TO authenticated
USING (
  NOT is_viewer(auth.uid())
  AND (
    user_id = auth.uid()
    OR account_id IN (SELECT id FROM public.email_accounts WHERE user_id = auth.uid())
    OR is_platform_admin(auth.uid())
    OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
  )
);

-- 11. RLS Policies for email_account_delegations
CREATE POLICY "Delegation owners can manage"
ON public.email_account_delegations FOR ALL
USING (account_id IN (SELECT id FROM public.email_accounts WHERE user_id = auth.uid()))
WITH CHECK (account_id IN (SELECT id FROM public.email_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Delegates can view their delegations"
ON public.email_account_delegations FOR SELECT
USING (delegate_user_id = auth.uid());

CREATE POLICY "Platform admins can manage all delegations"
ON public.email_account_delegations FOR ALL
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can view delegations"
ON public.email_account_delegations FOR SELECT
USING (is_tenant_admin(auth.uid()) AND account_id IN (SELECT id FROM public.email_accounts WHERE tenant_id = get_user_tenant_id(auth.uid())));

CREATE POLICY "Franchise admins can view franchise delegations"
ON public.email_account_delegations FOR SELECT
USING (is_franchise_admin(auth.uid()) AND account_id IN (SELECT id FROM public.email_accounts WHERE franchise_id = get_user_franchise_id(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())));

-- 12. Update email_accounts RLS
DROP POLICY IF EXISTS "Users can manage own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Platform admins can manage all email accounts" ON public.email_accounts;

CREATE POLICY "Email accounts scope matrix - SELECT"
ON public.email_accounts FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_platform_admin(auth.uid())
  OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
  OR (is_franchise_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()))
  OR id IN (SELECT account_id FROM public.email_account_delegations WHERE delegate_user_id = auth.uid() AND is_active = true AND (expires_at IS NULL OR expires_at > now()))
);

CREATE POLICY "Email accounts scope matrix - INSERT"
ON public.email_accounts FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR is_platform_admin(auth.uid()));

CREATE POLICY "Email accounts scope matrix - UPDATE"
ON public.email_accounts FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR is_platform_admin(auth.uid()));

CREATE POLICY "Email accounts scope matrix - DELETE"
ON public.email_accounts FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR is_platform_admin(auth.uid()));

-- 13. Update scheduled_emails RLS
DROP POLICY IF EXISTS "Super admins can manage all scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Tenant admins can manage tenant scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Franchise admins can manage franchise scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Users can manage own scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Scheduled emails scope matrix" ON public.scheduled_emails;

CREATE POLICY "Scheduled emails scope matrix"
ON public.scheduled_emails FOR ALL
TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
  OR (is_franchise_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()))
  OR (is_sales_manager(auth.uid()) AND user_id IN (SELECT get_sales_manager_team_user_ids(auth.uid())))
  OR user_id = auth.uid()
)
WITH CHECK (
  NOT is_viewer(auth.uid())
  AND (
    is_platform_admin(auth.uid())
    OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
    OR (is_franchise_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()))
    OR user_id = auth.uid()
  )
);

-- 14. Update timestamp trigger for delegations
CREATE OR REPLACE TRIGGER trg_email_delegations_updated
BEFORE UPDATE ON public.email_account_delegations
FOR EACH ROW
EXECUTE FUNCTION public.update_scheduled_email_timestamp();