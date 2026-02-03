
-- Migration: Fix Analytics Cost Column
-- Description: Updates analytics RPCs to remove reference to non-existent 'total_cost' column in shipments table.
--              Temporarily sets cost to 0 until a proper cost tracking mechanism is identified.
-- Date: 2026-02-07

BEGIN;

-- 1. Fix Get Financial Metrics
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
      0::numeric as cost -- Placeholder: shipments table has no total_cost column yet
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

-- 2. Fix Get Dashboard Stats
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
       0 -- Placeholder: Cost is 0 for now
    ) as total_profit;
END;
$$;

-- 3. Fix Get Daily Stats
CREATE OR REPLACE FUNCTION public.get_daily_stats(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_tenant_id uuid;
  v_start_date date;
  v_result jsonb;
BEGIN
  v_tenant_id := public.get_user_tenant_id(auth.uid());
  v_start_date := current_date - (p_days || ' days')::interval;

  WITH date_series AS (
    SELECT generate_series(v_start_date, current_date, '1 day'::interval)::date as day
  ),
  daily_revenue AS (
    SELECT 
      date_trunc('day', issue_date)::date as day,
      sum(total) as value
    FROM public.invoices
    WHERE tenant_id = v_tenant_id 
      AND status NOT IN ('draft', 'cancelled')
      AND issue_date >= v_start_date
    GROUP BY 1
  ),
  daily_shipments AS (
    SELECT 
      date_trunc('day', created_at)::date as day,
      count(*) as value
    FROM public.shipments
    WHERE tenant_id = v_tenant_id 
      AND status NOT IN ('draft', 'cancelled')
      AND created_at >= v_start_date
    GROUP BY 1
  ),
  daily_invoices AS (
    SELECT 
      date_trunc('day', issue_date)::date as day,
      count(*) as value
    FROM public.invoices
    WHERE tenant_id = v_tenant_id 
      AND status IN ('issued', 'overdue', 'partial')
      AND status NOT IN ('draft', 'cancelled')
      AND issue_date >= v_start_date
    GROUP BY 1
  ),
  daily_cost AS (
    SELECT 
      date_trunc('day', created_at)::date as day,
      0::numeric as value -- Placeholder
    FROM public.shipments
    WHERE tenant_id = v_tenant_id 
      AND status NOT IN ('draft', 'cancelled')
      AND created_at >= v_start_date
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'revenue', (
      SELECT jsonb_agg(jsonb_build_object('date', ds.day, 'value', COALESCE(r.value, 0)))
      FROM date_series ds
      LEFT JOIN daily_revenue r ON ds.day = r.day
    ),
    'shipments', (
      SELECT jsonb_agg(jsonb_build_object('date', ds.day, 'value', COALESCE(s.value, 0)))
      FROM date_series ds
      LEFT JOIN daily_shipments s ON ds.day = s.day
    ),
    'invoices', (
      SELECT jsonb_agg(jsonb_build_object('date', ds.day, 'value', COALESCE(i.value, 0)))
      FROM date_series ds
      LEFT JOIN daily_invoices i ON ds.day = i.day
    ),
    'profit', (
      SELECT jsonb_agg(jsonb_build_object('date', ds.day, 'value', COALESCE(r.value, 0) - COALESCE(c.value, 0)))
      FROM date_series ds
      LEFT JOIN daily_revenue r ON ds.day = r.day
      LEFT JOIN daily_cost c ON ds.day = c.day
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMIT;
