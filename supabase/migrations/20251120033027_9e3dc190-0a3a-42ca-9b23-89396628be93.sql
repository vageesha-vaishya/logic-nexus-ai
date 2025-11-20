-- ================================================
-- Phase 6: Customer-Facing Enhancements
-- ================================================

DROP TABLE IF EXISTS quote_presentation_templates CASCADE;
DROP TABLE IF EXISTS quote_shares CASCADE;
DROP TABLE IF EXISTS quote_access_logs CASCADE;
DROP TABLE IF EXISTS quote_comments CASCADE;
DROP TABLE IF EXISTS quote_documents CASCADE;
DROP TABLE IF EXISTS quote_approval_workflows CASCADE;
DROP TABLE IF EXISTS quote_approvals CASCADE;
DROP TABLE IF EXISTS quote_email_history CASCADE;

CREATE TABLE quote_presentation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  font_family TEXT DEFAULT 'Arial',
  layout_config JSONB DEFAULT '{}',
  header_template TEXT,
  footer_template TEXT,
  terms_conditions_template TEXT,
  show_carrier_details BOOLEAN DEFAULT true,
  show_transit_times BOOLEAN DEFAULT true,
  show_buy_prices BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE quote_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  access_type TEXT DEFAULT 'view_only',
  max_views INTEGER,
  current_views INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id),
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE quote_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_share_id UUID REFERENCES quote_shares(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  visitor_email TEXT,
  action_type TEXT
);

CREATE TABLE quote_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  author_type TEXT NOT NULL,
  author_user_id UUID REFERENCES profiles(id),
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE quote_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT,
  is_public BOOLEAN DEFAULT false,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE quote_email_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  to_emails TEXT[] NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivery_status TEXT DEFAULT 'sent'
);

-- Indexes
CREATE INDEX idx_qpt_t ON quote_presentation_templates(tenant_id);
CREATE INDEX idx_qs_q ON quote_shares(quote_id);
CREATE INDEX idx_qc_q ON quote_comments(quote_id);
CREATE INDEX idx_qd_q ON quote_documents(quote_id);

-- RLS
ALTER TABLE quote_presentation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_email_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pt_admin" ON quote_presentation_templates FOR ALL TO authenticated USING (is_platform_admin(auth.uid()));
CREATE POLICY "pt_tenant" ON quote_presentation_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "pt_view" ON quote_presentation_templates FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "qs_admin" ON quote_shares FOR ALL TO authenticated USING (is_platform_admin(auth.uid()));
CREATE POLICY "qs_user" ON quote_shares FOR ALL TO authenticated USING (quote_id IN (SELECT id FROM quotes WHERE franchise_id = get_user_franchise_id(auth.uid())));
CREATE POLICY "qs_public" ON quote_shares FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "qal_insert" ON quote_access_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "qal_view" ON quote_access_logs FOR SELECT TO authenticated USING (quote_id IN (SELECT id FROM quotes WHERE franchise_id = get_user_franchise_id(auth.uid())));

CREATE POLICY "qc_admin" ON quote_comments FOR ALL TO authenticated USING (is_platform_admin(auth.uid()));
CREATE POLICY "qc_user" ON quote_comments FOR ALL TO authenticated USING (quote_id IN (SELECT id FROM quotes WHERE franchise_id = get_user_franchise_id(auth.uid())));
CREATE POLICY "qc_public" ON quote_comments FOR INSERT TO anon, authenticated WITH CHECK (author_type = 'customer');

CREATE POLICY "qd_admin" ON quote_documents FOR ALL TO authenticated USING (is_platform_admin(auth.uid()));
CREATE POLICY "qd_user" ON quote_documents FOR ALL TO authenticated USING (quote_id IN (SELECT id FROM quotes WHERE franchise_id = get_user_franchise_id(auth.uid())));
CREATE POLICY "qd_public" ON quote_documents FOR SELECT TO anon, authenticated USING (is_public = true);

CREATE POLICY "qeh_view" ON quote_email_history FOR SELECT TO authenticated USING (quote_id IN (SELECT id FROM quotes WHERE franchise_id = get_user_franchise_id(auth.uid())));
CREATE POLICY "qeh_insert" ON quote_email_history FOR INSERT TO authenticated WITH CHECK (quote_id IN (SELECT id FROM quotes WHERE franchise_id = get_user_franchise_id(auth.uid())));

CREATE TRIGGER upd_qpt BEFORE UPDATE ON quote_presentation_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER upd_qc BEFORE UPDATE ON quote_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION generate_share_token() RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$ BEGIN RETURN encode(gen_random_bytes(32), 'base64'); END; $$;

CREATE OR REPLACE FUNCTION create_quote_share(p_tenant_id UUID, p_quote_id UUID, p_expires_in_days INTEGER DEFAULT 30) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO quote_shares (tenant_id, quote_id, share_token, expires_at)
  VALUES (p_tenant_id, p_quote_id, generate_share_token(), now() + (COALESCE(p_expires_in_days, 30) || ' days')::INTERVAL)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;