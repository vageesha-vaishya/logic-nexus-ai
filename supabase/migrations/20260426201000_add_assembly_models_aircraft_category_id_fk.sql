-- DB-VERIFICATION: assembly-models-aircraft-category-fk-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

ALTER TABLE public.assembly_models
  ADD COLUMN IF NOT EXISTS aircraft_category_id uuid NULL;

COMMENT ON COLUMN public.assembly_models.aircraft_category_id IS
  'Optional aircraft category reference to public.aircraft_categories(id).';

CREATE INDEX IF NOT EXISTS idx_assembly_models_aircraft_category_id
  ON public.assembly_models (aircraft_category_id);

DO $$
DECLARE
  v_column_attnum smallint;
  v_fk_exists boolean := false;
BEGIN
  IF to_regclass('public.assembly_models') IS NULL
     OR to_regclass('public.aircraft_categories') IS NULL THEN
    RETURN;
  END IF;

  SELECT attnum
  INTO v_column_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.assembly_models'::regclass
    AND attname = 'aircraft_category_id'
    AND NOT attisdropped;

  IF v_column_attnum IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = 'public.assembly_models'::regclass
      AND con.contype = 'f'
      AND con.confrelid = 'public.aircraft_categories'::regclass
      AND con.conkey = ARRAY[v_column_attnum]
  ) INTO v_fk_exists;

  IF NOT v_fk_exists THEN
    ALTER TABLE public.assembly_models
      ADD CONSTRAINT assembly_models_aircraft_category_id_fkey
      FOREIGN KEY (aircraft_category_id)
      REFERENCES public.aircraft_categories (id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;

