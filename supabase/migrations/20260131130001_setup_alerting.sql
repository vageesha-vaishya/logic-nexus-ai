-- Migration: Setup Alerting Trigger for Critical Logs

-- 1. Create a function to process critical logs
-- This function is a hook point for external notifications (Slack, Email, PagerDuty)
CREATE OR REPLACE FUNCTION public.process_critical_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- payload JSONB;
BEGIN
    -- Check if pg_net extension is available (commented out as it might not be enabled)
    -- IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    --     payload := jsonb_build_object('record', row_to_json(NEW));
    --     PERFORM net.http_post(
    --         url := current_setting('app.settings.edge_function_url', true) || '/alert-notifier',
    --         headers := '{"Content-Type": "application/json"}',
    --         body := payload
    --     );
    -- END IF;

    -- For now, we rely on Supabase Dashboard Webhooks which are configured outside SQL
    -- or Polling services.
    -- This function ensures we have a database-level hook point.
    
    RETURN NEW;
END;
$$;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS trg_critical_log_alert ON public.system_logs;

CREATE TRIGGER trg_critical_log_alert
    AFTER INSERT ON public.system_logs
    FOR EACH ROW
    WHEN (NEW.level = 'CRITICAL')
    EXECUTE FUNCTION public.process_critical_log();
