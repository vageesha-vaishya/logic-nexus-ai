-- Smart Search for HTS Codes
-- Implements fuzzy matching and typo tolerance using pg_trgm
-- Addresses "UX Gap vs Flexport" by allowing robust commodity search

-- 1. Create Trigram Index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_description_trgm 
ON public.aes_hts_codes 
USING GIN (description gin_trgm_ops);

-- 2. Smart Search RPC
-- Combines: Exact Code, Prefix Code, Full Text Search, and Trigram Similarity
CREATE OR REPLACE FUNCTION public.search_hts_codes_smart(
    p_search_term TEXT, 
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    hts_code VARCHAR,
    description TEXT,
    category VARCHAR,
    rank REAL
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_clean_term TEXT;
BEGIN
    -- Normalize search term
    p_search_term := trim(p_search_term);
    v_clean_term := regexp_replace(p_search_term, '[^0-9]', '', 'g');

    RETURN QUERY
    SELECT 
        a.id,
        a.hts_code,
        a.description,
        a.category,
        (
            -- Scoring Logic
            -- 1. Code Match (High Priority)
            (CASE 
                -- Exact match on cleaned code (e.g. input 851762 matches 8517.62...)
                WHEN v_clean_term <> '' AND regexp_replace(a.hts_code, '[^0-9]', '', 'g') = v_clean_term THEN 3.0
                -- Prefix match on cleaned code
                WHEN v_clean_term <> '' AND regexp_replace(a.hts_code, '[^0-9]', '', 'g') LIKE v_clean_term || '%' THEN 2.0
                ELSE 0 
            END) +
            
            -- 2. Description Similarity (Medium Priority)
            -- Trigram similarity
            (similarity(a.description, p_search_term) * 1.5) +
            
            -- 3. FTS Rank (Base Priority)
            (ts_rank(to_tsvector('english', coalesce(a.description, '')), websearch_to_tsquery('english', p_search_term)) * 0.5)
        )::REAL as rank
    FROM public.aes_hts_codes a
    WHERE 
        -- Filter conditions (OR logic)
        (v_clean_term <> '' AND regexp_replace(a.hts_code, '[^0-9]', '', 'g') LIKE v_clean_term || '%') OR
        to_tsvector('english', coalesce(a.description, '')) @@ websearch_to_tsquery('english', p_search_term) OR
        a.description % p_search_term OR
        a.description ILIKE '%' || p_search_term || '%' -- Simple substring fallback
    ORDER BY rank DESC, a.hts_code ASC
    LIMIT p_limit;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION search_hts_codes_smart(TEXT, INT) TO authenticated;
