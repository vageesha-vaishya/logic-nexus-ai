-- DB-VERIFICATION: amro-work-order-templates-alignment-reviewed
-- DB-ARCH-APPROVAL: pending-amro-arch-board-approval
--
-- Purpose:
-- - Ensure canonical table public.work_order_templates exists and has required indexes.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_work_order_templates_tenant_id
  ON public.work_order_templates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_work_order_templates_aircraft_model
  ON public.work_order_templates(aircraft_model);

COMMIT;
