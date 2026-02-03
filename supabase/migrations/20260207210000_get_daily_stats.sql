-- Migration: Get Daily Stats RPC
-- Description: Adds RPC for fetching daily statistics for dashboard sparklines
-- Date: 2026-02-07

BEGIN;

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
      AND status IN ('issued', 'overdue', 'partial') -- Matching "Pending" status somewhat, or just new invoices? 
      -- The card is "Pending Invoices" (stock), but sparkline usually shows flow. 
      -- Let's show "Invoices Issued" flow for the sparkline as it correlates.
      -- Actually, let's stick to "Invoices Created/Issued" regardless of status for the trend of activity.
      -- But to match the "Pending" theme, maybe "New Pending Invoices"?
      -- Let's just use "Invoices Issued" (flow) which is more useful.
      AND status NOT IN ('draft', 'cancelled')
      AND issue_date >= v_start_date
    GROUP BY 1
  ),
  daily_cost AS (
    SELECT 
      date_trunc('day', created_at)::date as day,
      sum(total_cost) as value
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
