-- Phase 3: Email Infrastructure Completion (Shared Access & Missing AI Fields)

-- 1. Add missing AI columns (complementing Phase 2)
ALTER TABLE public.emails 
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ;

-- 2. Email Account Delegations (Shared Inbox Support)
CREATE TABLE IF NOT EXISTS public.email_account_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  delegate_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions JSONB DEFAULT '["read", "send"]'::jsonb, -- read, send, delete, archive
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(account_id, delegate_user_id)
);

-- Enable RLS
ALTER TABLE public.email_account_delegations ENABLE ROW LEVEL SECURITY;

-- 3. RLS for Delegations

-- Account owners can manage delegations
CREATE POLICY "Owners can manage delegations"
ON public.email_account_delegations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.email_accounts
    WHERE id = account_id AND user_id = auth.uid()
  )
);

-- Delegates can view their delegations
CREATE POLICY "Delegates can view their delegations"
ON public.email_account_delegations
FOR SELECT
USING (delegate_user_id = auth.uid());

-- Tenant/Franchise admins can view delegations in their scope
CREATE POLICY "Admins can view delegations"
ON public.email_account_delegations
FOR SELECT
USING (
  (public.is_tenant_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.email_accounts ea
    WHERE ea.id = account_id AND ea.tenant_id = public.get_user_tenant_id(auth.uid())
  ))
  OR
  (public.is_franchise_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.email_accounts ea
    WHERE ea.id = account_id AND ea.franchise_id = public.get_user_franchise_id(auth.uid())
  ))
);

-- 4. Helper Function: Get Franchise User IDs (for UI lists)
CREATE OR REPLACE FUNCTION public.get_franchise_user_ids(_franchise_id UUID)
RETURNS TABLE (user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles 
  WHERE franchise_id = _franchise_id;
$$;

-- 5. Update Emails RLS to include Delegated Access
-- We need to DROP the existing policy and recreate it to include delegations
DROP POLICY IF EXISTS "Hierarchical email visibility" ON public.emails;

CREATE POLICY "Hierarchical email visibility"
ON public.emails FOR SELECT
TO authenticated
USING (
  -- Super Admin: see all
  public.is_super_admin(auth.uid())
  OR
  -- Tenant Admin: see all within tenant
  (public.is_tenant_admin(auth.uid()) AND tenant_id = public.get_user_tenant_id(auth.uid()))
  OR
  -- Franchise Admin: see all within franchise
  (public.is_franchise_admin(auth.uid()) 
   AND tenant_id = public.get_user_tenant_id(auth.uid())
   AND franchise_id = public.get_user_franchise_id(auth.uid()))
  OR
  -- User: see own emails or emails from their accounts
  (account_id IN (SELECT id FROM public.email_accounts WHERE user_id = auth.uid()))
  OR
  -- User: see emails they sent
  (user_id = auth.uid())
  OR
  -- User: see emails from accounts delegated to them
  (account_id IN (
    SELECT account_id FROM public.email_account_delegations 
    WHERE delegate_user_id = auth.uid()
  ))
);

-- 6. Update Email Accounts RLS for Delegation Visibility
-- Ensure delegates can see the accounts they have access to
DROP POLICY IF EXISTS "Users can view own email accounts" ON public.email_accounts;
-- Note: There might be other policies like "Tenant admins..." so we only drop/replace the user-centric one if it exists.
-- Or we create a new broad policy.
-- Let's check existing policies. If we can't check, we'll create a new policy "Users can view delegated accounts"
-- avoiding conflict with "Users can view own email accounts".

CREATE POLICY "Users can view delegated email accounts"
ON public.email_accounts FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT account_id FROM public.email_account_delegations 
    WHERE delegate_user_id = auth.uid()
  )
);
