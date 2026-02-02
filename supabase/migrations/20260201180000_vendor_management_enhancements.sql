-- Migration to enhance Vendor Management System (VRM) to World-Class Standards
-- Adds support for Onboarding Workflows, Performance Tracking, Contracts, Risk Management, and Documents.

-----------------------------------------------------------------------------
-- 1. Enhance Vendors Table
-----------------------------------------------------------------------------
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'draft' CHECK (onboarding_status IN ('draft', 'invited', 'pending_docs', 'in_review', 'approved', 'rejected', 'suspended')),
ADD COLUMN IF NOT EXISTS performance_rating NUMERIC(3,2) DEFAULT 0.00, -- 0.00 to 5.00
ADD COLUMN IF NOT EXISTS risk_rating TEXT DEFAULT 'low' CHECK (risk_rating IN ('low', 'medium', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS tax_id TEXT,
ADD COLUMN IF NOT EXISTS payment_terms TEXT, -- e.g., 'Net 30'
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-----------------------------------------------------------------------------
-- 2. Vendor Documents (Compliance & Legal)
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('insurance', 'license', 'certification', 'contract', 'nda', 'w9', 'other')),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
    expiry_date DATE,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_docs_vendor ON public.vendor_documents(vendor_id);

-----------------------------------------------------------------------------
-- 3. Vendor Contracts (Lifecycle Management)
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    contract_number TEXT,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'service_agreement' CHECK (type IN ('service_agreement', 'nda', 'sow', 'rate_agreement')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'terminated', 'renewed')),
    start_date DATE NOT NULL,
    end_date DATE,
    value NUMERIC(15,2),
    currency TEXT DEFAULT 'USD',
    auto_renew BOOLEAN DEFAULT false,
    termination_notice_days INTEGER DEFAULT 30,
    document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_contracts_vendor ON public.vendor_contracts(vendor_id);

-----------------------------------------------------------------------------
-- 4. Vendor Performance Reviews (KPIs & Scoring)
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_performance_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    review_period_start DATE NOT NULL,
    review_period_end DATE NOT NULL,
    overall_score NUMERIC(3,2) NOT NULL, -- 0.00 to 5.00
    quality_score NUMERIC(3,2),
    delivery_score NUMERIC(3,2),
    cost_score NUMERIC(3,2),
    communication_score NUMERIC(3,2),
    reviewer_id UUID REFERENCES public.profiles(id),
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor ON public.vendor_performance_reviews(vendor_id);

-----------------------------------------------------------------------------
-- 5. Vendor Risk Assessments
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    assessment_date DATE DEFAULT CURRENT_DATE,
    risk_score INTEGER, -- 0-100 (Higher is riskier)
    financial_risk TEXT CHECK (financial_risk IN ('low', 'medium', 'high')),
    operational_risk TEXT CHECK (operational_risk IN ('low', 'medium', 'high')),
    compliance_risk TEXT CHECK (compliance_risk IN ('low', 'medium', 'high')),
    mitigation_plan TEXT,
    assessed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_risk_vendor ON public.vendor_risk_assessments(vendor_id);

-----------------------------------------------------------------------------
-- 6. Enable RLS
-----------------------------------------------------------------------------
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_risk_assessments ENABLE ROW LEVEL SECURITY;

-- Policies (Standard Tenant Isolation)
-- Assuming vendors are tenant-scoped or global (tenant_id IS NULL)
-- For simplicity, we'll allow access if user belongs to the vendor's tenant (or if vendor is global)

-- Helper policy for documents
CREATE POLICY "Tenant Access" ON public.vendor_documents
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_documents.vendor_id
            AND (v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) OR v.tenant_id IS NULL)
        )
    );

CREATE POLICY "Tenant Access" ON public.vendor_contracts
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_contracts.vendor_id
            AND (v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) OR v.tenant_id IS NULL)
        )
    );

CREATE POLICY "Tenant Access" ON public.vendor_performance_reviews
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_performance_reviews.vendor_id
            AND (v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) OR v.tenant_id IS NULL)
        )
    );

CREATE POLICY "Tenant Access" ON public.vendor_risk_assessments
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_risk_assessments.vendor_id
            AND (v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) OR v.tenant_id IS NULL)
        )
    );

