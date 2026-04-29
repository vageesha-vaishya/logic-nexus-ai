-- DB-VERIFICATION: aircraft-template-counters-model-json-sync-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

ALTER TABLE public.aircraft_template_counters
  ADD COLUMN IF NOT EXISTS model_json jsonb;

ALTER TABLE public.aircraft_template_counters
  ALTER COLUMN model_json SET DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.aircraft_template_counters.model_json IS
  'Denormalized copy of aircraft_template.model_json for template-counter lookups.';

CREATE OR REPLACE FUNCTION public.sync_aircraft_template_counters_model_json()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.model_json := COALESCE(
    (
      SELECT at.model_json
      FROM public.aircraft_template at
      WHERE at.id = NEW.template_id
      LIMIT 1
    ),
    '[]'::jsonb
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_aircraft_template_counters_model_json
ON public.aircraft_template_counters;

CREATE TRIGGER trg_sync_aircraft_template_counters_model_json
BEFORE INSERT OR UPDATE OF template_id
ON public.aircraft_template_counters
FOR EACH ROW
EXECUTE FUNCTION public.sync_aircraft_template_counters_model_json();

CREATE OR REPLACE FUNCTION public.propagate_aircraft_template_model_json_to_counters()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.aircraft_template_counters
  SET model_json = COALESCE(NEW.model_json, '[]'::jsonb)
  WHERE template_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_aircraft_template_model_json_to_counters
ON public.aircraft_template;

CREATE TRIGGER trg_propagate_aircraft_template_model_json_to_counters
AFTER UPDATE OF model_json
ON public.aircraft_template
FOR EACH ROW
EXECUTE FUNCTION public.propagate_aircraft_template_model_json_to_counters();

UPDATE public.aircraft_template_counters atc
SET model_json = COALESCE(at.model_json, '[]'::jsonb)
FROM public.aircraft_template at
WHERE at.id = atc.template_id;

UPDATE public.aircraft_template_counters
SET model_json = '[]'::jsonb
WHERE model_json IS NULL;

ALTER TABLE public.aircraft_template_counters
  ALTER COLUMN model_json SET NOT NULL;

COMMIT;
