
-- Create vendor_document_versions table
CREATE TABLE IF NOT EXISTS public.vendor_document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.vendor_documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    comments TEXT,
    UNIQUE(document_id, version_number)
);

-- Enable RLS
ALTER TABLE public.vendor_document_versions ENABLE ROW LEVEL SECURITY;

-- Policies (matching vendor_documents)
DROP POLICY IF EXISTS "Vendor document versions are viewable by tenant users" ON public.vendor_document_versions;
CREATE POLICY "Vendor document versions are viewable by tenant users"
    ON public.vendor_document_versions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.vendor_documents d
            JOIN public.vendors v ON v.id = d.vendor_id
            WHERE d.id = vendor_document_versions.document_id
            AND (v.tenant_id = (select auth.jwt() ->> 'tenant_id')::uuid OR v.tenant_id IS NULL)
        )
    );

DROP POLICY IF EXISTS "Vendor document versions are insertable by tenant users" ON public.vendor_document_versions;
CREATE POLICY "Vendor document versions are insertable by tenant users"
    ON public.vendor_document_versions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.vendor_documents d
            JOIN public.vendors v ON v.id = d.vendor_id
            WHERE d.id = vendor_document_versions.document_id
            AND (v.tenant_id = (select auth.jwt() ->> 'tenant_id')::uuid OR v.tenant_id IS NULL)
        )
    );

DROP POLICY IF EXISTS "Vendor document versions are deletable by tenant admins" ON public.vendor_document_versions;
CREATE POLICY "Vendor document versions are deletable by tenant admins"
    ON public.vendor_document_versions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.vendor_documents d
            JOIN public.vendors v ON v.id = d.vendor_id
            WHERE d.id = vendor_document_versions.document_id
            AND (v.tenant_id = (select auth.jwt() ->> 'tenant_id')::uuid OR v.tenant_id IS NULL)
        )
        AND 
        (
            (select auth.jwt() ->> 'role') = 'admin' 
            OR 
            (select auth.jwt() ->> 'role') = 'platform_admin'
        )
    );
