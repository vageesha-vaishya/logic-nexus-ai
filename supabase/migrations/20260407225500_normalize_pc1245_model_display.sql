-- Normalize model display label for known assembly model id so UI does not show raw UUID.

DO $$
DECLARE
  v_model_id uuid := 'c13e33ca-3924-4ce6-84bc-ac27458ac26a'::uuid;
  v_has_aircraft_model boolean := false;
BEGIN
  -- Ensure assembly model has readable name/model_code.
  UPDATE public.assembly_models
  SET
    name = COALESCE(NULLIF(name, ''), 'PC - 12/45'),
    model_code = COALESCE(NULLIF(model_code, ''), 'PC - 12/45'),
    updated_at = now()
  WHERE id = v_model_id;

  -- Backfill aircraft_model text only when the legacy column exists in this environment.
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_package_templates'
      AND column_name = 'aircraft_model'
  )
  INTO v_has_aircraft_model;

  IF v_has_aircraft_model THEN
    EXECUTE $sql$
      UPDATE public.work_package_templates
      SET
        aircraft_model = 'PC - 12/45',
        updated_at = now()
      WHERE model_id = 'c13e33ca-3924-4ce6-84bc-ac27458ac26a'::uuid
        AND (
          aircraft_model IS NULL
          OR btrim(aircraft_model) = ''
          OR lower(btrim(aircraft_model)) = lower('c13e33ca-3924-4ce6-84bc-ac27458ac26a')
        )
    $sql$;
  END IF;
END $$;
