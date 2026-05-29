-- Idempotency anchor for the logistics.shipment.delivered → draft
-- invoice chain. The cross-module consumer stamps
-- metadata.source_outbox_id on every draft invoice it creates;
-- this UNIQUE partial index ensures the same outbox event can't
-- produce two draft invoices even if two consumer instances race.

CREATE UNIQUE INDEX IF NOT EXISTS finance_invoices_source_outbox_unique
  ON finance.invoices ((metadata->>'source_outbox_id'))
  WHERE metadata ? 'source_outbox_id';

COMMENT ON INDEX finance.finance_invoices_source_outbox_unique IS
  'Phase 5 cross-module consumer idempotency anchor — no two draft invoices share the same source_outbox_id.';
