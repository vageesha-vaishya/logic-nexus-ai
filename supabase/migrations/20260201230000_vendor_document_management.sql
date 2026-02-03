
-- Migration for Vendor Document Management Enhancements
-- Adds storage bucket, versioning, usage tracking, and audit triggers

BEGIN;

-- 1. Create Storage Bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-documents', 'vendor-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Update vendor_documents
ALTER TABLE public.vendor_documents
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 3. Create vendor_contract_versions
CREATE TABLE IF NOT EXISTS public.vendor_contract_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES public.vendor_contracts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    uploaded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_contract_versions_contract ON public.vendor_contract_versions(contract_id);

-- 4. Vendor Storage Usage
CREATE TABLE IF NOT EXISTS public.vendor_storage_usage (
    vendor_id UUID PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
    total_bytes_used BIGINT DEFAULT 0,
    file_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Storage Policies (RLS)
-- Allow authenticated users to upload/read files in the bucket
DROP POLICY IF EXISTS "Vendor Docs Access" ON storage.objects;
CREATE POLICY "Vendor Docs Access" ON storage.objects FOR ALL USING (
    bucket_id = 'vendor-documents' 
    AND auth.role() = 'authenticated'
) WITH CHECK (
    bucket_id = 'vendor-documents'
    AND auth.role() = 'authenticated'
);

-- 6. Enable RLS on new tables
ALTER TABLE public.vendor_contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_storage_usage ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for new tables

-- vendor_contract_versions
DROP POLICY IF EXISTS "Platform Admin Full Access Versions" ON public.vendor_contract_versions;
CREATE POLICY "Platform Admin Full Access Versions" ON public.vendor_contract_versions
    FOR ALL
    USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant Access Versions" ON public.vendor_contract_versions;
CREATE POLICY "Tenant Access Versions" ON public.vendor_contract_versions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vendor_contracts vc
            JOIN public.vendors v ON v.id = vc.vendor_id
            WHERE vc.id = vendor_contract_versions.contract_id
            AND (
                v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
                OR v.tenant_id IS NULL
            )
        )
    );

-- vendor_storage_usage
DROP POLICY IF EXISTS "Platform Admin Full Access Usage" ON public.vendor_storage_usage;
CREATE POLICY "Platform Admin Full Access Usage" ON public.vendor_storage_usage
    FOR ALL
    USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant Access Usage" ON public.vendor_storage_usage;
CREATE POLICY "Tenant Access Usage" ON public.vendor_storage_usage
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_storage_usage.vendor_id
            AND (
                v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
                OR v.tenant_id IS NULL
            )
        )
    );

-- 8. Audit Triggers

-- vendor_documents
DROP TRIGGER IF EXISTS audit_vendor_documents ON public.vendor_documents;
CREATE TRIGGER audit_vendor_documents
AFTER INSERT OR UPDATE OR DELETE ON public.vendor_documents
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- vendor_contracts
DROP TRIGGER IF EXISTS audit_vendor_contracts ON public.vendor_contracts;
CREATE TRIGGER audit_vendor_contracts
AFTER INSERT OR UPDATE OR DELETE ON public.vendor_contracts
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- vendor_contract_versions
DROP TRIGGER IF EXISTS audit_vendor_contract_versions ON public.vendor_contract_versions;
CREATE TRIGGER audit_vendor_contract_versions
AFTER INSERT OR UPDATE OR DELETE ON public.vendor_contract_versions
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

COMMIT;
