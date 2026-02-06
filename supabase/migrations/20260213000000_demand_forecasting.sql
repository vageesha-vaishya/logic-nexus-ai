
-- Demand Forecasting Schema
-- Implements 'demand_predictions' for Intelligent Demand Forecasting (Phase 3)

CREATE TABLE IF NOT EXISTS public.demand_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL, -- Scoped to tenant
    commodity_id UUID REFERENCES public.master_commodities(id) ON DELETE CASCADE, -- Optional link to specific commodity
    hs_code TEXT NOT NULL, -- The HS Code being forecasted
    forecast_date DATE NOT NULL, -- The future date/month this forecast applies to
    predicted_volume NUMERIC, -- Predicted quantity/volume
    confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 100),
    factors JSONB DEFAULT '{}'::jsonb, -- AI reasoning: e.g. { "seasonality": "high", "market_trend": "increasing", "risk_factors": [] }
    model_version TEXT DEFAULT 'gpt-4o-forecast-v1',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.demand_predictions ENABLE ROW LEVEL SECURITY;

-- Read policy
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'demand_predictions' AND policyname = 'Tenant read demand predictions'
  ) THEN
    CREATE POLICY "Tenant read demand predictions" ON public.demand_predictions
        FOR SELECT
        USING (
            tenant_id IN (
                SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
            )
        );
  END IF;
END $$;

-- Write policy (Service Role or Admin)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'demand_predictions' AND policyname = 'Tenant write demand predictions'
  ) THEN
    CREATE POLICY "Tenant write demand predictions" ON public.demand_predictions
        FOR ALL
        USING (
            tenant_id IN (
                SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
                AND role IN ('platform_admin', 'tenant_admin')
            )
        );
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_demand_predictions_tenant_hs ON public.demand_predictions(tenant_id, hs_code);
CREATE INDEX IF NOT EXISTS idx_demand_predictions_forecast_date ON public.demand_predictions(forecast_date);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_demand_predictions_modtime ON public.demand_predictions;
CREATE TRIGGER update_demand_predictions_modtime
    BEFORE UPDATE ON public.demand_predictions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
