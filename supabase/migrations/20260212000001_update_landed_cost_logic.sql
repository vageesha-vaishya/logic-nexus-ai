-- Migration: Update Landed Cost Logic (RPC + VAT Seeds)
-- Re-applies the calculate_landed_cost function with VAT support and fixes AES HTS ID bug.
-- Adds VAT tax definitions.

BEGIN;

-- 0. Ensure Unique Constraint exists for ON CONFLICT support
-- 0a. Cleanup duplicates first
DELETE FROM public.tax_definitions a USING public.tax_definitions b
WHERE a.id < b.id
AND a.code = b.code
AND a.jurisdiction = b.jurisdiction;

-- 0b. Add constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'tax_definitions_code_jurisdiction_key'
    ) THEN
        ALTER TABLE public.tax_definitions 
        ADD CONSTRAINT tax_definitions_code_jurisdiction_key UNIQUE (code, jurisdiction);
    END IF;
END $$;

-- 1. Ensure Tax Definitions (VAT) exist
INSERT INTO public.tax_definitions (code, name, jurisdiction, calculation_method, percentage_rate, min_amount, max_amount, currency)
VALUES 
('US_MPF', 'Merchandise Processing Fee', 'US', 'complex_min_max', 0.003464, 31.67, 614.35, 'USD'),
('US_HMF', 'Harbor Maintenance Fee', 'US', 'percentage', 0.00125, NULL, NULL, 'USD'),
('UK_VAT', 'Value Added Tax', 'UK', 'percentage', 0.20, NULL, NULL, 'GBP'),
('DE_VAT', 'Value Added Tax', 'DE', 'percentage', 0.19, NULL, NULL, 'EUR')
ON CONFLICT (code, jurisdiction) DO UPDATE 
SET percentage_rate = EXCLUDED.percentage_rate;

-- 2. Update calculate_landed_cost RPC
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
    total_tax NUMERIC := 0;
    
    -- Variables for per-item calc
    item_value NUMERIC;
    item_hs_code TEXT;
    item_clean_hs_code TEXT;
    duty_record RECORD;
    duty_amount NUMERIC;
    v_rate_found BOOLEAN;
    
    -- Variables for fees
    mpf_def RECORD;
    hmf_def RECORD;
    total_value NUMERIC := 0;
    entry_mpf NUMERIC := 0;
    entry_hmf NUMERIC := 0;
    
    -- Variables for taxes
    tax_def RECORD;
    tax_amount NUMERIC;
    
BEGIN
    -- 1. Iterate over items to calculate Duty
    FOR item IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        item_value := (item->>'value')::NUMERIC;
        item_hs_code := item->>'hs_code';
        -- Simple cleaning: remove dots and spaces
        item_clean_hs_code := regexp_replace(item_hs_code, '[^0-9]', '', 'g');
        
        total_value := total_value + item_value;
        duty_amount := 0;
        v_rate_found := false;

        -- Find applicable duty rate from duty_rates table
        -- We try to match the HS code prefix. 
        -- Prioritize exact match, then 6 digit, then 4 digit? 
        -- For now, let's try exact match on the first 6 digits (standard HS) if exact match fails.
        
        SELECT * INTO duty_record
        FROM public.duty_rates
        WHERE jurisdiction = destination_country
          AND (
            hs_code = item_clean_hs_code 
            OR hs_code = substring(item_clean_hs_code from 1 for 6)
          )
          AND effective_date <= CURRENT_DATE
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        ORDER BY length(hs_code) DESC, effective_date DESC -- Prefer longer (more specific) match
        LIMIT 1;

        IF FOUND THEN
            v_rate_found := true;
            IF duty_record.rate_type = 'ad_valorem' THEN
                duty_amount := item_value * duty_record.ad_valorem_rate;
            ELSIF duty_record.rate_type = 'specific' THEN
                 -- Simplified specific rate calc (assuming unit match for now)
                duty_amount := (item->>'quantity')::NUMERIC * duty_record.specific_amount; 
            ELSIF duty_record.rate_type = 'free' THEN
                duty_amount := 0;
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

    -- 2. Calculate US MPF & HMF (Specific Logic)
    IF destination_country = 'US' THEN
        -- Check if tax_definitions table exists (it should, but handle safely)
        BEGIN
            SELECT * INTO mpf_def FROM public.tax_definitions WHERE code = 'US_MPF' AND jurisdiction = 'US';
        EXCEPTION WHEN undefined_table THEN
            mpf_def := NULL;
        END;
        
        IF mpf_def IS NOT NULL THEN
            entry_mpf := total_value * mpf_def.percentage_rate;
            -- Apply Min/Max if defined
            IF mpf_def.min_amount IS NOT NULL AND entry_mpf < mpf_def.min_amount THEN
                entry_mpf := mpf_def.min_amount;
            ELSIF mpf_def.max_amount IS NOT NULL AND entry_mpf > mpf_def.max_amount THEN
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
             -- HMF usually applies to Ocean freight. 
             -- We should ideally check service type passed in arguments, but for now we assume applicability 
             -- or the caller filters items. 
             -- Let's apply to total value for now as an estimate.
             entry_hmf := total_value * hmf_def.percentage_rate;
        ELSE
             -- Fallback default for HMF (0.125%)
             entry_hmf := total_value * 0.00125;
        END IF;
        
        total_fees := entry_mpf + entry_hmf;
    END IF;

    -- 3. Calculate Taxes (VAT/GST)
    -- Look for percentage-based taxes for the destination jurisdiction (excluding MPF/HMF which are fees)
    FOR tax_def IN 
        SELECT * FROM public.tax_definitions 
        WHERE jurisdiction = destination_country 
          AND code NOT IN ('US_MPF', 'US_HMF') -- Exclude known fees handled above
          AND calculation_method = 'percentage'
    LOOP
        -- VAT Basis: usually CIF Value + Duty + Fees
        -- We approximate CIF as total_value for this engine unless freight cost is added
        tax_amount := (total_value + total_duty + total_fees) * tax_def.percentage_rate;
        total_tax := total_tax + tax_amount;
        
        -- Add tax detail to summary (optional, or just lump sum)
    END LOOP;

    RETURN jsonb_build_object(
        'items', to_jsonb(result_items),
        'summary', jsonb_build_object(
            'destination_country', destination_country,
            'total_value', total_value,
            'total_duty', round(total_duty, 2),
            'total_fees', round(total_fees, 2),
            'total_tax', round(total_tax, 2),
            'estimated_mpf', round(entry_mpf, 2),
            'estimated_hmf', round(entry_hmf, 2),
            'grand_total_estimated_landed_cost', round(total_duty + total_fees + total_tax, 2)
        )
    );
END;
$$;

COMMIT;
