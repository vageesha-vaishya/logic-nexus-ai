-- Repair drift: regenerate work_package_template_task_templates from work_package_templates.tasks_json
-- Usage:
--   psql "$DATABASE_URL" -f scripts/sql/repair_amro_wpt_task_drift.sql
--
-- Optional tuning:
--   SET app.repair_batch_size = '100';      -- default 100
--   SET app.repair_max_templates = '2000';  -- default 2000
--
-- Notes:
-- - Only templates with detected drift are processed.
-- - Each template is repaired atomically inside the loop step.
-- - Templates with invalid/missing task references or mixed model resolution are skipped and reported.

BEGIN;

DO $$
DECLARE
  v_batch_size integer := COALESCE(NULLIF(current_setting('app.repair_batch_size', true), '')::integer, 100);
  v_max_templates integer := COALESCE(NULLIF(current_setting('app.repair_max_templates', true), '')::integer, 2000);
  v_processed integer := 0;
  v_repaired integer := 0;
  v_skipped integer := 0;
  v_row record;
  v_task_ids uuid[];
  v_missing_task_ids uuid[];
  v_model_ids uuid[];
  v_model_id uuid;
  v_inserted_count integer;
BEGIN
  IF v_batch_size <= 0 THEN
    v_batch_size := 100;
  END IF;
  IF v_max_templates <= 0 THEN
    v_max_templates := 2000;
  END IF;

  CREATE TEMP TABLE tmp_wpt_repair_queue (
    work_package_template_id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    franchise_id uuid NULL,
    created_by uuid NULL,
    updated_by uuid NULL
  ) ON COMMIT DROP;

  CREATE TEMP TABLE tmp_wpt_repair_result (
    work_package_template_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    status text NOT NULL,
    detail text NULL,
    inserted_count integer NOT NULL DEFAULT 0,
    repaired_at timestamptz NOT NULL DEFAULT now()
  ) ON COMMIT DROP;

  WITH template_tasks_json AS (
    SELECT
      w.id AS work_package_template_id,
      w.tenant_id,
      w.franchise_id,
      w.created_by,
      w.updated_by,
      ARRAY(
        SELECT DISTINCT (entry->>'task_template_id')::uuid
        FROM jsonb_array_elements(coalesce(w.tasks_json, '[]'::jsonb)) entry
        WHERE jsonb_typeof(entry) = 'object'
          AND entry ? 'task_template_id'
          AND (entry->>'task_template_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      ) AS json_task_ids
    FROM public.work_package_templates w
    WHERE w.deleted_at IS NULL
  ),
  template_relation AS (
    SELECT
      r.work_package_template_id,
      ARRAY_AGG(DISTINCT r.task_template_id ORDER BY r.task_template_id) AS rel_task_ids
    FROM public.work_package_template_task_templates r
    GROUP BY r.work_package_template_id
  ),
  drift AS (
    SELECT
      j.work_package_template_id,
      j.tenant_id,
      j.franchise_id,
      j.created_by,
      j.updated_by
    FROM template_tasks_json j
    LEFT JOIN template_relation r
      ON r.work_package_template_id = j.work_package_template_id
    WHERE COALESCE(j.json_task_ids, ARRAY[]::uuid[]) IS DISTINCT FROM COALESCE(r.rel_task_ids, ARRAY[]::uuid[])
    ORDER BY j.work_package_template_id
    LIMIT v_max_templates
  )
  INSERT INTO tmp_wpt_repair_queue (work_package_template_id, tenant_id, franchise_id, created_by, updated_by)
  SELECT
    d.work_package_template_id,
    d.tenant_id,
    d.franchise_id,
    d.created_by,
    d.updated_by
  FROM drift d;

  FOR v_row IN
    SELECT q.*
    FROM tmp_wpt_repair_queue q
    ORDER BY q.work_package_template_id
    LIMIT v_max_templates
  LOOP
    EXIT WHEN v_processed >= v_max_templates;
    v_processed := v_processed + 1;

    SELECT ARRAY(
      SELECT DISTINCT (entry->>'task_template_id')::uuid
      FROM public.work_package_templates w
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(w.tasks_json, '[]'::jsonb)) entry
      WHERE w.id = v_row.work_package_template_id
        AND jsonb_typeof(entry) = 'object'
        AND entry ? 'task_template_id'
        AND (entry->>'task_template_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    INTO v_task_ids;

    IF COALESCE(array_length(v_task_ids, 1), 0) = 0 THEN
      DELETE FROM public.work_package_template_task_templates r
      WHERE r.work_package_template_id = v_row.work_package_template_id
        AND r.tenant_id = v_row.tenant_id;

      INSERT INTO tmp_wpt_repair_result (work_package_template_id, tenant_id, status, detail, inserted_count)
      VALUES (v_row.work_package_template_id, v_row.tenant_id, 'repaired', 'No task ids in tasks_json; relation rows cleared', 0);
      v_repaired := v_repaired + 1;
      CONTINUE;
    END IF;

    SELECT ARRAY(
      SELECT req_id
      FROM unnest(v_task_ids) req_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.task_templates t
        WHERE t.id = req_id
          AND t.tenant_id = v_row.tenant_id
          AND (v_row.franchise_id IS NULL OR t.franchise_id IS NULL OR t.franchise_id = v_row.franchise_id)
      )
    )
    INTO v_missing_task_ids;

    IF COALESCE(array_length(v_missing_task_ids, 1), 0) > 0 THEN
      INSERT INTO tmp_wpt_repair_result (work_package_template_id, tenant_id, status, detail, inserted_count)
      VALUES (
        v_row.work_package_template_id,
        v_row.tenant_id,
        'skipped',
        format('Missing task_template ids: %s', array_to_string(v_missing_task_ids, ', ')),
        0
      );
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT ARRAY(
      SELECT DISTINCT t.assembly_models
      FROM public.task_templates t
      WHERE t.id = ANY(v_task_ids)
        AND t.assembly_models IS NOT NULL
    )
    INTO v_model_ids;

    IF COALESCE(array_length(v_model_ids, 1), 0) <> 1 THEN
      INSERT INTO tmp_wpt_repair_result (work_package_template_id, tenant_id, status, detail, inserted_count)
      VALUES (
        v_row.work_package_template_id,
        v_row.tenant_id,
        'skipped',
        'Unable to resolve a single model_id from selected task templates',
        0
      );
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_model_id := v_model_ids[1];

    DELETE FROM public.work_package_template_task_templates r
    WHERE r.work_package_template_id = v_row.work_package_template_id
      AND r.tenant_id = v_row.tenant_id;

    INSERT INTO public.work_package_template_task_templates (
      tenant_id,
      franchise_id,
      work_package_template_id,
      model_id,
      task_template_id,
      created_by,
      updated_by
    )
    SELECT
      v_row.tenant_id,
      v_row.franchise_id,
      v_row.work_package_template_id,
      v_model_id,
      task_id,
      v_row.created_by,
      v_row.updated_by
    FROM unnest(v_task_ids) task_id
    ON CONFLICT ON CONSTRAINT uq_work_package_template_task_templates_scope DO NOTHING;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    UPDATE public.work_package_templates
    SET
      model_id = COALESCE(model_id, v_model_id),
      updated_at = now()
    WHERE id = v_row.work_package_template_id
      AND tenant_id = v_row.tenant_id;

    INSERT INTO tmp_wpt_repair_result (work_package_template_id, tenant_id, status, detail, inserted_count)
    VALUES (v_row.work_package_template_id, v_row.tenant_id, 'repaired', 'Relations regenerated from tasks_json', v_inserted_count);
    v_repaired := v_repaired + 1;

    IF (v_processed % v_batch_size) = 0 THEN
      RAISE NOTICE 'Processed % templates so far (repaired %, skipped %)', v_processed, v_repaired, v_skipped;
    END IF;
  END LOOP;

  RAISE NOTICE 'Repair complete. Processed=% Repaired=% Skipped=%', v_processed, v_repaired, v_skipped;

  RAISE NOTICE '--- Repair Result Sample (first 100 rows) ---';
  PERFORM 1;
END;
$$;

-- Summary result set
SELECT status, COUNT(*) AS template_count
FROM tmp_wpt_repair_result
GROUP BY status
ORDER BY status;

-- Detailed skipped templates (if any)
SELECT *
FROM tmp_wpt_repair_result
WHERE status = 'skipped'
ORDER BY repaired_at, work_package_template_id;

COMMIT;
