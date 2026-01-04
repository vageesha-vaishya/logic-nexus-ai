-- Function to cleanup old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_logs(days_to_keep int DEFAULT 90)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete logs older than the specified retention period
  DELETE FROM audit_logs
  WHERE created_at < now() - (days_to_keep || ' days')::interval;
  
  -- Log the cleanup action (optional, into a separate system log if needed, or just console output if run manually)
  RAISE NOTICE 'Deleted audit logs older than % days', days_to_keep;
END;
$$;
