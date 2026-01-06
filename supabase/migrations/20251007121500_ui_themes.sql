-- Safe Migration for UI Themes
CREATE TABLE IF NOT EXISTS public.ui_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
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

-- Create Index (Safe if exists)
CREATE UNIQUE INDEX IF NOT EXISTS ui_themes_scope_name_unique
  ON public.ui_themes (scope, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

ALTER TABLE public.ui_themes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS ui_themes_read_authenticated ON public.ui_themes;
DROP POLICY IF EXISTS ui_themes_user_write ON public.ui_themes;

-- Re-create policies
CREATE POLICY ui_themes_read_authenticated ON public.ui_themes
  FOR SELECT
  TO authenticated
  USING (is_active);

CREATE POLICY ui_themes_user_write ON public.ui_themes
  FOR ALL
  TO authenticated
  USING (scope = 'user' and user_id = auth.uid())
  WITH CHECK (scope = 'user' and user_id = auth.uid());

-- Refresh Schema Cache
NOTIFY pgrst, 'reload config';
