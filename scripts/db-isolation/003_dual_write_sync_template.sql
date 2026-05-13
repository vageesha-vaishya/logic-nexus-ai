-- Template: dual-write trigger synchronization for migration transition
-- Replace placeholders:
--   module_old.table_old
--   module_new.table_new

\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION module_audit.fn_sync_old_to_new()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO module_new.table_new (id, tenant_id, payload, updated_at)
  VALUES (NEW.id, NEW.tenant_id, NEW.payload, NEW.updated_at)
  ON CONFLICT (id) DO UPDATE
  SET tenant_id = EXCLUDED.tenant_id,
      payload = EXCLUDED.payload,
      updated_at = EXCLUDED.updated_at
  WHERE module_new.table_new.updated_at <= EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_module_sync_old_to_new ON module_old.table_old;

CREATE TRIGGER trg_module_sync_old_to_new
AFTER INSERT OR UPDATE ON module_old.table_old
FOR EACH ROW
EXECUTE FUNCTION module_audit.fn_sync_old_to_new();
