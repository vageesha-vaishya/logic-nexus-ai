-- Drift check: work_package_templates.tasks_json vs work_package_template_task_templates
-- Usage:
--   psql "$DATABASE_URL" -f scripts/sql/validate_amro_wpt_task_drift.sql

\echo '--- Drift summary by template ---'
WITH template_tasks_json AS (
  SELECT
    w.id AS work_package_template_id,
    w.tenant_id,
    w.franchise_id,
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
    COALESCE(j.json_task_ids, ARRAY[]::uuid[]) AS json_task_ids,
    COALESCE(r.rel_task_ids, ARRAY[]::uuid[]) AS rel_task_ids
  FROM template_tasks_json j
  LEFT JOIN template_relation r
    ON r.work_package_template_id = j.work_package_template_id
)
SELECT
  d.work_package_template_id,
  d.tenant_id,
  d.franchise_id,
  cardinality(d.json_task_ids) AS json_count,
  cardinality(d.rel_task_ids) AS relation_count,
  (SELECT ARRAY_AGG(x ORDER BY x) FROM unnest(d.json_task_ids) x EXCEPT SELECT ARRAY_AGG(y ORDER BY y) FROM unnest(d.rel_task_ids) y) AS in_json_not_relation,
  (SELECT ARRAY_AGG(x ORDER BY x) FROM unnest(d.rel_task_ids) x EXCEPT SELECT ARRAY_AGG(y ORDER BY y) FROM unnest(d.json_task_ids) y) AS in_relation_not_json
FROM drift d
WHERE d.json_task_ids IS DISTINCT FROM d.rel_task_ids
ORDER BY d.tenant_id, d.work_package_template_id;

\echo '--- Aggregate drift counts ---'
WITH template_tasks_json AS (
  SELECT
    w.id AS work_package_template_id,
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
)
SELECT
  COUNT(*) AS compared_templates,
  COUNT(*) FILTER (
    WHERE COALESCE(j.json_task_ids, ARRAY[]::uuid[]) IS DISTINCT FROM COALESCE(r.rel_task_ids, ARRAY[]::uuid[])
  ) AS drifted_templates
FROM template_tasks_json j
LEFT JOIN template_relation r
  ON r.work_package_template_id = j.work_package_template_id;
