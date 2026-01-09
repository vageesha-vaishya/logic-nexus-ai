-- ==========================================
-- PHASE 3: CRM TABLES
-- ==========================================
-- Execute this after Phase 2

-- Drop existing CRM tables (reverse dependency order)
DROP TABLE IF EXISTS emails CASCADE;
DROP TABLE IF EXISTS campaign_members CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS opportunity_line_items CASCADE;
DROP TABLE IF EXISTS opportunities CASCADE;
DROP TABLE IF EXISTS lead_assignment_history CASCADE;
DROP TABLE IF EXISTS lead_assignment_queue CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- NOTE: These tables already dropped in script 01, but including for safety

-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
  parent_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  account_type account_type DEFAULT 'prospect',
  status account_status DEFAULT 'active',
  industry TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  billing_address JSONB DEFAULT '{}',
  shipping_address JSONB DEFAULT '{}',
  annual_revenue NUMERIC,
  employee_count INTEGER,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  address JSONB DEFAULT '{}',
  linkedin_url TEXT,
  is_primary BOOLEAN DEFAULT false,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  status lead_status DEFAULT 'new',
  source lead_source DEFAULT 'other',
  estimated_value NUMERIC,
  expected_close_date DATE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  converted_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT,
  notes TEXT,
  lead_score INTEGER DEFAULT 0,
  last_activity_date TIMESTAMPTZ,
  conversion_probability INTEGER,
  qualification_status TEXT DEFAULT 'unqualified',
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lead Assignment Queue
CREATE TABLE IF NOT EXISTS lead_assignment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  assignment_method TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lead Assignment History
CREATE TABLE IF NOT EXISTS lead_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  assigned_from UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignment_method TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Opportunities
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  stage opportunity_stage NOT NULL DEFAULT 'prospecting',
  amount NUMERIC,
  probability INTEGER,
  close_date DATE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT,
  notes TEXT,
  next_step TEXT,
  loss_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- Opportunity Line Items
CREATE TABLE IF NOT EXISTS opportunity_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  product_code TEXT,
  product_name TEXT,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  tax_percent NUMERIC DEFAULT 0,
  line_total NUMERIC DEFAULT 0,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activities
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  activity_type activity_type NOT NULL,
  status activity_status DEFAULT 'planned',
  priority priority_level DEFAULT 'medium',
  description TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  campaign_type TEXT,
  status TEXT DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  budget NUMERIC,
  actual_cost NUMERIC,
  expected_revenue NUMERIC,
  expected_response INTEGER,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Campaign Members
CREATE TABLE IF NOT EXISTS campaign_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'sent',
  responded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Emails
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
  account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id TEXT,
  thread_id TEXT,
  from_address TEXT NOT NULL,
  to_addresses JSONB DEFAULT '[]',
  cc_addresses JSONB DEFAULT '[]',
  bcc_addresses JSONB DEFAULT '[]',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  folder TEXT DEFAULT 'inbox',
  attachments JSONB DEFAULT '[]',
  labels JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_franchise_id ON accounts(franchise_id);
CREATE INDEX idx_contacts_account ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_franchise_id ON contacts(franchise_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_franchise_id ON leads(franchise_id);
CREATE INDEX idx_leads_owner ON leads(owner_id);
CREATE INDEX idx_opportunities_account ON opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_id ON opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_franchise_id ON opportunities(franchise_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_id ON activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activities_franchise_id ON activities(franchise_id);
CREATE INDEX idx_activities_assigned ON activities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_franchise_id ON campaigns(franchise_id);
CREATE INDEX idx_emails_account ON emails(account_id);
CREATE INDEX IF NOT EXISTS idx_emails_franchise_id ON emails(franchise_id);

-- Triggers
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_opportunity_line_items_updated_at BEFORE UPDATE ON opportunity_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER INDEX IF EXISTS idx_leads_tenant RENAME TO idx_leads_tenant_id;
ALTER INDEX IF EXISTS idx_leads_franchise RENAME TO idx_leads_franchise_id;
ALTER INDEX IF EXISTS idx_opportunities_tenant RENAME TO idx_opportunities_tenant_id;
ALTER INDEX IF EXISTS idx_activities_tenant RENAME TO idx_activities_tenant_id;
ALTER INDEX IF EXISTS idx_campaigns_tenant RENAME TO idx_campaigns_tenant_id;
ALTER INDEX IF EXISTS idx_accounts_tenant RENAME TO idx_accounts_tenant_id;
ALTER INDEX IF EXISTS idx_accounts_franchise RENAME TO idx_accounts_franchise_id;
ALTER INDEX IF EXISTS idx_contacts_tenant RENAME TO idx_contacts_tenant_id;
