DO $migration$
BEGIN
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.amro_update_work_package_template_atomic(
      p_tenant_id uuid,
      p_franchise_id uuid,
      p_user_id uuid,
      p_work_package_template_id uuid,
      p_payload jsonb
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    AS $body$
    DECLARE
      v_record public.work_package_templates%ROWTYPE;
      v_tasks_json jsonb := '[]'::jsonb;
      v_scope_json jsonb := '[]'::jsonb;
      v_task_ids_raw uuid[] := ARRAY[]::uuid[];
      v_task_ids uuid[] := ARRAY[]::uuid[];
      v_missing_ids text[] := ARRAY[]::text[];
      v_relationships jsonb := '[]'::jsonb;
      v_model_ids uuid[] := ARRAY[]::uuid[];
      v_model_id uuid := NULL;
      v_response jsonb;
    BEGIN
      SELECT *
      INTO v_record
      FROM public.work_package_templates
      WHERE id = p_work_package_template_id
        AND tenant_id = p_tenant_id
        AND (p_franchise_id IS NULL OR franchise_id IS NULL OR franchise_id = p_franchise_id)
      LIMIT 1;

      IF v_record.id IS NULL THEN
        RAISE EXCEPTION 'Work package template not found';
      END IF;

      v_tasks_json := COALESCE(p_payload->'tasks_json', to_jsonb(COALESCE(v_record.tasks_json, '[]'::jsonb)));
      IF jsonb_typeof(v_tasks_json) = 'string' THEN
        BEGIN
          v_tasks_json := COALESCE((p_payload->>'tasks_json')::jsonb, '[]'::jsonb);
        EXCEPTION WHEN others THEN
          RAISE EXCEPTION 'Validation failed: tasks_json must be a JSON array';
        END;
      END IF;
      IF jsonb_typeof(v_tasks_json) <> 'array' THEN
        RAISE EXCEPTION 'Validation failed: tasks_json must be a JSON array';
      END IF;

      v_scope_json := COALESCE(p_payload->'scope_json', to_jsonb(COALESCE(v_record.scope_json, '[]'::jsonb)));
      IF jsonb_typeof(v_scope_json) = 'string' THEN
        BEGIN
          v_scope_json := COALESCE((p_payload->>'scope_json')::jsonb, '[]'::jsonb);
        EXCEPTION WHEN others THEN
          v_scope_json := '[]'::jsonb;
        END;
      END IF;
      IF jsonb_typeof(v_scope_json) <> 'array' THEN
        v_scope_json := '[]'::jsonb;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_tasks_json) AS entry
        WHERE jsonb_typeof(entry) = 'object'
          AND (NOT (entry ? 'task_template_id')
            OR NOT ((entry->>'task_template_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'))
      ) THEN
        RAISE EXCEPTION 'Validation failed: each tasks_json element must include a valid UUID task_template_id';
      END IF;

      SELECT COALESCE(array_agg((entry->>'task_template_id')::uuid), ARRAY[]::uuid[])
      INTO v_task_ids_raw
      FROM jsonb_array_elements(v_tasks_json) AS entry
      WHERE jsonb_typeof(entry) = 'object'
        AND entry ? 'task_template_id';

      SELECT COALESCE(array_agg(DISTINCT id_value), ARRAY[]::uuid[])
      INTO v_task_ids
      FROM unnest(v_task_ids_raw) AS id_value;

      IF array_length(v_task_ids_raw, 1) IS NOT NULL AND array_length(v_task_ids_raw, 1) <> array_length(v_task_ids, 1) THEN
        RAISE EXCEPTION 'Validation failed: duplicate task_template_id values are not allowed';
      END IF;

      IF array_length(v_task_ids, 1) IS NOT NULL THEN
        SELECT COALESCE(array_agg(req_id::text), ARRAY[]::text[])
        INTO v_missing_ids
        FROM unnest(v_task_ids) AS req_id
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.task_templates t
          WHERE t.id = req_id
            AND t.tenant_id = p_tenant_id
            AND (p_franchise_id IS NULL OR t.franchise_id IS NULL OR t.franchise_id = p_franchise_id)
        );
        IF array_length(v_missing_ids, 1) IS NOT NULL THEN
          RAISE EXCEPTION 'Validation failed: task_template_id not found (%)', array_to_string(v_missing_ids, ', ');
        END IF;
      END IF;

      UPDATE public.work_package_templates
      SET
        template_code = COALESCE(NULLIF(p_payload->>'template_code', ''), template_code),
        version = COALESCE((p_payload->>'version')::integer, version),
        active = COALESCE((p_payload->>'active')::boolean, active),
        template_name = COALESCE(NULLIF(p_payload->>'template_name', ''), template_name),
        maintenance_type = COALESCE(NULLIF(p_payload->>'maintenance_type', ''), maintenance_type),
        scope_json = v_scope_json,
        tasks_json = v_tasks_json,
        policy_snapshot_id = COALESCE(NULLIF(p_payload->>'policy_snapshot_id', ''), policy_snapshot_id),
        updated_by = p_user_id,
        updated_at = now()
      WHERE id = p_work_package_template_id
      RETURNING *
      INTO v_record;

      DELETE FROM public.work_package_template_task_templates
      WHERE tenant_id = p_tenant_id
        AND work_package_template_id = p_work_package_template_id
        AND (p_franchise_id IS NULL OR franchise_id IS NULL OR franchise_id = p_franchise_id);

      IF array_length(v_task_ids, 1) IS NOT NULL THEN
        SELECT COALESCE(array_agg(DISTINCT t.assembly_models), ARRAY[]::uuid[])
        INTO v_model_ids
        FROM public.task_templates t
        WHERE t.id = ANY (v_task_ids);
        IF array_length(v_model_ids, 1) = 1 THEN
          v_model_id := v_model_ids[1];
        ELSE
          RAISE EXCEPTION 'Validation failed: selected task templates belong to different or missing assembly_models';
        END IF;

        INSERT INTO public.work_package_template_task_templates (
          tenant_id,
          franchise_id,
          work_package_template_id,
          model_id,
          task_template_id,
          created_by,
          updated_by,
          created_at,
          updated_at
        )
        SELECT
          p_tenant_id,
          p_franchise_id,
          p_work_package_template_id,
          v_model_id,
          task_id,
          p_user_id,
          p_user_id,
          v_record.created_at,
          now()
        FROM unnest(v_task_ids) AS task_id
        ON CONFLICT ON CONSTRAINT uq_work_package_template_task_templates_scope DO NOTHING;
      END IF;

      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'work_package_template_id', r.work_package_template_id,
            'task_template_id', r.task_template_id,
            'tenant_id', r.tenant_id,
            'model_id', r.model_id,
            'created_at', r.created_at,
            'updated_at', r.updated_at
          )
        ),
        '[]'::jsonb
      )
      INTO v_relationships
      FROM public.work_package_template_task_templates r
      WHERE r.tenant_id = p_tenant_id
        AND r.work_package_template_id = p_work_package_template_id;

      v_response := jsonb_build_object(
        'record', to_jsonb(v_record),
        'updated_relationships', v_relationships
      );
      RETURN v_response;
    END;
    $body$
  $fn$;
END
$migration$;
