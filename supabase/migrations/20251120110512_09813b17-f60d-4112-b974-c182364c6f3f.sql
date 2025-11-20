-- Fix quotation_audit_log foreign key constraints to allow logging of deletions
-- The issue: when deleting a version/option, the audit trigger tries to log it,
-- but the foreign key constraint prevents this because the referenced record is being deleted

-- Make quotation_version_option_id nullable and change constraint to SET NULL on delete
ALTER TABLE quotation_audit_log 
  ALTER COLUMN quotation_version_option_id DROP NOT NULL;

-- Drop and recreate the foreign key constraint with ON DELETE SET NULL
ALTER TABLE quotation_audit_log 
  DROP CONSTRAINT IF EXISTS quotation_audit_log_quotation_version_option_id_fkey;

ALTER TABLE quotation_audit_log 
  ADD CONSTRAINT quotation_audit_log_quotation_version_option_id_fkey 
  FOREIGN KEY (quotation_version_option_id) 
  REFERENCES quotation_version_options(id) 
  ON DELETE SET NULL;

-- Also update quotation_version_id to SET NULL on delete to maintain audit trail
ALTER TABLE quotation_audit_log 
  DROP CONSTRAINT IF EXISTS quotation_audit_log_quotation_version_id_fkey;

ALTER TABLE quotation_audit_log 
  ADD CONSTRAINT quotation_audit_log_quotation_version_id_fkey 
  FOREIGN KEY (quotation_version_id) 
  REFERENCES quotation_versions(id) 
  ON DELETE SET NULL;

-- Update the triggers to fire BEFORE delete to capture data before cascade
DROP TRIGGER IF EXISTS log_version_changes_trigger ON quotation_versions;
DROP TRIGGER IF EXISTS log_option_changes_trigger ON quotation_version_options;

CREATE TRIGGER log_version_changes_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON quotation_versions
  FOR EACH ROW EXECUTE FUNCTION log_version_changes();

CREATE TRIGGER log_option_changes_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON quotation_version_options
  FOR EACH ROW EXECUTE FUNCTION log_option_changes();