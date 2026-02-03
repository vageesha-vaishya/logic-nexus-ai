-- Landed Cost Engine Implementation
-- Date: 2026-02-06
-- Description: Implements calculate_duty RPC and seeds sample duty rates.

BEGIN;

--------------------------------------------------------------------------------
-- 1. Calculate Duty RPC
--------------------------------------------------------------------------------

-- Function to calculate duty options based on HTS code and destination
CREATE OR REPLACE FUNCTION public.calculate_duty(
  p_hts_code TEXT,
  p_destination_country TEXT,
  p_customs_value NUMERIC DEFAULT 0
)
RETURNS TABLE (
  rate_type TEXT,
  rate_value NUMERIC,
  specific_rate TEXT,
  duty_amount NUMERIC,
  currency TEXT,
  source TEXT
) AS $$
DECLARE
  v_hts_id UUID;
BEGIN
  -- 1. Find HTS ID
  SELECT id INTO v_hts_id
  FROM public.aes_hts_codes
  WHERE hts_code = p_hts_code
  LIMIT 1;

  IF v_hts_id IS NULL THEN
    RETURN; -- Return empty set if HTS not found
  END IF;

  -- 2. Return all matching rates for the destination
  RETURN QUERY
  SELECT 
    dr.rate_type,
    dr.rate_value,
    dr.specific_rate,
    (dr.rate_value * p_customs_value)::NUMERIC(15,2) as duty_amount,
    dr.currency,
    dr.source
  FROM public.duty_rates dr
  WHERE dr.aes_hts_id = v_hts_id
    AND dr.country_code = p_destination_country
    AND dr.effective_date <= CURRENT_DATE
    AND (dr.expiry_date IS NULL OR dr.expiry_date >= CURRENT_DATE);

  -- If no rates found in DB, we could optionally return a "General/Default" rate 
  -- but for now we just return what we have.
END;
$$ LANGUAGE plpgsql;

-- Grant access
GRANT EXECUTE ON FUNCTION public.calculate_duty(TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_duty(TEXT, TEXT, NUMERIC) TO service_role;

--------------------------------------------------------------------------------
-- 2. Seed Sample Duty Rates (Idempotent)
--------------------------------------------------------------------------------
-- We need to find some HTS codes to attach rates to.
-- Since we don't know the IDs, we'll look them up.

DO $$
DECLARE
  v_hts_code_1 TEXT := '8517.62.00'; -- Phones/Comm gear (Example)
  v_hts_id_1 UUID;
  v_hts_code_2 TEXT := '6109.10.00'; -- T-Shirts Cotton
  v_hts_id_2 UUID;
BEGIN
  -- Ensure these HTS codes exist (create if missing for seeding purposes)
  -- Note: In prod, these should come from the master HTS list.
  
  -- Item 1: Communication Apparatus
  SELECT id INTO v_hts_id_1 FROM public.aes_hts_codes WHERE hts_code = v_hts_code_1;
  IF v_hts_id_1 IS NULL THEN
    INSERT INTO public.aes_hts_codes (hts_code, description, category, unit_of_measure)
    VALUES (v_hts_code_1, 'Machines for the reception, conversion and transmission or regeneration of voice, images or other data', 'Electronics', 'No.')
    RETURNING id INTO v_hts_id_1;
  END IF;

  -- Item 2: Cotton T-Shirts
  SELECT id INTO v_hts_id_2 FROM public.aes_hts_codes WHERE hts_code = v_hts_code_2;
  IF v_hts_id_2 IS NULL THEN
    INSERT INTO public.aes_hts_codes (hts_code, description, category, unit_of_measure)
    VALUES (v_hts_code_2, 'T-shirts, singlets and other vests, knitted or crocheted, of cotton', 'Textiles', 'Doz.')
    RETURNING id INTO v_hts_id_2;
  END IF;

  -- Seed Rates for Item 1 (Electronics - often duty free)
  -- US Import
  INSERT INTO public.duty_rates (aes_hts_id, country_code, rate_type, rate_value, source)
  SELECT v_hts_id_1, 'US', 'MFN', 0.00, 'USITC'
  WHERE NOT EXISTS (SELECT 1 FROM public.duty_rates WHERE aes_hts_id = v_hts_id_1 AND country_code = 'US' AND rate_type = 'MFN');
  
  -- CN Import (Hypothetical)
  INSERT INTO public.duty_rates (aes_hts_id, country_code, rate_type, rate_value, source)
  SELECT v_hts_id_1, 'CN', 'MFN', 0.05, 'China Customs'
  WHERE NOT EXISTS (SELECT 1 FROM public.duty_rates WHERE aes_hts_id = v_hts_id_1 AND country_code = 'CN' AND rate_type = 'MFN');

  -- Seed Rates for Item 2 (Textiles - high duty)
  -- US Import
  INSERT INTO public.duty_rates (aes_hts_id, country_code, rate_type, rate_value, source)
  SELECT v_hts_id_2, 'US', 'MFN', 0.165, 'USITC' -- 16.5%
  WHERE NOT EXISTS (SELECT 1 FROM public.duty_rates WHERE aes_hts_id = v_hts_id_2 AND country_code = 'US' AND rate_type = 'MFN');

  -- US FTA (e.g. CA/MX via USMCA)
  INSERT INTO public.duty_rates (aes_hts_id, country_code, rate_type, rate_value, source)
  SELECT v_hts_id_2, 'US', 'FTA', 0.00, 'USMCA'
  WHERE NOT EXISTS (SELECT 1 FROM public.duty_rates WHERE aes_hts_id = v_hts_id_2 AND country_code = 'US' AND rate_type = 'FTA');

END $$;

COMMIT;
