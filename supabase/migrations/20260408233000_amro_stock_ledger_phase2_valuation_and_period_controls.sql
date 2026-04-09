BEGIN;

CREATE TABLE IF NOT EXISTS public.amro_stock_valuation_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  ledger_transaction_id uuid NOT NULL REFERENCES public.amro_stock_ledger_transactions(id) ON DELETE CASCADE,
  valuation_layer_id uuid NOT NULL REFERENCES public.amro_stock_valuation_layers(id) ON DELETE CASCADE,
  consumed_quantity numeric(18,6) NOT NULL CHECK (consumed_quantity > 0),
  unit_cost numeric(18,6) NOT NULL CHECK (unit_cost >= 0),
  consumed_cost numeric(18,6) GENERATED ALWAYS AS (consumed_quantity * unit_cost) STORED,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_stock_valuation_consumptions_tenant_txn
  ON public.amro_stock_valuation_consumptions (tenant_id, ledger_transaction_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.amro_stock_period_closes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  period_code text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  close_status text NOT NULL DEFAULT 'open' CHECK (close_status IN ('open', 'closing', 'closed', 'reopened')),
  valuation_method text NOT NULL DEFAULT 'weighted_average' CHECK (valuation_method IN ('fifo', 'lifo', 'weighted_average')),
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  reopened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reopened_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_code)
);

CREATE INDEX IF NOT EXISTS idx_amro_stock_period_closes_tenant_status
  ON public.amro_stock_period_closes (tenant_id, close_status, period_end DESC);

CREATE TABLE IF NOT EXISTS public.amro_stock_approval_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN ('adjustment', 'period_reopen', 'backdated_posting')),
  request_status text NOT NULL DEFAULT 'pending' CHECK (request_status IN ('pending', 'approved', 'rejected')),
  related_transaction_id uuid REFERENCES public.amro_stock_ledger_transactions(id) ON DELETE SET NULL,
  related_period_id uuid REFERENCES public.amro_stock_period_closes(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  reason text,
  decision_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_stock_approval_queue_tenant_status
  ON public.amro_stock_approval_queue (tenant_id, request_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.amro_stock_audit_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_category text NOT NULL DEFAULT 'stock-ledger',
  reference_id text,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  immutable_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_stock_audit_timeline_tenant_created
  ON public.amro_stock_audit_timeline (tenant_id, created_at DESC);

CREATE OR REPLACE VIEW public.amro_stock_audit_export AS
SELECT
  tenant_id,
  franchise_id,
  actor_user_id,
  event_type,
  event_category,
  reference_id,
  event_payload,
  immutable_hash,
  created_at
FROM public.amro_stock_audit_timeline
ORDER BY created_at DESC;

COMMIT;
