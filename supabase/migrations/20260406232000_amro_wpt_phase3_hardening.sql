BEGIN;

ALTER TABLE public.work_package_templates
  ADD COLUMN IF NOT EXISTS aircraft_model text;

DO $$
DECLARE
  v_null_model_count bigint := 0;
  v_check_exists boolean := false;
BEGIN
  -- 1) Prefer existing explicit relation mapping from bridge table when unique per template.
  WITH relation_model AS (
    SELECT
      r.work_package_template_id,
      MIN(r.model_id) AS model_id
    FROM public.work_package_template_task_templates r
    WHERE r.model_id IS NOT NULL
    GROUP BY r.work_package_template_id
    HAVING COUNT(DISTINCT r.model_id) = 1
  )
  UPDATE public.work_package_templates w
  SET model_id = rm.model_id
  FROM relation_model rm
  WHERE w.id = rm.work_package_template_id
    AND w.model_id IS NULL;

  -- 2) Resolve from aircraft_model token (id/model_code/name/primary_model) when unique.
  WITH unresolved AS (
    SELECT id, tenant_id, franchise_id, trim(coalesce(aircraft_model, '')) AS model_token
    FROM public.work_package_templates
    WHERE model_id IS NULL
      AND trim(coalesce(aircraft_model, '')) <> ''
  ),
  candidate AS (
    SELECT
      u.id AS work_package_template_id,
      m.id AS model_id,
      row_number() OVER (PARTITION BY u.id ORDER BY m.updated_at DESC NULLS LAST, m.created_at DESC NULLS LAST, m.id) AS rn,
      count(*) OVER (PARTITION BY u.id) AS candidate_count
    FROM unresolved u
    JOIN public.assembly_models m
      ON m.tenant_id = u.tenant_id
     AND (u.franchise_id IS NULL OR m.franchise_id IS NULL OR m.franchise_id = u.franchise_id)
     AND (
       m.id::text = u.model_token
       OR lower(coalesce(m.model_code, '')) = lower(u.model_token)
       OR lower(coalesce(m.name, '')) = lower(u.model_token)
       OR lower(coalesce(m.primary_model, '')) = lower(u.model_token)
     )
  ),
  resolved AS (
    SELECT work_package_template_id, model_id
    FROM candidate
    WHERE rn = 1 AND candidate_count = 1
  )
  UPDATE public.work_package_templates w
  SET model_id = r.model_id
  FROM resolved r
  WHERE w.id = r.work_package_template_id
    AND w.model_id IS NULL;

  -- 3) Resolve from tasks_json -> task_templates.assembly_models when unique.
  WITH unresolved AS (
    SELECT id, tenant_id, franchise_id, tasks_json
    FROM public.work_package_templates
    WHERE model_id IS NULL
  ),
  extracted_task_ids AS (
    SELECT
      u.id AS work_package_template_id,
      (entry->>'task_template_id')::uuid AS task_template_id
    FROM unresolved u
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(u.tasks_json, '[]'::jsonb)) entry
    WHERE jsonb_typeof(entry) = 'object'
      AND entry ? 'task_template_id'
      AND (entry->>'task_template_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  task_model AS (
    SELECT
      e.work_package_template_id,
      MIN(t.assembly_models) AS model_id
    FROM extracted_task_ids e
    JOIN public.task_templates t
      ON t.id = e.task_template_id
    WHERE t.assembly_models IS NOT NULL
    GROUP BY e.work_package_template_id
    HAVING COUNT(DISTINCT t.assembly_models) = 1
  )
  UPDATE public.work_package_templates w
  SET model_id = tm.model_id
  FROM task_model tm
  WHERE w.id = tm.work_package_template_id
    AND w.model_id IS NULL;

  -- 4) Normalize aircraft_model label from resolved model_id where blank.
  UPDATE public.work_package_templates w
  SET aircraft_model = coalesce(nullif(m.model_code, ''), nullif(m.primary_model, ''), nullif(m.name, ''), w.aircraft_model)
  FROM public.assembly_models m
  WHERE w.model_id = m.id
    AND trim(coalesce(w.aircraft_model, '')) = '';

  -- Ensure required check exists.
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_work_package_templates_model_id_required'
      AND conrelid = 'public.work_package_templates'::regclass
  ) INTO v_check_exists;

  IF NOT v_check_exists THEN
    ALTER TABLE public.work_package_templates
      ADD CONSTRAINT ck_work_package_templates_model_id_required
      CHECK (model_id IS NOT NULL) NOT VALID;
  END IF;

  SELECT COUNT(*)
  INTO v_null_model_count
  FROM public.work_package_templates
  WHERE deleted_at IS NULL
    AND model_id IS NULL;

  IF v_null_model_count > 0 THEN
    RAISE EXCEPTION 'Phase3 hardening aborted: % work_package_templates rows still have NULL model_id', v_null_model_count;
  END IF;

  ALTER TABLE public.work_package_templates
    VALIDATE CONSTRAINT ck_work_package_templates_model_id_required;
END;
$$;

COMMIT;
