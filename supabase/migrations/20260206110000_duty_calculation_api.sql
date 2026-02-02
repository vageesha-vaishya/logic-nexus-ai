-- Duty Calculation API
-- Date: 2026-02-06
-- Description: RPC function for calculating estimated duties based on HTS codes and origin/destination.

BEGIN;

CREATE OR REPLACE FUNCTION public.calculate_duty(
  p_origin_country TEXT,
  p_destination_country TEXT,
  p_items JSONB -- Array of objects: { "hts_code": "...", "value": 1000, "quantity": 1, "currency": "USD" }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_duty NUMERIC := 0;
  v_item JSONB;
  v_hts_code TEXT;
  v_item_value NUMERIC;
  v_hts_id UUID;
  v_rate_record RECORD;
  v_duty_amount NUMERIC;
  v_breakdown JSONB := '[]'::jsonb;
  v_currency TEXT := 'USD'; -- Default
BEGIN
  -- Iterate through items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_hts_code := v_item->>'hts_code';
    v_item_value := (v_item->>'value')::NUMERIC;
    v_currency := COALESCE(v_item->>'currency', 'USD');
    v_duty_amount := 0;

    -- Lookup HTS ID
    SELECT id INTO v_hts_id FROM public.aes_hts_codes WHERE hts_code = v_hts_code LIMIT 1;

    IF v_hts_id IS NOT NULL THEN
      -- Find best duty rate
      -- Priority: FTA (Free Trade Agreement) > MFN (Most Favored Nation) > Other
      SELECT * INTO v_rate_record
      FROM public.duty_rates
      WHERE aes_hts_id = v_hts_id
        AND country_code = p_destination_country
      ORDER BY 
        CASE 
          WHEN rate_type = 'FTA' THEN 1
          WHEN rate_type = 'MFN' THEN 2
          ELSE 3
        END ASC
      LIMIT 1;

      IF v_rate_record IS NOT NULL THEN
        -- Calculate duty
        -- Assuming rate_value is a percentage (e.g., 0.05 for 5%)
        IF v_rate_record.rate_value IS NOT NULL THEN
          v_duty_amount := v_item_value * v_rate_record.rate_value;
        ELSE
          v_duty_amount := 0; -- Handle specific rates later
        END IF;

        v_total_duty := v_total_duty + v_duty_amount;

        -- Add to breakdown
        v_breakdown := v_breakdown || jsonb_build_object(
          'hts_code', v_hts_code,
          'duty_amount', round(v_duty_amount, 2),
          'rate_applied', (v_rate_record.rate_value * 100) || '%',
          'rate_type', v_rate_record.rate_type,
          'source', v_rate_record.source
        );
      ELSE
        -- No rate found
        v_breakdown := v_breakdown || jsonb_build_object(
          'hts_code', v_hts_code,
          'duty_amount', 0,
          'rate_applied', 'N/A',
          'rate_type', 'None',
          'note', 'No rate found for destination'
        );
      END IF;
    ELSE
       -- Invalid HTS
       v_breakdown := v_breakdown || jsonb_build_object(
          'hts_code', v_hts_code,
          'error', 'Invalid HTS Code'
        );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total_duty', round(v_total_duty, 2),
    'currency', v_currency,
    'breakdown', v_breakdown
  );
END;
$$;

COMMIT;
