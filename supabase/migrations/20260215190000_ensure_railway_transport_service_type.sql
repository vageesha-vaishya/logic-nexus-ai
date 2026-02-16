-- Ensure global Rail service type exists and is active
insert into service_types (code, name, is_active)
values ('railway_transport', 'Rail transport', true)
on conflict (code) do update
  set name = excluded.name,
      is_active = true;

