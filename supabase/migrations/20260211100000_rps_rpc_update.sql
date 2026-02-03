
-- Enhanced RPC for Restricted Party Screening
-- Includes fuzzy matching on name and exact/partial matching on country
-- Logs the screening attempt automatically (optional, but good for atomicity) OR we can log from service.
-- For now, we'll keep it as a search function and let the service handle logging to separate concerns (Search vs Audit).

DROP FUNCTION IF EXISTS public.screen_restricted_party(text, text, numeric);

CREATE OR REPLACE FUNCTION public.screen_restricted_party(
    p_name TEXT,
    p_country TEXT DEFAULT NULL,
    p_threshold NUMERIC DEFAULT 0.6
)
RETURNS TABLE (
    id UUID,
    source_list TEXT,
    entity_name TEXT,
    address TEXT,
    country_code TEXT,
    similarity NUMERIC,
    remarks TEXT,
    external_id TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    -- Ensure pg_trgm is available (it should be from previous migration, but good practice)
    -- Normalize input
    p_name := trim(p_name);
    
    RETURN QUERY
    SELECT 
        r.id,
        r.source_list,
        r.entity_name,
        r.address,
        r.country_code,
        GREATEST(
            similarity(r.entity_name, p_name),
            word_similarity(p_name, r.entity_name) -- Matches "Huawei" in "Huawei Technologies"
        )::NUMERIC AS similarity,
        r.remarks,
        r.external_id
    FROM public.restricted_party_lists r
    WHERE 
        (
            r.entity_name % p_name -- Trigram fuzzy match operator
            OR 
            r.entity_name ILIKE '%' || p_name || '%' -- Fallback for substrings
        )
        AND (
            p_country IS NULL 
            OR r.country_code IS NULL 
            OR r.country_code = '' 
            OR r.country_code ILIKE '%' || p_country || '%'
        )
        AND GREATEST(
            similarity(r.entity_name, p_name),
            word_similarity(p_name, r.entity_name)
        ) >= p_threshold
    ORDER BY similarity DESC
    LIMIT 20;
END;
$$;
