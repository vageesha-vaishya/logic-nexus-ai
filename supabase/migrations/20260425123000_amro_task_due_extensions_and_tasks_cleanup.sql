-- DB-VERIFICATION: tasks-schema-overlap-reviewed-task-evidence-generic-attachments-task-intervals
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- ============================================================================
-- 1) OPTIONAL NEW ENTITY: TASK DUE EXTENSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.task_due_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,

  extension_scope text NOT NULL CHECK (
    extension_scope IN ('hours', 'cycles', 'calendar_days', 'due_date', 'mixed')
  ),
  extension_value numeric(10,2),
  extension_unit text CHECK (
    extension_unit IS NULL OR extension_unit IN ('hours', 'cycles', 'days', 'months', 'years')
  ),

  original_due_at timestamptz,
  extended_due_at timestamptz,
  original_remaining_value numeric(12,2),
  extended_remaining_value numeric(12,2),

  reason text NOT NULL,
  approval_remark text,
  source_type varchar(50),
  source_ref varchar(100),

  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'cancelled')
  ),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,

  CONSTRAINT ck_task_due_extensions_approval_fields
    CHECK (
      status <> 'approved'
      OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
    ),
  CONSTRAINT ck_task_due_extensions_due_window
    CHECK (
      original_due_at IS NULL
      OR extended_due_at IS NULL
      OR extended_due_at >= original_due_at
    )
);

CREATE INDEX IF NOT EXISTS idx_task_due_extensions_tenant
  ON public.task_due_extensions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_task_due_extensions_tenant_franchise
  ON public.task_due_extensions(tenant_id, franchise_id);
CREATE INDEX IF NOT EXISTS idx_task_due_extensions_task
  ON public.task_due_extensions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_due_extensions_status
  ON public.task_due_extensions(status);
CREATE INDEX IF NOT EXISTS idx_task_due_extensions_active_requested
  ON public.task_due_extensions(tenant_id, requested_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.task_due_extensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amro_platform_admin_access_task_due_extensions ON public.task_due_extensions;
CREATE POLICY amro_platform_admin_access_task_due_extensions
  ON public.task_due_extensions
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_tenant_franchise_scope_task_due_extensions ON public.task_due_extensions;
CREATE POLICY amro_tenant_franchise_scope_task_due_extensions
  ON public.task_due_extensions
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  );

-- Keep updated_at consistent without requiring app-level writes.
DROP TRIGGER IF EXISTS trg_task_due_extensions_set_updated_at ON public.task_due_extensions;
CREATE TRIGGER trg_task_due_extensions_set_updated_at
  BEFORE UPDATE ON public.task_due_extensions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2) TASKS CLEANUP (NON-BREAKING): DUAL-COLUMN CONSOLIDATION
-- ============================================================================
-- Canonical mapping:
-- - sequence / assigned_technician_id / steps_json / qualifications_json
-- Compatibility aliases retained:
-- - sequence_order / assigned_to / steps / qualifications
UPDATE public.tasks
SET
  sequence = COALESCE(sequence, sequence_order),
  sequence_order = COALESCE(sequence_order, sequence),
  assigned_technician_id = COALESCE(assigned_technician_id, assigned_to),
  assigned_to = COALESCE(assigned_to, assigned_technician_id),
  steps_json = COALESCE(steps_json, steps),
  steps = COALESCE(steps, steps_json),
  qualifications_json = COALESCE(qualifications_json, qualifications),
  qualifications = COALESCE(qualifications, qualifications_json),
  updated_at = now()
WHERE
  sequence IS NULL
  OR sequence_order IS NULL
  OR assigned_technician_id IS NULL
  OR assigned_to IS NULL
  OR steps_json IS NULL
  OR steps IS NULL
  OR qualifications_json IS NULL
  OR qualifications IS NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS ck_tasks_sequence_positive;
ALTER TABLE public.tasks
  ADD CONSTRAINT ck_tasks_sequence_positive
    CHECK (sequence IS NULL OR sequence > 0);

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS ck_tasks_sequence_order_positive;
ALTER TABLE public.tasks
  ADD CONSTRAINT ck_tasks_sequence_order_positive
    CHECK (sequence_order IS NULL OR sequence_order > 0);

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS ck_tasks_assignment_alias_consistency;
ALTER TABLE public.tasks
  ADD CONSTRAINT ck_tasks_assignment_alias_consistency
    CHECK (
      assigned_to IS NULL
      OR assigned_technician_id IS NULL
      OR assigned_to = assigned_technician_id
    );

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS ck_tasks_sequence_alias_consistency;
ALTER TABLE public.tasks
  ADD CONSTRAINT ck_tasks_sequence_alias_consistency
    CHECK (
      sequence IS NULL
      OR sequence_order IS NULL
      OR sequence = sequence_order
    );

CREATE OR REPLACE FUNCTION public.sync_tasks_alias_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Canonical values take precedence, with fallback from legacy alias columns.
  NEW.sequence := COALESCE(NEW.sequence, NEW.sequence_order);
  NEW.sequence_order := COALESCE(NEW.sequence_order, NEW.sequence);

  NEW.assigned_technician_id := COALESCE(NEW.assigned_technician_id, NEW.assigned_to);
  NEW.assigned_to := COALESCE(NEW.assigned_to, NEW.assigned_technician_id);

  NEW.steps_json := COALESCE(NEW.steps_json, NEW.steps);
  NEW.steps := COALESCE(NEW.steps, NEW.steps_json);

  NEW.qualifications_json := COALESCE(NEW.qualifications_json, NEW.qualifications);
  NEW.qualifications := COALESCE(NEW.qualifications, NEW.qualifications_json);

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tasks_alias_columns ON public.tasks;
CREATE TRIGGER trg_sync_tasks_alias_columns
  BEFORE INSERT OR UPDATE OF
    sequence,
    sequence_order,
    assigned_to,
    assigned_technician_id,
    steps,
    steps_json,
    qualifications,
    qualifications_json
  ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tasks_alias_columns();

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_technician_id
  ON public.tasks(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sequence_active
  ON public.tasks(work_package_id, sequence)
  WHERE deleted_at IS NULL AND sequence IS NOT NULL;

COMMENT ON COLUMN public.tasks.assigned_to IS
  'Deprecated alias for assigned_technician_id; kept for backward compatibility.';
COMMENT ON COLUMN public.tasks.sequence_order IS
  'Deprecated alias for sequence; kept for backward compatibility.';
COMMENT ON COLUMN public.tasks.steps IS
  'Deprecated alias for steps_json; kept for backward compatibility.';
COMMENT ON COLUMN public.tasks.qualifications IS
  'Deprecated alias for qualifications_json; kept for backward compatibility.';

COMMIT;
