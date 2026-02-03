-- Phase 3: Vendor Performance Scorecard Schema

BEGIN;

-----------------------------------------------------------------------------
-- 0. Update Shipments Table (Prerequisite)
-- Add vendor_id to link shipments to vendors
-----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'vendor_id'
    ) THEN
        ALTER TABLE public.shipments 
        ADD COLUMN vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_shipments_vendor_id ON public.shipments(vendor_id);
    END IF;
END $$;

-----------------------------------------------------------------------------
-- 1. Quality Claims (New Table)
-- Tracks operational failures for Quality Compliance Score (30%)
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quality_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
    claim_number TEXT NOT NULL,
    claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT CHECK (type IN ('damage', 'shortage', 'wrong_item', 'documentation', 'delay', 'other')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
    amount NUMERIC DEFAULT 0, -- Financial impact
    currency TEXT DEFAULT 'USD',
    description TEXT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_claims_vendor ON public.quality_claims(vendor_id);
CREATE INDEX IF NOT EXISTS idx_quality_claims_date ON public.quality_claims(claim_date);

-- RLS
ALTER TABLE public.quality_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform Admin Full Access" ON public.quality_claims;
CREATE POLICY "Platform Admin Full Access" ON public.quality_claims
    FOR ALL USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant Access" ON public.quality_claims;
CREATE POLICY "Tenant Access" ON public.quality_claims
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = quality_claims.vendor_id
            AND (
                v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
                OR v.tenant_id IS NULL
            )
        )
    );

-----------------------------------------------------------------------------
-- 2. Vendor Performance Metrics (Daily Snapshots)
-- Stores calculated scores for historical trend analysis
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Component Scores (0-100)
    on_time_delivery_score NUMERIC CHECK (on_time_delivery_score BETWEEN 0 AND 100),
    quality_score NUMERIC CHECK (quality_score BETWEEN 0 AND 100),
    cost_score NUMERIC CHECK (cost_score BETWEEN 0 AND 100),
    responsiveness_score NUMERIC CHECK (responsiveness_score BETWEEN 0 AND 100),
    
    -- Aggregate Score (Weighted Average)
    total_score NUMERIC CHECK (total_score BETWEEN 0 AND 100),
    
    -- Raw Data Context (for auditing the score)
    total_shipments INTEGER DEFAULT 0,
    late_shipments INTEGER DEFAULT 0,
    total_claims_value NUMERIC DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(vendor_id, snapshot_date) -- One snapshot per vendor per day
);

CREATE INDEX IF NOT EXISTS idx_vendor_metrics_vendor ON public.vendor_performance_metrics(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_metrics_date ON public.vendor_performance_metrics(snapshot_date);

-- RLS
ALTER TABLE public.vendor_performance_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform Admin Full Access" ON public.vendor_performance_metrics;
CREATE POLICY "Platform Admin Full Access" ON public.vendor_performance_metrics
    FOR ALL USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant Read Access" ON public.vendor_performance_metrics;
CREATE POLICY "Tenant Read Access" ON public.vendor_performance_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_performance_metrics.vendor_id
            AND (
                v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
                OR v.tenant_id IS NULL
            )
        )
    );

-----------------------------------------------------------------------------
-- 3. Update Vendors Table
-- Denormalized current score for easy sorting/filtering
-----------------------------------------------------------------------------
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS current_performance_score NUMERIC CHECK (current_performance_score BETWEEN 0 AND 100),
ADD COLUMN IF NOT EXISTS last_performance_update TIMESTAMPTZ;

-----------------------------------------------------------------------------
-- 4. Vendor Portal Activity
-- For Responsiveness Score (10%)
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_portal_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL, -- e.g., 'login', 'view_po', 'upload_doc', 'respond_rfi'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_activity_vendor ON public.vendor_portal_activity(vendor_id);
CREATE INDEX IF NOT EXISTS idx_portal_activity_created ON public.vendor_portal_activity(created_at);

