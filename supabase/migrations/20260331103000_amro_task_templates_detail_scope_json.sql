DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
  ) THEN
    ALTER TABLE public.task_templates
      ADD COLUMN IF NOT EXISTS task_template_detail_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS task_template_scope_json jsonb NOT NULL DEFAULT '[]'::jsonb;

    UPDATE public.task_templates
    SET task_template_detail_json = jsonb_build_array(
      jsonb_build_object(
        'priority', 'Critical',
        'complexity', 'Simple',
        'description', 'Documentation Consolidation workflow. Ensure traceable evidence, cross-team coordination, and regulatory alignment with acceptance criteria, risk annotations, and handover checkpoints to prevent repeated defects and dispatch surprises. Ensure traceable evidence, cross-team coordination, and regulatory alignment with acceptance criteria, risk annotations, and handover checkpoints to prevent repeated defects and dispatch surprises.',
        'part_number', 'PN-WP-0001-001',
        'task_number', 'WP-0001-001',
        'serial_number', 'SN-WP-0001-001',
        'assigned_users', jsonb_build_array(
          jsonb_build_object(
            'role', 'Engineer',
            'user_id', '52811a3b-5baf-4c5f-854b-7ced632e3a74',
            'availability_status', 'Available'
          ),
          jsonb_build_object(
            'role', 'Inspector',
            'user_id', '8d7e21a9-5cb9-4d61-9e5d-3a7bf4f52c10',
            'availability_status', 'Busy'
          )
        ),
        'dependency_task_numbers', '[]'::jsonb
      )
    );

    ALTER TABLE public.task_templates
      DROP CONSTRAINT IF EXISTS ck_task_template_detail_json_array,
      DROP CONSTRAINT IF EXISTS ck_task_template_detail_scope_json_array;

    ALTER TABLE public.task_templates
      ADD CONSTRAINT ck_task_template_detail_json_array CHECK (jsonb_typeof(task_template_detail_json) = 'array'::text),
      ADD CONSTRAINT ck_task_template_detail_scope_json_array CHECK (jsonb_typeof(task_template_scope_json) = 'array'::text);
  END IF;
END $$;
