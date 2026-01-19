-- Migration: Add tenant_id and franchise_id to import_history
-- Description: Adds columns to track which tenant/franchise an import belongs to

ALTER TABLE import_history
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id),
ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES franchises(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_import_history_tenant ON import_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_history_franchise ON import_history(franchise_id);

-- Enable RLS on import_history if not already enabled
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts/duplication during re-runs or updates
DROP POLICY IF EXISTS "Platform admins full access on import_history" ON import_history;
DROP POLICY IF EXISTS "Tenant admins access own tenant imports" ON import_history;

-- Update RLS policies
-- 1. Platform admins can do everything
CREATE POLICY "Platform admins full access on import_history"
ON import_history
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 2. Tenant admins can view/create for their tenant
CREATE POLICY "Tenant admins access own tenant imports"
ON import_history
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
);
