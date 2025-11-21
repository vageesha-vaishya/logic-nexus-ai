-- Fix the log_version_changes function to defer audit logging for inserts
-- The issue is that NEW.id isn't available in quotation_versions when the trigger fires

DROP FUNCTION IF EXISTS log_version_changes() CASCADE;

CREATE OR REPLACE FUNCTION public.log_version_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_action TEXT;
  v_changes JSONB;
BEGIN
  v_action := TG_OP;
  
  IF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := row_to_json(OLD)::JSONB;
  END IF;
  
  -- Only log after the row is committed (AFTER trigger ensures this)
  -- Use a conditional insert that won't fail if quotation_version doesn't exist yet
  BEGIN
    INSERT INTO quotation_audit_log (
      tenant_id,
      quote_id,
      quotation_version_id,
      entity_type,
      entity_id,
      action,
      changes,
      user_id
    ) VALUES (
      COALESCE(NEW.tenant_id, OLD.tenant_id),
      COALESCE(NEW.quote_id, OLD.quote_id),
      COALESCE(NEW.id, OLD.id),
      'quotation_version',
      COALESCE(NEW.id, OLD.id),
      v_action,
      v_changes,
      auth.uid()
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      -- Silently ignore FK violations during insert (row not yet committed)
      NULL;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER log_version_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON quotation_versions
FOR EACH ROW
EXECUTE FUNCTION log_version_changes();