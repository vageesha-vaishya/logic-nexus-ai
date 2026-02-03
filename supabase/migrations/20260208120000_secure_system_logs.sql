
-- Migration: Secure System Logs and Update Analytics RPC
-- Description: Enables RLS on system_logs, adds policies, and updates get_system_log_stats to be RLS-compliant (SECURITY INVOKER)

BEGIN;

-- 1. Enable RLS on system_logs
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can view own tenant system logs" ON public.system_logs;
DROP POLICY IF EXISTS "Platform admins can view all system logs" ON public.system_logs;
DROP POLICY IF EXISTS "Service role has full access" ON public.system_logs;

-- 3. Create RLS Policies

-- Policy for Standard Users (View own tenant logs)
CREATE POLICY "Users can view own tenant system logs"
ON public.system_logs
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- Policy for Platform Admins (View all logs)
CREATE POLICY "Platform admins can view all system logs"
ON public.system_logs
FOR SELECT
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
);

-- Policy for Service Role (Full access)
-- Implicitly bypassed usually, but good to be explicit if needed, 
-- though RLS is usually bypassed by service_role key. 
-- We'll skip explicit service_role policy as it's default behavior for superusers/service_role.

-- 4. Update get_system_log_stats to be SECURITY INVOKER
-- This ensures it respects the RLS policies defined above.
CREATE OR REPLACE FUNCTION public.get_system_log_stats(
  time_range_start timestamptz DEFAULT (now() - interval '24 hours'),
  time_range_end timestamptz DEFAULT now()
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'by_level', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT level, count(*) as count
        FROM public.system_logs
        WHERE created_at BETWEEN time_range_start AND time_range_end
        GROUP BY level
      ) t
    ),
    'by_component', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT component, count(*) as count
        FROM public.system_logs
        WHERE created_at BETWEEN time_range_start AND time_range_end
        GROUP BY component
        ORDER BY count DESC
        LIMIT 10
      ) t
    ),
    'by_hour', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT date_trunc('hour', created_at) as hour, count(*) as count
        FROM public.system_logs
        WHERE created_at BETWEEN time_range_start AND time_range_end
        GROUP BY 1
        ORDER BY 1 ASC
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMIT;
