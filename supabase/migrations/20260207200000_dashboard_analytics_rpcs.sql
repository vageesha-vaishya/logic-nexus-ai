-- Migration: Dashboard Analytics RPCs
-- Description: Adds RPCs for dashboard analytics (financials, volume, stats)
-- Date: 2026-02-03

BEGIN;

-- 1. Get Financial Metrics (Revenue vs Cost)
CREATE OR REPLACE FUNCTION public.get_financial_metrics(period text DEFAULT '12m')
RETURNS TABLE (
  month text,
  revenue numeric,
  cost numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- We'll just ignore the period argument for now and default to 12 months
  -- to keep it simple, but we can extend it later.
  
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) as month
  ),
  monthly_revenue AS (
    SELECT 
      date_trunc('month', issue_date) as month,
      sum(total) as revenue
    FROM public.invoices
    WHERE status NOT IN ('draft', 'cancelled')
      AND issue_date >= (now() - interval '1 year')
      AND tenant_id = public.get_user_tenant_id(auth.uid())
    GROUP BY 1
  ),
  monthly_cost AS (
    SELECT 
      date_trunc('month', created_at) as month,
      sum(total_cost) as cost
    FROM public.shipments
    WHERE status NOT IN ('draft', 'cancelled')
      AND created_at >= (now() - interval '1 year')
      AND tenant_id = public.get_user_tenant_id(auth.uid())
    GROUP BY 1
  )
  SELECT 
    to_char(m.month, 'Mon') as month,
    COALESCE(r.revenue, 0) as revenue,
    COALESCE(c.cost, 0) as cost
  FROM months m
  LEFT JOIN monthly_revenue r ON m.month = r.month
  LEFT JOIN monthly_cost c ON m.month = c.month
  ORDER BY m.month;
END;
$$;

-- 2. Get Shipment Volume by Carrier
CREATE OR REPLACE FUNCTION public.get_carrier_volume(period text DEFAULT '12m')
RETURNS TABLE (
  carrier text,
  count bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.carrier_name as carrier,
    count(s.id) as count
  FROM public.shipments s
  JOIN public.carriers c ON s.carrier_id = c.id
  WHERE s.created_at >= (now() - interval '1 year')
    AND s.tenant_id = public.get_user_tenant_id(auth.uid())
  GROUP BY c.carrier_name
  ORDER BY count DESC
  LIMIT 10;
END;
$$;

-- 3. Get Dashboard Stats (Cards)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (
  total_revenue numeric,
  active_shipments bigint,
  pending_invoices bigint,
  total_profit numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.get_user_tenant_id(auth.uid());
  
  RETURN QUERY
  SELECT
    (SELECT COALESCE(sum(total), 0) FROM public.invoices 
     WHERE tenant_id = v_tenant_id AND status NOT IN ('draft', 'cancelled') AND issue_date >= date_trunc('year', now())) as total_revenue,
     
    (SELECT count(*) FROM public.shipments 
     WHERE tenant_id = v_tenant_id AND status IN ('confirmed', 'in_transit', 'customs', 'out_for_delivery')) as active_shipments,
     
    (SELECT count(*) FROM public.invoices 
     WHERE tenant_id = v_tenant_id AND status IN ('issued', 'overdue', 'partial')) as pending_invoices,
     
    (SELECT 
       COALESCE(
         (SELECT sum(total) FROM public.invoices WHERE tenant_id = v_tenant_id AND status NOT IN ('draft', 'cancelled') AND issue_date >= date_trunc('year', now())), 0
       ) - 
       COALESCE(
         (SELECT sum(total_cost) FROM public.shipments WHERE tenant_id = v_tenant_id AND status NOT IN ('draft', 'cancelled') AND created_at >= date_trunc('year', now())), 0
       )
    ) as total_profit;
END;
$$;

COMMIT;
