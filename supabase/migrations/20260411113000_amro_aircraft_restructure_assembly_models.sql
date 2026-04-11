BEGIN;

CREATE TABLE IF NOT EXISTS public.aircraft_legacy_backup (
  aircraft_id uuid PRIMARY KEY,
  legacy_payload jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  v_has_aircraft_type boolean;
  v_has_manufacturer boolean;
  v_has_model boolean;
  v_has_aircraft_model boolean;
  v_has_manufacturer_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'aircraft_type'
  ) INTO v_has_aircraft_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'manufacturer'
  ) INTO v_has_manufacturer;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'model'
  ) INTO v_has_model;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'aircraft_model'
  ) INTO v_has_aircraft_model;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'manufacturer_id'
  ) INTO v_has_manufacturer_id;

  IF v_has_aircraft_type OR v_has_manufacturer OR v_has_model OR v_has_aircraft_model OR v_has_manufacturer_id THEN
    INSERT INTO public.aircraft_legacy_backup (aircraft_id, legacy_payload)
    SELECT
      ac.id,
      jsonb_strip_nulls(
        jsonb_build_object(
          'aircraft_type', CASE WHEN v_has_aircraft_type THEN ac.aircraft_type ELSE NULL END,
          'manufacturer', CASE WHEN v_has_manufacturer THEN ac.manufacturer ELSE NULL END,
          'model', CASE WHEN v_has_model THEN ac.model ELSE NULL END,
          'aircraft_model', CASE WHEN v_has_aircraft_model THEN ac.aircraft_model ELSE NULL END,
          'manufacturer_id', CASE WHEN v_has_manufacturer_id THEN ac.manufacturer_id ELSE NULL END
        )
      )
    FROM public.aircraft ac
    ON CONFLICT (aircraft_id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS assembly_models uuid;

DO $$
DECLARE
  v_has_manufacturer boolean;
  v_has_model boolean;
  v_has_aircraft_model boolean;
  v_has_manufacturer_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'manufacturer'
  ) INTO v_has_manufacturer;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'model'
  ) INTO v_has_model;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'aircraft_model'
  ) INTO v_has_aircraft_model;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft' AND column_name = 'manufacturer_id'
  ) INTO v_has_manufacturer_id;

  IF v_has_manufacturer OR v_has_model OR v_has_aircraft_model OR v_has_manufacturer_id THEN
    UPDATE public.aircraft ac
    SET assembly_models = COALESCE(
      CASE
        WHEN v_has_aircraft_model
             AND ac.aircraft_model ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (
          SELECT am.id
          FROM public.assembly_models am
          WHERE am.id::text = ac.aircraft_model
          LIMIT 1
        )
        ELSE NULL
      END,
      (
        SELECT am.id
        FROM public.assembly_models am
        LEFT JOIN public.manufacturers m ON m.id = am.manufacturer_id
        WHERE am.tenant_id = ac.tenant_id
          AND (
            (v_has_model AND lower(btrim(am.model_code)) = lower(btrim(ac.model)))
            OR (v_has_model AND lower(btrim(am.name)) = lower(btrim(ac.model)))
            OR (v_has_aircraft_model AND lower(btrim(am.model_code)) = lower(btrim(ac.aircraft_model)))
            OR (v_has_aircraft_model AND lower(btrim(am.name)) = lower(btrim(ac.aircraft_model)))
            OR (
              v_has_manufacturer AND v_has_model
              AND lower(btrim(m.name)) = lower(btrim(ac.manufacturer))
              AND (
                lower(btrim(am.model_code)) = lower(btrim(ac.model))
                OR lower(btrim(am.name)) = lower(btrim(ac.model))
              )
            )
            OR (
              v_has_manufacturer_id AND v_has_model
              AND am.manufacturer_id = ac.manufacturer_id
              AND (
                lower(btrim(am.model_code)) = lower(btrim(ac.model))
                OR lower(btrim(am.name)) = lower(btrim(ac.model))
              )
            )
          )
        ORDER BY am.is_active DESC, am.updated_at DESC NULLS LAST
        LIMIT 1
      )
    )
    WHERE ac.assembly_models IS NULL;
  END IF;
END $$;

ALTER TABLE public.aircraft
  DROP CONSTRAINT IF EXISTS aircraft_assembly_models_fkey,
  DROP CONSTRAINT IF EXISTS maintenance_tasks_assembly_models_fkey;

ALTER TABLE public.aircraft
  ADD CONSTRAINT maintenance_tasks_assembly_models_fkey
    FOREIGN KEY (assembly_models)
    REFERENCES public.assembly_models(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_aircraft_assembly_models
  ON public.aircraft(assembly_models);

ALTER TABLE public.aircraft
  DROP COLUMN IF EXISTS aircraft_type,
  DROP COLUMN IF EXISTS manufacturer,
  DROP COLUMN IF EXISTS model,
  DROP COLUMN IF EXISTS aircraft_model,
  DROP COLUMN IF EXISTS manufacturer_id;

DROP INDEX IF EXISTS idx_aircraft_manufacturer_id;

COMMIT;

-- Rollback procedure (manual, if needed):
-- 1) ADD COLUMN back:
--      aircraft_type public.aircraft_type,
--      manufacturer text,
--      model text,
--      aircraft_model text,
--      manufacturer_id uuid
-- 2) Restore data from public.aircraft_legacy_backup.legacy_payload by aircraft_id.
-- 3) DROP CONSTRAINT maintenance_tasks_assembly_models_fkey and DROP COLUMN assembly_models if required.
