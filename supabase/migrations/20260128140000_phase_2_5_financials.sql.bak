-- Migration: Phase 2.5 Financials (Taxation, Invoicing, GL)

-- Create 'finance' schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS finance;

-- ==========================================
-- 1. Taxation Module
-- ==========================================

-- Tax Jurisdictions
CREATE TABLE finance.tax_jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL, -- e.g., "US-CA", "US-NY-NYC"
  name VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES finance.tax_jurisdictions(id),
  type VARCHAR(20) NOT NULL, -- 'COUNTRY', 'STATE', 'CITY', 'DISTRICT'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tax_jurisdictions_code_key UNIQUE (code)
);

-- Tax Codes (Product Categories)
CREATE TABLE finance.tax_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL, -- e.g., "SaaS-001"
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tax Rules (Versioned)
CREATE TABLE finance.tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID REFERENCES finance.tax_jurisdictions(id),
  tax_code_id UUID REFERENCES finance.tax_codes(id), -- NULL implies "Standard Rate" for the jurisdiction
  rate DECIMAL(10, 4) NOT NULL, -- 0.0825 for 8.25%
  priority INT DEFAULT 0, -- Higher priority overrides lower in case of conflict
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
  effective_to TIMESTAMP WITH TIME ZONE, -- NULL = Current
  rule_type VARCHAR(20) DEFAULT 'STANDARD', -- 'STANDARD', 'REDUCED', 'EXEMPT'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. Invoicing Module
-- ==========================================

CREATE TABLE finance.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  customer_id UUID NOT NULL, -- Logical reference to tenant-specific customer table
  invoice_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, SENT, PAID, VOID, OVERDUE
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency VARCHAR(3) NOT NULL,
  subtotal DECIMAL(15, 2) NOT NULL,
  tax_total DECIMAL(15, 2) NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT invoices_tenant_number_key UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE finance.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES finance.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  tax_code_id UUID REFERENCES finance.tax_codes(id),
  tax_amount DECIMAL(15, 2) NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. GL Sync Module
-- ==========================================

CREATE TABLE finance.gl_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  code VARCHAR(50) NOT NULL, -- e.g., "4000"
  name VARCHAR(100) NOT NULL, -- e.g., "Sales Revenue"
  type VARCHAR(20) NOT NULL, -- 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT gl_accounts_tenant_code_key UNIQUE (tenant_id, code)
);

CREATE TABLE finance.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  reference_id UUID NOT NULL, -- Link to Invoice/Payment ID
  reference_type VARCHAR(50) NOT NULL, -- 'INVOICE', 'PAYMENT'
  sync_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SYNCED, FAILED
  external_id VARCHAR(100), -- ID in QuickBooks/Xero
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE finance.tax_jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.tax_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.gl_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.journal_entries ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for Phase 2.5 Start)
-- Tax Master Data is readable by everyone (authenticated)
CREATE POLICY "Allow read access to tax master data" ON finance.tax_jurisdictions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read access to tax codes" ON finance.tax_codes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read access to tax rules" ON finance.tax_rules FOR SELECT USING (auth.role() = 'authenticated');

-- Invoices and GL Data are Tenant-Scoped
CREATE POLICY "Tenant isolation for invoices" ON finance.invoices
    USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation for invoice_items" ON finance.invoice_items
    USING (invoice_id IN (SELECT id FROM finance.invoices WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

CREATE POLICY "Tenant isolation for gl_accounts" ON finance.gl_accounts
    USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation for journal_entries" ON finance.journal_entries
    USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));
