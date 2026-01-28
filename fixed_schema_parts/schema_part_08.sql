  v_contact_email := p_contact_data->>'email';
  v_contact_first_name := p_contact_data->>'first_name';
  v_contact_last_name := p_contact_data->>'last_name';

  IF v_contact_first_name IS NULL OR v_contact_last_name IS NULL THEN
    RAISE EXCEPTION 'Contact first_name and last_name are required';
  END IF;

  IF NULLIF(p_contact_data->>'id','') IS NOT NULL THEN
    v_contact_id := (p_contact_data->>'id')::UUID;

    IF NOT EXISTS (SELECT 1 FROM public.contacts WHERE id = v_contact_id AND tenant_id = p_tenant_id) THEN
      RAISE EXCEPTION 'Contact ID % not found in Tenant %', v_contact_id, p_tenant_id;
    END IF;

    UPDATE public.contacts
    SET franchise_id = p_franchise_id,
        account_id = v_account_id,
        updated_at = now()
    WHERE id = v_contact_id;
  ELSE
    IF v_contact_email IS NOT NULL AND v_contact_email <> '' THEN
      SELECT id INTO v_contact_id
      FROM public.contacts
      WHERE tenant_id = p_tenant_id AND email = v_contact_email
      LIMIT 1;
    END IF;

    IF v_contact_id IS NOT NULL THEN
      UPDATE public.contacts
      SET franchise_id = p_franchise_id,
          account_id = v_account_id,
          updated_at = now()
      WHERE id = v_contact_id;
    ELSE
      INSERT INTO public.contacts (
        tenant_id, franchise_id, account_id,
        first_name, last_name, email, phone, mobile, title,
        created_by
      ) VALUES (
        p_tenant_id,
        p_franchise_id,
        v_account_id,
        v_contact_first_name,
        v_contact_last_name,
        v_contact_email,
        p_contact_data->>'phone',
        p_contact_data->>'mobile',
        p_contact_data->>'title',
        COALESCE(NULLIF(p_contact_data->>'created_by','')::UUID, v_actor)
      ) RETURNING id INTO v_contact_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'franchise_id', p_franchise_id,
    'account_id', v_account_id,
    'contact_id', v_contact_id,
    'message', 'Successfully assigned Account and Contact to Franchisee'
  );
END;
$$;

-- Create user_preferences table for Admin Scope Switcher
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  admin_override_enabled BOOLEAN NOT NULL DEFAULT false,
  theme VARCHAR(20) DEFAULT 'system',
  language VARCHAR(10) DEFAULT 'en',
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only manage their own preferences
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
CREATE POLICY "Users can view their own preferences" ON public.user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences" ON public.user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences" ON public.user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own preferences" ON public.user_preferences;
CREATE POLICY "Users can delete their own preferences" ON public.user_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: Set user scope preference (for Admin Override feature)
DROP FUNCTION IF EXISTS public.set_user_scope_preference(p_tenant_id UUID, p_franchise_id UUID, p_admin_override BOOLEAN);
CREATE OR REPLACE FUNCTION public.set_user_scope_preference(
  p_tenant_id UUID DEFAULT NULL,
  p_franchise_id UUID DEFAULT NULL,
  p_admin_override BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_preferences (user_id, tenant_id, franchise_id, admin_override_enabled)
  VALUES (v_user_id, p_tenant_id, p_franchise_id, p_admin_override)
  ON CONFLICT (user_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    franchise_id = EXCLUDED.franchise_id,
    admin_override_enabled = EXCLUDED.admin_override_enabled,
    updated_at = now();
END;
$$;

-- RPC: Set admin override (specifically for toggling override mode)
DROP FUNCTION IF EXISTS public.set_admin_override(p_enabled BOOLEAN, p_tenant_id UUID, p_franchise_id UUID);
CREATE OR REPLACE FUNCTION public.set_admin_override(
  p_enabled BOOLEAN,
  p_tenant_id UUID DEFAULT NULL,
  p_franchise_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_platform_admin BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is platform admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id AND role = 'platform_admin'
  ) INTO v_is_platform_admin;

  IF NOT v_is_platform_admin THEN
    RAISE EXCEPTION 'Only platform admins can use admin override';
  END IF;

  INSERT INTO public.user_preferences (user_id, tenant_id, franchise_id, admin_override_enabled)
  VALUES (v_user_id, p_tenant_id, p_franchise_id, p_enabled)
  ON CONFLICT (user_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    franchise_id = EXCLUDED.franchise_id,
    admin_override_enabled = EXCLUDED.admin_override_enabled,
    updated_at = now();
END;
$$;

-- Grant execute permissions

    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id),
    franchise_id UUID REFERENCES public.franchises(id),
    widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can view own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can view own dashboard preferences" ON public.dashboard_preferences FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can insert own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can insert own dashboard preferences" ON public.dashboard_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can update own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can update own dashboard preferences" ON public.dashboard_preferences FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy for Team View (read-only)
-- Users can view dashboards of other users in the same tenant
DROP POLICY IF EXISTS "Users can view team dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can view team dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can view team dashboard preferences" ON public.dashboard_preferences FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    );

-- Add completed_at to import_history for duration calculation
ALTER TABLE public.import_history ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Create import_errors table for detailed reporting
CREATE TABLE IF NOT EXISTS public.import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID REFERENCES public.import_history(id) ON DELETE CASCADE,
    row_number INTEGER,
    field TEXT,
    error_message TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;

-- Regular authenticated user policies (view and insert only)
DROP POLICY IF EXISTS "Users can view import errors" ON public.import_errors;
DROP POLICY IF EXISTS "Users can view import errors" ON public.import_errors;
CREATE POLICY "Users can view import errors" ON public.import_errors
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert import errors" ON public.import_errors;
DROP POLICY IF EXISTS "Users can insert import errors" ON public.import_errors;
CREATE POLICY "Users can insert import errors" ON public.import_errors
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Super Admin / Platform Admin policies (Full Access)
-- Grant full access to import_errors for platform admins
DROP POLICY IF EXISTS "Platform admins can manage all import errors" ON public.import_errors;
DROP POLICY IF EXISTS "Platform admins can manage all import errors" ON public.import_errors;
CREATE POLICY "Platform admins can manage all import errors" ON public.import_errors
    FOR ALL USING (public.is_platform_admin(auth.uid()));

-- Grant full access to import_history for platform admins (restoring full control including DELETE)
DROP POLICY IF EXISTS "Platform admins can manage all import history" ON public.import_history;
DROP POLICY IF EXISTS "Platform admins can manage all import history" ON public.import_history;
CREATE POLICY "Platform admins can manage all import history" ON public.import_history
    FOR ALL USING (public.is_platform_admin(auth.uid()));

-- Grant full access to import_history_details for platform admins
DROP POLICY IF EXISTS "Platform admins can manage all import details" ON public.import_history_details;
DROP POLICY IF EXISTS "Platform admins can manage all import details" ON public.import_history_details;
CREATE POLICY "Platform admins can manage all import details" ON public.import_history_details
    FOR ALL USING (public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_import_errors_import_id ON public.import_errors(import_id);

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
DROP FUNCTION IF EXISTS public.is_super_admin(_user_id UUID);
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

DROP FUNCTION IF EXISTS public.is_tenant_admin(_user_id UUID);
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

DROP FUNCTION IF EXISTS public.is_franchise_admin(_user_id UUID);
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
DROP POLICY IF EXISTS "Super admins can manage all scheduled emails" ON public.scheduled_emails;
CREATE POLICY "Super admins can manage all scheduled emails" ON public.scheduled_emails FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant scheduled emails" ON public.scheduled_emails;
CREATE POLICY "Tenant admins can manage tenant scheduled emails" ON public.scheduled_emails FOR ALL
TO authenticated
USING (
  public.is_tenant_admin(auth.uid())
  AND tenant_id = public.get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Franchise admins can manage franchise scheduled emails" ON public.scheduled_emails;
CREATE POLICY "Franchise admins can manage franchise scheduled emails" ON public.scheduled_emails FOR ALL
TO authenticated
USING (
  public.is_franchise_admin(auth.uid())
  AND tenant_id = public.get_user_tenant_id(auth.uid())
  AND franchise_id = public.get_user_franchise_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can manage own scheduled emails" ON public.scheduled_emails;
CREATE POLICY "Users can manage own scheduled emails" ON public.scheduled_emails FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- 6. RLS Policies for email_audit_log (Read-only hierarchical)
DROP POLICY IF EXISTS "Super admins can view all audit logs" ON public.email_audit_log;
CREATE POLICY "Super admins can view all audit logs" ON public.email_audit_log FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can view tenant audit logs" ON public.email_audit_log;
CREATE POLICY "Tenant admins can view tenant audit logs" ON public.email_audit_log FOR SELECT
TO authenticated
USING (
  public.is_tenant_admin(auth.uid())
  AND tenant_id = public.get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Franchise admins can view franchise audit logs" ON public.email_audit_log;
CREATE POLICY "Franchise admins can view franchise audit logs" ON public.email_audit_log FOR SELECT
TO authenticated
USING (
  public.is_franchise_admin(auth.uid())
  AND tenant_id = public.get_user_tenant_id(auth.uid())
  AND franchise_id = public.get_user_franchise_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can view own audit logs" ON public.email_audit_log;
CREATE POLICY "Users can view own audit logs" ON public.email_audit_log FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow inserts from service role (edge functions)
DROP POLICY IF EXISTS "Service can insert audit logs" ON public.email_audit_log;
CREATE POLICY "Service can insert audit logs" ON public.email_audit_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- 7. Trigger for automatic audit logging on email changes
DROP FUNCTION IF EXISTS public.log_email_audit();
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

DROP TRIGGER IF EXISTS trg_email_audit ON public.emails;
CREATE TRIGGER trg_email_audit
AFTER INSERT OR UPDATE ON public.emails
FOR EACH ROW
EXECUTE FUNCTION public.log_email_audit();

-- 8. Enhanced emails RLS with hierarchical visibility
DROP POLICY IF EXISTS "Users can view emails from their accounts" ON public.emails;

DROP POLICY IF EXISTS "Hierarchical email visibility" ON public.emails;
CREATE POLICY "Hierarchical email visibility" ON public.emails FOR SELECT
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
DROP FUNCTION IF EXISTS public.update_scheduled_email_timestamp();
CREATE OR REPLACE FUNCTION public.update_scheduled_email_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scheduled_emails_updated ON public.scheduled_emails;
CREATE TRIGGER trg_scheduled_emails_updated
BEFORE UPDATE ON public.scheduled_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_scheduled_email_timestamp();-- Fix security warnings from Phase 2 migration

-- 1. Fix function search_path on update_scheduled_email_timestamp
DROP FUNCTION IF EXISTS public.update_scheduled_email_timestamp();
CREATE OR REPLACE FUNCTION public.update_scheduled_email_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Replace overly permissive audit log INSERT policy with proper check
DROP POLICY IF EXISTS "Service can insert audit logs" ON public.email_audit_log;

DROP POLICY IF EXISTS "Authenticated users can insert audit logs for their actions" ON public.email_audit_log;
CREATE POLICY "Authenticated users can insert audit logs for their actions" ON public.email_audit_log FOR INSERT
TO authenticated
WITH CHECK (
  -- User can only insert audit logs for emails they have access to
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (public.is_tenant_admin(auth.uid()) AND tenant_id = public.get_user_tenant_id(auth.uid()))
  OR (public.is_franchise_admin(auth.uid()) 
      AND tenant_id = public.get_user_tenant_id(auth.uid())
      AND franchise_id = public.get_user_franchise_id(auth.uid()))
);-- Create dashboard_preferences table
CREATE TABLE IF NOT EXISTS public.dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tenant_id UUID REFERENCES public.tenants(id),
  widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  layout JSONB,
  theme_overrides JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- Create index
CREATE INDEX IF NOT EXISTS idx_dashboard_preferences_user_id ON public.dashboard_preferences(user_id);

-- RLS Policies - Users can only manage their own preferences
DROP POLICY IF EXISTS "Users can view own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can view own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can view own dashboard preferences" ON public.dashboard_preferences FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can insert own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can insert own dashboard preferences" ON public.dashboard_preferences FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can update own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can update own dashboard preferences" ON public.dashboard_preferences FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can delete own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can delete own dashboard preferences" ON public.dashboard_preferences FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Update timestamp trigger
DROP TRIGGER IF EXISTS trg_dashboard_preferences_updated ON public.dashboard_preferences;
CREATE TRIGGER trg_dashboard_preferences_updated
BEFORE UPDATE ON public.dashboard_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_scheduled_email_timestamp();
-- ============================================================
-- Email Infrastructure: Phase 3A - Add Enum Values
-- Must be separate transaction from using the values
-- ============================================================

-- Add missing role types to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';-- ============================================================
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
DROP FUNCTION IF EXISTS public.is_sales_manager(_user_id uuid);
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
DROP FUNCTION IF EXISTS public.is_viewer(_user_id uuid);
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
DROP FUNCTION IF EXISTS public.get_franchise_user_ids(_franchise_id uuid);
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
DROP FUNCTION IF EXISTS public.get_sales_manager_team_user_ids(_manager_id uuid);
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
DROP POLICY IF EXISTS "Email scope matrix - SELECT" ON public.emails;
CREATE POLICY "Email scope matrix - SELECT" ON public.emails FOR SELECT
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
DROP POLICY IF EXISTS "Email scope matrix - INSERT" ON public.emails;
CREATE POLICY "Email scope matrix - INSERT" ON public.emails FOR INSERT
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
DROP POLICY IF EXISTS "Email scope matrix - UPDATE" ON public.emails;
CREATE POLICY "Email scope matrix - UPDATE" ON public.emails FOR UPDATE
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
DROP POLICY IF EXISTS "Email scope matrix - DELETE" ON public.emails;
CREATE POLICY "Email scope matrix - DELETE" ON public.emails FOR DELETE
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
DROP POLICY IF EXISTS "Delegation owners can manage" ON public.email_account_delegations;
CREATE POLICY "Delegation owners can manage" ON public.email_account_delegations FOR ALL
USING (account_id IN (SELECT id FROM public.email_accounts WHERE user_id = auth.uid()))
WITH CHECK (account_id IN (SELECT id FROM public.email_accounts WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Delegates can view their delegations" ON public.email_account_delegations;
CREATE POLICY "Delegates can view their delegations" ON public.email_account_delegations FOR SELECT
USING (delegate_user_id = auth.uid());

DROP POLICY IF EXISTS "Platform admins can manage all delegations" ON public.email_account_delegations;
CREATE POLICY "Platform admins can manage all delegations" ON public.email_account_delegations FOR ALL
USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can view delegations" ON public.email_account_delegations;
CREATE POLICY "Tenant admins can view delegations" ON public.email_account_delegations FOR SELECT
USING (is_tenant_admin(auth.uid()) AND account_id IN (SELECT id FROM public.email_accounts WHERE tenant_id = get_user_tenant_id(auth.uid())));

DROP POLICY IF EXISTS "Franchise admins can view franchise delegations" ON public.email_account_delegations;
CREATE POLICY "Franchise admins can view franchise delegations" ON public.email_account_delegations FOR SELECT
USING (is_franchise_admin(auth.uid()) AND account_id IN (SELECT id FROM public.email_accounts WHERE franchise_id = get_user_franchise_id(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())));

-- 12. Update email_accounts RLS
DROP POLICY IF EXISTS "Users can manage own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Platform admins can manage all email accounts" ON public.email_accounts;

DROP POLICY IF EXISTS "Email accounts scope matrix - SELECT" ON public.email_accounts;
CREATE POLICY "Email accounts scope matrix - SELECT" ON public.email_accounts FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_platform_admin(auth.uid())
  OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
  OR (is_franchise_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()))
  OR id IN (SELECT account_id FROM public.email_account_delegations WHERE delegate_user_id = auth.uid() AND is_active = true AND (expires_at IS NULL OR expires_at > now()))
);

DROP POLICY IF EXISTS "Email accounts scope matrix - INSERT" ON public.email_accounts;
CREATE POLICY "Email accounts scope matrix - INSERT" ON public.email_accounts FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Email accounts scope matrix - UPDATE" ON public.email_accounts;
CREATE POLICY "Email accounts scope matrix - UPDATE" ON public.email_accounts FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Email accounts scope matrix - DELETE" ON public.email_accounts;
CREATE POLICY "Email accounts scope matrix - DELETE" ON public.email_accounts FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR is_platform_admin(auth.uid()));

-- 13. Update scheduled_emails RLS
DROP POLICY IF EXISTS "Super admins can manage all scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Tenant admins can manage tenant scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Franchise admins can manage franchise scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Users can manage own scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Scheduled emails scope matrix" ON public.scheduled_emails;

DROP POLICY IF EXISTS "Scheduled emails scope matrix" ON public.scheduled_emails;
CREATE POLICY "Scheduled emails scope matrix" ON public.scheduled_emails FOR ALL
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
EXECUTE FUNCTION public.update_scheduled_email_timestamp();-- Create schema reload helper function for PostgREST cache management
DROP FUNCTION IF EXISTS public.reload_postgrest_schema();
CREATE OR REPLACE FUNCTION public.reload_postgrest_schema()
RETURNS void AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
  NOTIFY pgrst, 'reload config';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure custom_fields column exists in activities table
ALTER TABLE IF EXISTS public.activities 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Create index for better performance on JSONB queries
CREATE INDEX IF NOT EXISTS idx_activities_custom_fields 
  ON public.activities USING GIN (custom_fields);

-- Force immediate schema reload
SELECT public.reload_postgrest_schema();-- Create security definer function to get user's email account IDs
-- This prevents infinite recursion in RLS policies
DROP FUNCTION IF EXISTS public.get_user_email_account_ids(_user_id uuid);
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
DROP FUNCTION IF EXISTS public.get_delegated_email_account_ids(_user_id uuid);
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
DROP POLICY IF EXISTS "Email accounts scope matrix - SELECT" ON public.email_accounts;
CREATE POLICY "Email accounts scope matrix - SELECT" ON public.email_accounts
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_platform_admin(auth.uid())
  OR (is_tenant_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()))
  OR (is_franchise_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()))
  OR id IN (SELECT get_delegated_email_account_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Email accounts scope matrix - INSERT" ON public.email_accounts;
CREATE POLICY "Email accounts scope matrix - INSERT" ON public.email_accounts
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Email accounts scope matrix - UPDATE" ON public.email_accounts;
CREATE POLICY "Email accounts scope matrix - UPDATE" ON public.email_accounts
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Email accounts scope matrix - DELETE" ON public.email_accounts;
CREATE POLICY "Email accounts scope matrix - DELETE" ON public.email_accounts
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR is_platform_admin(auth.uid()));

-- Drop existing emails policies
DROP POLICY IF EXISTS "Email scope matrix - SELECT" ON public.emails;
DROP POLICY IF EXISTS "Email scope matrix - INSERT" ON public.emails;
DROP POLICY IF EXISTS "Email scope matrix - UPDATE" ON public.emails;
DROP POLICY IF EXISTS "Email scope matrix - DELETE" ON public.emails;

-- Recreate emails policies using security definer functions
DROP POLICY IF EXISTS "Email scope matrix - SELECT" ON public.emails;
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

DROP POLICY IF EXISTS "Email scope matrix - INSERT" ON public.emails;
CREATE POLICY "Email scope matrix - INSERT" ON public.emails
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR account_id IN (SELECT get_user_email_account_ids(auth.uid()))
  OR is_platform_admin(auth.uid())
);

DROP POLICY IF EXISTS "Email scope matrix - UPDATE" ON public.emails;
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

DROP POLICY IF EXISTS "Email scope matrix - DELETE" ON public.emails;
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
SELECT public.reload_postgrest_schema();-- Migration: Entity Transfer System
-- Description: Tables and functions for managing entity transfers between tenants and franchises

-- 1. Create Enums
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'transfer_status'
          AND n.nspname = 'public'
    ) THEN BEGIN
    CREATE TYPE public.transfer_status AS ENUM ('pending', 'approved', 'rejected', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'transfer_type'
          AND n.nspname = 'public'
    ) THEN BEGIN
    CREATE TYPE public.transfer_type AS ENUM ('tenant_to_tenant', 'tenant_to_franchise', 'franchise_to_franchise');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'transfer_entity_type'
          AND n.nspname = 'public'
    ) THEN BEGIN
    CREATE TYPE public.transfer_entity_type AS ENUM ('lead', 'opportunity', 'quote', 'shipment', 'account', 'contact', 'activity');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
    END IF;
