-- Migration: Enhance quotation versioning system
-- Description: Adds audit logging, status tracking, and archiving capabilities to quotation_versions

-- 1. Add status enum if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quotation_version_status') THEN
        CREATE TYPE quotation_version_status AS ENUM ('draft', 'active', 'archived', 'deleted');
    END IF;
END $$;

-- 2. Enhance quotation_versions table
ALTER TABLE quotation_versions 
    ADD COLUMN IF NOT EXISTS status quotation_version_status DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS parent_version_id UUID REFERENCES quotation_versions(id),
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Create audit log table for versions
CREATE TABLE IF NOT EXISTS quotation_version_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_version_id UUID NOT NULL REFERENCES quotation_versions(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'CREATED', 'UPDATED', 'STATUS_CHANGE', 'PURGED'
    performed_by UUID REFERENCES auth.users(id),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_quotation_versions_status ON quotation_versions(status);
CREATE INDEX IF NOT EXISTS idx_quotation_version_audit_logs_version_id ON quotation_version_audit_logs(quotation_version_id);

-- 5. Enable RLS on audit logs
ALTER TABLE quotation_version_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their tenant" 
ON quotation_version_audit_logs FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM quotation_versions qv
        JOIN quotes q ON qv.quote_id = q.id
        WHERE qv.id = quotation_version_audit_logs.quotation_version_id
        AND q.tenant_id = get_user_tenant_id(auth.uid())
    )
);

-- 6. Function to handle soft delete
CREATE OR REPLACE FUNCTION soft_delete_quotation_version(version_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE quotation_versions
    SET status = 'deleted',
        updated_at = NOW()
    WHERE id = version_id;

    INSERT INTO quotation_version_audit_logs (quotation_version_id, action, performed_by, details)
    VALUES (version_id, 'DELETED', user_id, '{"type": "soft_delete"}'::jsonb);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to purge old versions (Retention Policy)
CREATE OR REPLACE FUNCTION purge_old_quotation_versions(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    purged_count INTEGER;
BEGIN
    WITH deleted_rows AS (
        DELETE FROM quotation_versions
        WHERE status = 'archived' 
        AND created_at < NOW() - (retention_days || ' days')::INTERVAL
        AND is_active = false
        RETURNING id
    )
    SELECT COUNT(*) INTO purged_count FROM deleted_rows;
    
    RETURN purged_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
