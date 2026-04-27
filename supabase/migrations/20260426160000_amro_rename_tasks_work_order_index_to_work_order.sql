-- DB-VERIFICATION: tasks-work-order-index-alignment-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

CREATE INDEX IF NOT EXISTS idx_tasks_work_order_id
  ON public.tasks(work_order_id);

COMMIT;
