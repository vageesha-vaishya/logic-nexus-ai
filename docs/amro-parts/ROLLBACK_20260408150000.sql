BEGIN;

DROP INDEX IF EXISTS public.idx_amro_parts_workflow_events_inventory;
DROP INDEX IF EXISTS public.idx_amro_parts_workflow_events_tenant_created;
DROP TABLE IF EXISTS public.amro_parts_mro_workflow_events;

ALTER TABLE public.parts_inventory
  DROP CONSTRAINT IF EXISTS parts_inventory_serial_number_format_ck,
  DROP CONSTRAINT IF EXISTS parts_inventory_part_number_format_ck;

ALTER TABLE public.parts_inventory
  DROP COLUMN IF EXISTS lifecycle_status;

COMMIT;

