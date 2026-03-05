-- Optimize Master Commodity Search RPC
-- Date: 2026-03-05
-- Description: Adds a dedicated RPC for searching master commodities using trigram indexes and ranking.

BEGIN;

-- Ensure pg_trgm is enabled (should be already, but safe to check)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create the RPC function
CREATE OR REPLACE FUNCTION public.search_master_commodities(
    p_search_term TEXT, 
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    sku TEXT,
    description TEXT,
    aes_hts_id UUID,
    hts_code VARCHAR, -- Added HTS Code
    default_cargo_type_id UUID,
    unit_value NUMERIC,
    hazmat_class TEXT,
    rank REAL
) 
LANGUAGE plpgsql
STABLE
SECURITY INVOKER -- Important: Respect RLS policies
AS $$
BEGIN
    -- Normalize search term
    p_search_term := trim(p_search_term);
    
    -- If search term is too short, return empty (though frontend should handle this)
    IF length(p_search_term) < 2 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        m.id,
        m.name,
        m.sku,
        m.description,
        m.aes_hts_id,
        h.hts_code, -- Join result
        m.default_cargo_type_id,
        m.unit_value,
        m.hazmat_class,
        (
            -- Scoring Logic
            (CASE WHEN m.name ILIKE p_search_term || '%' THEN 2.0 ELSE 0 END) +
            (similarity(m.name, p_search_term) * 1.5) +
            (similarity(coalesce(m.sku, ''), p_search_term) * 1.2) +
            (similarity(coalesce(m.description, ''), p_search_term) * 0.8)
        )::REAL as rank
    FROM public.master_commodities m
    LEFT JOIN public.aes_hts_codes h ON m.aes_hts_id = h.id
    WHERE 
        -- Trigram matching (fuzzy) or Prefix matching
        m.name % p_search_term OR
        m.name ILIKE '%' || p_search_term || '%' OR
        m.sku % p_search_term OR
        m.sku ILIKE '%' || p_search_term || '%' OR
        m.description % p_search_term OR
        m.description ILIKE '%' || p_search_term || '%'
    ORDER BY rank DESC
    LIMIT p_limit;
END;
$$;

COMMIT;
