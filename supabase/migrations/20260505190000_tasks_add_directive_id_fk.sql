-- DB-VERIFICATION: tasks-add-directive-id-fk-reviewed
-- DB-ARCH-APPROVAL: not-required-no-create-table

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE EXCEPTION 'Table public.tasks does not exist.';
  END IF;

  IF to_regclass('public.directives') IS NULL THEN
    RAISE EXCEPTION 'Table public.directives does not exist.';
  END IF;
END $$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS directive_id uuid NULL;

-- Existing rows are preserved. If legacy data contains invalid UUID references,
-- normalize them to NULL so FK creation is non-breaking.
UPDATE public.tasks t
SET directive_id = NULL
WHERE t.directive_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.directives d
    WHERE d.id = t.directive_id
  );

CREATE INDEX IF NOT EXISTS idx_tasks_directive_id
  ON public.tasks(directive_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tasks'
      AND c.conname = 'tasks_directive_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_directive_id_fkey
      FOREIGN KEY (directive_id)
      REFERENCES public.directives(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.tasks.directive_id IS
  'Optional reference to public.directives(id) for directive-linked tasks.';

COMMIT;
