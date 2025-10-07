-- UI Themes storage for scoped theme management
-- Creates table to store gradient tokens and metadata per scope

create table if not exists public.ui_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- tokens JSON: { start, end, primary, accent, angle, radius, sidebarBackground, sidebarAccent, dark, bgStart, bgEnd, bgAngle }
  tokens jsonb not null,
  scope text not null check (scope in ('platform','tenant','franchise','user')),
  tenant_id uuid null references public.tenants(id) on delete cascade,
  franchise_id uuid null references public.franchises(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- prevent duplicate names within the same scope context
create unique index if not exists ui_themes_scope_name_unique
  on public.ui_themes (scope, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

alter table public.ui_themes enable row level security;

-- Read policy: allow authenticated users to read themes.
-- In production, refine to match tenant/franchise/user scopes with membership checks.
create policy ui_themes_read_authenticated on public.ui_themes
  for select
  to authenticated
  using (is_active);

-- Insert/Update/Delete: allow users to manage their own user-scoped themes.
create policy ui_themes_user_write on public.ui_themes
  for all
  to authenticated
  using (
    scope = 'user' and user_id = auth.uid()
  )
  with check (
    scope = 'user' and user_id = auth.uid()
  );

-- Basic trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ui_themes_set_updated_at on public.ui_themes;
create trigger ui_themes_set_updated_at
  before update on public.ui_themes
  for each row execute function public.set_updated_at();