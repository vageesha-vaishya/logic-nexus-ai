-- 1. Scheduled Emails Table
CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  franchise_id UUID REFERENCES public.franchises(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  account_id UUID NOT NULL REFERENCES public.email_accounts(id),
  to_emails JSONB NOT NULL,
  cc_emails JSONB,
  bcc_emails JSONB,
  subject TEXT NOT NULL,
  body_html TEXT,
  template_id UUID REFERENCES public.email_templates(id),
  template_variables JSONB,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, sent, failed
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Scheduled Emails
CREATE POLICY "Users can manage their own scheduled emails"
  ON public.scheduled_emails
  USING (user_id = auth.uid());

CREATE POLICY "Platform admins can view all scheduled emails"
  ON public.scheduled_emails
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('platform_admin', 'super_admin')
    )
  );

-- 2. Email Audit Log Table
CREATE TABLE IF NOT EXISTS public.email_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  action TEXT NOT NULL, -- 'send', 'read', 'delete', 'archive', 'link'
  email_id UUID REFERENCES public.emails(id),
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Email Audit Log
CREATE POLICY "Platform admins view all email logs"
  ON public.email_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('platform_admin', 'super_admin')
    )
  );

CREATE POLICY "Tenant admins view tenant email logs"
  ON public.email_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'tenant_admin'
    )
    AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- 3. Add AI Columns to Emails Table
ALTER TABLE public.emails 
ADD COLUMN IF NOT EXISTS ai_category TEXT,
ADD COLUMN IF NOT EXISTS ai_sentiment TEXT,
ADD COLUMN IF NOT EXISTS ai_urgency TEXT,
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ;

-- 4. Automatic Audit Trigger
CREATE OR REPLACE FUNCTION public.log_email_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.email_audit_log (user_id, tenant_id, action, email_id, details)
  VALUES (
    auth.uid(),
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    TG_OP,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    )
  );
  RETURN NEW;
END;
$$;

-- Trigger for emails table (Audit Logging)
DROP TRIGGER IF EXISTS on_email_change ON public.emails;
CREATE TRIGGER on_email_change
  AFTER INSERT OR UPDATE OR DELETE ON public.emails
  FOR EACH ROW EXECUTE FUNCTION public.log_email_action();
