-- Fix the log_version_changes trigger to use AFTER INSERT instead of BEFORE
-- This ensures the version exists before trying to log it

DROP TRIGGER IF EXISTS log_version_changes_trigger ON quotation_versions;

CREATE TRIGGER log_version_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON quotation_versions
FOR EACH ROW
EXECUTE FUNCTION log_version_changes();

-- Also fix the log_option_changes trigger
DROP TRIGGER IF EXISTS log_option_changes_trigger ON quotation_version_options;

CREATE TRIGGER log_option_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON quotation_version_options
FOR EACH ROW
EXECUTE FUNCTION log_option_changes();