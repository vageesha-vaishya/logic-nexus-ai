-- Phase 1 Slice B prep — extend public.app_role with 'compliance_officer'.
--
-- The next migration (20260528150000_create_core_audit_log.sql) declares a
-- policy that grants compliance_officer SELECT across the tenant's audit_log
-- for regulator-evidence pulls. Postgres forbids using a newly-added enum
-- value in the same transaction that adds it, so the ADD VALUE lives in its
-- own migration here.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'compliance_officer';