END $$;

-- 2. Create Transfer Requests Table
CREATE TABLE IF NOT EXISTS entity_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_tenant_id UUID REFERENCES tenants(id) NOT NULL,
    source_franchise_id UUID REFERENCES franchises(id), -- Nullable for Tenant level
    target_tenant_id UUID REFERENCES tenants(id) NOT NULL,
    target_franchise_id UUID REFERENCES franchises(id), -- Nullable for Tenant level
    transfer_type transfer_type NOT NULL,
    status transfer_status DEFAULT 'pending',
    requested_by UUID REFERENCES auth.users(id) NOT NULL,
    approved_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Transfer Items Table
CREATE TABLE IF NOT EXISTS entity_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID REFERENCES entity_transfers(id) ON DELETE CASCADE NOT NULL,
    entity_type transfer_entity_type NOT NULL,
    entity_id UUID NOT NULL,
    status transfer_status DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE entity_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_transfer_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- View: Users can see transfers where they are source or target admin (simplified for now to tenant access)
DROP POLICY IF EXISTS "Users can view transfers for their tenant" ON entity_transfers;
CREATE POLICY "Users can view transfers for their tenant" ON entity_transfers
    FOR SELECT
    USING (
        source_tenant_id IN (
            SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
        ) OR
        target_tenant_id IN (
            SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

-- Create: Users can create transfers from their tenant
DROP POLICY IF EXISTS "Users can create transfers from their tenant" ON entity_transfers;
CREATE POLICY "Users can create transfers from their tenant" ON entity_transfers
    FOR INSERT
    WITH CHECK (
        source_tenant_id IN (
            SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

-- Update: Target tenant admins can approve/reject, Source can cancel (if pending)
DROP POLICY IF EXISTS "Target admins can update status" ON entity_transfers;
CREATE POLICY "Target admins can update status" ON entity_transfers
    FOR UPDATE
    USING (
        target_tenant_id IN (
            SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

-- Items policies inherit from parent transfer access roughly (simplified)
DROP POLICY IF EXISTS "View transfer items" ON entity_transfer_items;
CREATE POLICY "View transfer items" ON entity_transfer_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM entity_transfers et 
            WHERE et.id = entity_transfer_items.transfer_id
            AND (
                et.source_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()) OR
                et.target_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Create transfer items" ON entity_transfer_items;
CREATE POLICY "Create transfer items" ON entity_transfer_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM entity_transfers et 
            WHERE et.id = entity_transfer_items.transfer_id
            AND et.source_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
        )
    );

-- 6. RPC: Execute Transfer
DROP FUNCTION IF EXISTS execute_transfer(p_transfer_id UUID, p_approver_id UUID);
CREATE OR REPLACE FUNCTION execute_transfer(p_transfer_id UUID, p_approver_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
    v_success_count INT := 0;
    v_fail_count INT := 0;
    v_error_msg TEXT;
BEGIN
    -- Get transfer details
    SELECT * INTO v_transfer FROM entity_transfers WHERE id = p_transfer_id;
    
    IF v_transfer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Transfer not found');
    END IF;

    IF v_transfer.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Transfer is not pending');
    END IF;

    -- Update Transfer Status to In Progress (or just process)
    UPDATE entity_transfers SET approved_by = p_approver_id, updated_at = NOW() WHERE id = p_transfer_id;

    -- Process items
    FOR v_item IN SELECT * FROM entity_transfer_items WHERE transfer_id = p_transfer_id LOOP
        BEGIN
            -- Dynamic update based on entity type
            CASE v_item.entity_type
                WHEN 'lead' THEN
                    UPDATE leads 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'opportunity' THEN
                    UPDATE opportunities 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'quote' THEN
                    UPDATE quotes 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'shipment' THEN
                    UPDATE shipments 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'account' THEN
                    UPDATE accounts 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'contact' THEN
                    UPDATE contacts 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'activity' THEN
                    UPDATE activities 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                ELSE
                    RAISE EXCEPTION 'Unknown entity type: %', v_item.entity_type;
            END CASE;

            -- Mark item success
            UPDATE entity_transfer_items 
            SET status = 'success', updated_at = NOW() 
            WHERE id = v_item.id;
            
            v_success_count := v_success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_fail_count := v_fail_count + 1;
            v_error_msg := SQLERRM;
            
            UPDATE entity_transfer_items 
            SET status = 'failed', error_message = v_error_msg, updated_at = NOW() 
            WHERE id = v_item.id;
        END;
    END LOOP;

    -- Finalize Transfer Status
    IF v_fail_count = 0 THEN
        UPDATE entity_transfers SET status = 'completed', updated_at = NOW() WHERE id = p_transfer_id;
    ELSE
        -- If partial failure, maybe mark as completed with errors or failed?
        -- For now, let's mark as completed but items show status
        UPDATE entity_transfers SET status = 'completed', updated_at = NOW() WHERE id = p_transfer_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'processed', v_success_count + v_fail_count,
        'succeeded', v_success_count,
        'failed', v_fail_count
    );
END;
$$;
-- Migration: Assign Account and Contact to Franchisee RPC
-- Description: Function to safely assign/create Account and Contact for a Franchisee under a Tenant

DROP FUNCTION IF EXISTS public.assign_franchisee_account_contact(p_tenant_id UUID, p_franchise_id UUID, p_account_data JSONB, p_contact_data JSONB);
CREATE OR REPLACE FUNCTION public.assign_franchisee_account_contact(
    p_tenant_id UUID,
    p_franchise_id UUID,
    p_account_data JSONB,
    p_contact_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_account_id UUID;
    v_contact_id UUID;
    v_tenant_exists BOOLEAN;
    v_franchise_exists BOOLEAN;
    v_account_name TEXT;
    v_contact_email TEXT;
    v_contact_first_name TEXT;
    v_contact_last_name TEXT;
BEGIN
    -- 1. Verify Tenant exists
    SELECT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) INTO v_tenant_exists;
    IF NOT v_tenant_exists THEN
        RAISE EXCEPTION 'Tenant with ID % does not exist', p_tenant_id;
    END IF;

    -- 2. Verify Franchisee exists and belongs to Tenant
    SELECT EXISTS (SELECT 1 FROM franchises WHERE id = p_franchise_id AND tenant_id = p_tenant_id) INTO v_franchise_exists;
    IF NOT v_franchise_exists THEN
        RAISE EXCEPTION 'Franchise with ID % does not exist or does not belong to Tenant %', p_franchise_id, p_tenant_id;
    END IF;

    -- 3. Process Account
    v_account_name := p_account_data->>'name';
    IF v_account_name IS NULL OR v_account_name = '' THEN
        RAISE EXCEPTION 'Account name is required';
    END IF;

    -- Try to find existing account by ID or Name within Tenant
    IF (p_account_data->>'id') IS NOT NULL THEN
        v_account_id := (p_account_data->>'id')::UUID;
        
        -- Check if exists
        IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = v_account_id AND tenant_id = p_tenant_id) THEN
             RAISE EXCEPTION 'Account ID % not found in Tenant %', v_account_id, p_tenant_id;
        END IF;

        UPDATE accounts 
        SET 
            franchise_id = p_franchise_id,
            updated_at = NOW()
        WHERE id = v_account_id;
    ELSE
        -- Look up by name
        SELECT id INTO v_account_id FROM accounts WHERE tenant_id = p_tenant_id AND name = v_account_name LIMIT 1;
        
        IF v_account_id IS NOT NULL THEN
            UPDATE accounts 
            SET franchise_id = p_franchise_id, updated_at = NOW() 
            WHERE id = v_account_id;
        ELSE
            INSERT INTO accounts (
                tenant_id, franchise_id, name, 
                industry, website, phone, email, 
                billing_address, shipping_address,
                created_by
            ) VALUES (
                p_tenant_id, 
                p_franchise_id, 
                v_account_name,
                p_account_data->>'industry',
                p_account_data->>'website',
                p_account_data->>'phone',
                p_account_data->>'email',
                COALESCE(p_account_data->'billing_address', '{}'::jsonb),
                COALESCE(p_account_data->'shipping_address', '{}'::jsonb),
                (p_account_data->>'created_by')::UUID
            ) RETURNING id INTO v_account_id;
        END IF;
    END IF;

    -- 4. Process Contact
    v_contact_email := p_contact_data->>'email';
    v_contact_first_name := p_contact_data->>'first_name';
    v_contact_last_name := p_contact_data->>'last_name';

    IF v_contact_first_name IS NULL OR v_contact_last_name IS NULL THEN
        RAISE EXCEPTION 'Contact first_name and last_name are required';
    END IF;

    -- Try to find existing contact by ID or Email within Tenant
    IF (p_contact_data->>'id') IS NOT NULL THEN
        v_contact_id := (p_contact_data->>'id')::UUID;

        -- Check if exists
        IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = v_contact_id AND tenant_id = p_tenant_id) THEN
             RAISE EXCEPTION 'Contact ID % not found in Tenant %', v_contact_id, p_tenant_id;
        END IF;

        UPDATE contacts 
        SET 
            franchise_id = p_franchise_id,
            account_id = v_account_id,
            updated_at = NOW()
        WHERE id = v_contact_id;
    ELSE
        -- Look up by email (if provided)
        IF v_contact_email IS NOT NULL AND v_contact_email <> '' THEN
            SELECT id INTO v_contact_id FROM contacts WHERE tenant_id = p_tenant_id AND email = v_contact_email LIMIT 1;
        END IF;
        
        IF v_contact_id IS NOT NULL THEN
            UPDATE contacts 
            SET 
                franchise_id = p_franchise_id, 
                account_id = v_account_id,
                updated_at = NOW() 
            WHERE id = v_contact_id;
        ELSE
            INSERT INTO contacts (
                tenant_id, franchise_id, account_id,
                first_name, last_name, email, phone, mobile, title,
                created_by
            ) VALUES (
                p_tenant_id,
                p_franchise_id,
                v_account_id,
                v_contact_first_name,
                v_contact_last_name,
                v_contact_email,
                p_contact_data->>'phone',
                p_contact_data->>'mobile',
                p_contact_data->>'title',
                (p_contact_data->>'created_by')::UUID
            ) RETURNING id INTO v_contact_id;
        END IF;
    END IF;

    -- 5. Return Result
    RETURN jsonb_build_object(
        'success', true,
        'tenant_id', p_tenant_id,
        'franchise_id', p_franchise_id,
        'account_id', v_account_id,
        'contact_id', v_contact_id,
        'message', 'Successfully assigned Account and Contact to Franchisee'
    );
END;
$$;
-- Add POP3 support columns to email_accounts
ALTER TABLE public.email_accounts
ADD COLUMN IF NOT EXISTS pop3_host text,
ADD COLUMN IF NOT EXISTS pop3_port integer,
ADD COLUMN IF NOT EXISTS pop3_username text,
ADD COLUMN IF NOT EXISTS pop3_password text,
ADD COLUMN IF NOT EXISTS pop3_use_ssl boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pop3_delete_policy text DEFAULT 'keep';

-- Extend provider check to include POP3
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.email_accounts'::regclass
      AND conname = 'email_accounts_provider_check'
  ) THEN
    ALTER TABLE public.email_accounts
    DROP CONSTRAINT email_accounts_provider_check;
  END IF;
  BEGIN
    ALTER TABLE public.email_accounts DROP CONSTRAINT IF EXISTS email_accounts_provider_check;
ALTER TABLE public.email_accounts ADD CONSTRAINT email_accounts_provider_check CHECK (provider IN ('office365','gmail','smtp_imap','pop3','other'));
  EXCEPTION WHEN duplicate_object THEN
    -- Constraint already exists with desired definition
    NULL;
  END;
END $$;

-- Constrain delete policy values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_accounts_pop3_delete_policy_check'
  ) THEN
    ALTER TABLE public.email_accounts DROP CONSTRAINT IF EXISTS email_accounts_pop3_delete_policy_check;
