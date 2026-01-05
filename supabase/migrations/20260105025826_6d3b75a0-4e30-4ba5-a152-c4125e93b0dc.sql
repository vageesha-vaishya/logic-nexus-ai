-- Territory geography mappings (used by territory assignment module)
create table if not exists public.territory_geographies (
  id uuid primary key default gen_random_uuid(),
  territory_id uuid not null references public.territories(id) on delete cascade,
  continent_id uuid null references public.continents(id),
  country_id uuid null references public.countries(id),
  state_id uuid null references public.states(id),
  city_id uuid null references public.cities(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_territory_geographies_territory_id
  on public.territory_geographies(territory_id);

create index if not exists idx_territory_geographies_continent_id
  on public.territory_geographies(continent_id);

create index if not exists idx_territory_geographies_country_id
  on public.territory_geographies(country_id);

create index if not exists idx_territory_geographies_state_id
  on public.territory_geographies(state_id);

create index if not exists idx_territory_geographies_city_id
  on public.territory_geographies(city_id);

alter table public.territory_geographies enable row level security;

-- Access: users can manage geographies for territories in their tenant; platform admins can manage all.
create policy "Territory geographies readable"
on public.territory_geographies
for select
using (
  exists (
    select 1
    from public.user_roles ur
    join public.territories t on t.id = territory_geographies.territory_id
    where ur.user_id = auth.uid()
      and (ur.role = 'platform_admin'::app_role or ur.tenant_id = t.tenant_id)
  )
);

create policy "Territory geographies insertable"
on public.territory_geographies
for insert
with check (
  exists (
    select 1
    from public.user_roles ur
    join public.territories t on t.id = territory_geographies.territory_id
    where ur.user_id = auth.uid()
      and (ur.role = 'platform_admin'::app_role or ur.tenant_id = t.tenant_id)
  )
);

create policy "Territory geographies updatable"
on public.territory_geographies
for update
using (
  exists (
    select 1
    from public.user_roles ur
    join public.territories t on t.id = territory_geographies.territory_id
    where ur.user_id = auth.uid()
      and (ur.role = 'platform_admin'::app_role or ur.tenant_id = t.tenant_id)
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    join public.territories t on t.id = territory_geographies.territory_id
    where ur.user_id = auth.uid()
      and (ur.role = 'platform_admin'::app_role or ur.tenant_id = t.tenant_id)
  )
);

create policy "Territory geographies deletable"
on public.territory_geographies
for delete
using (
  exists (
    select 1
    from public.user_roles ur
    join public.territories t on t.id = territory_geographies.territory_id
    where ur.user_id = auth.uid()
      and (ur.role = 'platform_admin'::app_role or ur.tenant_id = t.tenant_id)
  )
);

-- Ensure the API schema cache picks up the new table immediately
select pg_notify('pgrst', 'reload schema');
