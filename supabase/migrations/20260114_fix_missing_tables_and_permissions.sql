-- Fix Missing Tables for Dynamic Roles and UI Themes
-- This migration combines missing schema elements from 20240107_dynamic_roles.sql and 20251007121500_ui_themes.sql
-- And ensures the current user has platform_admin access.

-- 1. Dynamic Roles Tables
CREATE TABLE IF NOT EXISTS public.auth_roles (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 99,
    can_manage_scopes TEXT[] DEFAULT '{}',
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auth_permissions (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auth_role_permissions (
    role_id TEXT REFERENCES public.auth_roles(id) ON DELETE CASCADE,
    permission_id TEXT REFERENCES public.auth_permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.auth_role_hierarchy (
    manager_role_id TEXT REFERENCES public.auth_roles(id) ON DELETE CASCADE,
    target_role_id TEXT REFERENCES public.auth_roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (manager_role_id, target_role_id)
);

-- Enable RLS for Auth Tables
ALTER TABLE public.auth_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_role_hierarchy ENABLE ROW LEVEL SECURITY;

-- Policies for Auth Tables (Simplified for fix)
DO $$ BEGIN
  CREATE POLICY "Everyone can view roles" ON public.auth_roles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Everyone can view permissions" ON public.auth_permissions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Everyone can view role permissions" ON public.auth_role_permissions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Everyone can view hierarchy" ON public.auth_role_hierarchy FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insert Default Roles
INSERT INTO public.auth_roles (id, label, description, level, can_manage_scopes, is_system) VALUES
('platform_admin', 'Platform Administrator', 'Full system access with global visibility', 0, '{global,tenant,franchise}', true),
('tenant_admin', 'Tenant Administrator', 'Manages a specific tenant and its franchises', 1, '{tenant,franchise}', true),
('franchise_admin', 'Franchise Administrator', 'Manages a specific franchise location', 2, '{franchise}', true),
('user', 'Standard User', 'Operational user with restricted access', 3, '{}', true)
ON CONFLICT (id) DO NOTHING;

-- 2. UI Themes Table
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

CREATE UNIQUE INDEX IF NOT EXISTS ui_themes_scope_name_unique
  ON public.ui_themes (scope, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

ALTER TABLE public.ui_themes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY ui_themes_read_authenticated ON public.ui_themes FOR SELECT TO authenticated USING (is_active);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY ui_themes_user_write ON public.ui_themes FOR ALL TO authenticated USING (scope = 'user' and user_id = auth.uid()) WITH CHECK (scope = 'user' and user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Fix User Permissions
-- Ensure the specific user has platform_admin role
-- User ID: ce4c64f5-cd8c-4d2d-bbbd-04972c4a7768

DO $$
DECLARE
  v_user_id UUID := 'ce4c64f5-cd8c-4d2d-bbbd-04972c4a7768';
BEGIN
  -- Only proceed if user exists in profiles to avoid FK errors
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
      
      -- Delete any existing non-admin roles for this user to avoid conflicts or confusion
      DELETE FROM public.user_roles WHERE user_id = v_user_id AND role != 'platform_admin';
      
      -- Insert platform_admin role if not exists
      IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'platform_admin') THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_user_id, 'platform_admin');
      END IF;
      
  END IF;
END $$;

NOTIFY pgrst, 'reload config';
