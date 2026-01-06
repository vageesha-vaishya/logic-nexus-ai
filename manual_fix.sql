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
-- Safe Migration for Queues
-- 1. Create Queues Table (Safe if exists)
CREATE TABLE IF NOT EXISTS public.queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    type TEXT CHECK (type IN ('holding', 'round_robin')) DEFAULT 'holding',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Tenant admins can manage queues" ON public.queues;
DROP POLICY IF EXISTS "Users can view queues in their tenant" ON public.queues;

-- 3. Re-create Policies
CREATE POLICY "Tenant admins can manage queues"
ON public.queues
FOR ALL
USING (
  has_role(auth.uid(), 'tenant_admin') 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can view queues in their tenant"
ON public.queues
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
);

-- 4. Queue Members Table
CREATE TABLE IF NOT EXISTS public.queue_members (
    queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (queue_id, user_id)
);

ALTER TABLE public.queue_members ENABLE ROW LEVEL SECURITY;

-- Drop policies for queue_members
DROP POLICY IF EXISTS "Tenant admins can manage queue members" ON public.queue_members;
DROP POLICY IF EXISTS "Users can view queue members in their tenant" ON public.queue_members;

-- Re-create policies
CREATE POLICY "Tenant admins can manage queue members"
ON public.queue_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.id = queue_members.queue_id
    AND q.tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'tenant_admin')
  )
);

CREATE POLICY "Users can view queue members in their tenant"
ON public.queue_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.id = queue_members.queue_id
    AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- 5. Add columns to related tables (Safe if exists)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS owner_queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL;

ALTER TABLE public.lead_assignment_rules 
ADD COLUMN IF NOT EXISTS assigned_queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assignment_type TEXT CHECK (assignment_type IN ('user', 'queue', 'round_robin_group')) DEFAULT 'user';

-- 6. Refresh Schema Cache
NOTIFY pgrst, 'reload config';
