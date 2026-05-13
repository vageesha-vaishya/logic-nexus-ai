-- Replace directives.category_id with directives.directives_type_id
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review
-- Extension assessment:
--   Existing public.directives table is being extended in place to preserve backward-compatible
--   master-record continuity while replacing obsolete category relationship semantics.

BEGIN;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Drop FK constraint(s) attached to directives.category_id, regardless of generated name.
  FOR v_constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'directives'
      AND c.contype = 'f'
      AND EXISTS (
        SELECT 1
        FROM unnest(c.conkey) AS ck(attnum)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = ck.attnum
        WHERE a.attname = 'category_id'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.directives DROP CONSTRAINT IF EXISTS %I',
      v_constraint_name
    );
  END LOOP;
END $$;

ALTER TABLE public.directives
  DROP COLUMN IF EXISTS category_id,
  ADD COLUMN IF NOT EXISTS directives_type_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'directives'
      AND c.conname = 'fk_directives_directives_type_id'
  ) THEN
    ALTER TABLE public.directives
      ADD CONSTRAINT fk_directives_directives_type_id
      FOREIGN KEY (directives_type_id)
      REFERENCES public.directives_type(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_directives_directives_type_id
  ON public.directives(directives_type_id);

COMMENT ON COLUMN public.directives.directives_type_id IS
  'Directive type reference to public.directives_type.id.';

COMMIT;