ALTER TABLE public.email_accounts ADD CONSTRAINT email_accounts_pop3_delete_policy_check CHECK (pop3_delete_policy IN ('keep','delete_after_fetch'));
  END IF;
END $$;

-- Optimize threading queries
ALTER TABLE public.emails
ADD COLUMN IF NOT EXISTS conversation_id text;

CREATE INDEX IF NOT EXISTS idx_emails_conversation_date 
ON public.emails (conversation_id, received_at DESC);

-- Optimize windowed fetch by account/date
CREATE INDEX IF NOT EXISTS idx_emails_account_date
ON public.emails (account_id, received_at DESC);
-- Migration: Add tenant_id and franchise_id to import_history
-- Description: Adds columns to track which tenant/franchise an import belongs to

ALTER TABLE import_history
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id),
ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES franchises(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_import_history_tenant ON import_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_history_franchise ON import_history(franchise_id);

-- Enable RLS on import_history if not already enabled
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts/duplication during re-runs or updates
DROP POLICY IF EXISTS "Platform admins full access on import_history" ON import_history;
DROP POLICY IF EXISTS "Tenant admins access own tenant imports" ON import_history;

-- Update RLS policies
-- 1. Platform admins can do everything
DROP POLICY IF EXISTS "Platform admins full access on import_history" ON import_history;
CREATE POLICY "Platform admins full access on import_history" ON import_history
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 2. Tenant admins can view/create for their tenant
DROP POLICY IF EXISTS "Tenant admins access own tenant imports" ON import_history;
CREATE POLICY "Tenant admins access own tenant imports" ON import_history
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
);
-- Fix missing dashboards.view permission for standard roles

-- 1. Ensure the permission definition exists in the catalog
INSERT INTO public.auth_permissions (id, category, description)
VALUES ('dashboards.view', 'Dashboard', 'Access to view dashboards')
ON CONFLICT (id) DO NOTHING;

-- 2. Grant the permission to all standard system roles
-- We use ON CONFLICT DO NOTHING to ensure idempotency
INSERT INTO public.auth_role_permissions (role_id, permission_id)
VALUES 
  ('platform_admin', 'dashboards.view'),
  ('tenant_admin', 'dashboards.view'),
  ('franchise_admin', 'dashboards.view'),
  ('user', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;
DROP FUNCTION IF EXISTS public.get_database_tables();
CREATE OR REPLACE FUNCTION public.get_database_tables()
RETURNS TABLE (
  table_name text,
  table_type text,
  rls_enabled boolean,
  policy_count bigint,
  column_count bigint,
  index_count bigint,
  row_estimate bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.relname::text AS table_name,
    CASE 
      WHEN c.relkind = 'r' THEN 'BASE TABLE'
      WHEN c.relkind = 'v' THEN 'VIEW'
      WHEN c.relkind = 'm' THEN 'MATERIALIZED VIEW'
      WHEN c.relkind = 'p' THEN 'PARTITIONED TABLE'
      WHEN c.relkind = 'f' THEN 'FOREIGN TABLE'
      ELSE 'OTHER'
    END::text AS table_type,
    c.relrowsecurity AS rls_enabled,
    (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count,
    (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS column_count,
    (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid) AS index_count,
    c.reltuples::bigint AS row_estimate
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f') -- Include Tables, Partitions, Views, Mat Views, Foreign Tables
    AND c.relname NOT IN ('spatial_ref_sys') -- Exclude PostGIS internal table
  ORDER BY c.relname;
$$;
-- Migration: Fix Transfer Logic, Add Audit Logging, and Enhance Relationships
-- Description: Fixes execute_transfer function, adds audit logging, and adds FKs to profiles for easier querying

-- 1. Fix execute_transfer function (replace 'success' with 'completed')
DROP FUNCTION IF EXISTS execute_transfer(p_transfer_id UUID, p_approver_id UUID);
CREATE OR REPLACE FUNCTION execute_transfer(p_transfer_id UUID, p_approver_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
    v_success_count INT := 0;
    v_fail_count INT := 0;
    v_error_msg TEXT;
BEGIN
    -- Get transfer details
    SELECT * INTO v_transfer FROM entity_transfers WHERE id = p_transfer_id;
    
    IF v_transfer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Transfer not found');
    END IF;

    IF v_transfer.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Transfer is not pending');
    END IF;

    -- Update Transfer Status to In Progress (or just process)
    UPDATE entity_transfers SET approved_by = p_approver_id, updated_at = NOW() WHERE id = p_transfer_id;

    -- Process items
    FOR v_item IN SELECT * FROM entity_transfer_items WHERE transfer_id = p_transfer_id LOOP
        BEGIN
            -- Dynamic update based on entity type
            CASE v_item.entity_type
                WHEN 'lead' THEN
                    UPDATE leads 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'opportunity' THEN
                    UPDATE opportunities 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'quote' THEN
                    UPDATE quotes 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'shipment' THEN
                    UPDATE shipments 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'account' THEN
                    UPDATE accounts 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'contact' THEN
                    UPDATE contacts 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'activity' THEN
                    UPDATE activities 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                ELSE
                    RAISE EXCEPTION 'Unknown entity type: %', v_item.entity_type;
            END CASE;

            -- Mark item success (FIXED: used 'completed' instead of 'success')
            UPDATE entity_transfer_items 
            SET status = 'completed', updated_at = NOW() 
            WHERE id = v_item.id;
            
            v_success_count := v_success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_fail_count := v_fail_count + 1;
            v_error_msg := SQLERRM;
            
            UPDATE entity_transfer_items 
            SET status = 'failed', error_message = v_error_msg, updated_at = NOW() 
            WHERE id = v_item.id;
        END;
    END LOOP;

    -- Finalize Transfer Status
    IF v_fail_count = 0 THEN
        UPDATE entity_transfers SET status = 'completed', updated_at = NOW() WHERE id = p_transfer_id;
    ELSE
        -- If partial failure, mark as completed (items show individual status)
        UPDATE entity_transfers SET status = 'completed', updated_at = NOW() WHERE id = p_transfer_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'processed', v_success_count + v_fail_count,
        'succeeded', v_success_count,
        'failed', v_fail_count
    );
END;
$$;

-- 2. Create Audit Function for Transfers
DROP FUNCTION IF EXISTS audit_transfer_change();
CREATE OR REPLACE FUNCTION audit_transfer_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_resource_type TEXT;
  v_resource_id UUID;
  v_ip TEXT;
  v_tenant UUID;
  v_franchise UUID;
  v_details JSONB;
BEGIN
  v_action := TG_OP;
  v_resource_type := TG_TABLE_NAME;
  v_resource_id := COALESCE(NEW.id, OLD.id);
  v_ip := COALESCE(inet_client_addr()::TEXT, 'unknown');
  v_tenant := public.get_user_tenant_id(auth.uid());
  v_franchise := public.get_user_franchise_id(auth.uid());
  
  IF TG_TABLE_NAME = 'entity_transfers' THEN
    v_details := jsonb_build_object(
      'tenant_id', v_tenant,
      'franchise_id', v_franchise,
      'source_tenant_id', COALESCE(NEW.source_tenant_id, OLD.source_tenant_id),
      'target_tenant_id', COALESCE(NEW.target_tenant_id, OLD.target_tenant_id),
      'transfer_type', COALESCE(NEW.transfer_type, OLD.transfer_type),
      'status', COALESCE(NEW.status, OLD.status)
    );
    IF TG_OP = 'UPDATE' THEN
       v_details := v_details || jsonb_build_object(
         'changes', jsonb_build_object(
           'status', jsonb_build_object('from', OLD.status, 'to', NEW.status)
         )
       );
    END IF;
  ELSIF TG_TABLE_NAME = 'entity_transfer_items' THEN
    v_details := jsonb_build_object(
      'tenant_id', v_tenant,
      'franchise_id', v_franchise,
      'transfer_id', COALESCE(NEW.transfer_id, OLD.transfer_id),
      'entity_type', COALESCE(NEW.entity_type, OLD.entity_type),
      'entity_id', COALESCE(NEW.entity_id, OLD.entity_id),
      'status', COALESCE(NEW.status, OLD.status)
    );
  END IF;

  INSERT INTO audit_logs(user_id, action, resource_type, resource_id, ip_address, details, created_at)
  VALUES (auth.uid(), v_action, v_resource_type, v_resource_id, v_ip, v_details, NOW());

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 3. Add Triggers
DROP TRIGGER IF EXISTS audit_entity_transfers ON entity_transfers;
CREATE TRIGGER audit_entity_transfers
AFTER INSERT OR UPDATE OR DELETE ON entity_transfers
FOR EACH ROW EXECUTE FUNCTION audit_transfer_change();

DROP TRIGGER IF EXISTS audit_entity_transfer_items ON entity_transfer_items;
CREATE TRIGGER audit_entity_transfer_items
AFTER INSERT OR UPDATE OR DELETE ON entity_transfer_items
FOR EACH ROW EXECUTE FUNCTION audit_transfer_change();

-- 4. Add Foreign Keys to Profiles for Querying
-- This allows referencing profiles!requested_by(email) in PostgREST
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'entity_transfers_requested_by_fkey_profiles'
  ) THEN
    ALTER TABLE entity_transfers DROP CONSTRAINT IF EXISTS entity_transfers_requested_by_fkey_profiles;
ALTER TABLE entity_transfers ADD CONSTRAINT entity_transfers_requested_by_fkey_profiles FOREIGN KEY (requested_by) REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'entity_transfers_approved_by_fkey_profiles'
  ) THEN
    ALTER TABLE entity_transfers DROP CONSTRAINT IF EXISTS entity_transfers_approved_by_fkey_profiles;
ALTER TABLE entity_transfers ADD CONSTRAINT entity_transfers_approved_by_fkey_profiles FOREIGN KEY (approved_by) REFERENCES profiles(id);
  END IF;
END $$;
-- Migration: Transfer Audit Logging
-- Description: Adds audit logging triggers for entity transfers and relationship changes

-- 1. Function to log transfer request changes
DROP FUNCTION IF EXISTS log_transfer_audit();
CREATE OR REPLACE FUNCTION log_transfer_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_action TEXT;
    v_details JSONB;
BEGIN
    -- Get current user ID if available, otherwise it might be a system action or null
    v_user_id := auth.uid();
    
    IF TG_OP = 'INSERT' THEN
        v_action := 'TRANSFER_CREATED';
        v_details := jsonb_build_object(
            'source_tenant_id', NEW.source_tenant_id,
            'target_tenant_id', NEW.target_tenant_id,
            'transfer_type', NEW.transfer_type,
            'status', NEW.status
        );
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'TRANSFER_UPDATED';
        v_details := jsonb_build_object(
            'old_status', OLD.status,
            'new_status', NEW.status,
            'approved_by', NEW.approved_by,
            'rejection_reason', NEW.rejection_reason
        );
        
        -- Special case for completion
        IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
            v_action := 'TRANSFER_COMPLETED';
        ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
            v_action := 'TRANSFER_REJECTED';
        ELSIF NEW.status = 'approved' AND OLD.status != 'approved' THEN
            v_action := 'TRANSFER_APPROVED';
        END IF;
    END IF;

    INSERT INTO audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        details
    ) VALUES (
        COALESCE(v_user_id, NEW.requested_by), -- Fallback to requester if auth.uid is null (e.g. background job)
        v_action,
        'entity_transfer',
        NEW.id,
        v_details
    );

    RETURN NEW;
END;
$$;

-- 2. Trigger for entity_transfers
DROP TRIGGER IF EXISTS trg_log_transfer_audit ON entity_transfers;
CREATE TRIGGER trg_log_transfer_audit
    AFTER INSERT OR UPDATE ON entity_transfers
    FOR EACH ROW
    EXECUTE FUNCTION log_transfer_audit();

-- 3. Function to log relationship changes (tenant/franchise updates) on entities
DROP FUNCTION IF EXISTS log_relationship_change();
CREATE OR REPLACE FUNCTION log_relationship_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_details JSONB;
BEGIN
    -- Only log if tenant_id or franchise_id changed
    IF (OLD.tenant_id IS DISTINCT FROM NEW.tenant_id) OR (OLD.franchise_id IS DISTINCT FROM NEW.franchise_id) THEN
        v_user_id := auth.uid();
        
        v_details := jsonb_build_object(
            'old_tenant_id', OLD.tenant_id,
            'new_tenant_id', NEW.tenant_id,
            'old_franchise_id', OLD.franchise_id,
            'new_franchise_id', NEW.franchise_id,
            'change_reason', 'Entity Transfer or Admin Update' 
        );

        INSERT INTO audit_logs (
            user_id,
            action,
            resource_type,
            resource_id,
            details
        ) VALUES (
            v_user_id,
            'RELATIONSHIP_CHANGED',
            TG_TABLE_NAME, -- Use table name as resource type (e.g., 'leads', 'opportunities')
            NEW.id,
            v_details
        );
    END IF;

    RETURN NEW;
END;
$$;

-- 4. Apply relationship change trigger to relevant tables
-- Leads
DROP TRIGGER IF EXISTS trg_log_lead_rel_change ON leads;
CREATE TRIGGER trg_log_lead_rel_change
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();

-- Opportunities
DROP TRIGGER IF EXISTS trg_log_opp_rel_change ON opportunities;
CREATE TRIGGER trg_log_opp_rel_change
    AFTER UPDATE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();

-- Quotes
DROP TRIGGER IF EXISTS trg_log_quote_rel_change ON quotes;
CREATE TRIGGER trg_log_quote_rel_change
    AFTER UPDATE ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();

-- Shipments
DROP TRIGGER IF EXISTS trg_log_shipment_rel_change ON shipments;
CREATE TRIGGER trg_log_shipment_rel_change
    AFTER UPDATE ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();

-- Accounts
DROP TRIGGER IF EXISTS trg_log_account_rel_change ON accounts;
CREATE TRIGGER trg_log_account_rel_change
    AFTER UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();

-- Contacts
DROP TRIGGER IF EXISTS trg_log_contact_rel_change ON contacts;
CREATE TRIGGER trg_log_contact_rel_change
    AFTER UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();

-- Activities
DROP TRIGGER IF EXISTS trg_log_activity_rel_change ON activities;
CREATE TRIGGER trg_log_activity_rel_change
    AFTER UPDATE ON activities
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();

-- 1. Add queue column to emails table
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS queue TEXT;

-- 2. Create index for queue lookups
CREATE INDEX IF NOT EXISTS idx_emails_queue ON public.emails(queue);
CREATE INDEX IF NOT EXISTS idx_emails_queue_tenant ON public.emails(queue, tenant_id);

-- 3. Create get_queue_counts function
DROP FUNCTION IF EXISTS public.get_queue_counts();
CREATE OR REPLACE FUNCTION public.get_queue_counts()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_result JSON;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_tenant_id IS NULL THEN
        RETURN '{}'::json;
    END IF;

    SELECT json_object_agg(name, COALESCE(count, 0)) INTO v_result
    FROM (
        SELECT q.name, count(e.id) as count
        FROM public.queues q
        LEFT JOIN public.emails e ON q.name = e.queue AND e.tenant_id = q.tenant_id
        WHERE q.tenant_id = v_tenant_id
        GROUP BY q.name
    ) t;

    RETURN COALESCE(v_result, '{}'::json);
END;
$$;

-- 4. Add RLS policy for queue emails
DROP POLICY IF EXISTS "Users can view emails in their queues" ON public.emails;

DROP POLICY IF EXISTS "Users can view emails in their queues" ON public.emails;
CREATE POLICY "Users can view emails in their queues" ON public.emails
FOR SELECT
TO authenticated
USING (
  queue IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.queues q
    JOIN public.queue_members qm ON q.id = qm.queue_id
    WHERE q.name = emails.queue
    AND q.tenant_id = emails.tenant_id
    AND qm.user_id = auth.uid()
  )
);
-- =============================================
-- QUEUE FILTERING & PERMISSION SYSTEM
-- Complete implementation for email queue management
-- =============================================

