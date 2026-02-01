-- Enable pg_cron extension if not already enabled (requires superuser or appropriate permissions)
-- Note: In Supabase, extensions are usually managed via Dashboard, but we can try if allowed.
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to clean up old logs
CREATE OR REPLACE FUNCTION delete_old_system_logs()
RETURNS void AS $$
BEGIN
  -- Delete logs older than 30 days
  DELETE FROM system_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule the cleanup job to run daily at 3 AM
-- Note: pg_cron usage requires specific permissions. If this fails, the user needs to enable it in Supabase Dashboard.
-- We wrap it in a DO block to avoid breaking if pg_cron is not available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('cleanup-system-logs', '0 3 * * *', 'SELECT delete_old_system_logs()');
  END IF;
END
$$;

-- Alternatively, we can use pg_net to call an edge function, but a simple SQL cleanup is better for data retention.
-- If pg_cron is not available, we can't schedule it from SQL alone without an external trigger.

-- Ensure index exists for performance on created_at
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
