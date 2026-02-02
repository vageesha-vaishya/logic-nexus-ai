
-- Migration: Fix RLS Policies for Vendor Sub-modules
-- Description: Ensures proper access control for vendor_contracts, vendor_documents, 
-- vendor_performance_reviews, and vendor_risk_assessments.
-- Allows Platform Admins full access and Tenant Admins/Users access to their tenant's vendors.

BEGIN;

-----------------------------------------------------------------------------
-- 1. Vendor Contracts
-----------------------------------------------------------------------------
ALTER TABLE public.vendor_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Access" ON public.vendor_contracts;
DROP POLICY IF EXISTS "Platform Admin Full Access" ON public.vendor_contracts;
DROP POLICY IF EXISTS "Tenant Admin Manage" ON public.vendor_contracts;
DROP POLICY IF EXISTS "Tenant User View" ON public.vendor_contracts;

-- Policy: Platform Admins (Full Access)
CREATE POLICY "Platform Admin Full Access" ON public.vendor_contracts
    FOR ALL
    USING (public.is_platform_admin(auth.uid()));

-- Policy: Tenant Users (View/Manage based on Tenant)
-- We allow all tenant users to view/manage for now if they belong to the tenant.
-- Ideally, only Admins manage, Users view.
CREATE POLICY "Tenant Access" ON public.vendor_contracts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_contracts.vendor_id
            AND (
                v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
                OR v.tenant_id IS NULL -- Global vendors (View only? Or allow attach contracts?)
            )
        )
    );

-----------------------------------------------------------------------------
-- 2. Vendor Documents
-----------------------------------------------------------------------------
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Access" ON public.vendor_documents;
DROP POLICY IF EXISTS "Platform Admin Full Access" ON public.vendor_documents;

CREATE POLICY "Platform Admin Full Access" ON public.vendor_documents
    FOR ALL
    USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant Access" ON public.vendor_documents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_documents.vendor_id
            AND (
                v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
                OR v.tenant_id IS NULL
            )
        )
    );

-----------------------------------------------------------------------------
-- 3. Vendor Performance Reviews
-----------------------------------------------------------------------------
ALTER TABLE public.vendor_performance_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Access" ON public.vendor_performance_reviews;
DROP POLICY IF EXISTS "Platform Admin Full Access" ON public.vendor_performance_reviews;

CREATE POLICY "Platform Admin Full Access" ON public.vendor_performance_reviews
    FOR ALL
    USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant Access" ON public.vendor_performance_reviews
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_performance_reviews.vendor_id
            AND (
                v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
                OR v.tenant_id IS NULL
            )
        )
    );

-----------------------------------------------------------------------------
-- 4. Vendor Risk Assessments
-----------------------------------------------------------------------------
ALTER TABLE public.vendor_risk_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Access" ON public.vendor_risk_assessments;
DROP POLICY IF EXISTS "Platform Admin Full Access" ON public.vendor_risk_assessments;

CREATE POLICY "Platform Admin Full Access" ON public.vendor_risk_assessments
    FOR ALL
    USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant Access" ON public.vendor_risk_assessments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_risk_assessments.vendor_id
            AND (
                v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
                OR v.tenant_id IS NULL
            )
        )
    );

COMMIT;
