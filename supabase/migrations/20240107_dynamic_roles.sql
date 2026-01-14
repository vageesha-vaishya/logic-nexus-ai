-- Create tables for dynamic role management

-- Roles table (Extension of the hardcoded types)
CREATE TABLE IF NOT EXISTS public.auth_roles (
    id TEXT PRIMARY KEY, -- 'platform_admin', 'tenant_admin', etc.
    label TEXT NOT NULL,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 99,
    can_manage_scopes TEXT[] DEFAULT '{}', -- 'global', 'tenant', 'franchise'
    is_system BOOLEAN DEFAULT FALSE, -- Prevent deletion of core roles
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions Catalog
CREATE TABLE IF NOT EXISTS public.auth_permissions (
    id TEXT PRIMARY KEY, -- 'leads.view', etc.
    category TEXT NOT NULL, -- 'Leads', 'Admin', etc.
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role <-> Permission Mapping
CREATE TABLE IF NOT EXISTS public.auth_role_permissions (
    role_id TEXT REFERENCES public.auth_roles(id) ON DELETE CASCADE,
    permission_id TEXT REFERENCES public.auth_permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- Role Hierarchy (Who can manage whom)
CREATE TABLE IF NOT EXISTS public.auth_role_hierarchy (
    manager_role_id TEXT REFERENCES public.auth_roles(id) ON DELETE CASCADE,
    target_role_id TEXT REFERENCES public.auth_roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (manager_role_id, target_role_id)
);

-- Enable RLS
ALTER TABLE public.auth_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_role_hierarchy ENABLE ROW LEVEL SECURITY;

-- Policies
-- Platform admins can view and manage everything
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_roles'
  ) THEN
    EXECUTE 'CREATE POLICY "Platform admins can manage roles" ON public.auth_roles ' ||
            'USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = ''platform_admin''))';

    EXECUTE 'CREATE POLICY "Platform admins can manage permissions" ON public.auth_permissions ' ||
            'USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = ''platform_admin''))';

    EXECUTE 'CREATE POLICY "Platform admins can manage role permissions" ON public.auth_role_permissions ' ||
            'USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = ''platform_admin''))';

    EXECUTE 'CREATE POLICY "Platform admins can manage hierarchy" ON public.auth_role_hierarchy ' ||
            'USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = ''platform_admin''))';
  END IF;
END $$;

-- Everyone can view roles and permissions (needed for UI/logic)
CREATE POLICY "Everyone can view roles" ON public.auth_roles
    FOR SELECT USING (true);

CREATE POLICY "Everyone can view permissions" ON public.auth_permissions
    FOR SELECT USING (true);

CREATE POLICY "Everyone can view role permissions" ON public.auth_role_permissions
    FOR SELECT USING (true);

CREATE POLICY "Everyone can view hierarchy" ON public.auth_role_hierarchy
    FOR SELECT USING (true);

-- Insert Initial Data (Seed from existing hardcoded values)
INSERT INTO public.auth_roles (id, label, description, level, can_manage_scopes, is_system) VALUES
('platform_admin', 'Platform Administrator', 'Full system access with global visibility', 0, '{global,tenant,franchise}', true),
('tenant_admin', 'Tenant Administrator', 'Manages a specific tenant and its franchises', 1, '{tenant,franchise}', true),
('franchise_admin', 'Franchise Administrator', 'Manages a specific franchise location', 2, '{franchise}', true),
('user', 'Standard User', 'Operational user with restricted access', 3, '{}', true)
ON CONFLICT (id) DO NOTHING;

-- Note: We would need to seed permissions and role_permissions here too, 
-- but that list is long. Ideally, we run a script to populate it from permissions.ts
