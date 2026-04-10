-- Phase 2: AOG Alerts, Interchangeable Parts, Purchase Orders, Demand Forecasting
BEGIN;

-- ─── AOG (Aircraft on Ground) Alerts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.amro_aog_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  aircraft_id uuid,
  part_inventory_id uuid NOT NULL REFERENCES public.parts_inventory(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'critical' CHECK (severity IN ('critical', 'high', 'medium')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'escalated', 'resolved', 'cancelled')),
  shortage_quantity numeric(18,6) NOT NULL,
  required_quantity numeric(18,6) NOT NULL,
  required_by timestamptz NOT NULL,
  escalation_level integer NOT NULL DEFAULT 0 CHECK (escalation_level >= 0),
  resolved_at timestamptz,
  resolution_notes text,
  notified_users uuid[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_aog_alerts_tenant_status ON public.amro_aog_alerts (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_amro_aog_alerts_part ON public.amro_aog_alerts (tenant_id, part_inventory_id, status);
CREATE INDEX IF NOT EXISTS idx_amro_aog_alerts_aircraft ON public.amro_aog_alerts (tenant_id, aircraft_id, status);

-- ─── Interchangeable Parts ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.amro_part_interchangeability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  part_inventory_id uuid NOT NULL REFERENCES public.parts_inventory(id) ON DELETE CASCADE,
  alternate_part_id uuid NOT NULL REFERENCES public.parts_inventory(id) ON DELETE CASCADE,
  interchangeability_type text NOT NULL CHECK (interchangeability_type IN ('direct', 'conditional', 'emergency')),
  effectiveness numeric(5,2) NOT NULL DEFAULT 100 CHECK (effectiveness >= 0 AND effectiveness <= 100),
  conditions text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, part_inventory_id, alternate_part_id)
);

CREATE INDEX IF NOT EXISTS idx_amro_part_interchange_part ON public.amro_part_interchangeability (tenant_id, part_inventory_id);
CREATE INDEX IF NOT EXISTS idx_amro_part_interchange_alt ON public.amro_part_interchangeability (tenant_id, alternate_part_id);

-- ─── Purchase Orders ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.amro_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  po_number text NOT NULL UNIQUE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'acknowledged', 'shipped', 'received', 'cancelled')),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  actual_delivery_date date,
  total_amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_purchase_orders_tenant_status ON public.amro_purchase_orders (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_amro_purchase_orders_supplier ON public.amro_purchase_orders (tenant_id, supplier_id);

CREATE TABLE IF NOT EXISTS public.amro_purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.amro_purchase_orders(id) ON DELETE CASCADE,
  part_inventory_id uuid NOT NULL REFERENCES public.parts_inventory(id) ON DELETE CASCADE,
  quantity_ordered numeric(18,6) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received numeric(18,6) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_price numeric(18,2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(18,2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_po_items_po ON public.amro_purchase_order_items (tenant_id, purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_amro_po_items_part ON public.amro_purchase_order_items (tenant_id, part_inventory_id);

-- ─── Demand Forecasting Data ─────────────────────────────────────────────────
ALTER TABLE public.parts_inventory
  ADD COLUMN IF NOT EXISTS demand_forecast_30d numeric(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS demand_forecast_60d numeric(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS demand_forecast_90d numeric(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_daily_demand numeric(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS demand_stddev numeric(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_time_days integer DEFAULT 14,
  ADD COLUMN IF NOT EXISTS dynamic_reorder_point numeric(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS safety_stock numeric(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_forecast_at timestamptz;

-- ─── Computed Reorder Point Function ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.amro_compute_dynamic_reorder_point()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Dynamic Reorder Point = (Avg Daily Demand × Lead Time) + Safety Stock
  -- Safety Stock = Z × StdDev × √(Lead Time)  (Z=1.65 for 95% service level)
  NEW.safety_stock := CEIL(1.65 * COALESCE(NEW.demand_stddev, 0) * SQRT(COALESCE(NEW.lead_time_days, 14)));
  NEW.dynamic_reorder_point := CEIL(COALESCE(NEW.avg_daily_demand, 0) * COALESCE(NEW.lead_time_days, 14)) + NEW.safety_stock;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compute_dynamic_reorder_point
  BEFORE INSERT OR UPDATE OF avg_daily_demand, demand_stddev, lead_time_days ON public.parts_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.amro_compute_dynamic_reorder_point();

-- ─── Demand Forecasting View ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.amro_parts_demand_overview AS
SELECT
  p.tenant_id,
  p.id AS part_inventory_id,
  p.part_number,
  p.description,
  p.warehouse_location,
  p.quantity_available,
  p.reorder_level,
  p.dynamic_reorder_point,
  p.safety_stock,
  p.avg_daily_demand,
  p.demand_stddev,
  p.demand_forecast_30d,
  p.demand_forecast_60d,
  p.demand_forecast_90d,
  p.lead_time_days,
  CASE
    WHEN p.quantity_available <= p.safety_stock THEN 'critical'
    WHEN p.quantity_available <= p.dynamic_reorder_point THEN 'reorder_due'
    WHEN p.quantity_available <= (p.dynamic_reorder_point * 1.5) THEN 'watch'
    ELSE 'healthy'
  END AS forecast_status,
  GREATEST(0, p.demand_forecast_30d - p.quantity_available) AS projected_shortage_30d,
  GREATEST(0, p.demand_forecast_60d - p.quantity_available) AS projected_shortage_60d,
  GREATEST(0, p.demand_forecast_90d - p.quantity_available) AS projected_shortage_90d
FROM public.parts_inventory p;

COMMIT;