-- 1. Create queue_rules table for auto-categorization
CREATE TABLE IF NOT EXISTS public.queue_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(tenant_id, name)
);

-- 2. Create index for efficient rule evaluation
CREATE INDEX IF NOT EXISTS idx_queue_rules_tenant_priority 
    ON public.queue_rules(tenant_id, priority DESC) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_queue_rules_queue_id 
    ON public.queue_rules(queue_id);

-- 3. Add tenant_id to queue_members if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'queue_members' 
        AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.queue_members ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
    END IF;
END $$;

-- 4. Enable RLS on queue_rules
ALTER TABLE public.queue_rules ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for queue_rules (tenant admin only)
DROP POLICY IF EXISTS "Tenant admins can manage queue rules" ON public.queue_rules;
DROP POLICY IF EXISTS "Tenant admins can manage queue rules" ON public.queue_rules;
CREATE POLICY "Tenant admins can manage queue rules" ON public.queue_rules
FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
);

-- 6. RLS policies for queue_members
ALTER TABLE public.queue_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their queue memberships" ON public.queue_members;
DROP POLICY IF EXISTS "Users can view their queue memberships" ON public.queue_members;
CREATE POLICY "Users can view their queue memberships" ON public.queue_members
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
);

DROP POLICY IF EXISTS "Tenant admins can manage queue memberships" ON public.queue_members;
DROP POLICY IF EXISTS "Tenant admins can manage queue memberships" ON public.queue_members;
CREATE POLICY "Tenant admins can manage queue memberships" ON public.queue_members
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
);

-- 7. RLS policies for queues table
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view queues in their tenant" ON public.queues;
DROP POLICY IF EXISTS "Users can view queues in their tenant" ON public.queues;
CREATE POLICY "Users can view queues in their tenant" ON public.queues
FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Tenant admins can manage queues" ON public.queues;
DROP POLICY IF EXISTS "Tenant admins can manage queues" ON public.queues;
CREATE POLICY "Tenant admins can manage queues" ON public.queues
FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
);

-- 8. Create function to evaluate queue rules and assign queue
DROP FUNCTION IF EXISTS public.process_email_queue_assignment();
CREATE OR REPLACE FUNCTION public.process_email_queue_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rule RECORD;
    v_criteria JSONB;
    v_match BOOLEAN;
    v_queue_name TEXT;
BEGIN
    -- Only process if queue is not already set
    IF NEW.queue IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Get tenant_id from email
    IF NEW.tenant_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Iterate through active rules ordered by priority (highest first)
    FOR v_rule IN 
        SELECT qr.criteria, q.name as queue_name
        FROM public.queue_rules qr
        JOIN public.queues q ON q.id = qr.queue_id
        WHERE qr.tenant_id = NEW.tenant_id
        AND qr.is_active = true
        ORDER BY qr.priority DESC
    LOOP
        v_criteria := v_rule.criteria;
        v_match := true;

        -- Check subject_contains
        IF v_criteria ? 'subject_contains' THEN
            IF NEW.subject IS NULL OR 
               NOT (NEW.subject ILIKE '%' || (v_criteria->>'subject_contains') || '%') THEN
                v_match := false;
            END IF;
        END IF;

        -- Check from_email (exact match, case insensitive)
        IF v_match AND v_criteria ? 'from_email' THEN
            IF NEW.from_email IS NULL OR 
               LOWER(NEW.from_email) != LOWER(v_criteria->>'from_email') THEN
                v_match := false;
            END IF;
        END IF;

        -- Check from_domain
        IF v_match AND v_criteria ? 'from_domain' THEN
            IF NEW.from_email IS NULL OR 
               NOT (LOWER(NEW.from_email) LIKE '%@' || LOWER(v_criteria->>'from_domain')) THEN
                v_match := false;
            END IF;
        END IF;

        -- Check body_contains
        IF v_match AND v_criteria ? 'body_contains' THEN
            IF (NEW.body_text IS NULL OR 
               NOT (NEW.body_text ILIKE '%' || (v_criteria->>'body_contains') || '%'))
               AND (NEW.body_html IS NULL OR 
               NOT (NEW.body_html ILIKE '%' || (v_criteria->>'body_contains') || '%')) THEN
                v_match := false;
            END IF;
        END IF;

        -- Check priority
        IF v_match AND v_criteria ? 'priority' THEN
            IF NEW.priority IS NULL OR 
               LOWER(NEW.priority) != LOWER(v_criteria->>'priority') THEN
                v_match := false;
            END IF;
        END IF;

        -- Check ai_category
        IF v_match AND v_criteria ? 'ai_category' THEN
            IF NEW.ai_category IS NULL OR 
               LOWER(NEW.ai_category) != LOWER(v_criteria->>'ai_category') THEN
                v_match := false;
            END IF;
        END IF;

        -- Check ai_sentiment
        IF v_match AND v_criteria ? 'ai_sentiment' THEN
            IF NEW.ai_sentiment IS NULL OR 
               LOWER(NEW.ai_sentiment) != LOWER(v_criteria->>'ai_sentiment') THEN
                v_match := false;
            END IF;
        END IF;

        -- If all criteria matched, assign queue and stop processing
        IF v_match THEN
            NEW.queue := v_rule.queue_name;
            RETURN NEW;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

-- 9. Create trigger for auto-assignment
DROP TRIGGER IF EXISTS trg_assign_email_queue ON public.emails;
CREATE TRIGGER trg_assign_email_queue
    BEFORE INSERT ON public.emails
    FOR EACH ROW
    EXECUTE FUNCTION public.process_email_queue_assignment();

-- 10. Create function to manually assign email to queue
DROP FUNCTION IF EXISTS public.assign_email_to_queue(p_email_id UUID, p_queue_name TEXT);
CREATE OR REPLACE FUNCTION public.assign_email_to_queue(
    p_email_id UUID,
    p_queue_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_has_access BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Get tenant_id from user_roles
    SELECT ur.tenant_id INTO v_tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
    LIMIT 1;

    -- Verify queue exists and user has access
    SELECT EXISTS (
        SELECT 1 FROM public.queues q
        JOIN public.queue_members qm ON q.id = qm.queue_id
        WHERE q.name = p_queue_name
        AND q.tenant_id = v_tenant_id
        AND qm.user_id = v_user_id
    ) INTO v_has_access;

    -- Also allow tenant admins
    IF NOT v_has_access THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = v_user_id
            AND ur.role = 'tenant_admin'
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Access denied: User does not have access to queue %', p_queue_name;
    END IF;

    -- Update email queue
    UPDATE public.emails
    SET queue = p_queue_name,
        updated_at = now()
    WHERE id = p_email_id
    AND tenant_id = v_tenant_id;

    -- Log the action
    INSERT INTO public.email_audit_log (
        email_id,
        event_type,
        event_data,
        user_id,
        tenant_id
    ) VALUES (
        p_email_id,
        'queue_assignment',
        jsonb_build_object('queue', p_queue_name, 'assigned_by', v_user_id),
        v_user_id,
        v_tenant_id
    );

    RETURN true;
END;
$$;

-- 11. Create function to get user's accessible queues
DROP FUNCTION IF EXISTS public.get_user_queues();
CREATE OR REPLACE FUNCTION public.get_user_queues()
RETURNS TABLE (
    queue_id UUID,
    queue_name TEXT,
    queue_type TEXT,
    description TEXT,
    email_count BIGINT,
    unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Get tenant_id from user_roles
    SELECT ur.tenant_id INTO v_tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
    LIMIT 1;

    -- Check if user is tenant admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = v_user_id
        AND ur.role = 'tenant_admin'
    ) INTO v_is_admin;

    RETURN QUERY
    SELECT 
        q.id as queue_id,
        q.name as queue_name,
        q.type as queue_type,
        q.description,
        COUNT(e.id) as email_count,
        COUNT(e.id) FILTER (WHERE e.is_read = false) as unread_count
    FROM public.queues q
    LEFT JOIN public.emails e ON q.name = e.queue AND q.tenant_id = e.tenant_id
    WHERE q.tenant_id = v_tenant_id
    AND q.is_active = true
    AND (
        v_is_admin = true
        OR EXISTS (
            SELECT 1 FROM public.queue_members qm
            WHERE qm.queue_id = q.id
            AND qm.user_id = v_user_id
        )
    )
    GROUP BY q.id, q.name, q.type, q.description;
END;
$$;

-- 12. Update updated_at trigger for queue_rules
DROP FUNCTION IF EXISTS public.update_queue_rules_updated_at();
CREATE OR REPLACE FUNCTION public.update_queue_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_queue_rules_updated_at ON public.queue_rules;
CREATE TRIGGER update_queue_rules_updated_at
    BEFORE UPDATE ON public.queue_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_queue_rules_updated_at();

-- 13. Grant execute permissions

-- Created: 2026-01-14

-- 1. Enhanced Schema Listing
-- Returns tables from all relevant schemas, not just public
DROP FUNCTION IF EXISTS public.get_all_database_tables(schemas text[]);
CREATE OR REPLACE FUNCTION public.get_all_database_tables(schemas text[] DEFAULT ARRAY['public', 'auth', 'storage', 'extensions'])
RETURNS TABLE (
  schema_name text,
  table_name text,
  table_type text,
  row_estimate bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    n.nspname::text AS schema_name,
    c.relname::text AS table_name,
    CASE 
      WHEN c.relkind = 'r' THEN 'BASE TABLE'
      WHEN c.relkind = 'v' THEN 'VIEW'
      WHEN c.relkind = 'm' THEN 'MATERIALIZED VIEW'
      WHEN c.relkind = 'p' THEN 'PARTITIONED TABLE'
      WHEN c.relkind = 'f' THEN 'FOREIGN TABLE'
      ELSE 'OTHER'
    END::text AS table_type,
    c.reltuples::bigint AS row_estimate
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = ANY(schemas)
    AND c.relkind IN ('r', 'v', 'm', 'p', 'f')
    AND c.relname NOT IN ('schema_migrations', 'spatial_ref_sys') -- Exclude technical tables
  ORDER BY n.nspname, c.relname;
$$;

-- 2. Secure Auth User Export
-- Exports users with non-sensitive data. 
-- Note: Password hashes are exported but caution is advised.
DROP FUNCTION IF EXISTS public.get_auth_users_export();
CREATE OR REPLACE FUNCTION public.get_auth_users_export()
RETURNS TABLE (
  id uuid,
  email varchar,
  encrypted_password varchar,
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar,
  recovery_token varchar,
  email_change_token_new varchar,
  email_change varchar,
  phone varchar,
  phone_confirmed_at timestamptz,
  phone_change_token varchar,
  phone_change varchar,
  app_metadata jsonb,
  user_metadata jsonb,
  is_sso_user boolean,
  created_at timestamptz,
  updated_at timestamptz,
  banned_until timestamptz,
  deleted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone,
    phone_confirmed_at,
    phone_change_token,
    phone_change,
    raw_app_meta_data as app_metadata,
    raw_user_meta_data as user_metadata,
    is_sso_user,
    created_at,
    updated_at,
    banned_until,
    deleted_at
  FROM auth.users;
$$;

-- 3. Storage Objects Export
DROP FUNCTION IF EXISTS public.get_storage_objects_export();
CREATE OR REPLACE FUNCTION public.get_storage_objects_export()
RETURNS TABLE (
  id uuid,
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_accessed_at timestamptz,
  metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    bucket_id,
    name,
    owner,
    created_at,
    updated_at,
    last_accessed_at,
    metadata
  FROM storage.objects;
$$;

-- 4. Generic Table Data Export (Dynamic)
-- Allows exporting data from any schema (e.g., extensions)
-- WARNING: This is a powerful function. Ensure RLS protects access to this function 
-- or restricts it to admins via application logic.
DROP FUNCTION IF EXISTS public.get_table_data_dynamic(target_schema text, target_table text, offset_val int, limit_val int);
CREATE OR REPLACE FUNCTION public.get_table_data_dynamic(
    target_schema text, 
    target_table text, 
    offset_val int DEFAULT 0, 
    limit_val int DEFAULT 1000
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Validate schema to prevent arbitrary access to system schemas
    IF target_schema NOT IN ('public', 'auth', 'storage', 'extensions') THEN
        RAISE EXCEPTION 'Invalid schema: %', target_schema;
    END IF;

    -- Execute dynamic query
    EXECUTE format(
        'SELECT jsonb_agg(t) FROM (SELECT * FROM %I.%I OFFSET %s LIMIT %s) t',
        target_schema,
        target_table,
        offset_val,
        limit_val
    ) INTO result;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
-- Function to perform a dry-run import by attempting inserts and rolling back via exception
-- Usage: Call this RPC with a JSON object where keys are table names and values are arrays of objects.
-- The function will attempt to insert records using jsonb_populate_recordset.
-- It will always RAISE EXCEPTION at the end to ensure no data is committed.
-- Client should look for "DRY_RUN_OK" in the error message to confirm success.

DROP FUNCTION IF EXISTS public.logic_nexus_import_dry_run(p_tables jsonb, p_schema text);
CREATE OR REPLACE FUNCTION public.logic_nexus_import_dry_run(
  p_tables jsonb,
  p_schema text DEFAULT 'public'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_table text;
  v_rows jsonb;
  v_count int;
  v_errors text[] := ARRAY[]::text[];
  v_total_success int := 0;
  v_table_count int := 0;
BEGIN
  -- Loop through tables in the input JSON
  FOR v_table, v_rows IN SELECT * FROM jsonb_each(p_tables)
  LOOP
    BEGIN
      -- Validate table existence in the specified schema
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = p_schema AND table_name = v_table
      ) THEN
        v_errors := array_append(v_errors, format('Table "%s"."%s" not found', p_schema, v_table));
        CONTINUE;
      END IF;

      -- Attempt insertion using jsonb_populate_recordset
      -- This validates data types and constraints (except deferred ones)
      EXECUTE format(
        'INSERT INTO %I.%I SELECT * FROM jsonb_populate_recordset(null::%I.%I, $1)',
        p_schema, v_table, p_schema, v_table
      ) USING v_rows;
      
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_total_success := v_total_success + v_count;
      v_table_count := v_table_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- Catch specific table errors
      v_errors := array_append(v_errors, format('Error in "%s": %s', v_table, SQLERRM));
    END;
  END LOOP;

  -- Final outcome
  IF array_length(v_errors, 1) > 0 THEN
    -- If there were errors, we raise a generic error with details
    RAISE EXCEPTION 'DRY_RUN_FAILED: % errors found. Details: %', array_length(v_errors, 1), array_to_string(v_errors, '; ');
  ELSE
    -- If all good, we still raise exception to rollback, but with a success signature
    RAISE EXCEPTION 'DRY_RUN_OK: Validated % rows across % tables', v_total_success, v_table_count;
  END IF;
END;
$$;
-- Migration: Enhance Audit Logs
-- Description: Adds resource_id, tenant_id, franchise_id to audit_logs and updates RLS.

-- 1. Add columns if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'resource_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS resource_id UUID;
        CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON public.audit_logs(resource_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'franchise_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES public.franchises(id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_franchise_id ON public.audit_logs(franchise_id);
    END IF;
END $$;

-- 2. Update RLS Policies

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Platform admins view all logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users view own logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Tenant admins view tenant logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Franchise admins view franchise logs" ON public.audit_logs;

-- Platform Admins can view all logs
DROP POLICY IF EXISTS "Platform admins view all logs" ON public.audit_logs;
CREATE POLICY "Platform admins view all logs" ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'platform_admin'
        )
    );

-- Tenant Admins can view logs for their tenant
DROP POLICY IF EXISTS "Tenant admins view tenant logs" ON public.audit_logs;
CREATE POLICY "Tenant admins view tenant logs" ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'tenant_admin'
            AND ur.tenant_id = audit_logs.tenant_id
        )
    );

-- Franchise Admins can view logs for their franchise
DROP POLICY IF EXISTS "Franchise admins view franchise logs" ON public.audit_logs;
CREATE POLICY "Franchise admins view franchise logs" ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'franchise_admin'
            AND ur.franchise_id = audit_logs.franchise_id
        )
    );

