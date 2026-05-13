-- Migration: Drop deprecated alias columns from public.tasks
-- Removes: sequence, steps, qualifications, assigned_to, task_completion_date, task_completion_hour
--
-- Canonical replacements:
--   sequence              → sequence_order
--   steps                 → steps_json
--   qualifications        → qualifications_json
--   assigned_to           → assigned_technician_id
--   task_completion_date  → actual_end_date (cast ::date)
--   task_completion_hour  → actual_work_hours
--
-- Pre-flight: ensure canonical columns are populated from aliases where needed
UPDATE public.tasks
SET
  sequence_order         = COALESCE(sequence_order, sequence),
  assigned_technician_id = COALESCE(assigned_technician_id, assigned_to::uuid),
  steps_json             = COALESCE(steps_json, steps),
  qualifications_json    = COALESCE(qualifications_json, qualifications),
  actual_end_date        = COALESCE(actual_end_date, task_completion_date::timestamptz),
  actual_work_hours      = COALESCE(actual_work_hours, task_completion_hour)
WHERE
  sequence_order IS NULL
  OR assigned_technician_id IS NULL
  OR steps_json IS NULL
  OR qualifications_json IS NULL
  OR (actual_end_date IS NULL AND task_completion_date IS NOT NULL)
  OR (actual_work_hours IS NULL AND task_completion_hour IS NOT NULL);

-- ─── Step 1: Drop the sync trigger (no longer needed after alias removal) ────
DROP TRIGGER IF EXISTS trg_sync_tasks_alias_columns ON public.tasks;
DROP FUNCTION IF EXISTS fn_sync_tasks_alias_columns();

-- ─── Step 2: Drop CHECK constraints that reference alias columns ──────────────
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS ck_tasks_assigned_to_matches_technician_id,
  DROP CONSTRAINT IF EXISTS ck_tasks_sequence_matches_sequence_order,
  DROP CONSTRAINT IF EXISTS ck_tasks_steps_alias_matches,
  DROP CONSTRAINT IF EXISTS ck_tasks_qualifications_alias_matches;

-- ─── Step 3: Drop indexes on alias columns ───────────────────────────────────
DROP INDEX IF EXISTS public.idx_tasks_assigned_to;

-- ─── Step 4: Drop the alias columns ─────────────────────────────────────────
ALTER TABLE public.tasks
  DROP COLUMN IF EXISTS sequence,
  DROP COLUMN IF EXISTS steps,
  DROP COLUMN IF EXISTS qualifications,
  DROP COLUMN IF EXISTS assigned_to,
  DROP COLUMN IF EXISTS task_completion_date,
  DROP COLUMN IF EXISTS task_completion_hour;

-- ─── Step 5: Update comments on canonical columns ────────────────────────────
COMMENT ON COLUMN public.tasks.sequence_order IS
  'Canonical task ordering within a work order (positive integer).';
COMMENT ON COLUMN public.tasks.assigned_technician_id IS
  'FK to auth.users; the technician assigned to this task.';
COMMENT ON COLUMN public.tasks.steps_json IS
  'Structured task steps as a JSON array or object.';
COMMENT ON COLUMN public.tasks.qualifications_json IS
  'Required qualifications/certifications as a JSON object.';
COMMENT ON COLUMN public.tasks.actual_end_date IS
  'Actual completion timestamp for the task (with time zone).';
COMMENT ON COLUMN public.tasks.actual_work_hours IS
  'Actual labour hours expended on this task.';
