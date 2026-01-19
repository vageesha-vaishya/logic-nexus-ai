-- Migration: Fix Transfer Logic, Add Audit Logging, and Enhance Relationships
-- Description: Fixes execute_transfer function, adds audit logging, and adds FKs to profiles for easier querying

-- 1. Fix execute_transfer function (replace 'success' with 'completed')
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

            -- Mark item success (FIXED: used 'completed' instead of 'success')
            UPDATE entity_transfer_items 
            SET status = 'completed', updated_at = NOW() 
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
        -- If partial failure, mark as completed (items show individual status)
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

-- 2. Create Audit Function for Transfers
CREATE OR REPLACE FUNCTION audit_transfer_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_resource_type TEXT;
  v_resource_id UUID;
  v_ip TEXT;
  v_tenant UUID;
  v_franchise UUID;
  v_details JSONB;
BEGIN
  v_action := TG_OP;
  v_resource_type := TG_TABLE_NAME;
  v_resource_id := COALESCE(NEW.id, OLD.id);
  v_ip := COALESCE(inet_client_addr()::TEXT, 'unknown');
  v_tenant := public.get_user_tenant_id(auth.uid());
  v_franchise := public.get_user_franchise_id(auth.uid());
  
  IF TG_TABLE_NAME = 'entity_transfers' THEN
    v_details := jsonb_build_object(
      'tenant_id', v_tenant,
      'franchise_id', v_franchise,
      'source_tenant_id', COALESCE(NEW.source_tenant_id, OLD.source_tenant_id),
      'target_tenant_id', COALESCE(NEW.target_tenant_id, OLD.target_tenant_id),
      'transfer_type', COALESCE(NEW.transfer_type, OLD.transfer_type),
      'status', COALESCE(NEW.status, OLD.status)
    );
    IF TG_OP = 'UPDATE' THEN
       v_details := v_details || jsonb_build_object(
         'changes', jsonb_build_object(
           'status', jsonb_build_object('from', OLD.status, 'to', NEW.status)
         )
       );
    END IF;
  ELSIF TG_TABLE_NAME = 'entity_transfer_items' THEN
    v_details := jsonb_build_object(
      'tenant_id', v_tenant,
      'franchise_id', v_franchise,
      'transfer_id', COALESCE(NEW.transfer_id, OLD.transfer_id),
      'entity_type', COALESCE(NEW.entity_type, OLD.entity_type),
      'entity_id', COALESCE(NEW.entity_id, OLD.entity_id),
      'status', COALESCE(NEW.status, OLD.status)
    );
  END IF;

  INSERT INTO audit_logs(user_id, action, resource_type, resource_id, ip_address, details, created_at)
  VALUES (auth.uid(), v_action, v_resource_type, v_resource_id, v_ip, v_details, NOW());

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 3. Add Triggers
DROP TRIGGER IF EXISTS audit_entity_transfers ON entity_transfers;
CREATE TRIGGER audit_entity_transfers
AFTER INSERT OR UPDATE OR DELETE ON entity_transfers
FOR EACH ROW EXECUTE FUNCTION audit_transfer_change();

DROP TRIGGER IF EXISTS audit_entity_transfer_items ON entity_transfer_items;
CREATE TRIGGER audit_entity_transfer_items
AFTER INSERT OR UPDATE OR DELETE ON entity_transfer_items
FOR EACH ROW EXECUTE FUNCTION audit_transfer_change();

-- 4. Add Foreign Keys to Profiles for Querying
-- This allows referencing profiles!requested_by(email) in PostgREST
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'entity_transfers_requested_by_fkey_profiles'
  ) THEN
    ALTER TABLE entity_transfers
    ADD CONSTRAINT entity_transfers_requested_by_fkey_profiles
    FOREIGN KEY (requested_by) REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'entity_transfers_approved_by_fkey_profiles'
  ) THEN
    ALTER TABLE entity_transfers
    ADD CONSTRAINT entity_transfers_approved_by_fkey_profiles
    FOREIGN KEY (approved_by) REFERENCES profiles(id);
  END IF;
END $$;
