-- Landed Cost Calculation RPC
-- Calculates duties and fees based on HS Codes and Tax Definitions.

CREATE OR REPLACE FUNCTION public.calculate_landed_cost(
    items JSONB, -- Array of { hs_code, value, quantity, weight, origin_country }
    destination_country TEXT DEFAULT 'US'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item JSONB;
    result_items JSONB[] := '{}';
    total_duty NUMERIC := 0;
    total_fees NUMERIC := 0;
    
    -- Variables for per-item calc
    item_value NUMERIC;
    item_hs_code TEXT;
    v_hts_id UUID;
    duty_record RECORD;
    duty_amount NUMERIC;
    v_rate_found BOOLEAN;
    
    -- Variables for fees
    mpf_def RECORD;
    hmf_def RECORD;
    total_value NUMERIC := 0;
    entry_mpf NUMERIC := 0;
    entry_hmf NUMERIC := 0;
    
BEGIN
    -- 1. Iterate over items to calculate Duty
    FOR item IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        item_value := (item->>'value')::NUMERIC;
        item_hs_code := item->>'hs_code';
        total_value := total_value + item_value;
        duty_amount := 0;
        v_rate_found := false;

        -- Find HTS ID (Smart Lookup: handles formatted vs unformatted and prefix matching)
        SELECT id INTO v_hts_id 
        FROM public.aes_hts_codes 
        WHERE regexp_replace(hts_code, '[^0-9]', '', 'g') LIKE regexp_replace(item_hs_code, '[^0-9]', '', 'g') || '%'
        ORDER BY hts_code ASC
        LIMIT 1;

        IF v_hts_id IS NOT NULL THEN
            -- Find applicable duty rate
            SELECT * INTO duty_record
            FROM public.duty_rates
            WHERE aes_hts_id = v_hts_id
            AND country_code = destination_country
            AND effective_date <= CURRENT_DATE
            AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
            ORDER BY effective_date DESC
            LIMIT 1;

            IF FOUND THEN
                v_rate_found := true;
                IF duty_record.rate_type = 'ad_valorem' THEN
                    duty_amount := item_value * duty_record.rate_value;
                ELSIF duty_record.rate_type = 'specific' THEN
                     -- Simplified specific rate calc (assuming unit match for now)
                    duty_amount := (item->>'quantity')::NUMERIC * duty_record.rate_value; 
                ELSIF duty_record.rate_type = 'free' THEN
                    duty_amount := 0;
                END IF;
            END IF;
        END IF;

        total_duty := total_duty + duty_amount;

        result_items := array_append(result_items, jsonb_build_object(
            'hs_code', item_hs_code,
            'duty_amount', round(duty_amount, 2),
            'rate_found', v_rate_found,
            'rate_details', CASE WHEN v_rate_found THEN row_to_json(duty_record) ELSE NULL END
        ));
    END LOOP;

    -- 2. Calculate US MPF
    IF destination_country = 'US' THEN
        -- Check if tax_definitions table exists (it should, but handle safely)
        BEGIN
            SELECT * INTO mpf_def FROM public.tax_definitions WHERE code = 'US_MPF' AND jurisdiction = 'US';
        EXCEPTION WHEN undefined_table THEN
            mpf_def := NULL;
        END;
        
        IF mpf_def IS NOT NULL THEN
            entry_mpf := total_value * mpf_def.percentage_rate;
            IF entry_mpf < mpf_def.min_amount THEN
                entry_mpf := mpf_def.min_amount;
            ELSIF entry_mpf > mpf_def.max_amount THEN
                entry_mpf := mpf_def.max_amount;
            END IF;
        ELSE
             -- Fallback default values for US MPF (FY 2025 approx)
             entry_mpf := total_value * 0.003464;
             IF entry_mpf < 31.67 THEN entry_mpf := 31.67; END IF;
             IF entry_mpf > 614.35 THEN entry_mpf := 614.35; END IF;
        END IF;
        
        -- Calculate HMF
        BEGIN
            SELECT * INTO hmf_def FROM public.tax_definitions WHERE code = 'US_HMF' AND jurisdiction = 'US';
        EXCEPTION WHEN undefined_table THEN
            hmf_def := NULL;
        END;

        IF hmf_def IS NOT NULL THEN
             entry_hmf := total_value * hmf_def.percentage_rate;
        ELSE
             -- Fallback default for HMF (0.125%)
             entry_hmf := total_value * 0.00125;
        END IF;
    END IF;

    total_fees := entry_mpf + entry_hmf;

    RETURN jsonb_build_object(
        'items', to_jsonb(result_items),
        'summary', jsonb_build_object(
            'total_value', total_value,
            'total_duty', round(total_duty, 2),
            'total_fees', round(total_fees, 2),
            'estimated_mpf', round(entry_mpf, 2),
            'estimated_hmf', round(entry_hmf, 2),
            'grand_total_estimated_landed_cost', round(total_duty + total_fees, 2)
        )
    );
END;
$$;
