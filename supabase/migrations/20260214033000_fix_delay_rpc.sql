-- Migration: Fix check_shipment_delays RPC
-- Description: Corrects column names (estimated_delivery -> estimated_delivery_date)
-- Author: Trae AI
-- Date: 2026-02-14

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
        SELECT s.id, s.tenant_id, s.shipment_number, s.estimated_delivery_date, s.status
        FROM public.shipments s
        WHERE 
            (p_tenant_id IS NULL OR s.tenant_id = p_tenant_id)
            AND s.status IN ('in_transit', 'out_for_delivery')
            AND s.estimated_delivery_date < CURRENT_DATE
            AND s.actual_delivery_date IS NULL
            -- Exclude shipments that already have an open delay
            AND NOT EXISTS (
                SELECT 1 FROM public.shipment_delays sd 
                WHERE sd.shipment_id = s.id 
                AND sd.status IN ('detected', 'acknowledged')
            )
    LOOP
        -- Calculate severity
        v_days_overdue := CURRENT_DATE - v_shipment.estimated_delivery_date::DATE;
        
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
            v_shipment.estimated_delivery_date,
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
