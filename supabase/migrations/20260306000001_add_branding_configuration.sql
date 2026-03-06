-- Migration: Add Branding Configuration
-- Description: Adds branding_settings to quotation_configuration and creates organization-assets storage bucket.
-- Date: 2026-03-06

BEGIN;

--------------------------------------------------------------------------------
-- 1. Extend Quotation Configuration Table
--------------------------------------------------------------------------------

-- Add branding_settings column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'quotation_configuration'
        AND column_name = 'branding_settings'
    ) THEN
        ALTER TABLE public.quotation_configuration
        ADD COLUMN branding_settings JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

--------------------------------------------------------------------------------
-- 2. Create Storage Bucket for Organization Assets
--------------------------------------------------------------------------------

-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-assets', 'organization-assets', true)
ON CONFLICT (id) DO NOTHING;

--------------------------------------------------------------------------------
-- 3. Storage Policies (RLS) for Organization Assets
--------------------------------------------------------------------------------

-- Enable RLS on objects if not already enabled (it usually is by default on storage.objects)

-- Policy: Public Read Access
-- Anyone can view assets in this bucket (needed for PDF generation and public links)
DROP POLICY IF EXISTS "Public Read Access for Organization Assets" ON storage.objects;
CREATE POLICY "Public Read Access for Organization Assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'organization-assets');

-- Policy: Authenticated Upload Access (Tenant Isolation)
-- Users can only upload to their tenant's folder: organization-assets/{tenant_id}/*
DROP POLICY IF EXISTS "Authenticated Upload Access for Organization Assets" ON storage.objects;
CREATE POLICY "Authenticated Upload Access for Organization Assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'organization-assets' AND
    (storage.foldername(name))[1]::uuid = (select get_user_tenant_id(auth.uid()))
);

-- Policy: Authenticated Update Access (Tenant Isolation)
-- Users can only update files in their tenant's folder
DROP POLICY IF EXISTS "Authenticated Update Access for Organization Assets" ON storage.objects;
CREATE POLICY "Authenticated Update Access for Organization Assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'organization-assets' AND
    (storage.foldername(name))[1]::uuid = (select get_user_tenant_id(auth.uid()))
);

-- Policy: Authenticated Delete Access (Tenant Isolation)
-- Users can only delete files in their tenant's folder
DROP POLICY IF EXISTS "Authenticated Delete Access for Organization Assets" ON storage.objects;
CREATE POLICY "Authenticated Delete Access for Organization Assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'organization-assets' AND
    (storage.foldername(name))[1]::uuid = (select get_user_tenant_id(auth.uid()))
);

COMMIT;
