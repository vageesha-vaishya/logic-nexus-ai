
-- Update Landed Cost Engine RPC to match Frontend
-- Date: 2026-02-06
-- Description: Updates calculate_duty RPC to accept JSONB items and return JSONB summary.

BEGIN;

-- Drop old signature to avoid confusion
DROP FUNCTION IF EXISTS public.calculate_duty(text, text, numeric);

-- New signature matching CargoDetailsForm.tsx
CREATE OR REPLACE FUNCTION public.calculate_duty(
  p_origin_country TEXT,
  p_destination_country TEXT,
  p_items JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_total_duty NUMERIC := 0;
  v_breakdown JSONB := '[]'::JSONB;
  v_item JSONB;
  v_hts_code TEXT;
  v_value NUMERIC;
  v_qty NUMERIC;
  v_rate_value NUMERIC;
  v_rate_type TEXT;
  v_duty_amount NUMERIC;
  v_hts_id UUID;
  v_currency TEXT := 'USD';
BEGIN
  -- Loop through items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_hts_code := v_item->>'hts_code';
    v_value := COALESCE((v_item->>'value')::NUMERIC, 0);
    v_qty := COALESCE((v_item->>'quantity')::NUMERIC, 1);
    
    -- Reset per item
    v_rate_value := 0;
    v_rate_type := 'None';
    v_duty_amount := 0;

    -- Find HTS ID
    SELECT id INTO v_hts_id FROM public.aes_hts_codes WHERE hts_code = v_hts_code LIMIT 1;
    
    IF v_hts_id IS NOT NULL THEN
      -- Find best duty rate for destination
      -- Logic: Prioritize MFN for now, or just take the first one found for this country
      SELECT rate_value, rate_type, currency 
      INTO v_rate_value, v_rate_type, v_currency
      FROM public.duty_rates 
      WHERE aes_hts_id = v_hts_id 
        AND country_code = p_destination_country
      ORDER BY rate_value DESC -- Conservative estimate (highest rate)
      LIMIT 1;
      
      IF v_rate_value IS NOT NULL THEN
        v_duty_amount := v_value * v_rate_value;
        v_total_duty := v_total_duty + v_duty_amount;
      ELSE
         v_rate_value := 0;
         v_rate_type := 'Not Found';
      END IF;
    ELSE
       v_rate_type := 'Invalid HTS';
    END IF;

    v_breakdown := v_breakdown || jsonb_build_object(
      'hts_code', v_hts_code,
      'rate_type', v_rate_type,
      'rate_applied', (v_rate_value * 100)::Numeric(10,2)::TEXT || '%',
      'duty_amount', v_duty_amount
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'total_duty', v_total_duty,
    'currency', v_currency,
    'breakdown', v_breakdown
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.calculate_duty(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_duty(TEXT, TEXT, JSONB) TO service_role;

COMMIT;
