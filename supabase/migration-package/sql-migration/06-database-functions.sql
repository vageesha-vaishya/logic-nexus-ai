-- ==========================================
-- PHASE 6: DATABASE FUNCTIONS & TRIGGERS
-- ==========================================
-- Execute this after Phase 5

-- Drop existing triggers
DROP TRIGGER IF EXISTS auto_generate_quote_number_trigger ON quotes CASCADE;
DROP TRIGGER IF EXISTS update_lead_score_trigger ON leads CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS tenant_has_feature(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS decrement_user_lead_count(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_user_lead_count(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS auto_generate_quote_number() CASCADE;
DROP FUNCTION IF EXISTS generate_quote_number(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS update_lead_score() CASCADE;
DROP FUNCTION IF EXISTS calculate_lead_score(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_franchise_id(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_tenant_id(UUID) CASCADE;
DROP FUNCTION IF EXISTS has_role(UUID, app_role) CASCADE;
DROP FUNCTION IF EXISTS is_platform_admin(UUID) CASCADE;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(check_user_id, 'platform_admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION has_role(check_user_id UUID, check_role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id AND role = check_role
  );
$$;

CREATE OR REPLACE FUNCTION get_user_tenant_id(check_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM user_roles
  WHERE user_id = check_user_id
    AND role IN ('tenant_admin', 'franchise_admin', 'user')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_user_franchise_id(check_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT franchise_id FROM user_roles
  WHERE user_id = check_user_id
    AND role IN ('franchise_admin', 'user')
  LIMIT 1;
$$;

-- Lead scoring function
CREATE OR REPLACE FUNCTION calculate_lead_score(lead_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_score INTEGER := 0;
  lead_rec RECORD;
BEGIN
  SELECT * INTO lead_rec FROM leads WHERE id = lead_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Score based on status
  total_score := total_score + CASE lead_rec.status
    WHEN 'qualified' THEN 30
    WHEN 'contacted' THEN 20
    WHEN 'proposal' THEN 40
    WHEN 'negotiation' THEN 50
    WHEN 'new' THEN 10
    ELSE 0
  END;

  -- Score based on estimated value
  IF lead_rec.estimated_value IS NOT NULL THEN
    total_score := total_score + CASE
      WHEN lead_rec.estimated_value >= 100000 THEN 30
      WHEN lead_rec.estimated_value >= 50000 THEN 20
      WHEN lead_rec.estimated_value >= 10000 THEN 10
      ELSE 5
    END;
  END IF;

  -- Score based on recent activity
  IF lead_rec.last_activity_date IS NOT NULL THEN
    IF lead_rec.last_activity_date > (NOW() - INTERVAL '7 days') THEN
      total_score := total_score + 15;
    ELSIF lead_rec.last_activity_date > (NOW() - INTERVAL '30 days') THEN
      total_score := total_score + 10;
    END IF;
  END IF;

  -- Score based on source
  total_score := total_score + CASE lead_rec.source
    WHEN 'referral' THEN 15
    WHEN 'website' THEN 10
    WHEN 'event' THEN 12
    ELSE 5
  END;

  RETURN total_score;
END;
$$;

-- Update lead score trigger
CREATE OR REPLACE FUNCTION update_lead_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.lead_score := calculate_lead_score(NEW.id);
  RETURN NEW;
END;
$$;

-- Quote number generation functions
CREATE OR REPLACE FUNCTION generate_quote_number(p_tenant_id UUID, p_franchise_id UUID DEFAULT NULL)
RETURNS TEXT
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
  -- Get configuration (franchise overrides tenant)
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;
  
  -- Fall back to tenant config
  IF v_prefix IS NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;
  
  -- Defaults
  v_prefix := COALESCE(v_prefix, 'QUO');
  v_reset_policy := COALESCE(v_reset_policy, 'none'::quote_reset_policy);
  
  -- Determine period key
  v_period_key := CASE v_reset_policy
    WHEN 'daily' THEN to_char(CURRENT_DATE, 'YYYY-MM-DD')
    WHEN 'monthly' THEN to_char(CURRENT_DATE, 'YYYY-MM')
    WHEN 'yearly' THEN to_char(CURRENT_DATE, 'YYYY')
    ELSE 'none'
  END;
  
  -- Get next sequence
  IF p_franchise_id IS NOT NULL THEN
    INSERT INTO quote_number_sequences (tenant_id, franchise_id, period_key, last_sequence, created_at, updated_at)
    VALUES (p_tenant_id, p_franchise_id, v_period_key, 1, NOW(), NOW())
    ON CONFLICT (tenant_id, franchise_id, period_key)
    WHERE franchise_id IS NOT NULL
    DO UPDATE SET last_sequence = quote_number_sequences.last_sequence + 1, updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  ELSE
    INSERT INTO quote_number_sequences (tenant_id, franchise_id, period_key, last_sequence, created_at, updated_at)
    VALUES (p_tenant_id, NULL, v_period_key, 1, NOW(), NOW())
    ON CONFLICT (tenant_id, period_key)
    WHERE franchise_id IS NULL
    DO UPDATE SET last_sequence = quote_number_sequences.last_sequence + 1, updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  END IF;
  
  -- Format quote number
  v_quote_number := CASE v_reset_policy
    WHEN 'daily' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'monthly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'yearly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    ELSE v_prefix || '-' || lpad(v_next_seq::TEXT, 6, '0')
  END;
  
  RETURN v_quote_number;
END;
$$;

-- Auto-generate quote number trigger
CREATE OR REPLACE FUNCTION auto_generate_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := generate_quote_number(NEW.tenant_id, NEW.franchise_id);
  END IF;
  RETURN NEW;
END;
$$;

-- User capacity management
CREATE OR REPLACE FUNCTION increment_user_lead_count(p_user_id UUID, p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_capacity (user_id, tenant_id, current_leads, last_assigned_at)
  VALUES (p_user_id, p_tenant_id, 1, NOW())
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET
    current_leads = user_capacity.current_leads + 1,
    last_assigned_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION decrement_user_lead_count(p_user_id UUID, p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_capacity
  SET current_leads = GREATEST(0, current_leads - 1)
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
END;
$$;

-- Subscription features
CREATE OR REPLACE FUNCTION tenant_has_feature(_tenant_id UUID, _feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tenant_subscriptions ts
    JOIN subscription_plans sp ON ts.plan_id = sp.id
    WHERE ts.tenant_id = _tenant_id
      AND ts.status = 'active'
      AND ts.current_period_end > now()
      AND (
        sp.features @> jsonb_build_array(jsonb_build_object('key', _feature_key))
        OR sp.features @> jsonb_build_array(_feature_key)
      )
  );
$$;

-- Create triggers
DROP TRIGGER IF EXISTS update_lead_score_trigger ON leads;
CREATE TRIGGER update_lead_score_trigger
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_score();

DROP TRIGGER IF EXISTS auto_generate_quote_number_trigger ON quotes;
CREATE TRIGGER auto_generate_quote_number_trigger
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_quote_number();

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION require_encryption_key()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k TEXT;
BEGIN
  k := current_setting('app.encryption_key', true);
  IF k IS NULL OR k = '' THEN
    RAISE EXCEPTION 'encryption key not set';
  END IF;
  RETURN k;
END;
$$;

CREATE OR REPLACE FUNCTION encrypt_text(plaintext TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k TEXT;
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;
  k := require_encryption_key();
  RETURN pgp_sym_encrypt(plaintext, k, 'cipher-algo=aes256, compress-algo=1');
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_text(cipher BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k TEXT;
BEGIN
  IF cipher IS NULL THEN
    RETURN NULL;
  END IF;
  k := require_encryption_key();
  RETURN pgp_sym_decrypt(cipher, k);
END;
$$;

CREATE OR REPLACE FUNCTION audit_row_change()
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
BEGIN
  v_action := TG_OP;
  v_resource_type := TG_TABLE_NAME;
  v_resource_id := COALESCE(NEW.id, OLD.id);
  v_ip := COALESCE(inet_client_addr()::TEXT, 'unknown');
  v_tenant := public.get_user_tenant_id(auth.uid());
  v_franchise := public.get_user_franchise_id(auth.uid());
  INSERT INTO audit_logs(user_id, action, resource_type, resource_id, ip_address, details, created_at)
  VALUES (
    auth.uid(),
    v_action,
    v_resource_type,
    v_resource_id,
    v_ip,
    jsonb_build_object(
      'tenant_id', v_tenant,
      'franchise_id', v_franchise
    ),
    NOW()
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS audit_accounts ON accounts;
CREATE TRIGGER audit_accounts
AFTER INSERT OR UPDATE OR DELETE ON accounts
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS audit_contacts ON contacts;
CREATE TRIGGER audit_contacts
AFTER INSERT OR UPDATE OR DELETE ON contacts
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS audit_leads ON leads;
CREATE TRIGGER audit_leads
AFTER INSERT OR UPDATE OR DELETE ON leads
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS audit_opportunities ON opportunities;
CREATE TRIGGER audit_opportunities
AFTER INSERT OR UPDATE OR DELETE ON opportunities
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS audit_activities ON activities;
CREATE TRIGGER audit_activities
AFTER INSERT OR UPDATE OR DELETE ON activities
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS audit_campaigns ON campaigns;
CREATE TRIGGER audit_campaigns
AFTER INSERT OR UPDATE OR DELETE ON campaigns
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS audit_quotes ON quotes;
CREATE TRIGGER audit_quotes
AFTER INSERT OR UPDATE OR DELETE ON quotes
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS audit_shipments ON shipments;
CREATE TRIGGER audit_shipments
AFTER INSERT OR UPDATE OR DELETE ON shipments
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS audit_emails ON emails;
CREATE TRIGGER audit_emails
AFTER INSERT OR UPDATE OR DELETE ON emails
FOR EACH ROW EXECUTE FUNCTION audit_row_change();
