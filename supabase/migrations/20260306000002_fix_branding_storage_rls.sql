-- Migration: Fix Branding Storage RLS
-- Description: Updates storage policies for organization-assets to allow Platform Admins full access and safer UUID comparison.
-- Date: 2026-03-06

BEGIN;

--------------------------------------------------------------------------------
-- Update Storage Policies (RLS) for Organization Assets
--------------------------------------------------------------------------------

-- Policy: Authenticated Upload Access (Tenant Isolation + Admin Access)
DROP POLICY IF EXISTS "Authenticated Upload Access for Organization Assets" ON storage.objects;
CREATE POLICY "Authenticated Upload Access for Organization Assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'organization-assets' AND
    (
        -- Allow Platform Admins full access (unless masquerading, in which case they fall through to tenant check)
        public.is_platform_admin(auth.uid())
        OR
        -- Allow Tenant Users (and Masquerading Admins) access to their specific tenant folder
        -- Use text comparison to avoid UUID cast errors on invalid folder names
        (storage.foldername(name))[1] = (select public.get_user_tenant_id(auth.uid()))::text
    )
);

-- Policy: Authenticated Update Access (Tenant Isolation + Admin Access)
DROP POLICY IF EXISTS "Authenticated Update Access for Organization Assets" ON storage.objects;
CREATE POLICY "Authenticated Update Access for Organization Assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'organization-assets' AND
    (
        public.is_platform_admin(auth.uid())
        OR
        (storage.foldername(name))[1] = (select public.get_user_tenant_id(auth.uid()))::text
    )
);

-- Policy: Authenticated Delete Access (Tenant Isolation + Admin Access)
DROP POLICY IF EXISTS "Authenticated Delete Access for Organization Assets" ON storage.objects;
CREATE POLICY "Authenticated Delete Access for Organization Assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'organization-assets' AND
    (
        public.is_platform_admin(auth.uid())
        OR
        (storage.foldername(name))[1] = (select public.get_user_tenant_id(auth.uid()))::text
    )
);

COMMIT;
