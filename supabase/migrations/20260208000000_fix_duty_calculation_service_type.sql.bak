BEGIN;

-- Update calculate_duty to support 'ocean_freight' enum value for HMF calculation
CREATE OR REPLACE FUNCTION public.calculate_duty(
  p_origin_country TEXT,
  p_destination_country TEXT,
  p_service_type TEXT, -- 'ocean', 'ocean_freight', 'air', etc.
  p_items JSONB -- Array of { "hts_code": "...", "value": 1000, "quantity": 1 }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_duty NUMERIC := 0;
  v_total_fees NUMERIC := 0;
  v_total_mpf NUMERIC := 0;
  v_total_hmf NUMERIC := 0;
  v_item JSONB;
  v_hts_code TEXT;
  v_item_value NUMERIC;
  v_hts_id UUID;
  v_rate_record RECORD;
  v_duty_amount NUMERIC;
  v_mpf_amount NUMERIC;
  v_hmf_amount NUMERIC;
  v_breakdown JSONB := '[]'::jsonb;
  v_currency TEXT := 'USD';
  v_rate_applied TEXT;
BEGIN
  -- Iterate items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_hts_code := v_item->>'hts_code';
    v_item_value := COALESCE((v_item->>'value')::NUMERIC, 0);
    v_currency := COALESCE(v_item->>'currency', 'USD');
    v_duty_amount := 0;
    v_mpf_amount := 0;
    v_hmf_amount := 0;
    v_rate_applied := 'N/A';

    -- 1. HTS Duty Lookup
    SELECT id INTO v_hts_id FROM public.aes_hts_codes WHERE hts_code = v_hts_code LIMIT 1;
    
    IF v_hts_id IS NOT NULL THEN
       SELECT * INTO v_rate_record
       FROM public.duty_rates
       WHERE aes_hts_id = v_hts_id
         AND country_code = p_destination_country
       ORDER BY CASE WHEN rate_type = 'FTA' THEN 1 WHEN rate_type = 'MFN' THEN 2 ELSE 3 END ASC
       LIMIT 1;

       IF FOUND AND v_rate_record.rate_value IS NOT NULL THEN
         v_duty_amount := v_item_value * v_rate_record.rate_value;
         v_rate_applied := (v_rate_record.rate_value * 100) || '%';
       END IF;
    END IF;

    -- 2. US Import Fees (MPF & HMF)
    IF p_destination_country = 'US' THEN
       -- MPF (Merchandise Processing Fee) - Ad Valorem 0.3464%
       v_mpf_amount := v_item_value * 0.003464;
       v_total_mpf := v_total_mpf + v_mpf_amount;

       -- HMF (Harbor Maintenance Fee) - Ocean only, 0.125%
       -- Updated to include 'ocean_freight' from shipment_type enum
       IF p_service_type IN ('ocean', 'ocean_freight', 'sea') THEN
          v_hmf_amount := v_item_value * 0.00125;
          v_total_hmf := v_total_hmf + v_hmf_amount;
       END IF;
    END IF;

    v_total_duty := v_total_duty + v_duty_amount;
    v_total_fees := v_total_fees + v_mpf_amount + v_hmf_amount;

    v_breakdown := v_breakdown || jsonb_build_object(
      'hts_code', v_hts_code,
      'value', v_item_value,
      'duty_amount', round(v_duty_amount, 2),
      'fees_amount', round(v_mpf_amount + v_hmf_amount, 2),
      'mpf', round(v_mpf_amount, 2),
      'hmf', round(v_hmf_amount, 2),
      'rate_applied', v_rate_applied
    );
  END LOOP;

  -- Apply MPF Min/Max Logic (Formal Entry)
  -- Min $31.67, Max $614.35 (FY 2024 rates approx)
  IF p_destination_country = 'US' AND v_total_mpf > 0 THEN
      DECLARE
        v_clamped_mpf NUMERIC;
      BEGIN
        v_clamped_mpf := GREATEST(31.67, LEAST(v_total_mpf, 614.35));
        -- Adjust total fees by the difference
        v_total_fees := v_total_fees - v_total_mpf + v_clamped_mpf;
        -- Update total MPF to reflect the clamped value
        v_total_mpf := v_clamped_mpf;
      END;
  END IF;

  RETURN jsonb_build_object(
    'total_duty', round(v_total_duty, 2),
    'total_fees', round(v_total_fees, 2),
    'total_mpf', round(v_total_mpf, 2),
    'total_hmf', round(v_total_hmf, 2),
    'total_landed_cost', round(v_total_duty + v_total_fees, 2),
    'currency', v_currency,
    'breakdown', v_breakdown
  );
END;
$$;

COMMIT;
