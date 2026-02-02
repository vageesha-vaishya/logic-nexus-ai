-- Migration for Vendor Folder Management
-- Adds vendor_folders table and links documents/contracts to folders

BEGIN;

-- 1. Create vendor_folders table
CREATE TABLE IF NOT EXISTS public.vendor_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.vendor_folders(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '{"read": ["*"], "write": ["admin", "manager"]}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_folders_vendor ON public.vendor_folders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_folders_parent ON public.vendor_folders(parent_id);

-- 2. Add folder_id to vendor_documents
ALTER TABLE public.vendor_documents
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.vendor_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_documents_folder ON public.vendor_documents(folder_id);

-- 3. Add folder_id to vendor_contracts
ALTER TABLE public.vendor_contracts
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.vendor_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_contracts_folder ON public.vendor_contracts(folder_id);

-- 4. Enable RLS
ALTER TABLE public.vendor_folders ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Platform Admin
CREATE POLICY "Platform Admin Full Access Folders" ON public.vendor_folders
    FOR ALL
    USING (public.is_platform_admin(auth.uid()));

-- Tenant Access
CREATE POLICY "Tenant Access Folders" ON public.vendor_folders
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_folders.vendor_id
            AND (
                v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
                OR v.tenant_id IS NULL
            )
        )
    );

-- 6. Audit Trigger
DROP TRIGGER IF EXISTS audit_vendor_folders ON public.vendor_folders;
CREATE TRIGGER audit_vendor_folders
AFTER INSERT OR UPDATE OR DELETE ON public.vendor_folders
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- 7. Seed "General" folder for existing vendors (optional but helpful)
-- This logic is a bit complex for SQL migration without procedural code, 
-- but we can do a simple insert for vendors that don't have any folders.
INSERT INTO public.vendor_folders (vendor_id, name, permissions)
SELECT id, 'General', '{"read": ["*"], "write": ["admin", "manager"]}'::jsonb
FROM public.vendors v
WHERE NOT EXISTS (SELECT 1 FROM public.vendor_folders vf WHERE vf.vendor_id = v.id);

COMMIT;
