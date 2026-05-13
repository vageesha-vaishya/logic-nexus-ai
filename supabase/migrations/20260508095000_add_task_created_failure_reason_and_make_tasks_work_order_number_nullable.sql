BEGIN;

ALTER TABLE flypal.flypal_configured_directives
  ADD COLUMN IF NOT EXISTS task_created_failure_reason text NULL;

COMMENT ON COLUMN flypal.flypal_configured_directives.task_created_failure_reason IS
  'Stores task creation failure reason from flypal_configured_directives_create_tasks edge function.';

ALTER TABLE public.tasks
  ALTER COLUMN work_order_number DROP NOT NULL;

COMMIT;
