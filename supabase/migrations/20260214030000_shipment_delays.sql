-- Migration: Shipment Delays and Self-Correction
-- Description: Adds shipment_delays table and delay detection RPC
-- Author: Trae AI
-- Date: 2026-02-14

-- 1. Create shipment_delays table
CREATE TABLE IF NOT EXISTS public.shipment_delays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    delay_reason TEXT NOT NULL, -- e.g., 'Missed ETA', 'Tracking Exception'
    original_eta DATE,
    new_eta DATE,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'acknowledged', 'resolved', 'ignored')),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.shipment_delays ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shipment_delays' AND policyname = 'Users can view delays for their tenant'
  ) THEN
    CREATE POLICY "Users can view delays for their tenant"
        ON public.shipment_delays
        FOR SELECT
        USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shipment_delays' AND policyname = 'Users can manage delays for their tenant'
  ) THEN
    CREATE POLICY "Users can manage delays for their tenant"
        ON public.shipment_delays
        FOR ALL
        USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
  END IF;
END $$;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_shipment_delays_modtime ON public.shipment_delays;
CREATE TRIGGER update_shipment_delays_modtime
    BEFORE UPDATE ON public.shipment_delays
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


-- 2. Create Delay Detection RPC
CREATE OR REPLACE FUNCTION public.check_shipment_delays(p_tenant_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_shipment RECORD;
    v_delay_count INTEGER := 0;
    v_severity TEXT;
    v_days_overdue INTEGER;
BEGIN
    -- Iterate over shipments that are active but past their ETA
    FOR v_shipment IN
        SELECT s.id, s.tenant_id, s.shipment_number, s.estimated_delivery, s.status
        FROM public.shipments s
        WHERE 
            (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id)
            AND s.status IN ('in_transit', 'out_for_delivery')
            AND s.estimated_delivery < CURRENT_DATE
            AND s.actual_delivery IS NULL
            -- Exclude shipments that already have an open delay
            AND NOT EXISTS (
                SELECT 1 FROM public.shipment_delays sd 
                WHERE sd.shipment_id = s.id 
                AND sd.status IN ('detected', 'acknowledged')
            )
    LOOP
        -- Calculate severity
        v_days_overdue := CURRENT_DATE - v_shipment.estimated_delivery;
        
        IF v_days_overdue < 2 THEN
            v_severity := 'low';
        ELSIF v_days_overdue < 5 THEN
            v_severity := 'medium';
        ELSE
            v_severity := 'high';
        END IF;

        -- Insert Delay Record
        INSERT INTO public.shipment_delays (
            tenant_id,
            shipment_id,
            delay_reason,
            original_eta,
            severity,
            status
        ) VALUES (
            v_shipment.tenant_id,
            v_shipment.id,
            'Missed ETA: Shipment is overdue by ' || v_days_overdue || ' days',
            v_shipment.estimated_delivery,
            v_severity,
            'detected'
        );

        v_delay_count := v_delay_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'delays_detected', v_delay_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
