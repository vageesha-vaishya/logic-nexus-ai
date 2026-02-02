-- Migration to add automated retention policy enforcement
-- Created at: 2026-02-02
-- Description: Adds RPC to archive expired documents

-- Function to archive expired documents
CREATE OR REPLACE FUNCTION archive_expired_vendor_documents(p_retention_days INT DEFAULT 3650)
RETURNS TABLE (
    archived_count INT,
    archived_doc_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_archived_count INT;
    v_archived_ids UUID[];
BEGIN
    -- Identify documents to archive
    -- Criteria: Status is not 'archived' AND (expiry_date < NOW() OR (created_at < NOW() - INTERVAL 'p_retention_days days' AND expiry_date IS NULL))
    -- Note: This is a strict policy. Adjust logic as needed. 
    -- For now, we only archive if explicitly expired + 30 days grace period, OR if older than retention limit.
    
    WITH archived_docs AS (
        UPDATE vendor_documents
        SET 
            status = 'archived',
            updated_at = NOW()
        WHERE 
            status != 'archived'
            AND (
                -- Case 1: Expired more than 90 days ago
                (expiry_date IS NOT NULL AND expiry_date < (CURRENT_DATE - INTERVAL '90 days'))
                OR
                -- Case 2: Older than retention period (default 10 years)
                (created_at < (NOW() - (p_retention_days || ' days')::INTERVAL))
            )
        RETURNING id
    )
    SELECT 
        COUNT(*),
        ARRAY_AGG(id)
    INTO 
        v_archived_count,
        v_archived_ids
    FROM archived_docs;

    -- Log to audit log if any archived
    IF v_archived_count > 0 THEN
        INSERT INTO audit_logs (
            action,
            resource_type,
            resource_id,
            details,
            severity,
            created_at
        )
        VALUES (
            'ARCHIVE_DOCUMENTS',
            'vendor_documents',
            NULL, -- Batch operation
            jsonb_build_object(
                'count', v_archived_count,
                'ids', v_archived_ids,
                'reason', 'Automated Retention Policy'
            ),
            'info',
            NOW()
        );
    END IF;

    RETURN QUERY SELECT v_archived_count, v_archived_ids;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION archive_expired_vendor_documents(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_expired_vendor_documents(INT) TO service_role;
