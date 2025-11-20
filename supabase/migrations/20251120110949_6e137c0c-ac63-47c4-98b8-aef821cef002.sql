-- Clean up duplicate audit log triggers and ensure they fire BEFORE delete

-- Remove any existing triggers for version/option logging
DROP TRIGGER IF EXISTS trigger_log_version_changes ON quotation_versions;
DROP TRIGGER IF EXISTS trigger_log_option_changes ON quotation_version_options;
DROP TRIGGER IF EXISTS log_version_changes_trigger ON quotation_versions;
DROP TRIGGER IF EXISTS log_option_changes_trigger ON quotation_version_options;

-- Recreate a single BEFORE trigger on each table so parent rows still exist
CREATE TRIGGER trigger_log_version_changes
  BEFORE INSERT OR UPDATE OR DELETE ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION log_version_changes();

CREATE TRIGGER trigger_log_option_changes
  BEFORE INSERT OR UPDATE OR DELETE ON quotation_version_options
  FOR EACH ROW
  EXECUTE FUNCTION log_option_changes();