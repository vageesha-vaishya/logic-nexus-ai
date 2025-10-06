-- Fix RLS policy for consignees to allow platform admins global access
-- Ensures platform admins can SELECT/INSERT/UPDATE/DELETE across all rows

-- Enable RLS (idempotent)
ALTER TABLE public.consignees ENABLE ROW LEVEL SECURITY;

-- Drop and recreate platform admin policy with proper USING/WITH CHECK
DROP POLICY IF EXISTS "Platform admins can manage all consignees" ON public.consignees;

CREATE POLICY "Platform admins can manage all consignees"
ON public.consignees
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- Keep tenant-scoped policies as defined elsewhere; this file only fixes admin policy.