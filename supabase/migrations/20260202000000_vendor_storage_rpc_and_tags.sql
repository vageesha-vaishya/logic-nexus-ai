-- Migration: Vendor Storage RPCs and Metadata Enhancements
-- Description: Adds tags/folder columns and storage management functions

BEGIN;

-- 1. Add Metadata Columns
ALTER TABLE public.vendor_documents 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS folder text DEFAULT 'General';

ALTER TABLE public.vendor_contracts 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. Create Storage Management Functions

-- Function to increment (or decrement) storage usage
CREATE OR REPLACE FUNCTION public.increment_vendor_storage(
    p_vendor_id UUID,
    p_bytes BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.vendor_storage_usage (vendor_id, total_bytes_used, file_count)
    VALUES (p_vendor_id, p_bytes, 1)
    ON CONFLICT (vendor_id) DO UPDATE
    SET 
        total_bytes_used = vendor_storage_usage.total_bytes_used + p_bytes,
        file_count = vendor_storage_usage.file_count + (CASE WHEN p_bytes > 0 THEN 1 ELSE -1 END),
        updated_at = now();
END;
$$;

-- Function to check quota availability
-- Returns remaining bytes. If negative, over quota.
-- Default quota: 1GB (1073741824 bytes)
CREATE OR REPLACE FUNCTION public.check_vendor_storage_quota(
    p_vendor_id UUID,
    p_new_bytes BIGINT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_usage BIGINT;
    v_quota BIGINT := 1073741824; -- 1GB
BEGIN
    SELECT total_bytes_used INTO v_current_usage
    FROM public.vendor_storage_usage
    WHERE vendor_id = p_vendor_id;

    IF v_current_usage IS NULL THEN
        v_current_usage := 0;
    END IF;

    RETURN (v_current_usage + p_new_bytes) <= v_quota;
END;
$$;

-- 3. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_vendor_storage TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_vendor_storage_quota TO authenticated;

COMMIT;