-- Users can view their own logs
DROP POLICY IF EXISTS "Users view own logs" ON public.audit_logs;
CREATE POLICY "Users view own logs" ON public.audit_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert logs (must be authenticated)
DROP POLICY IF EXISTS "Users can insert logs" ON public.audit_logs;
CREATE POLICY "Users can insert logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 3. Add function to automatically set tenant_id/franchise_id on insert if not provided
-- This is useful if the insertion comes from a trigger that doesn't explicitly set them,
-- although ScopedDataAccess should handle this.
DROP FUNCTION IF EXISTS public.set_audit_log_context();
CREATE OR REPLACE FUNCTION public.set_audit_log_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1);
    END IF;
    IF NEW.franchise_id IS NULL THEN
        NEW.franchise_id := (SELECT franchise_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_audit_log_context ON public.audit_logs;
CREATE TRIGGER trg_set_audit_log_context
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.set_audit_log_context();
-- Execute batch of INSERT statements for data-only restores from export ZIP
-- Security: Restricted to platform/tenant admins; only allows INSERT into public schema
-- Idempotent: Uses CREATE OR REPLACE and GRANT statements guarded by existence checks

DO $$
BEGIN
  -- Create helper function if missing: is_platform_admin and is_tenant_admin are expected to exist
  -- The project already defines these in prior migrations.
  NULL;
END $$;

DROP FUNCTION IF EXISTS public.execute_insert_batch(statements text[]);
CREATE OR REPLACE FUNCTION public.execute_insert_batch(statements text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text;
  success_count int := 0;
  failed_count int := 0;
  error_rows jsonb := '[]'::jsonb;
BEGIN
  -- Authorization: only platform admins or tenant admins may execute
  IF NOT public.is_platform_admin(auth.uid()) AND NOT public.is_tenant_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF statements IS NULL OR array_length(statements, 1) IS NULL THEN
    RETURN jsonb_build_object('success', 0, 'failed', 0, 'error_rows', '[]'::jsonb);
  END IF;

  FOREACH s IN ARRAY statements LOOP
    s := trim(s);

    IF s ~* '^\s*INSERT\s+INTO\s+"[^"]+"' AND s !~* '^\s*INSERT\s+INTO\s+"?public"?\.' THEN
      s := regexp_replace(s, '^\s*INSERT\s+INTO\s+"([^"]+)"', 'INSERT INTO public."\\1"', 1, 1, 'i');
    ELSIF s ~* '^\s*INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)' AND s !~* '^\s*INSERT\s+INTO\s+"?public"?\.' THEN
      s := regexp_replace(s, '^\s*INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)', 'INSERT INTO public.\\1', 1, 1, 'i');
    END IF;

    -- Only allow INSERTs into public schema; skip any other statements
    IF s ~* '^\s*INSERT\s+INTO\s+"?public"?\.' THEN
      BEGIN
        EXECUTE s;
        success_count := success_count + 1;
      EXCEPTION WHEN OTHERS THEN
        failed_count := failed_count + 1;
        error_rows := error_rows || jsonb_build_array(
          jsonb_build_object('statement', s, 'error', SQLERRM)
        );
      END;
    ELSE
      -- Unsupported or unsafe statement; record as failed for transparency
      failed_count := failed_count + 1;
      error_rows := error_rows || jsonb_build_array(
        jsonb_build_object('statement', s, 'error', 'unsupported statement')
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', success_count,
    'failed', failed_count,
    'error_rows', COALESCE(error_rows, '[]'::jsonb)
  );
END;
$$;

-- Grant execute to authenticated users; function enforces role checks internally
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'execute_insert_batch'
  ) THEN
    NULL;
  END IF;
END $$;

-- Enhanced export helpers with cross-schema support

-- 1. Get Table Constraints (Schema-aware)
DROP FUNCTION IF EXISTS public.get_table_constraints();
CREATE OR REPLACE FUNCTION public.get_table_constraints()
RETURNS TABLE (
    schema_name text,
    table_name text,
    constraint_name text,
    constraint_type text,
    constraint_details text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''  -- Force schema qualification in outputs where dependent on search_path
AS $$
    SELECT 
        n.nspname::text AS schema_name,
        rel.relname::text AS table_name,
        con.conname::text AS constraint_name,
        CASE 
            WHEN con.contype = 'p' THEN 'PRIMARY KEY'
            WHEN con.contype = 'u' THEN 'UNIQUE'
            WHEN con.contype = 'f' THEN 'FOREIGN KEY'
            WHEN con.contype = 'c' THEN 'CHECK'
            ELSE 'OTHER'
        END::text AS constraint_type,
        pg_get_constraintdef(con.oid)::text AS constraint_details
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname IN ('public', 'auth', 'storage', 'extensions')
    ORDER BY n.nspname, rel.relname, con.contype;
$$;

-- 2. Get Table Indexes (Schema-aware)
DROP FUNCTION IF EXISTS public.get_table_indexes();
CREATE OR REPLACE FUNCTION public.get_table_indexes()
RETURNS TABLE (
    schema_name text,
    table_name text,
    index_name text,
    index_definition text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = '' -- Force schema qualification
AS $$
    SELECT 
        n.nspname::text AS schema_name,
        t.relname::text AS table_name,
        i.relname::text AS index_name,
        pg_get_indexdef(i.oid)::text AS index_definition
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname IN ('public', 'auth', 'storage', 'extensions')
      AND NOT x.indisprimary
      AND NOT x.indisunique
    ORDER BY n.nspname, t.relname, i.relname;
$$;

-- 3. Get RLS Policies (Schema-aware)
DROP FUNCTION IF EXISTS public.get_all_rls_policies();
CREATE OR REPLACE FUNCTION public.get_all_rls_policies()
RETURNS TABLE (
    schema_name text,
    table_name text,
    policy_name text,
    command text,
    roles text[],
    using_expression text,
    with_check_expression text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = '' -- Force schema qualification
AS $$
    SELECT 
        n.nspname::text AS schema_name,
        t.relname::text AS table_name,
        pol.polname::text AS policy_name,
        CASE pol.polcmd
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
        END::text AS command,
        ARRAY(
            SELECT r.rolname 
            FROM pg_roles r 
            WHERE r.oid = ANY(pol.polroles)
        )::text[] AS roles,
        pg_get_expr(pol.polqual, pol.polrelid)::text AS using_expression,
        pg_get_expr(pol.polwithcheck, pol.polrelid)::text AS with_check_expression
    FROM pg_policy pol
    JOIN pg_class t ON t.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname IN ('public', 'auth', 'storage', 'extensions')
    ORDER BY n.nspname, t.relname, pol.polname;
$$;
-- Fix Missing Tables for Dynamic Roles and UI Themes
-- This migration combines missing schema elements from 20240107_dynamic_roles.sql and 20251007121500_ui_themes.sql
-- And ensures the current user has platform_admin access.

-- 1. Dynamic Roles Tables
CREATE TABLE IF NOT EXISTS public.auth_roles (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 99,
    can_manage_scopes TEXT[] DEFAULT '{}',
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auth_permissions (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auth_role_permissions (
    role_id TEXT REFERENCES public.auth_roles(id) ON DELETE CASCADE,
    permission_id TEXT REFERENCES public.auth_permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.auth_role_hierarchy (
    manager_role_id TEXT REFERENCES public.auth_roles(id) ON DELETE CASCADE,
    target_role_id TEXT REFERENCES public.auth_roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (manager_role_id, target_role_id)
);

-- Enable RLS for Auth Tables
ALTER TABLE public.auth_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_role_hierarchy ENABLE ROW LEVEL SECURITY;

-- Policies for Auth Tables (Simplified for fix)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view roles" ON public.auth_roles;
CREATE POLICY "Everyone can view roles" ON public.auth_roles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view permissions" ON public.auth_permissions;
CREATE POLICY "Everyone can view permissions" ON public.auth_permissions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view role permissions" ON public.auth_role_permissions;
CREATE POLICY "Everyone can view role permissions" ON public.auth_role_permissions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view hierarchy" ON public.auth_role_hierarchy;
CREATE POLICY "Everyone can view hierarchy" ON public.auth_role_hierarchy FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insert Default Roles
INSERT INTO public.auth_roles (id, label, description, level, can_manage_scopes, is_system) VALUES
('platform_admin', 'Platform Administrator', 'Full system access with global visibility', 0, '{global,tenant,franchise}', true),
('tenant_admin', 'Tenant Administrator', 'Manages a specific tenant and its franchises', 1, '{tenant,franchise}', true),
('franchise_admin', 'Franchise Administrator', 'Manages a specific franchise location', 2, '{franchise}', true),
('user', 'Standard User', 'Operational user with restricted access', 3, '{}', true)
ON CONFLICT (id) DO NOTHING;

-- 2. UI Themes Table
CREATE TABLE IF NOT EXISTS public.ui_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tokens jsonb not null,
  scope text not null check (scope in ('platform','tenant','franchise','user')),
  tenant_id uuid null references public.tenants(id) on delete cascade,
  franchise_id uuid null references public.franchises(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ui_themes_scope_name_unique
  ON public.ui_themes (scope, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

ALTER TABLE public.ui_themes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS ui_themes_read_authenticated ON public.ui_themes;
CREATE POLICY ui_themes_read_authenticated ON public.ui_themes FOR SELECT TO authenticated USING (is_active);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS ui_themes_user_write ON public.ui_themes;
CREATE POLICY ui_themes_user_write ON public.ui_themes FOR ALL TO authenticated USING (scope = 'user' and user_id = auth.uid()) WITH CHECK (scope = 'user' and user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Fix User Permissions
-- Ensure the specific user has platform_admin role
-- User ID: ce4c64f5-cd8c-4d2d-bbbd-04972c4a7768

DO $$
DECLARE
  v_user_id UUID := 'ce4c64f5-cd8c-4d2d-bbbd-04972c4a7768';
BEGIN
  -- Only proceed if user exists in profiles to avoid FK errors
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
      
      -- Delete any existing non-admin roles for this user to avoid conflicts or confusion
      DELETE FROM public.user_roles WHERE user_id = v_user_id AND role != 'platform_admin';
      
      -- Insert platform_admin role if not exists
      IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'platform_admin') THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_user_id, 'platform_admin');
      END IF;
      
  END IF;
END $$;

NOTIFY pgrst, 'reload config';
-- Create function to get detailed database schema for all relevant schemas
DROP FUNCTION IF EXISTS public.get_all_database_schema();
CREATE OR REPLACE FUNCTION public.get_all_database_schema()
RETURNS TABLE (
  schema_name text,
  table_name text,
  column_name text,
  data_type text,
  is_nullable boolean,
  column_default text,
  is_primary_key boolean,
  is_foreign_key boolean,
  references_schema text,
  references_table text,
  references_column text,
  udt_schema text,
  udt_name text,
  character_maximum_length integer
)
AS $$
  SELECT 
    c.table_schema::text,
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END as is_nullable,
    c.column_default::text,
    CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key,
    CASE WHEN kcu2.table_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
    kcu2.table_schema::text as references_schema,
    kcu2.table_name::text as references_table,
    kcu2.column_name::text as references_column,
    c.udt_schema::text as udt_schema,
    c.udt_name::text as udt_name,
    c.character_maximum_length
  FROM information_schema.columns c
  LEFT JOIN information_schema.key_column_usage kcu 
    ON c.table_name = kcu.table_name 
    AND c.column_name = kcu.column_name
    AND c.table_schema = kcu.table_schema
  LEFT JOIN information_schema.table_constraints tc 
    ON kcu.constraint_name = tc.constraint_name
    AND kcu.table_schema = tc.table_schema
  LEFT JOIN information_schema.referential_constraints rc 
    ON rc.constraint_name = kcu.constraint_name
    AND rc.constraint_schema = kcu.table_schema
  LEFT JOIN information_schema.key_column_usage kcu2 
    ON rc.unique_constraint_name = kcu2.constraint_name
    AND rc.unique_constraint_schema = kcu2.table_schema
  WHERE c.table_schema IN ('public', 'auth', 'storage', 'extensions', 'vault')
    AND c.table_name NOT IN ('spatial_ref_sys')
  ORDER BY c.table_schema, c.table_name, c.ordinal_position;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
DROP FUNCTION IF EXISTS public.get_all_database_tables();
CREATE OR REPLACE FUNCTION public.get_all_database_tables()
RETURNS TABLE (
  schema_name text,
  table_name text,
  table_type text,
  rls_enabled boolean,
  policy_count bigint,
  column_count bigint,
  index_count bigint,
  row_estimate bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    n.nspname::text AS schema_name,
    c.relname::text AS table_name,
    CASE 
      WHEN c.relkind = 'r' THEN 'BASE TABLE'
      WHEN c.relkind = 'v' THEN 'VIEW'
      WHEN c.relkind = 'm' THEN 'MATERIALIZED VIEW'
      WHEN c.relkind = 'p' THEN 'PARTITIONED TABLE'
      WHEN c.relkind = 'f' THEN 'FOREIGN TABLE'
      ELSE 'OTHER'
    END::text AS table_type,
    c.relrowsecurity AS rls_enabled,
    (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count,
    (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS column_count,
    (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid) AS index_count,
    c.reltuples::bigint AS row_estimate
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'auth', 'storage', 'extensions', 'vault')
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND c.relname NOT IN ('spatial_ref_sys')
    AND c.relname NOT LIKE 'pg_%'
  ORDER BY n.nspname, c.relname;
$$;
-- Function to get exact table count for any schema
DROP FUNCTION IF EXISTS public.get_table_count(target_schema text, target_table text);
CREATE OR REPLACE FUNCTION public.get_table_count(target_schema text, target_table text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    row_count bigint;
    query text;
BEGIN
    -- Validate schema to prevent SQL injection (allow only alphanumeric and underscores)
    IF NOT (target_schema ~ '^[a-zA-Z0-9_]+$') OR NOT (target_table ~ '^[a-zA-Z0-9_]+$') THEN
        RAISE EXCEPTION 'Invalid schema or table name';
    END IF;

    -- Construct query securely
    query := format('SELECT count(*) FROM %I.%I', target_schema, target_table);
    
    -- Execute query
    EXECUTE query INTO row_count;
    
    RETURN row_count;
EXCEPTION
    WHEN OTHERS THEN
        RETURN -1; -- Return -1 on error (e.g. permission denied or table not found)
END;
$$;
-- Function to export data incrementally based on timestamp
DROP FUNCTION IF EXISTS public.get_table_data_incremental(target_schema text, target_table text, min_timestamp timestamptz, offset_val int, limit_val int);
CREATE OR REPLACE FUNCTION public.get_table_data_incremental(
    target_schema text, 
    target_table text, 
    min_timestamp timestamptz,
    offset_val int DEFAULT 0, 
    limit_val int DEFAULT 1000
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
    has_created boolean;
    has_updated boolean;
    query text;
BEGIN
    -- Validate schema
    IF target_schema NOT IN ('public', 'auth', 'storage', 'extensions', 'vault') THEN
        RAISE EXCEPTION 'Invalid schema: %', target_schema;
    END IF;

    -- Check if columns exist
    SELECT 
        EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = target_schema AND table_name = target_table AND column_name = 'created_at'
        ),
        EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = target_schema AND table_name = target_table AND column_name = 'updated_at'
        )
    INTO has_created, has_updated;

    -- Build query
    query := format('SELECT * FROM %I.%I', target_schema, target_table);
    
    IF has_created AND has_updated THEN
        query := query || format(' WHERE created_at >= %L OR updated_at >= %L', min_timestamp, min_timestamp);
    ELSIF has_created THEN
        query := query || format(' WHERE created_at >= %L', min_timestamp);
    ELSIF has_updated THEN
        query := query || format(' WHERE updated_at >= %L', min_timestamp);
    ELSE
        -- No timestamp columns, return empty if incremental requested? 
        -- Or return everything? Usually incremental implies we can filter.
        -- Returning empty prevents re-exporting static tables.
        RETURN '[]'::jsonb;
    END IF;

    query := query || format(' OFFSET %s LIMIT %s', offset_val, limit_val);

    EXECUTE format('SELECT jsonb_agg(t) FROM (%s) t', query) INTO result;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
-- Function to restore table data to any schema
-- WARNING: This bypasses RLS if used with SECURITY DEFINER. Ensure proper access control.
DROP FUNCTION IF EXISTS public.restore_table_data(target_schema text, target_table text, data jsonb, mode text -- 'insert' or 'upsert');
CREATE OR REPLACE FUNCTION public.restore_table_data(
    target_schema text,
    target_table text,
    data jsonb,
    mode text DEFAULT 'insert' -- 'insert' or 'upsert'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    record jsonb;
    keys text[];
    values text[];
    query text;
    inserted_count int := 0;
    error_count int := 0;
    errors text[] := ARRAY[]::text[];
    col text;
    val text;
    conflict_cols text;
BEGIN
    -- Validate schema
    IF target_schema NOT IN ('public', 'auth', 'storage', 'extensions') THEN
        RAISE EXCEPTION 'Invalid schema: %', target_schema;
    END IF;

    -- Process each record
    FOR record IN SELECT * FROM jsonb_array_elements(data)
    LOOP
        BEGIN
            -- Extract keys and values
            SELECT array_agg(key), array_agg(value)
            INTO keys, values
            FROM jsonb_each_text(record);

            -- Build INSERT query
            query := format(
                'INSERT INTO %I.%I (%s) VALUES (%s)',
                target_schema,
                target_table,
                array_to_string(array(SELECT format('%I', k) FROM unnest(keys) k), ','),
                array_to_string(array(SELECT format('%L', v) FROM unnest(values) v), ',')
            );

            -- Handle UPSERT
            IF mode = 'upsert' THEN
                -- Try to find primary key (simplistic approach, assumes 'id')
                -- A better approach would be to query pg_constraint
                conflict_cols := 'id'; 
                
                -- Check if 'id' exists in keys
                IF 'id' = ANY(keys) THEN
                    query := query || format(' ON CONFLICT (%I) DO UPDATE SET ', conflict_cols);
                    
                    -- Build SET clause for update
                    -- "col" = EXCLUDED."col"
                    query := query || array_to_string(
                        array(
                            SELECT format('%I = EXCLUDED.%I', k, k) 
                            FROM unnest(keys) k 
                            WHERE k != 'id'
                        ), 
                        ','
                    );
                ELSE
                    -- Fallback to DO NOTHING if no ID (or handle specific tables)
                    query := query || ' ON CONFLICT DO NOTHING';
                END IF;
            END IF;

            EXECUTE query;
            inserted_count := inserted_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            errors := array_append(errors, SQLERRM);
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', inserted_count,
        'failed', error_count,
        'errors', errors[1:5] -- Return first 5 errors
    );
END;
$$;
-- Function to restore table data to any schema with dynamic conflict target
-- WARNING: This bypasses RLS if used with SECURITY DEFINER. Ensure proper access control.
DROP FUNCTION IF EXISTS public.restore_table_data(target_schema text, target_table text, data jsonb, mode text, -- 'insert' or 'upsert' conflict_target text[]);
CREATE OR REPLACE FUNCTION public.restore_table_data(
    target_schema text,
    target_table text,
    data jsonb,
    mode text DEFAULT 'insert', -- 'insert' or 'upsert'
    conflict_target text[] DEFAULT NULL -- Array of column names for ON CONFLICT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    record jsonb;
    row_number int := 0;
    keys text[];
    values text[];
    query text;
    inserted_count int := 0;
    error_count int := 0;
    errors text[] := ARRAY[]::text[];
    error_rows jsonb := '[]'::jsonb;
    col text;
    val text;
    conflict_clause text;
    err_code text;
    err_constraint text;
BEGIN
    -- Validate schema
    IF target_schema NOT IN ('public', 'auth', 'storage', 'extensions', 'vault') THEN
        RAISE EXCEPTION 'Invalid schema: %', target_schema;
    END IF;

    -- Process each record
    FOR record IN SELECT * FROM jsonb_array_elements(data)
    LOOP
        row_number := row_number + 1;
        BEGIN
            -- Extract keys and values
            SELECT array_agg(key), array_agg(value)
            INTO keys, values
            FROM jsonb_each_text(record);

            -- Build INSERT query
            query := format(
                'INSERT INTO %I.%I (%s) VALUES (%s)',
                target_schema,
                target_table,
                array_to_string(array(SELECT format('%I', k) FROM unnest(keys) k), ','),
                array_to_string(array(SELECT format('%L', v) FROM unnest(values) v), ',')
            );

            -- Handle UPSERT
            IF mode = 'upsert' THEN
                IF conflict_target IS NOT NULL AND array_length(conflict_target, 1) > 0 THEN
                    -- Use provided conflict target
                    conflict_clause := array_to_string(array(SELECT format('%I', c) FROM unnest(conflict_target) c), ',');
                    
                    query := query || format(' ON CONFLICT (%s) DO UPDATE SET ', conflict_clause);
                    
                    -- Build SET clause for update
                    query := query || array_to_string(
                        array(
                            SELECT format('%I = EXCLUDED.%I', k, k) 
                            FROM unnest(keys) k 
                            WHERE NOT (k = ANY(conflict_target)) -- Exclude conflict columns from update
                        ), 
                        ','
                    );
                ELSE
                    -- Fallback to simplistic 'id' if exists, else DO NOTHING
                    IF 'id' = ANY(keys) THEN
                        query := query || ' ON CONFLICT (id) DO UPDATE SET ';
                         query := query || array_to_string(
                            array(
                                SELECT format('%I = EXCLUDED.%I', k, k) 
                                FROM unnest(keys) k 
                                WHERE k != 'id'
                            ), 
                            ','
                        );
                    ELSE
                         query := query || ' ON CONFLICT DO NOTHING';
                    END IF;
                END IF;
            END IF;

            EXECUTE query;
            inserted_count := inserted_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            GET STACKED DIAGNOSTICS err_code = RETURNED_SQLSTATE,
                                   err_constraint = CONSTRAINT_NAME;
            errors := array_append(errors, SQLERRM);
            error_rows := error_rows || jsonb_build_array(
                jsonb_build_object(
                    'row_number', row_number,
                    'error', SQLERRM,
                    'code', err_code,
                    'constraint', err_constraint
                )
            );
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', inserted_count,
        'failed', error_count,
        'errors', errors[1:5],
        'error_rows', error_rows
    );
END;
$$;
-- Function to get exact table count for any schema
DROP FUNCTION IF EXISTS public.get_table_count(target_schema text, target_table text);
CREATE OR REPLACE FUNCTION public.get_table_count(target_schema text, target_table text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    row_count bigint;
    query text;
BEGIN
    IF NOT (target_schema ~ '^[a-zA-Z0-9_]+$') OR NOT (target_table ~ '^[a-zA-Z0-9_]+$') THEN
        RAISE EXCEPTION 'Invalid schema or table name';
    END IF;
    query := format('SELECT count(*) FROM %I.%I', target_schema, target_table);
    EXECUTE query INTO row_count;
    RETURN row_count;
EXCEPTION
    WHEN OTHERS THEN
        RETURN -1;
END;
$$;

-- Create function to get detailed database schema
DROP FUNCTION IF EXISTS public.get_all_database_schema();
CREATE OR REPLACE FUNCTION public.get_all_database_schema()
RETURNS TABLE (
  schema_name text,
  table_name text,
  column_name text,
  data_type text,
  is_nullable boolean,
  column_default text,
  is_primary_key boolean,
  is_foreign_key boolean,
  references_schema text,
  references_table text,
  references_column text
)
AS $$
  SELECT 
    c.table_schema::text,
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END as is_nullable,
    c.column_default::text,
    CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key,
    CASE WHEN kcu2.table_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
    kcu2.table_schema::text as references_schema,
    kcu2.table_name::text as references_table,
    kcu2.column_name::text as references_column
  FROM information_schema.columns c
  LEFT JOIN information_schema.key_column_usage kcu 
    ON c.table_name = kcu.table_name 
    AND c.column_name = kcu.column_name
    AND c.table_schema = kcu.table_schema
  LEFT JOIN information_schema.table_constraints tc 
    ON kcu.constraint_name = tc.constraint_name
    AND kcu.table_schema = tc.table_schema
  LEFT JOIN information_schema.referential_constraints rc 
    ON rc.constraint_name = kcu.constraint_name
    AND rc.constraint_schema = kcu.table_schema
  LEFT JOIN information_schema.key_column_usage kcu2 
    ON rc.unique_constraint_name = kcu2.constraint_name
    AND rc.unique_constraint_schema = kcu2.table_schema
  WHERE c.table_schema IN ('public', 'auth', 'storage', 'extensions', 'vault')
    AND c.table_name NOT IN ('spatial_ref_sys')
  ORDER BY c.table_schema, c.table_name, c.ordinal_position;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Returns tables from all relevant schemas
DROP FUNCTION IF EXISTS public.get_all_database_tables(schemas text[]);
CREATE OR REPLACE FUNCTION public.get_all_database_tables(schemas text[] DEFAULT ARRAY['public', 'auth', 'storage', 'extensions'])
RETURNS TABLE (
  schema_name text,
  table_name text,
  table_type text,
  row_estimate bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    n.nspname::text AS schema_name,
    c.relname::text AS table_name,
    CASE 
      WHEN c.relkind = 'r' THEN 'BASE TABLE'
      WHEN c.relkind = 'v' THEN 'VIEW'
      WHEN c.relkind = 'm' THEN 'MATERIALIZED VIEW'
      WHEN c.relkind = 'p' THEN 'PARTITIONED TABLE'
      WHEN c.relkind = 'f' THEN 'FOREIGN TABLE'
      ELSE 'OTHER'
    END::text AS table_type,
    c.reltuples::bigint AS row_estimate
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = ANY(schemas)
    AND c.relkind IN ('r', 'v', 'm', 'p', 'f')
    AND c.relname NOT IN ('schema_migrations', 'spatial_ref_sys')
  ORDER BY n.nspname, c.relname;
$$;

-- Auth User Export (using actual auth.users columns)
DROP FUNCTION IF EXISTS public.get_auth_users_export();
CREATE OR REPLACE FUNCTION public.get_auth_users_export()
RETURNS TABLE (
  id uuid,
  email varchar,
  encrypted_password varchar,
  email_confirmed_at timestamptz,
  phone varchar,
  phone_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  banned_until timestamptz,
  deleted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    phone,
    phone_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    banned_until,
    deleted_at
  FROM auth.users;
$$;

-- Storage Objects Export
DROP FUNCTION IF EXISTS public.get_storage_objects_export();
CREATE OR REPLACE FUNCTION public.get_storage_objects_export()
RETURNS TABLE (
  id uuid,
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_accessed_at timestamptz,
  metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    bucket_id,
    name,
    owner,
    created_at,
    updated_at,
    last_accessed_at,
    metadata
  FROM storage.objects;
$$;

-- Generic Table Data Export (Dynamic)
DROP FUNCTION IF EXISTS public.get_table_data_dynamic(target_schema text, target_table text, offset_val int, limit_val int);
CREATE OR REPLACE FUNCTION public.get_table_data_dynamic(
    target_schema text, 
    target_table text, 
    offset_val int DEFAULT 0, 
    limit_val int DEFAULT 1000
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    IF target_schema NOT IN ('public', 'auth', 'storage', 'extensions') THEN
        RAISE EXCEPTION 'Invalid schema: %', target_schema;
    END IF;
    EXECUTE format(
        'SELECT jsonb_agg(t) FROM (SELECT * FROM %I.%I OFFSET %s LIMIT %s) t',
        target_schema,
        target_table,
        offset_val,
        limit_val
    ) INTO result;
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;-- Execute batch of INSERT statements for data-only restores from export ZIP
-- Security: Restricted to platform/tenant admins; only allows INSERT into public schema
-- Idempotent: Uses CREATE OR REPLACE and GRANT statements guarded by existence checks

DO $$
BEGIN
  -- Create helper function if missing: is_platform_admin and is_tenant_admin are expected to exist
  -- The project already defines these in prior migrations.
  NULL;
END $$;

DROP FUNCTION IF EXISTS public.execute_insert_batch(statements text[]);
CREATE OR REPLACE FUNCTION public.execute_insert_batch(statements text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text;
  success_count int := 0;
  failed_count int := 0;
  error_rows jsonb := '[]'::jsonb;
BEGIN
  -- Authorization: only platform admins or tenant admins may execute
  IF NOT public.is_platform_admin(auth.uid()) AND NOT public.is_tenant_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF statements IS NULL OR array_length(statements, 1) IS NULL THEN
    RETURN jsonb_build_object('success', 0, 'failed', 0, 'error_rows', '[]'::jsonb);
  END IF;

  FOREACH s IN ARRAY statements LOOP
    s := trim(s);

    IF s ~* '^\s*INSERT\s+INTO\s+"[^"]+"' AND s !~* '^\s*INSERT\s+INTO\s+"?public"?\.' THEN
      s := regexp_replace(s, '^\s*INSERT\s+INTO\s+"([^"]+)"', 'INSERT INTO public."\\1"', 1, 1, 'i');
    ELSIF s ~* '^\s*INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)' AND s !~* '^\s*INSERT\s+INTO\s+"?public"?\.' THEN
      s := regexp_replace(s, '^\s*INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)', 'INSERT INTO public.\\1', 1, 1, 'i');
    END IF;

    -- Only allow INSERTs into public schema; skip any other statements
    IF s ~* '^\s*INSERT\s+INTO\s+"?public"?\.' THEN
      BEGIN
        EXECUTE s;
        success_count := success_count + 1;
      EXCEPTION WHEN OTHERS THEN
        failed_count := failed_count + 1;
        error_rows := error_rows || jsonb_build_array(
          jsonb_build_object('statement', s, 'error', SQLERRM)
        );
      END;
    ELSE
      -- Unsupported or unsafe statement; record as failed for transparency
      failed_count := failed_count + 1;
      error_rows := error_rows || jsonb_build_array(
        jsonb_build_object('statement', s, 'error', 'unsupported statement')
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', success_count,
    'failed', failed_count,
    'error_rows', COALESCE(error_rows, '[]'::jsonb)
  );
END;
$$;

-- Grant execute to authenticated users; function enforces role checks internally

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
DROP POLICY IF EXISTS "Users can manage their own scheduled emails" ON public.scheduled_emails;
CREATE POLICY "Users can manage their own scheduled emails" ON public.scheduled_emails
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Platform admins can view all scheduled emails" ON public.scheduled_emails;
CREATE POLICY "Platform admins can view all scheduled emails" ON public.scheduled_emails
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('platform_admin')
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
DROP POLICY IF EXISTS "Platform admins view all email logs" ON public.email_audit_log;
CREATE POLICY "Platform admins view all email logs" ON public.email_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('platform_admin')
    )
  );

DROP POLICY IF EXISTS "Tenant admins view tenant email logs" ON public.email_audit_log;
CREATE POLICY "Tenant admins view tenant email logs" ON public.email_audit_log
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
DROP FUNCTION IF EXISTS public.log_email_action();
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
-- Fix dashboard_preferences RLS and Permissions
-- Handles potential RLS recursion and ensures correct access for own/team dashboards

-- 1. Ensure table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.dashboard_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id),
    franchise_id UUID REFERENCES public.franchises(id),
    widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- 3. Grant permissions to authenticated users

-- 4. Re-create Policies (Drop all first to ensure clean state)

DROP POLICY IF EXISTS "Users can view own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can insert own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can update own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can delete own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can view team dashboard preferences" ON public.dashboard_preferences;

-- Policy 1: Users can view/manage their own preferences
DROP POLICY IF EXISTS "Users can view own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can view own dashboard preferences" ON public.dashboard_preferences FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can insert own dashboard preferences" ON public.dashboard_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can update own dashboard preferences" ON public.dashboard_preferences FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can delete own dashboard preferences" ON public.dashboard_preferences FOR DELETE
    USING (auth.uid() = user_id);

-- Policy 2: Users can view team dashboard preferences (Read-Only)
-- Platform Admins can view all.
-- Tenant/Franchise users can view preferences belonging to their tenant.
DROP POLICY IF EXISTS "Users can view team dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can view team dashboard preferences" ON public.dashboard_preferences FOR SELECT
    USING (
        public.is_platform_admin(auth.uid())
        OR
        (
            tenant_id IS NOT NULL 
            AND 
            tenant_id IN (
                SELECT tenant_id FROM public.user_roles 
                WHERE user_id = auth.uid() 
                AND tenant_id IS NOT NULL
            )
        )
    );

-- 5. Fix user_roles policy recursion (just in case)
-- Ensure user_roles is viewable by owner to avoid RLS recursion issues
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT
    USING (user_id = auth.uid());
-- Allow Platform Admins to view/manage all transfers
DROP POLICY IF EXISTS "Users can view transfers for their tenant" ON entity_transfers;
DROP POLICY IF EXISTS "Users can view transfers" ON entity_transfers;
CREATE POLICY "Users can view transfers" ON entity_transfers
    FOR SELECT
    USING (
        (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
        OR
        source_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()) 
        OR
        target_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can create transfers from their tenant" ON entity_transfers;
DROP POLICY IF EXISTS "Users can create transfers" ON entity_transfers;
CREATE POLICY "Users can create transfers" ON entity_transfers
    FOR INSERT
    WITH CHECK (
        (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
        OR
        source_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Target admins can update status" ON entity_transfers;
DROP POLICY IF EXISTS "Users can update status" ON entity_transfers;
CREATE POLICY "Users can update status" ON entity_transfers
    FOR UPDATE
    USING (
        (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
        OR
        target_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
    );

-- Items policies
DROP POLICY IF EXISTS "View transfer items" ON entity_transfer_items;
DROP POLICY IF EXISTS "View transfer items" ON entity_transfer_items;
CREATE POLICY "View transfer items" ON entity_transfer_items
    FOR SELECT
    USING (
        (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
        OR
        EXISTS (
            SELECT 1 FROM entity_transfers et 
            WHERE et.id = entity_transfer_items.transfer_id
            AND (
                et.source_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()) OR
                et.target_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Create transfer items" ON entity_transfer_items;
DROP POLICY IF EXISTS "Create transfer items" ON entity_transfer_items;
CREATE POLICY "Create transfer items" ON entity_transfer_items
    FOR INSERT
    WITH CHECK (
        (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
        OR
        EXISTS (
            SELECT 1 FROM entity_transfers et 
            WHERE et.id = entity_transfer_items.transfer_id
            AND et.source_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
        )
    );

-- Update dashboard_preferences policies
DROP POLICY IF EXISTS "Users can view team dashboard preferences" ON dashboard_preferences;
DROP POLICY IF EXISTS "Users can view team dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can view team dashboard preferences" ON public.dashboard_preferences FOR SELECT
    USING (
        (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
        OR
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    );
DROP FUNCTION IF EXISTS public.get_fk_orphans();
CREATE OR REPLACE FUNCTION public.get_fk_orphans()
RETURNS TABLE (
    constraint_schema text,
    table_name text,
    constraint_name text,
    child_column text,
    parent_schema text,
    parent_table text,
    parent_column text,
    orphan_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec record;
    cnt bigint;
BEGIN
    FOR rec IN
        SELECT
            tc.constraint_schema,
            tc.table_name,
            tc.constraint_name,
            kcu.column_name AS child_column,
            ccu.table_schema AS parent_schema,
            ccu.table_name AS parent_table,
            ccu.column_name AS parent_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.constraint_schema = kcu.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.constraint_schema = ccu.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.constraint_schema IN ('public', 'auth', 'storage')
    LOOP
        cnt := 0;
        EXECUTE format(
            'SELECT count(*) FROM %I.%I AS child LEFT JOIN %I.%I AS parent ON child.%I = parent.%I WHERE child.%I IS NOT NULL AND parent.%I IS NULL',
            rec.constraint_schema,
            rec.table_name,
            COALESCE(rec.parent_schema, 'public'),
            rec.parent_table,
            rec.child_column,
            rec.parent_column,
            rec.child_column,
            rec.parent_column
        ) INTO cnt;
        IF cnt > 0 THEN
            constraint_schema := rec.constraint_schema;
            table_name := rec.table_name;
            constraint_name := rec.constraint_name;
            child_column := rec.child_column;
            parent_schema := COALESCE(rec.parent_schema, 'public');
            parent_table := rec.parent_table;
            parent_column := rec.parent_column;
            orphan_count := cnt;
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;

-- Migration to implement Strict RLS Override for Platform Admins
-- This migration modifies core helper functions to respect user_preferences when admin_override_enabled is true.

-- 1. Create admin_override_audit table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.admin_override_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    tenant_id UUID REFERENCES public.tenants(id),
    franchise_id UUID REFERENCES public.franchises(id),
    enabled BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on audit table
ALTER TABLE public.admin_override_audit ENABLE ROW LEVEL SECURITY;

-- Audit Policies
DROP POLICY IF EXISTS "Users view own admin override audit" ON public.admin_override_audit;
DROP POLICY IF EXISTS "Users view own admin override audit" ON public.admin_override_audit;
CREATE POLICY "Users view own admin override audit" ON public.admin_override_audit FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Platform admins manage admin override audit" ON public.admin_override_audit;
DROP POLICY IF EXISTS "Platform admins manage admin override audit" ON public.admin_override_audit;
CREATE POLICY "Platform admins manage admin override audit" ON public.admin_override_audit FOR ALL 
USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
);

-- 2. Update is_platform_admin to return FALSE if override is enabled
DROP FUNCTION IF EXISTS public.is_platform_admin(check_user_id UUID);
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id AND role = 'platform_admin'
  ) 
  AND NOT EXISTS (
    SELECT 1 FROM user_preferences 
    WHERE user_id = check_user_id AND admin_override_enabled = true
  );
$$;

-- 3. Update has_role to masquerade as tenant/franchise admin if override is enabled
DROP FUNCTION IF EXISTS public.has_role(check_user_id UUID, check_role app_role);
CREATE OR REPLACE FUNCTION public.has_role(check_user_id UUID, check_role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_real_platform_admin BOOLEAN;
  v_override_enabled BOOLEAN;
  v_override_tenant_id UUID;
  v_override_franchise_id UUID;
BEGIN
  -- Check if user is REALLY a platform admin
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = check_user_id AND role = 'platform_admin')
  INTO v_is_real_platform_admin;

  -- Check if override is enabled in preferences
  SELECT 
    (admin_override_enabled IS TRUE),
    tenant_id,
    franchise_id
  INTO v_override_enabled, v_override_tenant_id, v_override_franchise_id
  FROM user_preferences
  WHERE user_id = check_user_id;

  -- Masquerade as tenant_admin if override is enabled (and tenant is selected)
  IF v_is_real_platform_admin AND v_override_enabled THEN
    IF check_role = 'platform_admin' THEN
        RETURN FALSE;
    ELSIF check_role = 'tenant_admin' THEN
        -- Only return true if tenant is selected AND franchise is NOT selected
        -- This ensures that selecting a franchise simulates "Franchise Admin" view (strict scoping)
        RETURN v_override_tenant_id IS NOT NULL AND v_override_franchise_id IS NULL;
    ELSIF check_role = 'franchise_admin' THEN
        RETURN v_override_franchise_id IS NOT NULL;
    END IF;
  END IF;

  -- Normal role check
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id
    AND role = check_role
  );
END;
$$;

-- 8. Fix Profiles RLS Policy to use helper functions (avoid direct join bypass)
DROP POLICY IF EXISTS "Admins can view all profiles in their scope" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in their scope" ON public.profiles;
CREATE POLICY "Admins can view all profiles in their scope" ON public.profiles FOR SELECT
  USING (
    public.is_platform_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'tenant_admin') AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = public.profiles.id AND ur.tenant_id = public.get_user_tenant_id(auth.uid())
    )) OR
    (public.has_role(auth.uid(), 'franchise_admin') AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = public.profiles.id AND ur.franchise_id = public.get_user_franchise_id(auth.uid())
    ))
  );

DROP POLICY IF EXISTS "Admins can update profiles in their scope" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their scope" ON public.profiles;
CREATE POLICY "Admins can update profiles in their scope" ON public.profiles FOR UPDATE
  USING (
    public.is_platform_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'tenant_admin') AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = public.profiles.id AND ur.tenant_id = public.get_user_tenant_id(auth.uid())
    )) OR
    (public.has_role(auth.uid(), 'franchise_admin') AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = public.profiles.id AND ur.franchise_id = public.get_user_franchise_id(auth.uid())
    ))
  );

-- 4. Update get_user_tenant_id to return override tenant
DROP FUNCTION IF EXISTS public.get_user_tenant_id(check_user_id UUID);
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(check_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_real_platform_admin BOOLEAN;
  v_override_enabled BOOLEAN;
  v_override_tenant_id UUID;
  v_role_tenant_id UUID;
BEGIN
  -- Check if user is REALLY a platform admin (ignoring the modified is_platform_admin function)
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = check_user_id AND role = 'platform_admin')
  INTO v_is_real_platform_admin;

  -- Check if override is enabled in preferences
  SELECT 
    (admin_override_enabled IS TRUE),
    tenant_id
  INTO v_override_enabled, v_override_tenant_id
  FROM user_preferences
  WHERE user_id = check_user_id;

  -- Return override tenant if applicable
  IF v_is_real_platform_admin AND v_override_enabled THEN
    RETURN v_override_tenant_id;
  END IF;

  -- Otherwise return normal role-based tenant
  -- (Prioritize tenant_admin, then franchise_admin, then user)
  SELECT tenant_id INTO v_role_tenant_id
  FROM user_roles
  WHERE user_id = check_user_id
  ORDER BY 
    CASE role 
      WHEN 'tenant_admin' THEN 1 
      WHEN 'franchise_admin' THEN 2 
      ELSE 3 
    END
  LIMIT 1;

  RETURN v_role_tenant_id;
END;
$$;

-- 5. Update get_user_franchise_id to return override franchise
DROP FUNCTION IF EXISTS public.get_user_franchise_id(check_user_id UUID);
CREATE OR REPLACE FUNCTION public.get_user_franchise_id(check_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_real_platform_admin BOOLEAN;
  v_override_enabled BOOLEAN;
  v_override_franchise_id UUID;
  v_role_franchise_id UUID;
BEGIN
  -- Check if user is REALLY a platform admin
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = check_user_id AND role = 'platform_admin')
  INTO v_is_real_platform_admin;

  -- Check if override is enabled in preferences
  SELECT 
    (admin_override_enabled IS TRUE),
    franchise_id
  INTO v_override_enabled, v_override_franchise_id
  FROM user_preferences
  WHERE user_id = check_user_id;

  -- Return override franchise if applicable
  IF v_is_real_platform_admin AND v_override_enabled THEN
    RETURN v_override_franchise_id;
  END IF;

  -- Otherwise return normal role-based franchise
  SELECT franchise_id INTO v_role_franchise_id
  FROM user_roles
  WHERE user_id = check_user_id
  AND franchise_id IS NOT NULL
  LIMIT 1;

  RETURN v_role_franchise_id;
END;
$$;

-- 6. Update set_admin_override to log audit
DROP FUNCTION IF EXISTS public.set_admin_override(p_enabled BOOLEAN, p_tenant_id UUID, p_franchise_id UUID);
CREATE OR REPLACE FUNCTION public.set_admin_override(
    p_enabled BOOLEAN,
    p_tenant_id UUID DEFAULT NULL,
    p_franchise_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_platform_admin BOOLEAN;
BEGIN
    -- Check if user is platform admin (using direct check to avoid recursion)
    SELECT EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'platform_admin'
    ) INTO v_is_platform_admin;

    IF NOT v_is_platform_admin THEN
        RAISE EXCEPTION 'Only platform admins can use admin override';
    END IF;

    -- Update Preferences
    INSERT INTO public.user_preferences (user_id, admin_override_enabled, tenant_id, franchise_id)
    VALUES (auth.uid(), p_enabled, p_tenant_id, p_franchise_id)
    ON CONFLICT (user_id)
    DO UPDATE SET
        admin_override_enabled = EXCLUDED.admin_override_enabled,
        tenant_id = COALESCE(p_tenant_id, user_preferences.tenant_id),
        franchise_id = COALESCE(p_franchise_id, user_preferences.franchise_id),
        updated_at = NOW();

    -- Audit Log
    INSERT INTO public.admin_override_audit (user_id, tenant_id, franchise_id, enabled)
    VALUES (auth.uid(), p_tenant_id, p_franchise_id, p_enabled);
END;
$$;

-- 7. Update set_user_scope_preference to log audit for platform admins
DROP FUNCTION IF EXISTS public.set_user_scope_preference(p_tenant_id UUID, p_franchise_id UUID, p_admin_override BOOLEAN);
CREATE OR REPLACE FUNCTION public.set_user_scope_preference(
    p_tenant_id UUID,
    p_franchise_id UUID,
    p_admin_override BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_platform_admin BOOLEAN;
BEGIN
    -- Update Preferences
    INSERT INTO public.user_preferences (user_id, tenant_id, franchise_id, admin_override_enabled)
    VALUES (auth.uid(), p_tenant_id, p_franchise_id, p_admin_override)
    ON CONFLICT (user_id)
    DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        franchise_id = EXCLUDED.franchise_id,
        admin_override_enabled = EXCLUDED.admin_override_enabled,
        updated_at = NOW();

    -- Audit Log if Platform Admin and Override is enabled
    -- We check if they are a platform admin first
    SELECT EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'platform_admin'
    ) INTO v_is_platform_admin;

    IF v_is_platform_admin AND p_admin_override THEN
        INSERT INTO public.admin_override_audit (user_id, tenant_id, franchise_id, enabled)
        VALUES (auth.uid(), p_tenant_id, p_franchise_id, true);
    END IF;
END;
$$;
DROP FUNCTION IF EXISTS public.get_fk_orphans();
CREATE OR REPLACE FUNCTION public.get_fk_orphans()
RETURNS TABLE (
    constraint_schema text,
    table_name text,
    constraint_name text,
    child_column text,
    parent_schema text,
    parent_table text,
    parent_column text,
    orphan_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec record;
    cnt bigint;
BEGIN
    FOR rec IN
        SELECT
            tc.constraint_schema,
            tc.table_name,
            tc.constraint_name,
            kcu.column_name AS child_column,
            ccu.table_schema AS parent_schema,
            ccu.table_name AS parent_table,
            ccu.column_name AS parent_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.constraint_schema = kcu.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.constraint_schema = ccu.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.constraint_schema IN ('public', 'auth', 'storage')
    LOOP
        cnt := 0;
        EXECUTE format(
            'SELECT count(*) FROM %I.%I AS child LEFT JOIN %I.%I AS parent ON child.%I = parent.%I WHERE child.%I IS NOT NULL AND parent.%I IS NULL',
            rec.constraint_schema,
            rec.table_name,
            COALESCE(rec.parent_schema, 'public'),
            rec.parent_table,
            rec.child_column,
            rec.parent_column,
            rec.child_column,
            rec.parent_column
        ) INTO cnt;
        IF cnt > 0 THEN
            constraint_schema := rec.constraint_schema;
            table_name := rec.table_name;
            constraint_name := rec.constraint_name;
            child_column := rec.child_column;
            parent_schema := COALESCE(rec.parent_schema, 'public');
            parent_table := rec.parent_table;
            parent_column := rec.parent_column;
            orphan_count := cnt;
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;-- Phase 3: Email Infrastructure Completion (Shared Access & Missing AI Fields)

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
DROP POLICY IF EXISTS "Owners can manage delegations" ON public.email_account_delegations;
CREATE POLICY "Owners can manage delegations" ON public.email_account_delegations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.email_accounts
    WHERE id = account_id AND user_id = auth.uid()
  )
);

-- Delegates can view their delegations
DROP POLICY IF EXISTS "Delegates can view their delegations" ON public.email_account_delegations;
CREATE POLICY "Delegates can view their delegations" ON public.email_account_delegations
FOR SELECT
USING (delegate_user_id = auth.uid());

-- Tenant/Franchise admins can view delegations in their scope
DROP POLICY IF EXISTS "Admins can view delegations" ON public.email_account_delegations;
CREATE POLICY "Admins can view delegations" ON public.email_account_delegations
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
DROP FUNCTION IF EXISTS public.get_franchise_user_ids(_franchise_id UUID);
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

DROP POLICY IF EXISTS "Hierarchical email visibility" ON public.emails;
CREATE POLICY "Hierarchical email visibility" ON public.emails FOR SELECT
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

DROP POLICY IF EXISTS "Users can view delegated email accounts" ON public.email_accounts;
CREATE POLICY "Users can view delegated email accounts" ON public.email_accounts FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT account_id FROM public.email_account_delegations 
    WHERE delegate_user_id = auth.uid()
  )
);
-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for email-attachments bucket

-- Allow authenticated users to upload attachments
DROP POLICY IF EXISTS "Users can upload email attachments" ON storage.objects;
CREATE POLICY "Users can upload email attachments" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'email-attachments');

-- Allow authenticated users to view attachments
-- Ideally, we should restrict this, but for now, authenticated users can view/download
DROP POLICY IF EXISTS "Users can view email attachments" ON storage.objects;
CREATE POLICY "Users can view email attachments" ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'email-attachments');

-- Allow users to delete their own attachments (optional, for cleanup)
DROP POLICY IF EXISTS "Users can delete their own email attachments" ON storage.objects;
CREATE POLICY "Users can delete their own email attachments" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'email-attachments' AND auth.uid() = owner);
-- Ensure custom_fields column exists in activities table
BEGIN;

ALTER TABLE IF EXISTS public.activities 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Create index for better performance on JSONB queries
CREATE INDEX IF NOT EXISTS idx_activities_custom_fields ON public.activities USING GIN (custom_fields);

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

COMMIT;
-- Create import_overrides table for tracking validation bypass actions
CREATE TABLE IF NOT EXISTS public.import_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    issues TEXT[],
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.import_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their overrides" ON public.import_overrides;
CREATE POLICY "Users can view their overrides" ON public.import_overrides
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert overrides" ON public.import_overrides;
CREATE POLICY "Users can insert overrides" ON public.import_overrides
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Platform admins can manage all overrides" ON public.import_overrides;
CREATE POLICY "Platform admins can manage all overrides" ON public.import_overrides
    FOR ALL USING (public.is_platform_admin(auth.uid()));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_import_overrides_user_id ON public.import_overrides(user_id);

-- Fix: Recreate assign_lead_with_transaction without explicit COMMIT/ROLLBACK
DROP FUNCTION IF EXISTS public.assign_lead_with_transaction(p_lead_id uuid, p_assigned_to uuid, p_assignment_method text, p_rule_id uuid, p_tenant_id uuid, p_franchise_id uuid);
CREATE OR REPLACE FUNCTION public.assign_lead_with_transaction(
  p_lead_id uuid,
  p_assigned_to uuid,
  p_assignment_method text,
  p_rule_id uuid,
  p_tenant_id uuid,
  p_franchise_id uuid
) RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update lead owner
    UPDATE leads SET owner_id = p_assigned_to WHERE id = p_lead_id;

    -- Record assignment history
    INSERT INTO lead_assignment_history (
      lead_id, assigned_to, assignment_method, rule_id, tenant_id, franchise_id, assigned_by
    ) VALUES (
      p_lead_id, p_assigned_to, p_assignment_method, p_rule_id, p_tenant_id, p_franchise_id, NULL
    );

    -- Update user capacity
    UPDATE user_capacity
    SET current_leads = current_leads + 1, last_assigned_at = now()
    WHERE user_id = p_assigned_to AND tenant_id = p_tenant_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Fix: Recreate logic_nexus_import_dry_run with corrected search_path
DROP FUNCTION IF EXISTS public.logic_nexus_import_dry_run(p_tables jsonb, p_schema text);
CREATE OR REPLACE FUNCTION public.logic_nexus_import_dry_run(
  p_tables jsonb,
  p_schema text DEFAULT 'public'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table text;
  v_rows jsonb;
  v_count int;
  v_errors text[] := ARRAY[]::text[];
  v_total_success int := 0;
  v_table_count int := 0;
BEGIN
  FOR v_table, v_rows IN SELECT * FROM jsonb_each(p_tables)
  LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = p_schema AND table_name = v_table
      ) THEN
        v_errors := array_append(v_errors, format('Table "%s"."%s" not found', p_schema, v_table));
        CONTINUE;
      END IF;

      EXECUTE format(
        'INSERT INTO %I.%I SELECT * FROM jsonb_populate_recordset(null::%I.%I, $1)',
        p_schema, v_table, p_schema, v_table
      ) USING v_rows;
      
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_total_success := v_total_success + v_count;
      v_table_count := v_table_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, format('Error in "%s": %s', v_table, SQLERRM));
    END;
  END LOOP;

  IF array_length(v_errors, 1) > 0 THEN
    RAISE EXCEPTION 'DRY_RUN_FAILED: % errors found. Details: %', array_length(v_errors, 1), array_to_string(v_errors, '; ');
  ELSE
    RAISE EXCEPTION 'DRY_RUN_OK: Validated % rows across % tables', v_total_success, v_table_count;
  END IF;
END;
$$;
-- Create email_sync_logs table
CREATE TABLE IF NOT EXISTS public.email_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    emails_synced INTEGER DEFAULT 0,
    details JSONB,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_sync_logs' AND policyname = 'Users can view own sync logs'
    ) THEN
        DROP POLICY IF EXISTS "Users can view own sync logs" ON public.email_sync_logs;
CREATE POLICY "Users can view own sync logs" ON public.email_sync_logs
            FOR SELECT
            USING (
                account_id IN (
                    SELECT id FROM public.email_accounts WHERE user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_sync_logs' AND policyname = 'Platform admins can view all sync logs'
    ) THEN
        DROP POLICY IF EXISTS "Platform admins can view all sync logs" ON public.email_sync_logs;
CREATE POLICY "Platform admins can view all sync logs" ON public.email_sync_logs
            FOR SELECT
            USING (is_platform_admin(auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_sync_logs' AND policyname = 'Users can insert own sync logs'
    ) THEN
        DROP POLICY IF EXISTS "Users can insert own sync logs" ON public.email_sync_logs;
CREATE POLICY "Users can insert own sync logs" ON public.email_sync_logs
            FOR INSERT
            WITH CHECK (
                account_id IN (
                    SELECT id FROM public.email_accounts WHERE user_id = auth.uid()
                )
            );
    END IF;
END
$$;

-- Subscription Plan Enhancements for Master Data Management
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'price_quarterly'
  ) THEN
    ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_quarterly NUMERIC(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'trial_period_days'
  ) THEN
    ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS trial_period_days INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'deployment_model'
  ) THEN
    ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS deployment_model TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'supported_currencies'
  ) THEN
    ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS supported_currencies TEXT[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'supported_languages'
  ) THEN
    ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS supported_languages TEXT[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END$$;

-- Add user scaling columns to subscription_plans
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS user_scaling_factor numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_users integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_users integer DEFAULT NULL;

-- Comment on columns for documentation

-- Fix RLS policy for subscription_plans to allow platform admins to manage plans
-- even when "Admin Override" (masquerading) is enabled.
-- This ensures global configuration can be managed regardless of the current view scope.

-- 1. Create a helper function to check for ACTUAL platform admin role, ignoring overrides.
DROP FUNCTION IF EXISTS public.is_actual_platform_admin(check_user_id UUID);
CREATE OR REPLACE FUNCTION public.is_actual_platform_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id AND role = 'platform_admin'
  );
$$;

-- 2. Update the RLS policy for subscription_plans to use the new function.
-- This allows platform admins to Insert/Update/Delete plans even if they are currently viewing as a tenant.

DROP POLICY IF EXISTS "Platform admins can manage subscription plans" ON public.subscription_plans;

DROP POLICY IF EXISTS "Platform admins can manage subscription plans" ON public.subscription_plans;
CREATE POLICY "Platform admins can manage subscription plans" ON public.subscription_plans
  FOR ALL
  USING (public.is_actual_platform_admin(auth.uid()));
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low'));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_quotes_priority ON public.quotes(priority);

-- Update existing quotes to have a priority (random distribution for demo or based on value)
UPDATE public.quotes 
SET priority = CASE 
    WHEN sell_price > 10000 THEN 'high'
    WHEN sell_price > 2000 THEN 'medium'
    ELSE 'low'
END
WHERE priority IS NULL;
-- Fix ON CONFLICT clauses in generate_quote_number to match partial indexes

DROP FUNCTION IF EXISTS public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid);
CREATE OR REPLACE FUNCTION public.generate_quote_number(
  p_tenant_id uuid,
  p_franchise_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_reset_policy quote_reset_policy;
  v_period_key TEXT;
  v_next_seq INTEGER;
  v_quote_number TEXT;
BEGIN
  -- Prefer franchise config, fallback to tenant
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;

  IF v_prefix IS NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  v_prefix := COALESCE(v_prefix, 'QUO');
  -- Force daily reset to meet requested format
  v_reset_policy := 'daily'::quote_reset_policy;

  -- Period key for sequences: canonical YYYY-MM-DD bucket
  v_period_key := to_char(CURRENT_DATE, 'YYYY-MM-DD');

  -- Upsert/increment sequence per scope
  IF p_franchise_id IS NOT NULL THEN
    INSERT INTO public.quote_number_sequences (tenant_id, franchise_id, period_key, last_sequence)
    VALUES (p_tenant_id, p_franchise_id, v_period_key, 1)
    ON CONFLICT (tenant_id, franchise_id, period_key) WHERE franchise_id IS NOT NULL
    DO UPDATE SET last_sequence = public.quote_number_sequences.last_sequence + 1,
                  updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  ELSE
    INSERT INTO public.quote_number_sequences (tenant_id, franchise_id, period_key, last_sequence)
    VALUES (p_tenant_id, NULL, v_period_key, 1)
    ON CONFLICT (tenant_id, period_key) WHERE franchise_id IS NULL
    DO UPDATE SET last_sequence = public.quote_number_sequences.last_sequence + 1,
                  updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  END IF;

  -- Format: PREFIX-YYMMDD-#####
  v_quote_number := v_prefix || '-' || to_char(CURRENT_DATE, 'YYMMDD') || '-' || lpad(v_next_seq::TEXT, 5, '0');

  RETURN v_quote_number;
END;
$$;
-- Migration: Fix Tenant Creation RLS and Permissions
-- Description: Ensures the specified super user has the 'platform_admin' role and re-applies RLS policies for the tenants table to allow creation.
-- Author: Trae AI
-- Date: 2026-01-20

-- 1. Ensure the user has the platform_admin role
DO $$
DECLARE
  v_user_email TEXT := 'bahuguna.vimal@gmail.com';
  v_user_id UUID;
  v_role_exists BOOLEAN;
  v_profile_exists BOOLEAN;
BEGIN
  -- Find the user by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_user_email;

  IF v_user_id IS NOT NULL THEN
    -- Ensure profile exists (idempotent check)
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) INTO v_profile_exists;
    
    IF NOT v_profile_exists THEN
       INSERT INTO public.profiles (id, email, first_name, last_name, is_active)
       VALUES (v_user_id, v_user_email, 'Vimal', 'Bahuguna', true);
    END IF;

    -- Check if role exists
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = v_user_id AND role = 'platform_admin'
    ) INTO v_role_exists;

    -- Assign role if missing
    IF NOT v_role_exists THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'platform_admin');
    END IF;
  END IF;
