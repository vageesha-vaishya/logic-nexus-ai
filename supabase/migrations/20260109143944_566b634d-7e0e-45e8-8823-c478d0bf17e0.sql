-- Fix RLS for import history so tenant-scoped users are restricted, while platform admins can operate without a tenant assignment.

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history_details ENABLE ROW LEVEL SECURITY;

-- Drop previous policies (names may vary across earlier iterations)
DROP POLICY IF EXISTS "Users can view import history" ON public.import_history;
DROP POLICY IF EXISTS "Users can insert import history" ON public.import_history;
DROP POLICY IF EXISTS "Users can update import history" ON public.import_history;
DROP POLICY IF EXISTS "Users can delete import history" ON public.import_history;
DROP POLICY IF EXISTS "Users can view import history for their tenant" ON public.import_history;
DROP POLICY IF EXISTS "Users can insert import history for their tenant" ON public.import_history;
DROP POLICY IF EXISTS "Users can update import history for their tenant" ON public.import_history;

DROP POLICY IF EXISTS "Users can view import details" ON public.import_history_details;
DROP POLICY IF EXISTS "Users can insert import details" ON public.import_history_details;
DROP POLICY IF EXISTS "Users can update import details" ON public.import_history_details;
DROP POLICY IF EXISTS "Users can view import details for their tenant" ON public.import_history_details;
DROP POLICY IF EXISTS "Users can insert import details for their tenant" ON public.import_history_details;
DROP POLICY IF EXISTS "Users can update import details for their tenant" ON public.import_history_details;

-- Helper predicate embedded in each policy:
-- 1) platform_admin can access everything
-- 2) otherwise limited to user's tenant_id(s) from user_roles

-- import_history policies
CREATE POLICY "Import history: select"
ON public.import_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR tenant_id IN (
    SELECT ur.tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id IS NOT NULL
  )
);

CREATE POLICY "Import history: insert"
ON public.import_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR tenant_id IN (
    SELECT ur.tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id IS NOT NULL
  )
);

CREATE POLICY "Import history: update"
ON public.import_history
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR tenant_id IN (
    SELECT ur.tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id IS NOT NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR tenant_id IN (
    SELECT ur.tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id IS NOT NULL
  )
);

-- import_history_details policies (linked via import_id -> import_history.tenant_id)
CREATE POLICY "Import details: select"
ON public.import_history_details
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR import_id IN (
    SELECT ih.id
    FROM public.import_history ih
    WHERE ih.tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
);

CREATE POLICY "Import details: insert"
ON public.import_history_details
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR import_id IN (
    SELECT ih.id
    FROM public.import_history ih
    WHERE ih.tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
);

CREATE POLICY "Import details: update"
ON public.import_history_details
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR import_id IN (
    SELECT ih.id
    FROM public.import_history ih
    WHERE ih.tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'platform_admin'
  )
  OR import_id IN (
    SELECT ih.id
    FROM public.import_history ih
    WHERE ih.tenant_id IN (
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
    )
  )
);

-- Ensure authenticated role has table privileges (RLS still enforces row access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_history_details TO authenticated;
