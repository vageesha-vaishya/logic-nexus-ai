-- Migration: Create Analytics RPC for System Logs
-- Description: Provides aggregated stats for dashboard visualization

CREATE OR REPLACE FUNCTION get_system_log_stats(
  time_range_start timestamptz DEFAULT (now() - interval '24 hours'),
  time_range_end timestamptz DEFAULT now()
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'by_level', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT level, count(*) as count
        FROM system_logs
        WHERE created_at BETWEEN time_range_start AND time_range_end
        GROUP BY level
      ) t
    ),
    'by_component', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT component, count(*) as count
        FROM system_logs
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
        FROM system_logs
        WHERE created_at BETWEEN time_range_start AND time_range_end
        GROUP BY 1
        ORDER BY 1 ASC
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_system_log_stats(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_log_stats(timestamptz, timestamptz) TO service_role;
