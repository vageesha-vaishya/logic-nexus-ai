-- Optimize audit_logs table indexes for dashboard performance
-- Phase 4, Task 13: Performance Testing & Optimization

-- Create a composite index on (resource_type, created_at DESC) for faster filtered queries
-- This index helps with "Show all leads created in last hour" type queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type_created_at_desc
  ON public.audit_logs(resource_type, created_at DESC)
  WHERE created_at IS NOT NULL;

-- Create a composite index on (action, created_at DESC) for action filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at_desc
  ON public.audit_logs(action, created_at DESC)
  WHERE created_at IS NOT NULL;

-- Create index on created_at DESC to speed up "latest logs" queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc
  ON public.audit_logs(created_at DESC)
  WHERE created_at IS NOT NULL;

-- Analyze the table to update statistics for the query planner
ANALYZE public.audit_logs;

-- Display current indexes
-- SELECT schemaname, tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'audit_logs'
-- ORDER BY indexname;
