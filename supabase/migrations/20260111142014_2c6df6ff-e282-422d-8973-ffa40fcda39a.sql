-- =====================================================
-- PHASE 2 EMAIL INFRASTRUCTURE: Complete Implementation
-- =====================================================

-- 1. Add missing columns to emails table
ALTER TABLE public.emails 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS ai_category TEXT,
ADD COLUMN IF NOT EXISTS ai_sentiment TEXT CHECK (ai_sentiment IN ('positive', 'neutral', 'negative')),
ADD COLUMN IF NOT EXISTS ai_urgency TEXT CHECK (ai_urgency IN ('low', 'medium', 'high', 'critical'));

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON public.emails(user_id);

-- 2. Create scheduled_emails table for queue-based processing
CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  franchise_id UUID REFERENCES public.franchises(id),
  user_id UUID REFERENCES auth.users(id),
  account_id UUID REFERENCES public.email_accounts(id),
  
  -- Recipients
  to_emails JSONB NOT NULL,
  cc_emails JSONB,
  bcc_emails JSONB,
  
  -- Content
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  
  -- Template support
  template_id UUID REFERENCES public.email_templates(id),
  template_variables JSONB,
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Metadata
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  metadata JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on scheduled_emails
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Indexes for scheduled_emails
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON public.scheduled_emails(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_at ON public.scheduled_emails(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_tenant_id ON public.scheduled_emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_user_id ON public.scheduled_emails(user_id);

-- 3. Create email_audit_log table for compliance
CREATE TABLE IF NOT EXISTS public.email_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  franchise_id UUID REFERENCES public.franchises(id),
  email_id UUID REFERENCES public.emails(id) ON DELETE SET NULL,
  scheduled_email_id UUID REFERENCES public.scheduled_emails(id) ON DELETE SET NULL,
  
  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'scheduled', 'cancelled')),
  event_data JSONB,
  
  -- Actor
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on email_audit_log
ALTER TABLE public.email_audit_log ENABLE ROW LEVEL SECURITY;

-- Indexes for email_audit_log
CREATE INDEX IF NOT EXISTS idx_email_audit_log_email_id ON public.email_audit_log(email_id);
CREATE INDEX IF NOT EXISTS idx_email_audit_log_tenant_id ON public.email_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_audit_log_event_type ON public.email_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_email_audit_log_created_at ON public.email_audit_log(created_at);

-- 4. Create helper functions for hierarchical access
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'platform_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'tenant_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_franchise_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.role = 'franchise_admin'
  );
$$;

-- 5. RLS Policies for scheduled_emails (Hierarchical)
CREATE POLICY "Super admins can manage all scheduled emails"
ON public.scheduled_emails FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant scheduled emails"
ON public.scheduled_emails FOR ALL
TO authenticated
USING (
  public.is_tenant_admin(auth.uid())
  AND tenant_id = public.get_user_tenant_id(auth.uid())
);

CREATE POLICY "Franchise admins can manage franchise scheduled emails"
ON public.scheduled_emails FOR ALL
TO authenticated
USING (
  public.is_franchise_admin(auth.uid())
  AND tenant_id = public.get_user_tenant_id(auth.uid())
  AND franchise_id = public.get_user_franchise_id(auth.uid())
);

CREATE POLICY "Users can manage own scheduled emails"
ON public.scheduled_emails FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- 6. RLS Policies for email_audit_log (Read-only hierarchical)
CREATE POLICY "Super admins can view all audit logs"
ON public.email_audit_log FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can view tenant audit logs"
ON public.email_audit_log FOR SELECT
TO authenticated
USING (
  public.is_tenant_admin(auth.uid())
  AND tenant_id = public.get_user_tenant_id(auth.uid())
);

CREATE POLICY "Franchise admins can view franchise audit logs"
ON public.email_audit_log FOR SELECT
TO authenticated
USING (
  public.is_franchise_admin(auth.uid())
  AND tenant_id = public.get_user_tenant_id(auth.uid())
  AND franchise_id = public.get_user_franchise_id(auth.uid())
);

CREATE POLICY "Users can view own audit logs"
ON public.email_audit_log FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow inserts from service role (edge functions)
CREATE POLICY "Service can insert audit logs"
ON public.email_audit_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- 7. Trigger for automatic audit logging on email changes
CREATE OR REPLACE FUNCTION public.log_email_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.email_audit_log (
      tenant_id, franchise_id, email_id, event_type, event_data, user_id
    ) VALUES (
      NEW.tenant_id, NEW.franchise_id, NEW.id, 
      CASE NEW.direction WHEN 'outbound' THEN 'sent' ELSE 'delivered' END,
      jsonb_build_object('subject', NEW.subject, 'to', NEW.to_emails),
      auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO public.email_audit_log (
      tenant_id, franchise_id, email_id, event_type, event_data, user_id
    ) VALUES (
      NEW.tenant_id, NEW.franchise_id, NEW.id, 
      CASE 
        WHEN NEW.status = 'failed' THEN 'failed'
        WHEN NEW.is_read AND NOT OLD.is_read THEN 'opened'
        ELSE 'delivered'
      END,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_audit
AFTER INSERT OR UPDATE ON public.emails
FOR EACH ROW
EXECUTE FUNCTION public.log_email_audit();

-- 8. Enhanced emails RLS with hierarchical visibility
DROP POLICY IF EXISTS "Users can view emails from their accounts" ON public.emails;

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
);

-- 9. Update timestamp trigger for scheduled_emails
CREATE OR REPLACE FUNCTION public.update_scheduled_email_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_scheduled_emails_updated
BEFORE UPDATE ON public.scheduled_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_scheduled_email_timestamp();