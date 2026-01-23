-- Fix broken trigger function that references non-existent column transit_time_days
-- This function is triggered BEFORE INSERT on quotation_version_options

CREATE OR REPLACE FUNCTION public.populate_option_from_rate()
RETURNS trigger
AS $$
DECLARE
  v_total numeric;
BEGIN
  -- Only attempt to fetch if carrier_rate_id is provided and valid
  IF NEW.carrier_rate_id IS NOT NULL THEN
    -- carrier_rates does not have transit_time_days, so we only fetch total_amount
    -- We select into v_total to avoid overwriting if not found (though select into nulls if no row)
    
    SELECT r.total_amount INTO v_total
    FROM public.carrier_rates r WHERE r.id = NEW.carrier_rate_id;

    -- Only override if we actually found a value (and found the rate)
    -- If SELECT returns no rows, v_total is NULL.
    -- If rate exists but total_amount is NULL, v_total is NULL.
    -- In both cases we probably don't want to overwrite a potentially valid user-supplied total_amount 
    -- unless we are sure the rate exists.
    -- But existing logic was: NEW.total_amount := v_total; which overwrites.
    
    -- Improved logic: only overwrite if v_total is NOT NULL.
    IF v_total IS NOT NULL THEN
      NEW.total_amount := v_total;
    END IF;
    
    -- Removed: NEW.transit_days := v_transit; (Column transit_time_days does not exist in carrier_rates)
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
