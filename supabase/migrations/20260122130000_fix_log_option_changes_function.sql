CREATE OR REPLACE FUNCTION log_option_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Wrap insert in exception block to handle potential FK race conditions
  BEGIN
    INSERT INTO quotation_audit_log (
      tenant_id,
      quotation_version_id,
      quotation_version_option_id,
      entity_type,
      entity_id,
      action,
      changes,
      user_id
    ) VALUES (
      COALESCE(NEW.tenant_id, OLD.tenant_id),
      COALESCE(NEW.quotation_version_id, OLD.quotation_version_id),
      COALESCE(NEW.id, OLD.id),
      'quotation_version_option',
      COALESCE(NEW.id, OLD.id),
      v_action,
      v_changes,
      auth.uid()
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      -- Silently ignore FK violations during insert
      -- This can happen if the parent record is not yet fully visible to the trigger
      NULL;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;
