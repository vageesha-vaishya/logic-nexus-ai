-- DB-VERIFICATION: tasks-is-configured-drop-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- Guardrail: fail fast if any database object still references public.tasks.is_configured.
DO $$
DECLARE
  dependent_views text;
  dependent_functions text;
  dependent_triggers text;
BEGIN
  SELECT string_agg(format('%I.%I', vcu.view_schema, vcu.view_name), ', ' ORDER BY vcu.view_schema, vcu.view_name)
  INTO dependent_views
  FROM information_schema.view_column_usage vcu
  WHERE vcu.table_schema = 'public'
    AND vcu.table_name = 'tasks'
    AND vcu.column_name = 'is_configured';

  SELECT string_agg(format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)), ', ' ORDER BY n.nspname, p.proname)
  INTO dependent_functions
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prokind IN ('f', 'p')
    AND pg_get_functiondef(p.oid) ILIKE '%is_configured%';

  SELECT string_agg(format('%I.%I', n.nspname, t.tgname), ', ' ORDER BY n.nspname, t.tgname)
  INTO dependent_triggers
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND c.relname = 'tasks'
    AND n.nspname = 'public'
    AND pg_get_triggerdef(t.oid) ILIKE '%is_configured%';

  IF dependent_views IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot drop public.tasks.is_configured; dependent views found: %', dependent_views;
  END IF;

  IF dependent_functions IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot drop public.tasks.is_configured; dependent functions found: %', dependent_functions;
  END IF;

  IF dependent_triggers IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot drop public.tasks.is_configured; dependent triggers found: %', dependent_triggers;
  END IF;
END
$$;

ALTER TABLE public.tasks
  DROP COLUMN IF EXISTS is_configured;

COMMIT;

-- =============================================================================
-- Rollback Procedure (manual)
-- =============================================================================
-- BEGIN;
-- ALTER TABLE public.tasks
--   ADD COLUMN IF NOT EXISTS is_configured boolean;
-- ALTER TABLE public.tasks
--   ALTER COLUMN is_configured SET DEFAULT false;
-- UPDATE public.tasks
-- SET is_configured = false
-- WHERE is_configured IS NULL;
-- ALTER TABLE public.tasks
--   ALTER COLUMN is_configured SET NOT NULL;
-- COMMENT ON COLUMN public.tasks.is_configured IS
--   'Tracks whether task configuration has been completed (false = not configured, true = configured).';
-- COMMIT;

-- =============================================================================
-- Verification Queries (post-migration)
-- =============================================================================
-- 1) Verify column removal.
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'tasks'
--   AND column_name = 'is_configured';
--
-- 2) Verify other task columns remain intact.
-- SELECT COUNT(*) AS task_row_count FROM public.tasks;
--
-- 3) Verify constraints on tasks remain valid.
-- SELECT conname, pg_get_constraintdef(c.oid) AS definition
-- FROM pg_constraint c
-- JOIN pg_class t ON t.oid = c.conrelid
-- JOIN pg_namespace n ON n.oid = t.relnamespace
-- WHERE n.nspname = 'public'
--   AND t.relname = 'tasks'
-- ORDER BY conname;
