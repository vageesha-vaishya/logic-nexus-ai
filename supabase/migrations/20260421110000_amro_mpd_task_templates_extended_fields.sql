-- AMRO MPD task template extensions
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review

alter table if exists public.task_templates
  add column if not exists threshold_cycles integer null,
  add column if not exists loc_json jsonb not null default '[]'::jsonb,
  add column if not exists other_details_json jsonb not null default '[]'::jsonb;

comment on column public.task_templates.threshold_cycles is
  'Landing-cycle threshold used by MPD inspection frequency where applicable.';

comment on column public.task_templates.loc_json is
  'Location metadata payload for MPD (zone, area, notes).';

comment on column public.task_templates.other_details_json is
  'Extensible MPD details payload including linked tools/spares/task cards/activity refs and attachments.';
