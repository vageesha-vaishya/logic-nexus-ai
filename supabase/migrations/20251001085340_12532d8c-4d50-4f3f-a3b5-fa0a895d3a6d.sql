-- Make tenant_id nullable in email_accounts to support platform admins
ALTER TABLE public.email_accounts ALTER COLUMN tenant_id DROP NOT NULL;

-- Update RLS policies for email_accounts to handle null tenant_id
DROP POLICY IF EXISTS "Platform admins can manage all email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can create own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can view own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can update own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can delete own email accounts" ON public.email_accounts;

-- Recreate policies with proper null handling
CREATE POLICY "Platform admins can manage all email accounts"
  ON public.email_accounts
  FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can manage own email accounts"
  ON public.email_accounts
  FOR ALL
  USING (user_id = auth.uid());