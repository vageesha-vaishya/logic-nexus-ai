-- Fix security warnings from Phase 2 migration

-- 1. Fix function search_path on update_scheduled_email_timestamp
CREATE OR REPLACE FUNCTION public.update_scheduled_email_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Replace overly permissive audit log INSERT policy with proper check
DROP POLICY IF EXISTS "Service can insert audit logs" ON public.email_audit_log;

CREATE POLICY "Authenticated users can insert audit logs for their actions"
ON public.email_audit_log FOR INSERT
TO authenticated
WITH CHECK (
  -- User can only insert audit logs for emails they have access to
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (public.is_tenant_admin(auth.uid()) AND tenant_id = public.get_user_tenant_id(auth.uid()))
  OR (public.is_franchise_admin(auth.uid()) 
      AND tenant_id = public.get_user_tenant_id(auth.uid())
      AND franchise_id = public.get_user_franchise_id(auth.uid()))
);