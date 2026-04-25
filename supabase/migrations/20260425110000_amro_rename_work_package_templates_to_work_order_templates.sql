-- DB-VERIFICATION: amro-work-package-to-work-order-templates-rename-reviewed
-- DB-ARCH-APPROVAL: pending-amro-arch-board-approval
--
-- Purpose:
-- - Rename physical table public.work_package_templates -> public.work_order_templates
-- - Preserve runtime compatibility by recreating public.work_package_templates as an updatable view
-- - Rename dependent constraints/indexes that embed the legacy table name

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.work_order_templates') IS NULL
     AND to_regclass('public.work_package_templates') IS NOT NULL THEN
    ALTER TABLE public.work_package_templates RENAME TO work_order_templates;
  END IF;
END
$$;

DO $$
DECLARE
  rec record;
  new_name text;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conname LIKE '%work_package_templates%'
  LOOP
    new_name := replace(rec.conname, 'work_package_templates', 'work_order_templates');
    IF rec.conname <> new_name THEN
      EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
        (SELECT conrelid::regclass::text FROM pg_constraint WHERE conname = rec.conname LIMIT 1),
        rec.conname,
        new_name
      );
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  rec record;
  new_name text;
BEGIN
  FOR rec IN
    SELECT schemaname, indexname
    FROM pg_indexes
    WHERE indexname LIKE '%work_package_templates%'
      AND schemaname = 'public'
  LOOP
    new_name := replace(rec.indexname, 'work_package_templates', 'work_order_templates');
    IF rec.indexname <> new_name THEN
      EXECUTE format('ALTER INDEX %I.%I RENAME TO %I', rec.schemaname, rec.indexname, new_name);
    END IF;
  END LOOP;
END
$$;

DROP VIEW IF EXISTS public.work_package_templates;

CREATE VIEW public.work_package_templates AS
SELECT *
FROM public.work_order_templates;

COMMENT ON VIEW public.work_package_templates IS
  'Compatibility view for legacy callers after physical rename to public.work_order_templates.';

COMMIT;
