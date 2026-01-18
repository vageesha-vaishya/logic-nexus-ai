-- Migration: Entity Transfer System
-- Description: Tables and functions for managing entity transfers between tenants and franchises

-- 1. Create Enums
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'transfer_status'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.transfer_status AS ENUM ('pending', 'approved', 'rejected', 'completed', 'failed');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'transfer_type'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.transfer_type AS ENUM ('tenant_to_tenant', 'tenant_to_franchise', 'franchise_to_franchise');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'transfer_entity_type'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.transfer_entity_type AS ENUM ('lead', 'opportunity', 'quote', 'shipment', 'account', 'contact', 'activity');
    END IF;
END $$;

-- 2. Create Transfer Requests Table
CREATE TABLE IF NOT EXISTS entity_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_tenant_id UUID REFERENCES tenants(id) NOT NULL,
    source_franchise_id UUID REFERENCES franchises(id), -- Nullable for Tenant level
    target_tenant_id UUID REFERENCES tenants(id) NOT NULL,
    target_franchise_id UUID REFERENCES franchises(id), -- Nullable for Tenant level
    transfer_type transfer_type NOT NULL,
    status transfer_status DEFAULT 'pending',
    requested_by UUID REFERENCES auth.users(id) NOT NULL,
    approved_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Transfer Items Table
CREATE TABLE IF NOT EXISTS entity_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID REFERENCES entity_transfers(id) ON DELETE CASCADE NOT NULL,
    entity_type transfer_entity_type NOT NULL,
    entity_id UUID NOT NULL,
    status transfer_status DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE entity_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_transfer_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- View: Users can see transfers where they are source or target admin (simplified for now to tenant access)
CREATE POLICY "Users can view transfers for their tenant" ON entity_transfers
    FOR SELECT
    USING (
        source_tenant_id IN (
            SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
        ) OR
        target_tenant_id IN (
            SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

-- Create: Users can create transfers from their tenant
CREATE POLICY "Users can create transfers from their tenant" ON entity_transfers
    FOR INSERT
    WITH CHECK (
        source_tenant_id IN (
            SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

-- Update: Target tenant admins can approve/reject, Source can cancel (if pending)
CREATE POLICY "Target admins can update status" ON entity_transfers
    FOR UPDATE
    USING (
        target_tenant_id IN (
            SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

-- Items policies inherit from parent transfer access roughly (simplified)
CREATE POLICY "View transfer items" ON entity_transfer_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM entity_transfers et 
            WHERE et.id = entity_transfer_items.transfer_id
            AND (
                et.source_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()) OR
                et.target_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
            )
        )
    );

CREATE POLICY "Create transfer items" ON entity_transfer_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM entity_transfers et 
            WHERE et.id = entity_transfer_items.transfer_id
            AND et.source_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
        )
    );

-- 6. RPC: Execute Transfer
CREATE OR REPLACE FUNCTION execute_transfer(p_transfer_id UUID, p_approver_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
    v_success_count INT := 0;
    v_fail_count INT := 0;
    v_error_msg TEXT;
BEGIN
    -- Get transfer details
    SELECT * INTO v_transfer FROM entity_transfers WHERE id = p_transfer_id;
    
    IF v_transfer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Transfer not found');
    END IF;

    IF v_transfer.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Transfer is not pending');
    END IF;

    -- Update Transfer Status to In Progress (or just process)
    UPDATE entity_transfers SET approved_by = p_approver_id, updated_at = NOW() WHERE id = p_transfer_id;

    -- Process items
    FOR v_item IN SELECT * FROM entity_transfer_items WHERE transfer_id = p_transfer_id LOOP
        BEGIN
            -- Dynamic update based on entity type
            CASE v_item.entity_type
                WHEN 'lead' THEN
                    UPDATE leads 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'opportunity' THEN
                    UPDATE opportunities 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'quote' THEN
                    UPDATE quotes 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'shipment' THEN
                    UPDATE shipments 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'account' THEN
                    UPDATE accounts 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'contact' THEN
                    UPDATE contacts 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                WHEN 'activity' THEN
                    UPDATE activities 
                    SET tenant_id = v_transfer.target_tenant_id, 
                        franchise_id = v_transfer.target_franchise_id,
                        updated_at = NOW()
                    WHERE id = v_item.entity_id;
                ELSE
                    RAISE EXCEPTION 'Unknown entity type: %', v_item.entity_type;
            END CASE;

            -- Mark item success
            UPDATE entity_transfer_items 
            SET status = 'success', updated_at = NOW() 
            WHERE id = v_item.id;
            
            v_success_count := v_success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_fail_count := v_fail_count + 1;
            v_error_msg := SQLERRM;
            
            UPDATE entity_transfer_items 
            SET status = 'failed', error_message = v_error_msg, updated_at = NOW() 
            WHERE id = v_item.id;
        END;
    END LOOP;

    -- Finalize Transfer Status
    IF v_fail_count = 0 THEN
        UPDATE entity_transfers SET status = 'completed', updated_at = NOW() WHERE id = p_transfer_id;
    ELSE
        -- If partial failure, maybe mark as completed with errors or failed?
        -- For now, let's mark as completed but items show status
        UPDATE entity_transfers SET status = 'completed', updated_at = NOW() WHERE id = p_transfer_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'processed', v_success_count + v_fail_count,
        'succeeded', v_success_count,
        'failed', v_fail_count
    );
END;
$$;
