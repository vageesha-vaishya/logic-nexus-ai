create table public.aircraft_template (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid null,
  template_name text not null,
  aircraft_type text not null,
  manufacturer text null,
  manufacturer_id uuid null,
  aircraft_model text null,
  maintenance_program text null,
  revision_number text null,
  amendment_number text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid null,
  updated_by uuid null,
  constraint aircraft_template_pkey primary key (id),
  constraint aircraft_template_tenant_id_fkey foreign key (tenant_id) references public.tenants (id) on delete cascade,
  constraint aircraft_template_manufacturer_id_fkey foreign key (manufacturer_id) references public.manufacturers (id) on delete set null
) tablespace pg_default;

insert into public.aircraft_template
  ( tenant_id, template_name, aircraft_type, manufacturer, aircraft_model, maintenance_program, revision_number, amendment_number)
values
  ( 'e42ec6fd-6b88-4721-befe-4443d9743120', 'A320 48H Transit Check', 'NarrowBody', 'Airbus', 'A320', 'AMP-A320-REV4', '04', '002'),
  ( 'e42ec6fd-6b88-4721-befe-4443d9743120', 'B787 Heavy Maintenance Base', 'WideBody', 'Boeing', '787-9', 'AMP-B787-OP7', '07', '001');

create table public.aircraft_template_counters (
  id uuid not null default gen_random_uuid(),
 tenant_id uuid null,
  template_id uuid not null,
  counter_name text not null,
  model_affected text null,
  unit_measured text null,
  constraint aircraft_template_counters_pkey primary key (id),
  constraint aircraft_template_counters_tenant_id_fkey foreign key (tenant_id) references public.tenants (id) on delete cascade
  --constraint aircraft_template_counters_template_fkey foreign key (template_id) references public.aircraft_template (id) on delete cascade
) tablespace pg_default;

create index if not exists idx_tmpl_cntrs_template_id on public.aircraft_template_counters(template_id);

insert into public.aircraft_template_counters
  (template_id, counter_name, model_affected, unit_measured)
values
  ('11111111-1111-1111-1111-111111111111', 'Calendar', 'Nose Gear Assy', 'since'),
  ('11111111-1111-1111-1111-111111111111', 'Flight hours', 'Airframe', 'hours'),
  ('11111111-1111-1111-1111-111111111111', 'Landing', 'Airframe', 'cycles'),
  ('11111111-1111-1111-1111-111111111111', 'N1', 'Engine 1', 'value'),
  ('11111111-1111-1111-1111-111111111111', 'N2', 'Engine 2', 'value'),
  ('22222222-2222-2222-2222-222222222222', 'Calendar', 'Main Landing Gear', 'since'),
  ('22222222-2222-2222-2222-222222222222', 'Flight hours', 'Airframe', 'hours'),
  ('22222222-2222-2222-2222-222222222222', 'Landing', 'Airframe', 'cycles'),
  ('22222222-2222-2222-2222-222222222222', 'APU Hours', 'GTCP331-500', 'hours'),
  ('22222222-2222-2222-2222-222222222222', 'APU Cycles', 'GTCP331-500', 'cycles');
