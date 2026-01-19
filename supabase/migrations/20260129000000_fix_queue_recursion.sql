-- Fix infinite recursion in queue policies by using SECURITY DEFINER functions
-- to break the circular dependency between queues and queue_members RLS.

-- 1. Helper function to check queue membership (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_queue_member_secure(p_queue_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.queue_members
    WHERE queue_id = p_queue_id
    AND user_id = p_user_id
  );
END;
$$;

-- 2. Helper function to get queue tenant (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_queue_tenant_id_secure(p_queue_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.queues
  WHERE id = p_queue_id;
  RETURN v_tenant_id;
END;
$$;

-- 3. Fix policies on public.queues
-- Drop potential conflicting policies
DROP POLICY IF EXISTS "Users can view queues they are members of" ON public.queues;

-- Recreate with secure function to avoid recursion
CREATE POLICY "Users can view queues they are members of"
ON public.queues FOR SELECT
TO authenticated
USING (
  public.is_queue_member_secure(id, auth.uid())
  OR public.has_role(auth.uid(), 'tenant_admin'::public.app_role)
);

-- 4. Fix policies on public.queue_members
-- Cleanup old potentially duplicate policies
DROP POLICY IF EXISTS "Tenant admins can manage queue members" ON public.queue_members;
DROP POLICY IF EXISTS "Tenant admins can manage queue memberships" ON public.queue_members;

-- Recreate consistent policy using secure function to avoid recursion
CREATE POLICY "Tenant admins can manage queue memberships"
ON public.queue_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'tenant_admin'
    AND ur.tenant_id = public.get_queue_tenant_id_secure(queue_members.queue_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'tenant_admin'
    AND ur.tenant_id = public.get_queue_tenant_id_secure(queue_members.queue_id)
  )
);