END $$;

-- 2. Reset and Re-apply RLS policies for tenants to ensure INSERT is allowed
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Platform admins full access to tenants" ON public.tenants;
DROP POLICY IF EXISTS "Platform admins can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Platform admins can view all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Platform admins can update tenants" ON public.tenants;
DROP POLICY IF EXISTS "Platform admins can delete tenants" ON public.tenants;
DROP POLICY IF EXISTS "Platform admins can update all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Platform admins can delete all tenants" ON public.tenants;

-- Create explicit policies for clarity and coverage

-- SELECT: Platform admins can see all
DROP POLICY IF EXISTS "Platform admins can view all tenants" ON public.tenants;
CREATE POLICY "Platform admins can view all tenants" ON public.tenants FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

-- INSERT: Only Platform admins can create tenants
DROP POLICY IF EXISTS "Platform admins can insert tenants" ON public.tenants;
CREATE POLICY "Platform admins can insert tenants" ON public.tenants FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- UPDATE: Platform admins can update all
DROP POLICY IF EXISTS "Platform admins can update all tenants" ON public.tenants;
CREATE POLICY "Platform admins can update all tenants" ON public.tenants FOR UPDATE
  USING (public.is_platform_admin(auth.uid()));

-- DELETE: Platform admins can delete all
DROP POLICY IF EXISTS "Platform admins can delete all tenants" ON public.tenants;
CREATE POLICY "Platform admins can delete all tenants" ON public.tenants FOR DELETE
  USING (public.is_platform_admin(auth.uid()));

