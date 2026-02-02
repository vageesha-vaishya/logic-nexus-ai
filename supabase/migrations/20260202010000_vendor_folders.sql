-- Migration: Vendor Folders for Organization and Permissions
-- Description: Creates vendor_folders table and updates documents/contracts to link to it

BEGIN;

-- 1. Create vendor_folders table
CREATE TABLE IF NOT EXISTS public.vendor_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.vendor_folders(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '{"read": ["*"], "write": ["admin", "manager"]}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id),
    
    -- Ensure unique folder names per parent (or root) per vendor
    UNIQUE(vendor_id, parent_id, name)
);

-- 2. Add folder_id to vendor_documents and vendor_contracts
ALTER TABLE public.vendor_documents 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.vendor_folders(id) ON DELETE SET NULL;

-- 3. Enable RLS
ALTER TABLE public.vendor_folders ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Platform Admin: Full Access
CREATE POLICY "Platform Admin Full Access Folders" ON public.vendor_folders
    FOR ALL
    USING (public.is_platform_admin(auth.uid()));

-- Tenant Access: View/Edit based on tenant
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

-- 5. Helper Function to create default folders
CREATE OR REPLACE FUNCTION public.create_default_vendor_folders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.vendor_folders (vendor_id, name, permissions)
    VALUES 
    (NEW.id, 'General', '{"read": ["*"], "write": ["*"]}'::jsonb),
    (NEW.id, 'Contracts', '{"read": ["*"], "write": ["admin", "manager"]}'::jsonb),
    (NEW.id, 'Financials', '{"read": ["admin", "accountant"], "write": ["admin", "accountant"]}'::jsonb),
    (NEW.id, 'Compliance', '{"read": ["*"], "write": ["admin", "manager"]}'::jsonb);
    RETURN NEW;
END;
$$;

-- Trigger to create default folders on vendor creation
DROP TRIGGER IF EXISTS trigger_create_default_vendor_folders ON public.vendors;
CREATE TRIGGER trigger_create_default_vendor_folders
AFTER INSERT ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.create_default_vendor_folders();

-- 6. Backfill existing folders (Optional/Best Effort)
-- Create folders for existing vendors if they don't have any
INSERT INTO public.vendor_folders (vendor_id, name, permissions)
SELECT id, 'General', '{"read": ["*"], "write": ["*"]}'::jsonb
FROM public.vendors v
WHERE NOT EXISTS (SELECT 1 FROM public.vendor_folders vf WHERE vf.vendor_id = v.id);

COMMIT;
