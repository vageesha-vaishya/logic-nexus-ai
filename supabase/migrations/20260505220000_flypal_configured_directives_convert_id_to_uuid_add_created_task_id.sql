-- Migration: convert flypal.flypal_configured_directives.id to uuid and add created_task_id
-- Author: GPT-5.3-Codex
-- Date: 2026-05-05
-- DB-VERIFICATION: flypal-configured-directives-id-uuid-and-created-task-id-reviewed
-- DB-ARCH-APPROVAL: not-required-no-create-table

BEGIN;

CREATE SCHEMA IF NOT EXISTS flypal;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_id_type text;
  v_pk_name text;
BEGIN
  IF to_regclass('flypal.flypal_configured_directives') IS NULL THEN
    RAISE EXCEPTION 'Table flypal.flypal_configured_directives does not exist.';
  END IF;

  SELECT data_type
  INTO v_id_type
  FROM information_schema.columns
  WHERE table_schema = 'flypal'
    AND table_name = 'flypal_configured_directives'
    AND column_name = 'id';

  IF v_id_type IS NULL THEN
    ALTER TABLE flypal.flypal_configured_directives
      ADD COLUMN id uuid;
    UPDATE flypal.flypal_configured_directives
    SET id = gen_random_uuid()
    WHERE id IS NULL;
    ALTER TABLE flypal.flypal_configured_directives
      ALTER COLUMN id SET DEFAULT gen_random_uuid(),
      ALTER COLUMN id SET NOT NULL;
  ELSIF v_id_type <> 'uuid' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'flypal'
        AND table_name = 'flypal_configured_directives'
        AND column_name = 'id_uuid'
    ) THEN
      ALTER TABLE flypal.flypal_configured_directives
        ADD COLUMN id_uuid uuid;
    END IF;

    UPDATE flypal.flypal_configured_directives
    SET id_uuid = gen_random_uuid()
    WHERE id_uuid IS NULL;

    ALTER TABLE flypal.flypal_configured_directives
      ALTER COLUMN id_uuid SET DEFAULT gen_random_uuid(),
      ALTER COLUMN id_uuid SET NOT NULL;

    SELECT c.conname
    INTO v_pk_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'flypal'
      AND t.relname = 'flypal_configured_directives'
      AND c.contype = 'p'
    LIMIT 1;

    IF v_pk_name IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE flypal.flypal_configured_directives DROP CONSTRAINT %I',
        v_pk_name
      );
    END IF;

    ALTER TABLE flypal.flypal_configured_directives
      DROP COLUMN id;

    ALTER TABLE flypal.flypal_configured_directives
      RENAME COLUMN id_uuid TO id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'flypal'
      AND t.relname = 'flypal_configured_directives'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE flypal.flypal_configured_directives
      ADD CONSTRAINT flypal_configured_directives_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE flypal.flypal_configured_directives
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE flypal.flypal_configured_directives
  ADD COLUMN IF NOT EXISTS created_task_id uuid;

DO $$
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'flypal'
        AND t.relname = 'flypal_configured_directives'
        AND c.conname = 'fk_flypal_cfg_directives_created_task_id'
    ) THEN
      ALTER TABLE flypal.flypal_configured_directives
        ADD CONSTRAINT fk_flypal_cfg_directives_created_task_id
        FOREIGN KEY (created_task_id)
        REFERENCES public.tasks(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_directives_created_task_id
  ON flypal.flypal_configured_directives (created_task_id);

COMMENT ON COLUMN flypal.flypal_configured_directives.id IS
  'Primary key UUID with default gen_random_uuid().';
COMMENT ON COLUMN flypal.flypal_configured_directives.created_task_id IS
  'Optional created task identifier in public.tasks.';

COMMIT;

-- ROLLBACK (manual):
-- BEGIN;
-- ALTER TABLE flypal.flypal_configured_directives
--   DROP CONSTRAINT IF EXISTS fk_flypal_cfg_directives_created_task_id;
-- DROP INDEX IF EXISTS idx_flypal_cfg_directives_created_task_id;
-- ALTER TABLE flypal.flypal_configured_directives
--   DROP COLUMN IF EXISTS created_task_id;
-- COMMIT;
