-- DB-VERIFICATION: uim-phase2-core-services-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review
-- EXTENSION-ASSESSMENT:
--   Adds command/event projection support for deterministic replay
--   without modifying Phase-1 table contracts.

BEGIN;

CREATE TABLE IF NOT EXISTS public.uim_inventory_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  command_type varchar(30) NOT NULL
    CHECK (command_type IN ('RECEIVE','MOVE','RESERVE','CONSUME')),
  command_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key varchar(120),
  command_status varchar(20) NOT NULL DEFAULT 'accepted'
    CHECK (command_status IN ('accepted','applied','failed')),
  error_message text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_uim_inventory_commands_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.uim_inventory_projection_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  inventory_item_id uuid NOT NULL REFERENCES public.uim_inventory_items(id) ON DELETE CASCADE,
  projected_available_quantity numeric(12,4) NOT NULL DEFAULT 0,
  projected_reserved_quantity numeric(12,4) NOT NULL DEFAULT 0,
  projected_consumed_quantity numeric(12,4) NOT NULL DEFAULT 0,
  last_ledger_id uuid,
  last_ledger_at timestamptz,
  replay_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_uim_projection_snapshot_item UNIQUE (tenant_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_uim_inventory_commands_tenant_created
  ON public.uim_inventory_commands(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uim_inventory_commands_tenant_type
  ON public.uim_inventory_commands(tenant_id, command_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uim_projection_snapshots_tenant_item
  ON public.uim_inventory_projection_snapshots(tenant_id, inventory_item_id);

ALTER TABLE public.uim_inventory_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uim_inventory_projection_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uim_platform_admin_access ON public.uim_inventory_commands;
CREATE POLICY uim_platform_admin_access
  ON public.uim_inventory_commands
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS uim_tenant_scope_access ON public.uim_inventory_commands;
CREATE POLICY uim_tenant_scope_access
  ON public.uim_inventory_commands
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS uim_platform_admin_access ON public.uim_inventory_projection_snapshots;
CREATE POLICY uim_platform_admin_access
  ON public.uim_inventory_projection_snapshots
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS uim_tenant_scope_access ON public.uim_inventory_projection_snapshots;
CREATE POLICY uim_tenant_scope_access
  ON public.uim_inventory_projection_snapshots
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

COMMIT;
