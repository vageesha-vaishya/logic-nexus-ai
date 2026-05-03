-- DB-VERIFICATION: flight-crew-role-table-overlap-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

create extension if not exists pgcrypto;

create table if not exists public.flight_crew_role (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  role_name text not null,
  role_description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint flight_crew_role_tenant_role_name_uk unique (tenant_id, role_name),
  constraint flight_crew_role_role_name_not_blank_ck check (length(trim(role_name)) > 0)
);

insert into public.flight_crew_role (tenant_id, role_name, role_description)
values
  ('157b8d12-c115-446e-a4dc-d12077751fe2'::uuid, 'Pilot in Command', 'Primary pilot responsible for command authority and flight decisions.'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2'::uuid, 'Co-pilot', 'Second-in-command pilot supporting flight operations and navigation.'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2'::uuid, 'Cabin Crew', 'Crew member responsible for cabin safety and passenger service.'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2'::uuid, 'AME', 'Aircraft Maintenance Engineer responsible for maintenance certification and release.'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2'::uuid, 'Flight Technician', 'Technical crew role supporting systems monitoring and specialized checks.'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2'::uuid, 'Observer', 'Authorized observer onboard for oversight, audit, or training purposes.'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2'::uuid, 'DHD', 'Deadhead crew member traveling as passenger for positioning purposes.'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2'::uuid, 'On Duty', 'Crew member assigned as active duty for the operation period.'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2'::uuid, 'Flight Engineer', 'Crew member responsible for aircraft systems operation and monitoring.'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2'::uuid, 'Load Master', 'Crew member responsible for load planning, weight and balance, and cargo security.'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2'::uuid, 'Ground Engineer', 'Engineering support role responsible for ground-side technical readiness.'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2'::uuid, 'Trainee', 'Crew member in supervised training capacity.'),
  ('157b8d12-c115-446e-a4dc-d12077751fe2'::uuid, 'Operating', 'Crew member designated as operating crew for the specific sector.')
on conflict (tenant_id, role_name) do update
set
  role_description = excluded.role_description,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());
