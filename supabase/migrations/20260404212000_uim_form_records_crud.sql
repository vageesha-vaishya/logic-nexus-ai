-- DB-VERIFICATION: uim-form-records-overlap-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review
-- EXTENSION-ASSESSMENT:
--   Existing UIM operational tables remain unchanged; this additive table stores dynamic
--   route-form payloads for Phase-1/2 UI CRUD bootstrapping without contract breakage.

BEGIN;

CREATE TABLE IF NOT EXISTS public.uim_form_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  node_key varchar(50) NOT NULL
    CHECK (node_key IN ('overview','item-master','stock-ledger','reservations','issue-consume','restock','locations','analytics')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_uim_form_records_tenant_node
  ON public.uim_form_records(tenant_id, node_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_uim_form_records_tenant_franchise
  ON public.uim_form_records(tenant_id, franchise_id, node_key);

ALTER TABLE public.uim_form_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uim_platform_admin_access ON public.uim_form_records;
CREATE POLICY uim_platform_admin_access
  ON public.uim_form_records
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS uim_tenant_scope_access ON public.uim_form_records;
CREATE POLICY uim_tenant_scope_access
  ON public.uim_form_records
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

COMMIT;
