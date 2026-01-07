-- ==========================================
-- PHASE: MISSING TABLES FOR ROLES, TEMPLATES, AND PORTAL
-- ==========================================

-- Quote Templates Table
CREATE TABLE IF NOT EXISTS quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  content JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Portal Tokens Table for sharing quotes
CREATE TABLE IF NOT EXISTS portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auth Roles Table (for dynamic role management)
CREATE TABLE IF NOT EXISTS auth_roles (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0,
  can_manage_scopes TEXT[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auth Permissions Table
CREATE TABLE IF NOT EXISTS auth_permissions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auth Role Permissions Junction Table
CREATE TABLE IF NOT EXISTS auth_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id TEXT NOT NULL REFERENCES auth_roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES auth_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Lead Activities Table (for lead scoring)
CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lead Score Config Table
CREATE TABLE IF NOT EXISTS lead_score_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  weights_json JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Lead Score Logs Table
CREATE TABLE IF NOT EXISTS lead_score_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  old_score INTEGER,
  new_score INTEGER,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shipment Attachments Table
CREATE TABLE IF NOT EXISTS shipment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quote_templates_tenant ON quote_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_quote ON portal_tokens(quote_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_role_permissions_role ON auth_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_score_logs_lead ON lead_score_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_shipment_attachments_shipment ON shipment_attachments(shipment_id);

-- Enable RLS
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_score_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_score_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quote_templates
CREATE POLICY "Users can view their tenant templates" ON quote_templates
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

CREATE POLICY "Users can manage their tenant templates" ON quote_templates
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

-- RLS Policies for portal_tokens
CREATE POLICY "Users can view their quote tokens" ON portal_tokens
  FOR SELECT USING (
    quote_id IN (SELECT id FROM quotes WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

CREATE POLICY "Users can manage their quote tokens" ON portal_tokens
  FOR ALL USING (
    quote_id IN (SELECT id FROM quotes WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

-- RLS Policies for auth tables (admin only)
CREATE POLICY "Platform admins can manage auth_roles" ON auth_roles
  FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

CREATE POLICY "All authenticated can read auth_roles" ON auth_roles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Platform admins can manage auth_permissions" ON auth_permissions
  FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

CREATE POLICY "All authenticated can read auth_permissions" ON auth_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Platform admins can manage auth_role_permissions" ON auth_role_permissions
  FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

CREATE POLICY "All authenticated can read auth_role_permissions" ON auth_role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for lead_activities
CREATE POLICY "Users can view their tenant lead activities" ON lead_activities
  FOR SELECT USING (
    lead_id IN (SELECT id FROM leads WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

CREATE POLICY "Users can manage their tenant lead activities" ON lead_activities
  FOR ALL USING (
    lead_id IN (SELECT id FROM leads WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

-- RLS Policies for lead_score_config
CREATE POLICY "Users can view their tenant score config" ON lead_score_config
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

CREATE POLICY "Admins can manage score config" ON lead_score_config
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND role IN ('tenant_admin', 'platform_admin'))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

-- RLS Policies for lead_score_logs
CREATE POLICY "Users can view their tenant score logs" ON lead_score_logs
  FOR SELECT USING (
    lead_id IN (SELECT id FROM leads WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

-- RLS Policies for shipment_attachments
CREATE POLICY "Users can view their shipment attachments" ON shipment_attachments
  FOR SELECT USING (
    shipment_id IN (SELECT id FROM shipments WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

CREATE POLICY "Users can manage their shipment attachments" ON shipment_attachments
  FOR ALL USING (
    shipment_id IN (SELECT id FROM shipments WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

-- Update triggers
CREATE TRIGGER update_quote_templates_updated_at BEFORE UPDATE ON quote_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_auth_roles_updated_at BEFORE UPDATE ON auth_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lead_score_config_updated_at BEFORE UPDATE ON lead_score_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();