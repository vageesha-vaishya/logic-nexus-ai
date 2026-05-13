-- Repair WPT model mismatch for Deccan tenant / Deccan Fly franchise scope.
-- Root cause addressed:
-- - work_order_templates.model_id can drift from model resolved by selected task templates
--   (task_templates.assembly_models), causing save validation:
--   "selected task templates do not match selected model_id".

DO $$
DECLARE
  v_tenant_id uuid;
  v_franchise_id uuid;
  v_has_tenant_code boolean := false;
  v_has_franchise_code boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'code'
  )
  INTO v_has_tenant_code;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'franchises'
      AND column_name = 'code'
  )
  INTO v_has_franchise_code;

  -- Resolve Deccan tenant (prefer known id, fallback by name/code).
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
    RAISE EXCEPTION 'Deccan tenant not found; cannot repair WPT model mismatch.';
  END IF;

  -- Resolve/create Deccan Fly franchise for that tenant.
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

  -- Keep Deccan templates scoped to Deccan Fly where scope is missing.
  UPDATE public.work_order_templates w
  SET franchise_id = v_franchise_id
  WHERE w.tenant_id = v_tenant_id
    AND w.franchise_id IS NULL;

  -- Build deterministic model resolution from selected task templates:
  -- 1) task ids linked via relation table
  -- 2) task ids present in tasks_json payload
  WITH template_scope AS (
    SELECT w.id, w.tenant_id, w.franchise_id, w.created_by, w.updated_by
    FROM public.work_order_templates w
    WHERE w.tenant_id = v_tenant_id
      AND (w.franchise_id = v_franchise_id OR w.franchise_id IS NULL)
      AND w.deleted_at IS NULL
  ),
  relation_task_ids AS (
    SELECT DISTINCT
      t.id AS template_id,
      r.task_template_id::text AS task_template_id
    FROM template_scope t
    JOIN public.work_order_template_task_templates r
      ON r.work_order_template_id = t.id
     AND r.tenant_id = t.tenant_id
     AND (r.franchise_id = v_franchise_id OR r.franchise_id IS NULL)
    WHERE r.task_template_id IS NOT NULL
  ),
  json_task_ids AS (
    SELECT DISTINCT
      t.id AS template_id,
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
    FROM template_scope t
    JOIN public.work_order_templates w
      ON w.id = t.id
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(w.tasks_json, '[]'::jsonb)) elem
  ),
  all_task_ids AS (
    SELECT template_id, task_template_id
    FROM relation_task_ids
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
  -- Update template model_id for templates where selected tasks resolve to one model.
  UPDATE public.work_order_templates w
  SET model_id = s.resolved_model_id,
      franchise_id = coalesce(w.franchise_id, v_franchise_id),
      updated_at = now()
  FROM single_model_templates s
  WHERE w.id = s.template_id
    AND w.tenant_id = v_tenant_id
    AND w.model_id IS DISTINCT FROM s.resolved_model_id;

  -- Align relation rows to resolved template model.
  WITH single_model_templates AS (
    SELECT
      w.id AS template_id,
      w.model_id AS resolved_model_id
    FROM public.work_order_templates w
    WHERE w.tenant_id = v_tenant_id
      AND (w.franchise_id = v_franchise_id OR w.franchise_id IS NULL)
      AND w.deleted_at IS NULL
      AND w.model_id IS NOT NULL
  )
  UPDATE public.work_order_template_task_templates r
  SET model_id = s.resolved_model_id,
      franchise_id = coalesce(r.franchise_id, v_franchise_id),
      updated_at = now()
  FROM single_model_templates s
  WHERE r.work_order_template_id = s.template_id
    AND r.tenant_id = v_tenant_id
    AND r.model_id IS DISTINCT FROM s.resolved_model_id;

  -- Insert missing relation rows from tasks_json using resolved template model.
  WITH template_scope AS (
    SELECT w.id, w.tenant_id, coalesce(w.franchise_id, v_franchise_id) AS franchise_id, w.model_id, w.created_by, w.updated_by
    FROM public.work_order_templates w
    WHERE w.tenant_id = v_tenant_id
      AND (w.franchise_id = v_franchise_id OR w.franchise_id IS NULL)
      AND w.deleted_at IS NULL
      AND w.model_id IS NOT NULL
  ),
  json_task_ids AS (
    SELECT DISTINCT
      t.id AS template_id,
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
    FROM template_scope t
    JOIN public.work_order_templates w
      ON w.id = t.id
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(w.tasks_json, '[]'::jsonb)) elem
    WHERE nullif(
      btrim(
        coalesce(
          elem->>'task_template_id',
          elem->>'taskTemplateId',
          elem->>'id',
          ''
        )
      ),
      ''
    ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
  INSERT INTO public.work_order_template_task_templates (
    tenant_id,
    franchise_id,
    work_order_template_id,
    model_id,
    task_template_id,
    created_by,
    updated_by
  )
  SELECT
    t.tenant_id,
    t.franchise_id,
    t.id,
    t.model_id,
    j.task_template_id::uuid,
    t.created_by,
    t.updated_by
  FROM template_scope t
  JOIN json_task_ids j
    ON j.template_id = t.id
  LEFT JOIN public.work_order_template_task_templates r
    ON r.tenant_id = t.tenant_id
   AND r.work_order_template_id = t.id
   AND r.task_template_id = j.task_template_id::uuid
  WHERE r.id IS NULL;
END $$;