-- Ensure Tenant Admin policies are preserved/restored
-- (Dropping first to ensure no duplicates if naming varied)
DROP POLICY IF EXISTS "Tenant admins can view own tenant" ON public.tenants;

DROP POLICY IF EXISTS "Tenant admins can view own tenant" ON public.tenants;
CREATE POLICY "Tenant admins can view own tenant" ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id(auth.uid()));

-- 3. Verify is_platform_admin function (idempotent replacement)
DROP FUNCTION IF EXISTS public.is_platform_admin(check_user_id UUID);
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id AND role = 'platform_admin'
  );
$$;
-- Phase 1 Schema Updates for Quotation Module
-- Adds support for 3-Tier Rate Engine and enhanced Quote details

BEGIN;

-- 1. Enhance 'quotes' table
ALTER TABLE public.quotes 
  ADD COLUMN IF NOT EXISTS incoterms TEXT,
  ADD COLUMN IF NOT EXISTS ready_date DATE,
  ADD COLUMN IF NOT EXISTS service_level TEXT, -- e.g., 'Standard', 'Express', 'Saver'
  ADD COLUMN IF NOT EXISTS is_hazmat BOOLEAN DEFAULT false;

-- 2. Enhance 'quote_items' table
ALTER TABLE public.quote_items 
  ADD COLUMN IF NOT EXISTS hazmat_class TEXT,
  ADD COLUMN IF NOT EXISTS un_number TEXT; -- United Nations number for hazmat

