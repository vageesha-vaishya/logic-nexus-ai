-- DB-VERIFICATION: aircraft-template-model-json-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

ALTER TABLE public.aircraft_template
  ADD COLUMN IF NOT EXISTS model_json jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.aircraft_template.model_json IS
  'Cached model payload captured at template creation to reduce hierarchy lookup calls. Example element: {"assembly_model_id":"...","assembly_model_name":"...","manufacturer":"...","aircraft_category_name":"..."}';

COMMIT;

