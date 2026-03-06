
-- Create tenant_profile table as requested
CREATE TABLE IF NOT EXISTS public.tenant_profile (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    legal_name TEXT,
    registered_address TEXT,
    tax_id TEXT,
    default_payment_terms TEXT,
    standard_terms_clause_id TEXT,
    emergency_contact_info JSONB,
    use_enhanced_template BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment on table
COMMENT ON TABLE public.tenant_profile IS 'Extension of tenants table to store legal and profile details for Quotation module';

-- Enable RLS
ALTER TABLE public.tenant_profile ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Tenant admins can view their profile" ON public.tenant_profile;
CREATE POLICY "Tenant admins can view their profile"
    ON public.tenant_profile
    FOR SELECT
    USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can update their profile" ON public.tenant_profile;
CREATE POLICY "Tenant admins can update their profile"
    ON public.tenant_profile
    FOR UPDATE
    USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Insert default profiles for existing tenants
INSERT INTO public.tenant_profile (tenant_id, legal_name)
SELECT id, name FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Grant permissions (adjust based on your role system, usually authenticated is enough with RLS)
GRANT SELECT, UPDATE, INSERT ON public.tenant_profile TO authenticated;
GRANT SELECT ON public.tenant_profile TO service_role;
