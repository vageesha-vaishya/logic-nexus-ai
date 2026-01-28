-- Migration: Add Tenant Nexus Table
-- Description: Links tenants to tax jurisdictions to define where they have tax obligations.

CREATE TABLE IF NOT EXISTS finance.tenant_nexus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  jurisdiction_id UUID NOT NULL REFERENCES finance.tax_jurisdictions(id) ON DELETE CASCADE,
  registration_number VARCHAR(100), -- VAT/GST/Sales Tax ID
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE, -- NULL means active indefinitely
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tenant_nexus_unique_active UNIQUE (tenant_id, jurisdiction_id)
);

-- Enable RLS
ALTER TABLE finance.tenant_nexus ENABLE ROW LEVEL SECURITY;

-- Policies
-- Tenant admins can view and manage their own nexus
CREATE POLICY "Tenant admins can manage own nexus" ON finance.tenant_nexus
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Platform admins can manage all
CREATE POLICY "Platform admins can manage all nexus" ON finance.tenant_nexus
  USING (is_platform_admin(auth.uid()));
