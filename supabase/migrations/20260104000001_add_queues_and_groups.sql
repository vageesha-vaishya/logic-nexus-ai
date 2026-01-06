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
DROP POLICY IF EXISTS "Admins can manage queues" ON public.queues;
DROP POLICY IF EXISTS "Users can view queues in their tenant" ON public.queues;

-- 3. Re-create Policies
CREATE POLICY "Tenant admins can manage queues"
ON public.queues
FOR ALL
USING (
  has_role(auth.uid(), 'tenant_admin') 
  AND tenant_id = get_user_tenant_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'tenant_admin') 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Admins can manage queues"
ON public.queues
FOR ALL
USING (has_role(auth.uid(), 'platform_admin'))
WITH CHECK (has_role(auth.uid(), 'platform_admin'));

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
DROP POLICY IF EXISTS "Admins can manage queue members" ON public.queue_members;
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
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.id = queue_members.queue_id
    AND q.tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'tenant_admin')
  )
);

CREATE POLICY "Admins can manage queue members"
ON public.queue_members
FOR ALL
USING (has_role(auth.uid(), 'platform_admin'))
WITH CHECK (has_role(auth.uid(), 'platform_admin'));

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
