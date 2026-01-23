-- Fix audit log triggers to handle FK constraints correctly
-- The issue: "BEFORE INSERT" trigger tries to log a row before it exists, causing FK violation in audit log
-- Solution: 
-- 1. INSERT must be AFTER (so row exists for FK check)
-- 2. DELETE must be BEFORE (so row still exists for FK check)
-- 3. UPDATE can be AFTER (to capture final state)

-- ==========================================
-- 1. Fix quotation_version_options trigger
-- ==========================================
DROP TRIGGER IF EXISTS log_option_changes_trigger ON quotation_version_options;

-- Trigger for INSERT and UPDATE (AFTER)
DROP TRIGGER IF EXISTS log_option_changes_trigger_insert_update ON quotation_version_options;
CREATE TRIGGER log_option_changes_trigger_insert_update
  AFTER INSERT OR UPDATE ON quotation_version_options
  FOR EACH ROW
  EXECUTE FUNCTION log_option_changes();

-- Trigger for DELETE (BEFORE)
DROP TRIGGER IF EXISTS log_option_changes_trigger_delete ON quotation_version_options;
CREATE TRIGGER log_option_changes_trigger_delete
  BEFORE DELETE ON quotation_version_options
  FOR EACH ROW
  EXECUTE FUNCTION log_option_changes();


-- ==========================================
-- 2. Fix quotation_versions trigger (consistency)
-- ==========================================
DROP TRIGGER IF EXISTS log_version_changes_trigger ON quotation_versions;

-- Trigger for INSERT and UPDATE (AFTER)
DROP TRIGGER IF EXISTS log_version_changes_trigger_insert_update ON quotation_versions;
CREATE TRIGGER log_version_changes_trigger_insert_update
  AFTER INSERT OR UPDATE ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION log_version_changes();

-- Trigger for DELETE (BEFORE)
DROP TRIGGER IF EXISTS log_version_changes_trigger_delete ON quotation_versions;
CREATE TRIGGER log_version_changes_trigger_delete
  BEFORE DELETE ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION log_version_changes();
