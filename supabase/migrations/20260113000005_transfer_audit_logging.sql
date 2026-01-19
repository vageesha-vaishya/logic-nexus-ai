-- Migration: Transfer Audit Logging
-- Description: Adds audit logging triggers for entity transfers and relationship changes

-- 1. Function to log transfer request changes
CREATE OR REPLACE FUNCTION log_transfer_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_action TEXT;
    v_details JSONB;
BEGIN
    -- Get current user ID if available, otherwise it might be a system action or null
    v_user_id := auth.uid();
    
    IF TG_OP = 'INSERT' THEN
        v_action := 'TRANSFER_CREATED';
        v_details := jsonb_build_object(
            'source_tenant_id', NEW.source_tenant_id,
            'target_tenant_id', NEW.target_tenant_id,
            'transfer_type', NEW.transfer_type,
            'status', NEW.status
        );
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'TRANSFER_UPDATED';
        v_details := jsonb_build_object(
            'old_status', OLD.status,
            'new_status', NEW.status,
            'approved_by', NEW.approved_by,
            'rejection_reason', NEW.rejection_reason
        );
        
        -- Special case for completion
        IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
            v_action := 'TRANSFER_COMPLETED';
        ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
            v_action := 'TRANSFER_REJECTED';
        ELSIF NEW.status = 'approved' AND OLD.status != 'approved' THEN
            v_action := 'TRANSFER_APPROVED';
        END IF;
    END IF;

    INSERT INTO audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        details
    ) VALUES (
        COALESCE(v_user_id, NEW.requested_by), -- Fallback to requester if auth.uid is null (e.g. background job)
        v_action,
        'entity_transfer',
        NEW.id,
        v_details
    );

    RETURN NEW;
END;
$$;

-- 2. Trigger for entity_transfers
DROP TRIGGER IF EXISTS trg_log_transfer_audit ON entity_transfers;
CREATE TRIGGER trg_log_transfer_audit
    AFTER INSERT OR UPDATE ON entity_transfers
    FOR EACH ROW
    EXECUTE FUNCTION log_transfer_audit();

-- 3. Function to log relationship changes (tenant/franchise updates) on entities
CREATE OR REPLACE FUNCTION log_relationship_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_details JSONB;
BEGIN
    -- Only log if tenant_id or franchise_id changed
    IF (OLD.tenant_id IS DISTINCT FROM NEW.tenant_id) OR (OLD.franchise_id IS DISTINCT FROM NEW.franchise_id) THEN
        v_user_id := auth.uid();
        
        v_details := jsonb_build_object(
            'old_tenant_id', OLD.tenant_id,
            'new_tenant_id', NEW.tenant_id,
            'old_franchise_id', OLD.franchise_id,
            'new_franchise_id', NEW.franchise_id,
            'change_reason', 'Entity Transfer or Admin Update' 
        );

        INSERT INTO audit_logs (
            user_id,
            action,
            resource_type,
            resource_id,
            details
        ) VALUES (
            v_user_id,
            'RELATIONSHIP_CHANGED',
            TG_TABLE_NAME, -- Use table name as resource type (e.g., 'leads', 'opportunities')
            NEW.id,
            v_details
        );
    END IF;

    RETURN NEW;
END;
$$;

-- 4. Apply relationship change trigger to relevant tables
-- Leads
DROP TRIGGER IF EXISTS trg_log_lead_rel_change ON leads;
CREATE TRIGGER trg_log_lead_rel_change
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();

-- Opportunities
DROP TRIGGER IF EXISTS trg_log_opp_rel_change ON opportunities;
CREATE TRIGGER trg_log_opp_rel_change
    AFTER UPDATE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();

-- Quotes
DROP TRIGGER IF EXISTS trg_log_quote_rel_change ON quotes;
CREATE TRIGGER trg_log_quote_rel_change
    AFTER UPDATE ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();

-- Shipments
DROP TRIGGER IF EXISTS trg_log_shipment_rel_change ON shipments;
CREATE TRIGGER trg_log_shipment_rel_change
    AFTER UPDATE ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();

-- Accounts
DROP TRIGGER IF EXISTS trg_log_account_rel_change ON accounts;
CREATE TRIGGER trg_log_account_rel_change
    AFTER UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();

-- Contacts
DROP TRIGGER IF EXISTS trg_log_contact_rel_change ON contacts;
CREATE TRIGGER trg_log_contact_rel_change
    AFTER UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();

-- Activities
DROP TRIGGER IF EXISTS trg_log_activity_rel_change ON activities;
CREATE TRIGGER trg_log_activity_rel_change
    AFTER UPDATE ON activities
    FOR EACH ROW
    EXECUTE FUNCTION log_relationship_change();
