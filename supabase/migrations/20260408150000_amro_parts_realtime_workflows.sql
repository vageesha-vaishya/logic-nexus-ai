BEGIN;

ALTER TABLE public.parts_inventory
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'serviceable'
    CHECK (lifecycle_status IN (
      'serviceable',
      'inspection_due',
      'needs_repair',
      'repair_in_progress',
      'ready_for_install',
      'replaced',
      'retired',
      'quarantined'
    ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'parts_inventory_part_number_format_ck'
      AND conrelid = 'public.parts_inventory'::regclass
  ) THEN
    ALTER TABLE public.parts_inventory
      ADD CONSTRAINT parts_inventory_part_number_format_ck
      CHECK (part_number ~ '^[A-Z0-9-]{3,64}$');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'parts_inventory_serial_number_format_ck'
      AND conrelid = 'public.parts_inventory'::regclass
  ) THEN
    ALTER TABLE public.parts_inventory
      ADD CONSTRAINT parts_inventory_serial_number_format_ck
      CHECK (serial_number IS NULL OR serial_number ~ '^[A-Z0-9-]{1,64}$');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.amro_parts_mro_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  part_inventory_id uuid NOT NULL REFERENCES public.parts_inventory(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'part_inspection',
    'repair_scheduling',
    'replacement_authorization'
  )),
  event_status text NOT NULL DEFAULT 'pending' CHECK (event_status IN ('pending', 'triggered', 'completed', 'failed')),
  trigger_reason text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_parts_workflow_events_tenant_created
  ON public.amro_parts_mro_workflow_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_amro_parts_workflow_events_inventory
  ON public.amro_parts_mro_workflow_events (part_inventory_id, event_type, event_status);

COMMIT;