-- 3. Enhance 'carrier_rates' to support 3-Tier Rate Engine
-- Tier 1: Contract (Customer specific)
-- Tier 2: Spot (Carrier specific, standard)
-- Tier 3: Market (General averages)

DO $$
BEGIN
  -- Add 'tier' column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'tier'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('contract', 'spot', 'market')) DEFAULT 'spot';
  END IF;

  -- Add 'customer_id' for Contract rates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;
  
  -- Add 'effective_date' and 'expiry_date' if not present (carrier_rates might not have them, 'rates' did)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'valid_from'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN IF NOT EXISTS valid_from DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_rates' 
    AND column_name = 'valid_to'
  ) THEN
    ALTER TABLE public.carrier_rates ADD COLUMN IF NOT EXISTS valid_to DATE;
  END IF;
END $$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_carrier_rates_tier ON public.carrier_rates(tier);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_customer ON public.carrier_rates(customer_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_validity ON public.carrier_rates(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_quotes_ready_date ON public.quotes(ready_date);

COMMIT;
-- Fix "FAILED TO FETCH QUOTE ERROR" by ensuring quotes table has correct columns and foreign keys
-- Specifically targeting account_id (vs customer_id), missing franchise_id FK, and service_type_id

DO $$
BEGIN

  -- 1. Handle account_id / customer_id discrepancy
  -- If customer_id exists but account_id does not, rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'customer_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.quotes RENAME COLUMN customer_id TO account_id;
  END IF;

  -- If account_id still doesn't exist (neither did customer_id), add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;
