-- Migration: Audit Pricing History
-- Description: Adds audit logging for services and service_pricing_tiers to track price history.

-- 1. Create Audit Function for Pricing Changes
CREATE OR REPLACE FUNCTION audit_pricing_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_details JSONB;
  v_resource_type TEXT;
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  v_user_id := auth.uid();
  v_action := TG_OP; -- INSERT, UPDATE, DELETE
  v_resource_type := TG_TABLE_NAME;

  -- Determine Tenant ID (try NEW, then OLD, then user's tenant)
  IF TG_OP = 'DELETE' THEN
      v_tenant_id := OLD.tenant_id;
  ELSE
      v_tenant_id := NEW.tenant_id;
  END IF;

  -- If tenant_id is still null (e.g. global service), it stays null or we could fetch from user
  IF v_tenant_id IS NULL AND v_user_id IS NOT NULL THEN
      -- Optional: Fallback to user's tenant if not in record, but for global services it should be NULL
      -- v_tenant_id := public.get_user_tenant_id(v_user_id);
  END IF;

  -- Construct Details JSON
  IF TG_OP = 'INSERT' THEN
      v_details := jsonb_build_object(
          'new_values', row_to_json(NEW)
      );
  ELSIF TG_OP = 'UPDATE' THEN
      v_details := jsonb_build_object(
          'old_values', row_to_json(OLD),
          'new_values', row_to_json(NEW),
          'changed_fields', (
              SELECT jsonb_object_agg(key, value)
              FROM jsonb_each(row_to_json(NEW)::jsonb)
              WHERE row_to_json(OLD)::jsonb -> key IS DISTINCT FROM value
          )
      );
  ELSIF TG_OP = 'DELETE' THEN
      v_details := jsonb_build_object(
          'old_values', row_to_json(OLD)
      );
  END IF;

  -- Insert into audit_logs
  -- Assuming audit_logs table exists from previous migrations
  INSERT INTO public.audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details,
      tenant_id,
      created_at
  ) VALUES (
      v_user_id,
      'PRICING_' || v_action, -- e.g. PRICING_UPDATE
      v_resource_type,        -- services or service_pricing_tiers
      COALESCE(NEW.id, OLD.id),
      v_details,
      v_tenant_id,
      NOW()
  );

  RETURN NULL; -- Return value ignored for AFTER triggers
END;
$$;

-- 2. Create Triggers

-- Trigger for Services
DROP TRIGGER IF EXISTS trg_audit_services ON public.services;
CREATE TRIGGER trg_audit_services
  AFTER INSERT OR UPDATE OR DELETE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION audit_pricing_change();

-- Trigger for Service Pricing Tiers
DROP TRIGGER IF EXISTS trg_audit_service_pricing_tiers ON public.service_pricing_tiers;
CREATE TRIGGER trg_audit_service_pricing_tiers
  AFTER INSERT OR UPDATE OR DELETE ON public.service_pricing_tiers
  FOR EACH ROW
  EXECUTE FUNCTION audit_pricing_change();
