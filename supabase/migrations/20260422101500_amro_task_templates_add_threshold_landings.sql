-- AMRO task templates threshold landings
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review

alter table if exists public.task_templates
  add column if not exists threshold_landings integer null;

comment on column public.task_templates.threshold_landings is
  'Landing threshold for task template maintenance intervals where applicable.';