ALTER TABLE public.vendor_portal_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform Admin Full Access" ON public.vendor_portal_activity;
CREATE POLICY "Platform Admin Full Access" ON public.vendor_portal_activity
    FOR ALL USING (public.is_platform_admin(auth.uid()));

-----------------------------------------------------------------------------
-- 5. RPC: Calculate Vendor Score
-- Logic to compute scores on demand
-----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_vendor_score(p_vendor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_shipments INTEGER;
    v_on_time_shipments INTEGER;
    v_total_spend NUMERIC;
    v_claim_amount NUMERIC;
    v_otd_score NUMERIC := 100;
    v_quality_score NUMERIC := 100;
    v_final_score NUMERIC;
    v_claim_count INTEGER;
BEGIN
    -- 1. On-Time Delivery (40%)
    -- Look back 90 days
    -- Using actual_delivery_date and estimated_delivery_date
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE actual_delivery_date <= estimated_delivery_date)
    INTO v_total_shipments, v_on_time_shipments
    FROM public.shipments
    WHERE vendor_id = p_vendor_id
    AND status = 'delivered'
    AND actual_delivery_date >= (CURRENT_DATE - INTERVAL '90 days');

    IF v_total_shipments > 0 THEN
        v_otd_score := (v_on_time_shipments::NUMERIC / v_total_shipments::NUMERIC) * 100;
    ELSE
        v_otd_score := 100; -- Default if no data
    END IF;

    -- 2. Quality Compliance (30%)
    -- Look back 90 days.
    SELECT COALESCE(SUM(amount), 0)
    INTO v_claim_amount
    FROM public.quality_claims
    WHERE vendor_id = p_vendor_id
    AND claim_date >= (CURRENT_DATE - INTERVAL '90 days');
    
    SELECT COUNT(*) INTO v_claim_count
    FROM public.quality_claims
    WHERE vendor_id = p_vendor_id
    AND claim_date >= (CURRENT_DATE - INTERVAL '90 days');
    
    v_quality_score := GREATEST(0, 100 - (v_claim_count * 10));

    -- 3. Calculate Weighted Average (assuming Cost=100, Responsiveness=100 for now)
    -- OTD (40%) + Quality (30%) + Cost (20%) + Response (10%)
    v_final_score := (v_otd_score * 0.4) + (v_quality_score * 0.3) + (100 * 0.2) + (100 * 0.1);
    
    -- 4. Update Vendor Record
    UPDATE public.vendors
    SET current_performance_score = ROUND(v_final_score, 2),
        last_performance_update = now()
    WHERE id = p_vendor_id;

    -- 5. Insert History (Upsert to prevent duplicate key errors if run multiple times same day)
    INSERT INTO public.vendor_performance_metrics (
        vendor_id, snapshot_date, 
        on_time_delivery_score, quality_score, cost_score, responsiveness_score, 
        total_score, total_shipments, late_shipments
    ) VALUES (
        p_vendor_id, CURRENT_DATE,
        ROUND(v_otd_score, 2), ROUND(v_quality_score, 2), 100, 100,
        ROUND(v_final_score, 2), v_total_shipments, (v_total_shipments - v_on_time_shipments)
    )
    ON CONFLICT (vendor_id, snapshot_date) DO UPDATE SET
        on_time_delivery_score = EXCLUDED.on_time_delivery_score,
        quality_score = EXCLUDED.quality_score,
        total_score = EXCLUDED.total_score,
        total_shipments = EXCLUDED.total_shipments,
        late_shipments = EXCLUDED.late_shipments;
    
    RETURN jsonb_build_object(
        'vendor_id', p_vendor_id,
        'total_score', ROUND(v_final_score, 2),
        'otd_score', ROUND(v_otd_score, 2),
        'quality_score', ROUND(v_quality_score, 2)
    );
END;
$$;

COMMIT;
