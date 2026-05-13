-- DB-VERIFICATION: amro-aircraft-task-generation-rpc-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

CREATE OR REPLACE FUNCTION public.generate_aircraft_tasks_from_templates(
  p_aircraft_id uuid,
  p_requested_by uuid DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aircraft record;
  v_work_order record;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_template_count integer := 0;
  v_now timestamptz := now();
  v_correlation_id text := COALESCE(NULLIF(btrim(p_correlation_id), ''), gen_random_uuid()::text);
  v_status text;
BEGIN
  IF p_aircraft_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_AIRCRAFT_ID',
      'message', 'aircraft_id is required'
    );
  END IF;

  SELECT
    a.id,
    a.tenant_id,
    a.franchise_id,
    a.assembly_models,
    a.status,
    a.registration
  INTO v_aircraft
  FROM public.aircraft a
  WHERE a.id = p_aircraft_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_AIRCRAFT_ID',
      'message', 'Aircraft not found'
    );
  END IF;

  IF v_aircraft.assembly_models IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'MISSING_ASSEMBLY_MODEL',
      'message', 'Aircraft has no assembly model mapped'
    );
  END IF;

  v_status := lower(COALESCE(v_aircraft.status::text, ''));
  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'AIRCRAFT_NOT_PENDING',
      'message', 'Aircraft status must be pending for task generation',
      'current_status', v_aircraft.status::text
    );
  END IF;

  SELECT COUNT(*)
  INTO v_template_count
  FROM public.task_templates tt
  WHERE tt.tenant_id = v_aircraft.tenant_id
    AND tt.assembly_models = v_aircraft.assembly_models
    AND (
      v_aircraft.franchise_id IS NULL
      OR tt.franchise_id IS NULL
      OR tt.franchise_id = v_aircraft.franchise_id
    );

  IF v_template_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'MISSING_TEMPLATES',
      'message', 'No task templates found for the aircraft assembly model',
      'assembly_model_id', v_aircraft.assembly_models
    );
  END IF;

  SELECT
    wo.id,
    wo.work_order_number
  INTO v_work_order
  FROM public.work_orders wo
  WHERE wo.tenant_id = v_aircraft.tenant_id
    AND wo.aircraft_id = v_aircraft.id
    AND wo.title = 'Pending Aircraft Activation'
    AND (
      v_aircraft.franchise_id IS NULL
      OR wo.franchise_id IS NULL
      OR wo.franchise_id = v_aircraft.franchise_id
    )
  ORDER BY wo.updated_at DESC NULLS LAST, wo.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_work_order.id IS NULL THEN
    INSERT INTO public.work_orders (
      tenant_id,
      franchise_id,
      aircraft_id,
      work_order_number,
      title,
      description,
      work_type,
      maintenance_type,
      status,
      created_by,
      updated_by
    )
    VALUES (
      v_aircraft.tenant_id,
      v_aircraft.franchise_id,
      v_aircraft.id,
      'ACT-' || upper(substr(replace(v_aircraft.id::text, '-', ''), 1, 8)) || '-' || to_char(v_now, 'YYYYMMDDHH24MISSMS'),
      'Pending Aircraft Activation',
      'Auto-generated work order for pending aircraft activation tasks',
      'activation',
      'inspection',
      'planning',
      p_requested_by,
      p_requested_by
    )
    RETURNING id, work_order_number
    INTO v_work_order;
  END IF;

  WITH template_scope AS (
    SELECT
      tt.id AS task_template_id,
      COALESCE(NULLIF(btrim(tt.category_code), ''), 'general') AS task_category,
      COALESCE(NULLIF(btrim(tt.code_form_no), ''), NULLIF(btrim(tt.description), ''), 'Template Task') AS task_title,
      NULLIF(btrim(tt.description), '') AS task_description,
      row_number() OVER (ORDER BY tt.task_id, tt.id) AS row_seq
    FROM public.task_templates tt
    WHERE tt.tenant_id = v_aircraft.tenant_id
      AND tt.assembly_models = v_aircraft.assembly_models
      AND (
        v_aircraft.franchise_id IS NULL
        OR tt.franchise_id IS NULL
        OR tt.franchise_id = v_aircraft.franchise_id
      )
  ),
  deduped AS (
    SELECT ts.*
    FROM template_scope ts
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.work_orders w ON w.id = t.work_order_id
      WHERE t.tenant_id = v_aircraft.tenant_id
        AND w.aircraft_id = v_aircraft.id
        AND t.task_template_id = ts.task_template_id
    )
  ),
  seq_seed AS (
    SELECT COALESCE(max(t.sequence), 0) AS max_sequence
    FROM public.tasks t
    WHERE t.tenant_id = v_aircraft.tenant_id
      AND t.work_order_id = v_work_order.id
  ),
  inserted AS (
    INSERT INTO public.tasks (
      tenant_id,
      franchise_id,
      work_order_id,
      task_template_id,
      task_number,
      title,
      description,
      task_category,
      sequence,
      sequence_order,
      status,
      created_by,
      updated_by
    )
    SELECT
      v_aircraft.tenant_id,
      v_aircraft.franchise_id,
      v_work_order.id,
      d.task_template_id,
      v_work_order.work_order_number || '-' || lpad((seq_seed.max_sequence + d.row_seq)::text, 3, '0'),
      d.task_title,
      d.task_description,
      d.task_category,
      seq_seed.max_sequence + d.row_seq,
      seq_seed.max_sequence + d.row_seq,
      'pending',
      p_requested_by,
      p_requested_by
    FROM deduped d
    CROSS JOIN seq_seed
    RETURNING id
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  v_skipped := v_template_count - v_inserted;

  UPDATE public.aircraft
  SET status = 'active',
      updated_at = now()
  WHERE id = v_aircraft.id
    AND lower(status::text) = 'pending';

  INSERT INTO public.system_logs (
    level,
    message,
    metadata,
    correlation_id,
    component,
    environment,
    user_id,
    tenant_id
  )
  VALUES (
    'INFO',
    'Aircraft tasks generated from templates',
    jsonb_build_object(
      'aircraft_id', v_aircraft.id,
      'registration', v_aircraft.registration,
      'assembly_model_id', v_aircraft.assembly_models,
      'work_order_id', v_work_order.id,
      'work_order_number', v_work_order.work_order_number,
      'task_templates_found', v_template_count,
      'tasks_created', v_inserted,
      'tasks_skipped_as_duplicates', v_skipped,
      'aircraft_status_transition', jsonb_build_object('from', 'pending', 'to', 'active')
    ),
    v_correlation_id,
    'amro.aircraft-task-generation',
    'production',
    p_requested_by,
    v_aircraft.tenant_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'aircraft_id', v_aircraft.id,
    'assembly_model_id', v_aircraft.assembly_models,
    'work_order_id', v_work_order.id,
    'work_order_number', v_work_order.work_order_number,
    'tasks_created', v_inserted,
    'tasks_skipped', v_skipped,
    'task_templates_found', v_template_count,
    'aircraft_status', 'active',
    'correlation_id', v_correlation_id
  );
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO public.system_logs (
      level,
      message,
      metadata,
      correlation_id,
      component,
      environment,
      user_id,
      tenant_id
    )
    VALUES (
      'ERROR',
      'Aircraft task generation failed',
      jsonb_build_object(
        'aircraft_id', p_aircraft_id,
        'error', SQLERRM
      ),
      v_correlation_id,
      'amro.aircraft-task-generation',
      'production',
      p_requested_by,
      COALESCE(v_aircraft.tenant_id, NULL)
    );
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.generate_aircraft_tasks_from_templates(uuid, uuid, text) IS
  'Generates tasks from task_templates for pending aircraft by assembly model, prevents duplicates, writes system logs, and activates aircraft on success.';

COMMIT;
