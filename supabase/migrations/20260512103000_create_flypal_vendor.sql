-- DB-VERIFICATION: Assessed existing vendor tables (e.g. public.vendors) and flypal staging tables; none match flypal_vendors.csv shape without cross-domain coupling.
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

CREATE SCHEMA IF NOT EXISTS flypal;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS flypal.flypal_vendor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor text,
  code text,
  address text,
  city text,
  zip_code text,
  state text,
  country text,
  contact_person text
);

COMMENT ON TABLE flypal.flypal_vendor IS
  'Flypal vendor master rows imported from flypal_vendors.csv (raw external source).';

COMMIT;
