-- DB-VERIFICATION: Verified required AMRO aircraft list fields are absent in public.aircraft and added as additive columns.
-- DB-ARCH-APPROVAL: Required before merge as per database governance policy.

ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS defect_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_limit_remaining numeric(15,2),
  ADD COLUMN IF NOT EXISTS restrictions text;

ALTER TABLE public.aircraft
  ADD CONSTRAINT aircraft_defect_count_non_negative
  CHECK (defect_count >= 0) NOT VALID;

ALTER TABLE public.aircraft
  VALIDATE CONSTRAINT aircraft_defect_count_non_negative;
