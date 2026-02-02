-- Migration: Secure Vendor Storage, RLS, and Data Retention
-- Description: Fixes weak RLS, secures storage bucket, and adds retention logic

BEGIN;

-- 1. Fix RLS on Vendor Documents
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.vendor_documents;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.vendor_documents;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.vendor_documents;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.vendor_documents;

CREATE POLICY "Platform Admin Full Access Documents" ON public.vendor_documents
    FOR ALL
    USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant Access Documents" ON public.vendor_documents
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

-- 2. Fix RLS on Vendor Contracts
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.vendor_contracts;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.vendor_contracts;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.vendor_contracts;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.vendor_contracts;

CREATE POLICY "Platform Admin Full Access Contracts" ON public.vendor_contracts
    FOR ALL
    USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant Access Contracts" ON public.vendor_contracts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_contracts.vendor_id
            AND (
                v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
                OR v.tenant_id IS NULL
            )
        )
    );

-- 3. Secure Storage Bucket (vendor-documents)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-documents', 'vendor-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing weak storage policies if any
DROP POLICY IF EXISTS "Vendor Docs Access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload vendor docs" ON storage.objects;

-- Create Tenant-Aware Storage Policies
CREATE POLICY "Vendor Docs Tenant Access" ON storage.objects
FOR ALL
USING (
    bucket_id = 'vendor-documents'
    AND auth.role() = 'authenticated'
    AND EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.id::text = (storage.foldername(name))[1]
        AND (
            v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
            OR v.tenant_id IS NULL
        )
    )
)
WITH CHECK (
    bucket_id = 'vendor-documents'
    AND auth.role() = 'authenticated'
    AND EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.id::text = (storage.foldername(name))[1]
        AND (
            v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
            OR v.tenant_id IS NULL
        )
    )
);

-- 4. Data Retention Function
-- Function to identify expired documents
CREATE OR REPLACE FUNCTION public.get_expired_vendor_documents(p_days_grace integer DEFAULT 30)
RETURNS TABLE (
    id UUID,
    vendor_id UUID,
    name TEXT,
    expiry_date DATE,
    file_path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT vd.id, vd.vendor_id, vd.name, vd.expiry_date, vd.file_path
    FROM public.vendor_documents vd
    WHERE vd.expiry_date < (current_date - p_days_grace)
    AND vd.status != 'archived';
END;
$$;

COMMIT;
