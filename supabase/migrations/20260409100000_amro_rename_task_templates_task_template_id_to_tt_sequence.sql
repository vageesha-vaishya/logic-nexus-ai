BEGIN;

DO $migration$
DECLARE
  has_old_column boolean;
  has_new_column boolean;
BEGIN
  IF to_regclass('public.task_templates') IS NULL THEN
    RAISE EXCEPTION 'Table public.task_templates does not exist';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'task_template_id'
  ) INTO has_old_column;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'tt_sequence'
  ) INTO has_new_column;

  IF has_old_column AND has_new_column THEN
    RAISE EXCEPTION 'Both task_template_id and tt_sequence exist on public.task_templates; manual reconciliation required';
  END IF;

  IF has_old_column THEN
    ALTER TABLE public.task_templates
      RENAME COLUMN task_template_id TO tt_sequence;
  END IF;

  IF to_regclass('public.task_templates_task_template_id_seq') IS NOT NULL
    AND to_regclass('public.task_templates_tt_sequence_seq') IS NULL THEN
    ALTER SEQUENCE public.task_templates_task_template_id_seq
      RENAME TO task_templates_tt_sequence_seq;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND constraint_name = 'task_templates_task_template_id_key'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND constraint_name = 'task_templates_tt_sequence_key'
  ) THEN
    ALTER TABLE public.task_templates
      RENAME CONSTRAINT task_templates_task_template_id_key TO task_templates_tt_sequence_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'tt_sequence'
      AND is_identity = 'YES'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Verification failed: public.task_templates.tt_sequence is not identity and NOT NULL';
  END IF;
END
$migration$;

COMMENT ON COLUMN public.task_templates.tt_sequence IS
  'Human-readable tenant-scoped sequence for task templates (renamed from task_template_id). UUID primary key remains in id.';

COMMIT;
