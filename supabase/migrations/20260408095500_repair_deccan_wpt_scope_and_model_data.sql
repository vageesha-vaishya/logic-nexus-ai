-- Data repair for Deccan tenant / Deccan Fly franchise:
-- 1) Align existing WPT + relation rows to Deccan Fly scope (not only NULL values).
-- 2) Reconcile WPT model_id with selected task templates where a single model is resolvable.

DO $$
DECLARE
  v_tenant_id uuid;
  v_franchise_id uuid;
  v_has_tenant_code boolean := false;
  v_has_franchise_code boolean := false;
  v_has_rel_franchise_column boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'code'
  ) INTO v_has_tenant_code;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'franchises'
      AND column_name = 'code'
  ) INTO v_has_franchise_code;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_package_template_task_templates'
      AND column_name = 'franchise_id'
  ) INTO v_has_rel_franchise_column;

  IF v_has_tenant_code THEN
    SELECT t.id
      INTO v_tenant_id
    FROM public.tenants t
    WHERE t.id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
       OR lower(t.name) LIKE 'deccan%'
       OR lower(coalesce(t.code, '')) LIKE 'deccan%'
    ORDER BY (t.id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid) DESC, t.created_at ASC
    LIMIT 1;
  ELSE
    SELECT t.id
      INTO v_tenant_id
    FROM public.tenants t
    WHERE t.id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
       OR lower(t.name) LIKE 'deccan%'
    ORDER BY (t.id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid) DESC, t.created_at ASC
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Deccan tenant not found; cannot run WPT data repair';
  END IF;

  SELECT f.id
    INTO v_franchise_id
  FROM public.franchises f
  WHERE f.tenant_id = v_tenant_id
    AND (
      lower(f.name) = 'deccan fly'
      OR (
        v_has_franchise_code
        AND lower(coalesce(f.code, '')) IN ('deccan-fly', 'deccan_fly', 'deccanfly', 'deccan')
      )
    )
  ORDER BY f.is_active DESC, f.created_at ASC
  LIMIT 1;

  IF v_franchise_id IS NULL THEN
    IF v_has_franchise_code THEN
      INSERT INTO public.franchises (tenant_id, name, code, address, is_active)
      VALUES (v_tenant_id, 'Deccan Fly', 'DECCAN-FLY', '{}'::jsonb, true)
      RETURNING id INTO v_franchise_id;
    ELSE
      INSERT INTO public.franchises (tenant_id, name, address, is_active)
      VALUES (v_tenant_id, 'Deccan Fly', '{}'::jsonb, true)
      RETURNING id INTO v_franchise_id;
    END IF;
  END IF;

  -- Force-align ALL Deccan tenant WPT records to Deccan Fly scope.
  UPDATE public.work_package_templates w
  SET franchise_id = v_franchise_id
  WHERE w.tenant_id = v_tenant_id
    AND w.deleted_at IS NULL
    AND w.franchise_id IS DISTINCT FROM v_franchise_id;

  -- Force-align relation rows too (if franchise_id exists there).
  IF v_has_rel_franchise_column THEN
    UPDATE public.work_package_template_task_templates r
    SET franchise_id = v_franchise_id
    WHERE r.tenant_id = v_tenant_id
      AND r.franchise_id IS DISTINCT FROM v_franchise_id;
  END IF;

  -- Reconcile model_id from selected task templates when resolvable to one model.
  WITH relation_task_ids AS (
    SELECT DISTINCT
      w.id AS template_id,
      r.task_template_id::text AS task_template_id
    FROM public.work_package_templates w
    JOIN public.work_package_template_task_templates r
      ON r.work_package_template_id = w.id
     AND r.tenant_id = w.tenant_id
    WHERE w.tenant_id = v_tenant_id
      AND w.deleted_at IS NULL
      AND w.franchise_id = v_franchise_id
      AND r.task_template_id IS NOT NULL
  ),
  json_task_ids AS (
    SELECT DISTINCT
      w.id AS template_id,
      nullif(
        btrim(
          coalesce(
            elem->>'task_template_id',
            elem->>'taskTemplateId',
            elem->>'id',
            ''
          )
        ),
        ''
      ) AS task_template_id
    FROM public.work_package_templates w
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(w.tasks_json, '[]'::jsonb)) elem
    WHERE w.tenant_id = v_tenant_id
      AND w.deleted_at IS NULL
      AND w.franchise_id = v_franchise_id
  ),
  all_task_ids AS (
    SELECT template_id, task_template_id FROM relation_task_ids
    UNION
    SELECT template_id, task_template_id
    FROM json_task_ids
    WHERE task_template_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  resolved_models AS (
    SELECT
      a.template_id,
      min(tt.assembly_models::text)::uuid AS resolved_model_id,
      count(DISTINCT tt.assembly_models) AS model_count
    FROM all_task_ids a
    JOIN public.task_templates tt
      ON tt.id = a.task_template_id::uuid
     AND tt.tenant_id = v_tenant_id
     AND (tt.franchise_id = v_franchise_id OR tt.franchise_id IS NULL)
    WHERE tt.assembly_models IS NOT NULL
    GROUP BY a.template_id
  ),
  single_model_templates AS (
    SELECT template_id, resolved_model_id
    FROM resolved_models
    WHERE model_count = 1
  )
  UPDATE public.work_package_templates w
  SET model_id = s.resolved_model_id,
      updated_at = now()
  FROM single_model_templates s
  WHERE w.id = s.template_id
    AND w.tenant_id = v_tenant_id
    AND w.franchise_id = v_franchise_id
    AND w.model_id IS DISTINCT FROM s.resolved_model_id;

  -- Keep relation model_id aligned with template model_id.
  UPDATE public.work_package_template_task_templates r
  SET model_id = w.model_id,
      updated_at = now()
  FROM public.work_package_templates w
  WHERE r.work_package_template_id = w.id
    AND r.tenant_id = v_tenant_id
    AND w.tenant_id = v_tenant_id
    AND w.franchise_id = v_franchise_id
    AND w.model_id IS NOT NULL
    AND r.model_id IS DISTINCT FROM w.model_id;
END $$;
