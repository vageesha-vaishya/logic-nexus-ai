-- Enable audit logging for Domain/Service Architecture tables
-- Depends on: 20260131235000_comprehensive_domain_seeding.sql

BEGIN;

-- 0. Ensure audit_row_change function exists
CREATE OR REPLACE FUNCTION audit_row_change()
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
  
  -- Attempt to get IP (might be null in some contexts)
  BEGIN
    v_ip := inet_client_addr()::TEXT;
  EXCEPTION WHEN OTHERS THEN
    v_ip := 'unknown';
  END;

  -- Attempt to get tenant/franchise from user_roles if possible
  -- We use a safe approach avoiding errors if functions don't exist
  BEGIN
    v_tenant := public.get_user_tenant_id(auth.uid());
  EXCEPTION WHEN OTHERS THEN
    v_tenant := NULL;
  END;

  BEGIN
    v_franchise := public.get_user_franchise_id(auth.uid());
  EXCEPTION WHEN OTHERS THEN
    v_franchise := NULL;
  END;

  -- Build details
  IF TG_OP = 'DELETE' THEN
      v_details := to_jsonb(OLD);
  ELSIF TG_OP = 'INSERT' THEN
      v_details := to_jsonb(NEW);
  ELSE
      v_details := jsonb_build_object(
          'old', to_jsonb(OLD),
          'new', to_jsonb(NEW)
      );
  END IF;

  INSERT INTO audit_logs(
      user_id, 
      action, 
      resource_type, 
      resource_id, 
      ip_address, 
      details, 
      tenant_id, 
      franchise_id, 
      created_at
  )
  VALUES (
    auth.uid(),
    v_action,
    v_resource_type,
    v_resource_id,
    v_ip::inet, -- Cast back to inet if table requires it, or text if altered
    v_details,
    v_tenant,
    v_franchise,
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 1. Platform Domains
DROP TRIGGER IF EXISTS audit_platform_domains ON platform_domains;
CREATE TRIGGER audit_platform_domains
AFTER INSERT OR UPDATE OR DELETE ON platform_domains
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- 2. Service Categories
DROP TRIGGER IF EXISTS audit_service_categories ON service_categories;
CREATE TRIGGER audit_service_categories
AFTER INSERT OR UPDATE OR DELETE ON service_categories
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- 3. Service Types
DROP TRIGGER IF EXISTS audit_service_types ON service_types;
CREATE TRIGGER audit_service_types
AFTER INSERT OR UPDATE OR DELETE ON service_types
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- 4. Service Modes
DROP TRIGGER IF EXISTS audit_service_modes ON service_modes;
CREATE TRIGGER audit_service_modes
AFTER INSERT OR UPDATE OR DELETE ON service_modes
FOR EACH ROW EXECUTE FUNCTION audit_row_change();

COMMIT;
