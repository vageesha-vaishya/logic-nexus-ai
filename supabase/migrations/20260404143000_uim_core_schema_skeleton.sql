-- DB-VERIFICATION: uim-core-skeleton-overlap-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review
-- EXTENSION-ASSESSMENT:
--   Existing platform tables (tenants, franchises, auth.users) are reused.
--   New UIM tables are additive and tenant-scoped to preserve compatibility.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.uim_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  sku varchar(50) NOT NULL,
  part_number varchar(100),
  title varchar(255) NOT NULL,
  category varchar(50),
  unit_of_measure varchar(20) NOT NULL DEFAULT 'pcs',
  is_serialized boolean NOT NULL DEFAULT false,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_uim_catalog_items_sku UNIQUE (tenant_id, sku)
);

CREATE TABLE IF NOT EXISTS public.uim_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  catalog_item_id uuid NOT NULL REFERENCES public.uim_catalog_items(id) ON DELETE RESTRICT,
  serial_number varchar(100),
  batch_lot_number varchar(100),
  quantity numeric(12,4) NOT NULL DEFAULT 1.0000 CHECK (quantity >= 0),
  status varchar(30) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','reserved','quarantine','in_transit','consumed','scrapped')),
  location_type varchar(30),
  location_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_uim_inventory_items_serial UNIQUE (tenant_id, serial_number)
);

CREATE TABLE IF NOT EXISTS public.uim_inventory_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  inventory_item_id uuid NOT NULL REFERENCES public.uim_inventory_items(id) ON DELETE RESTRICT,
  transaction_type varchar(30) NOT NULL
    CHECK (transaction_type IN ('RECEIVE','MOVE','RESERVE','RELEASE','CONSUME','ADJUST','SCRAP','RETURN')),
  quantity_changed numeric(12,4) NOT NULL,
  from_location_id uuid,
  to_location_id uuid,
  referenced_module varchar(50),
  referenced_record_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.uim_inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  catalog_item_id uuid NOT NULL REFERENCES public.uim_catalog_items(id) ON DELETE RESTRICT,
  inventory_item_id uuid REFERENCES public.uim_inventory_items(id) ON DELETE SET NULL,
  reserved_quantity numeric(12,4) NOT NULL CHECK (reserved_quantity > 0),
  reservation_status varchar(30) NOT NULL DEFAULT 'active'
    CHECK (reservation_status IN ('active','fulfilled','expired','cancelled')),
  expected_use_date timestamptz,
  reservation_token varchar(64) NOT NULL,
  referenced_module varchar(50),
  referenced_record_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_uim_inventory_reservations_token UNIQUE (tenant_id, reservation_token)
);

ALTER TABLE public.uim_inventory_ledger
  ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES public.uim_inventory_reservations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_uim_catalog_items_tenant_sku
  ON public.uim_catalog_items(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_uim_inventory_items_tenant_catalog
  ON public.uim_inventory_items(tenant_id, catalog_item_id, status);
CREATE INDEX IF NOT EXISTS idx_uim_inventory_ledger_tenant_item_created
  ON public.uim_inventory_ledger(tenant_id, inventory_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uim_inventory_reservations_tenant_catalog
  ON public.uim_inventory_reservations(tenant_id, catalog_item_id, reservation_status, created_at DESC);

ALTER TABLE public.uim_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uim_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uim_inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uim_inventory_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uim_platform_admin_access ON public.uim_catalog_items;
CREATE POLICY uim_platform_admin_access
  ON public.uim_catalog_items
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS uim_tenant_scope_access ON public.uim_catalog_items;
CREATE POLICY uim_tenant_scope_access
  ON public.uim_catalog_items
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS uim_platform_admin_access ON public.uim_inventory_items;
CREATE POLICY uim_platform_admin_access
  ON public.uim_inventory_items
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS uim_tenant_scope_access ON public.uim_inventory_items;
CREATE POLICY uim_tenant_scope_access
  ON public.uim_inventory_items
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS uim_platform_admin_access ON public.uim_inventory_ledger;
CREATE POLICY uim_platform_admin_access
  ON public.uim_inventory_ledger
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS uim_tenant_scope_access ON public.uim_inventory_ledger;
CREATE POLICY uim_tenant_scope_access
  ON public.uim_inventory_ledger
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS uim_platform_admin_access ON public.uim_inventory_reservations;
CREATE POLICY uim_platform_admin_access
  ON public.uim_inventory_reservations
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS uim_tenant_scope_access ON public.uim_inventory_reservations;
CREATE POLICY uim_tenant_scope_access
  ON public.uim_inventory_reservations
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

COMMIT;
