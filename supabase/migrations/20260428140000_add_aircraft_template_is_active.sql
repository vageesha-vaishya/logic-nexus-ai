alter table if exists public.aircraft_template
  add column if not exists is_active boolean;

alter table if exists public.aircraft_template
  alter column is_active set default true;

update public.aircraft_template
set is_active = true
where is_active is null;

alter table if exists public.aircraft_template
  alter column is_active set not null;
