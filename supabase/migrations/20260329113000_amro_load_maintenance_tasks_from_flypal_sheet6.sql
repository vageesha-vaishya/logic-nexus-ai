BEGIN;

ALTER TABLE public.task_templates
  ALTER COLUMN reference_amp TYPE text,
  ALTER COLUMN reference_amp DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.task_templates_temp (
  id bigserial PRIMARY KEY,
  source_row_number integer,
  tenant_id uuid,
  franchise_id uuid,
  code_form_no varchar(50),
  ata_code varchar(10),
  reference_amp text,
  description text,
  category_code varchar(50),
  estimated_man_hours_raw text,
  revision_status text,
  interval_hours_raw text,
  interval_cycles_raw text,
  interval_months_raw text,
  calendar_unit_raw text,
  insert_status varchar(20) NOT NULL DEFAULT 'PENDING',
  error_message text,
  inserted_task_id uuid,
  processed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_maintenance_tasks_temp_source_row_number
  ON public.task_templates_temp(source_row_number);

COMMIT;
