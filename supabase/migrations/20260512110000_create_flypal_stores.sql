-- DB-VERIFICATION: No existing flypal table matches flypal_stores.csv heading set for store/station/customer status rows.
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

CREATE SCHEMA IF NOT EXISTS flypal;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS flypal.flypal_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store text,
  station text,
  valued_store text,
  owned_by_customer text,
  customer text,
  not_in_use text,
  not_in_use_date text,
  CONSTRAINT uq_flypal_stores_all_columns UNIQUE (
    store,
    station,
    valued_store,
    owned_by_customer,
    customer,
    not_in_use,
    not_in_use_date
  )
);

COMMENT ON TABLE flypal.flypal_stores IS
  'Flypal stores imported from flypal_stores.csv (raw external source headings preserved).';

COMMIT;
