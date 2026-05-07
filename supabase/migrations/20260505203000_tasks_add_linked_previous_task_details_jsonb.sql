-- DB-VERIFICATION: tasks-add-linked-previous-task-details-jsonb-reviewed
-- DB-ARCH-APPROVAL: not-required-no-create-table

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE EXCEPTION 'Table public.tasks does not exist.';
  END IF;
END $$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS linked_previous_task_details jsonb NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tasks.linked_previous_task_details IS
  'Optional JSON payload holding denormalized details for linked_previous_task_id.';

COMMIT;
