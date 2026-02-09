-- Migration: 20260222180000_domain_health.sql
-- Description: Adds table for Domain Health (SPF/DKIM/DMARC verification)

CREATE TABLE IF NOT EXISTS public.compliance_domain_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    spf_verified BOOLEAN DEFAULT false,
    dkim_verified BOOLEAN DEFAULT false,
    dmarc_verified BOOLEAN DEFAULT false,
    dns_records JSONB DEFAULT '{}'::jsonb, -- Stores expected vs actual records
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.compliance_domain_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant admins can manage domain verifications" ON public.compliance_domain_verifications
    FOR ALL
    TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_domain_verifications_modtime ON public.compliance_domain_verifications;
CREATE TRIGGER update_domain_verifications_modtime
    BEFORE UPDATE ON public.compliance_domain_verifications
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
