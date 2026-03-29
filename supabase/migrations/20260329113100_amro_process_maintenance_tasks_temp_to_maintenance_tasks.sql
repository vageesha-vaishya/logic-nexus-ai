BEGIN;

ALTER TABLE public.maintenance_tasks
  ALTER COLUMN revision_status TYPE text,
  ALTER COLUMN revision_status DROP NOT NULL;

DO $$
DECLARE
  task_row public.maintenance_tasks_temp%ROWTYPE;
  v_category_id uuid;
  v_category_code_clean text;
  v_threshold_hours numeric(10,2);
  v_threshold_cycles integer;
  v_threshold_calendar integer;
  v_calendar_unit public.calendar_unit;
  v_repeat_interval boolean;
  v_estimated_man_hours numeric(10,2);
  v_inserted_task_id uuid;
BEGIN
  FOR task_row IN
    SELECT *
    FROM public.maintenance_tasks_temp
    WHERE insert_status <> 'SUCCESS'
    ORDER BY id
  LOOP
    BEGIN
      v_category_code_clean := upper(trim(coalesce(task_row.category_code, '')));
      v_category_code_clean := regexp_replace(v_category_code_clean, '\*+$', '');

      v_category_id := NULL;
      IF v_category_code_clean <> '' THEN
        SELECT tc.id
        INTO v_category_id
        FROM public.task_categories tc
        WHERE tc.tenant_id = task_row.tenant_id
          AND tc.is_active = true
          AND (
            upper(tc.code) = upper(trim(coalesce(task_row.category_code, '')))
            OR upper(tc.code) = v_category_code_clean
          )
        ORDER BY CASE
          WHEN upper(tc.code) = upper(trim(coalesce(task_row.category_code, ''))) THEN 0
          ELSE 1
        END
        LIMIT 1;
      END IF;

      v_threshold_hours := NULL;
      IF coalesce(task_row.interval_hours_raw, '') <> '' THEN
        v_threshold_hours := NULLIF(
          regexp_replace(split_part(task_row.interval_hours_raw, ':', 1), '[^0-9.]', '', 'g'),
          ''
        )::numeric;
      END IF;

      v_threshold_cycles := NULL;
      IF coalesce(task_row.interval_cycles_raw, '') <> '' THEN
        v_threshold_cycles := NULLIF(
          regexp_replace(task_row.interval_cycles_raw, '[^0-9]', '', 'g'),
          ''
        )::integer;
      END IF;

      v_threshold_calendar := NULL;
      v_calendar_unit := NULL;
      IF coalesce(task_row.interval_months_raw, '') <> '' THEN
        v_threshold_calendar := NULLIF(
          regexp_replace(task_row.interval_months_raw, '[^0-9]', '', 'g'),
          ''
        )::integer;

        IF task_row.interval_months_raw ~* '\mDy\M' THEN
          v_calendar_unit := 'Dy'::public.calendar_unit;
        ELSIF task_row.interval_months_raw ~* '\mMt\M' THEN
          v_calendar_unit := 'Mt'::public.calendar_unit;
        ELSIF task_row.interval_months_raw ~* '\mYr\M' THEN
          v_calendar_unit := 'Yr'::public.calendar_unit;
        END IF;
      END IF;

      IF v_calendar_unit IS NULL AND coalesce(task_row.calendar_unit_raw, '') <> '' THEN
        IF task_row.calendar_unit_raw ~* '\mDy\M' THEN
          v_calendar_unit := 'Dy'::public.calendar_unit;
        ELSIF task_row.calendar_unit_raw ~* '\mMt\M' THEN
          v_calendar_unit := 'Mt'::public.calendar_unit;
        ELSIF task_row.calendar_unit_raw ~* '\mYr\M' THEN
          v_calendar_unit := 'Yr'::public.calendar_unit;
        END IF;
      END IF;

      v_estimated_man_hours := NULL;
      IF coalesce(task_row.estimated_man_hours_raw, '') <> '' THEN
        v_estimated_man_hours := NULLIF(
          regexp_replace(task_row.estimated_man_hours_raw, '[^0-9.-]', '', 'g'),
          ''
        )::numeric;
      END IF;

      v_repeat_interval := (
        v_threshold_hours IS NOT NULL
        OR v_threshold_cycles IS NOT NULL
        OR v_threshold_calendar IS NOT NULL
      );

      INSERT INTO public.maintenance_tasks (
        tenant_id,
        franchise_id,
        code_form_no,
        ata_code,
        reference_amp,
        description,
        category_code,
        category_id,
        estimated_man_hours,
        revision_status,
        threshold_hours,
        threshold_cycles,
        threshold_calendar,
        calendar_unit,
        repeat_interval
      )
      VALUES (
        task_row.tenant_id,
        task_row.franchise_id,
        task_row.code_form_no,
        task_row.ata_code,
        task_row.reference_amp,
        task_row.description,
        task_row.category_code,
        v_category_id,
        v_estimated_man_hours,
        task_row.revision_status,
        v_threshold_hours,
        v_threshold_cycles,
        v_threshold_calendar,
        v_calendar_unit,
        v_repeat_interval
      )
      RETURNING id INTO v_inserted_task_id;

      UPDATE public.maintenance_tasks_temp
      SET insert_status = 'SUCCESS',
          error_message = NULL,
          inserted_task_id = v_inserted_task_id,
          processed_at = now()
      WHERE id = task_row.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.maintenance_tasks_temp
      SET insert_status = 'FAILED',
          error_message = SQLERRM,
          inserted_task_id = NULL,
          processed_at = now()
      WHERE id = task_row.id;
    END;
  END LOOP;
END $$;

COMMIT;
