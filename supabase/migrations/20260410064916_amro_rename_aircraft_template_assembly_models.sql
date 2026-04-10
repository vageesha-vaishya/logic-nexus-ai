BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft_template'
      AND column_name = 'aircraft_model'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft_template'
      AND column_name = 'assembly_models'
  ) THEN
    EXECUTE 'ALTER TABLE public.aircraft_template RENAME COLUMN aircraft_model TO assembly_models';
  END IF;
END $$;

DO $$
DECLARE
  v_column_type text;
BEGIN
  SELECT data_type
  INTO v_column_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'aircraft_template'
    AND column_name = 'assembly_models';

  IF v_column_type IS NULL THEN
    RETURN;
  END IF;

  IF v_column_type <> 'uuid' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'aircraft_template'
        AND column_name = 'assembly_models_legacy_text'
    ) THEN
      EXECUTE 'ALTER TABLE public.aircraft_template ADD COLUMN assembly_models_legacy_text text';
    END IF;

    EXECUTE 'UPDATE public.aircraft_template SET assembly_models_legacy_text = assembly_models WHERE assembly_models_legacy_text IS NULL';

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'aircraft_template'
        AND column_name = 'assembly_models_uuid_tmp'
    ) THEN
      EXECUTE 'ALTER TABLE public.aircraft_template ADD COLUMN assembly_models_uuid_tmp uuid';
    END IF;

    EXECUTE $sql$
      UPDATE public.aircraft_template at
      SET assembly_models_uuid_tmp = COALESCE(
        CASE
          WHEN at.assembly_models ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            THEN at.assembly_models::uuid
          ELSE NULL
        END,
        (
          SELECT am.id
          FROM public.assembly_models am
          WHERE lower(btrim(am.model_code)) = lower(btrim(at.assembly_models))
             OR lower(btrim(am.name)) = lower(btrim(at.assembly_models))
             OR regexp_replace(lower(am.model_code), '[^a-z0-9]+', '', 'g') = regexp_replace(lower(at.assembly_models), '[^a-z0-9]+', '', 'g')
             OR regexp_replace(lower(am.name), '[^a-z0-9]+', '', 'g') = regexp_replace(lower(at.assembly_models), '[^a-z0-9]+', '', 'g')
          ORDER BY am.is_active DESC, am.updated_at DESC NULLS LAST
          LIMIT 1
        )
      )
      WHERE at.assembly_models IS NOT NULL
        AND btrim(at.assembly_models) <> ''
    $sql$;

    EXECUTE 'ALTER TABLE public.aircraft_template DROP COLUMN assembly_models';
    EXECUTE 'ALTER TABLE public.aircraft_template RENAME COLUMN assembly_models_uuid_tmp TO assembly_models';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'aircraft_template_assembly_models_fkey'
      AND conrelid = 'public.aircraft_template'::regclass
  ) THEN
    ALTER TABLE public.aircraft_template
      ADD CONSTRAINT aircraft_template_assembly_models_fkey
        FOREIGN KEY (assembly_models)
        REFERENCES public.assembly_models(id)
        ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
