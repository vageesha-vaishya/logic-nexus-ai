-- Optimization for Commodity Search and HTS Performance
-- Date: 2026-03-05
-- Description: Adds missing indexes for master_commodities, optimizes HTS search RPC, and ensures search vectors are populated.

BEGIN;

-- 1. Enable pg_trgm extension if not already enabled (required for fuzzy search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add Trigram indexes to master_commodities for fast ILIKE searches
-- These were missing, causing full table scans when searching user catalog
CREATE INDEX IF NOT EXISTS idx_master_commodities_name_trgm ON public.master_commodities USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_master_commodities_sku_trgm ON public.master_commodities USING GIN (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_master_commodities_description_trgm ON public.master_commodities USING GIN (description gin_trgm_ops);

-- 3. Add Trigram index to hts_code for fallback search
CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_code_trgm ON public.aes_hts_codes USING GIN (hts_code gin_trgm_ops);

-- 4. Add Functional Index on cleaned HTS code for faster prefix search in RPC
-- Matches the logic: regexp_replace(hts_code, '[^0-9]', '', 'g')
CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_clean_code ON public.aes_hts_codes ((regexp_replace(hts_code, '[^0-9]', '', 'g')));

-- 5. Ensure search_vector is populated for all HTS codes
-- This is critical for the FTS part of the RPC to work efficiently
UPDATE public.aes_hts_codes 
SET search_vector = to_tsvector('english'::regconfig, 
    coalesce(description, '') || ' ' || 
    coalesce(hts_code, '') || ' ' || 
    coalesce(category, '')
)
WHERE search_vector IS NULL;

-- 6. Optimize search_hts_codes_smart RPC
-- Replaces the inefficient OR logic with UNION-based strategy to leverage specific indexes
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
    v_search_query tsquery;
BEGIN
    -- Normalize search term
    p_search_term := trim(p_search_term);
    v_clean_term := regexp_replace(p_search_term, '[^0-9]', '', 'g');
    
    -- Prepare TSQuery (handle empty/invalid query gracefully)
    BEGIN
        v_search_query := websearch_to_tsquery('english', p_search_term);
    EXCEPTION WHEN OTHERS THEN
        v_search_query := to_tsquery('english', '');
    END;

    RETURN QUERY
    WITH matches AS (
        -- 1. Exact/Prefix Code Match (Uses idx_aes_hts_codes_clean_code)
        SELECT 
            a.id,
            a.hts_code,
            a.description,
            a.category,
            a.search_vector
        FROM public.aes_hts_codes a
        WHERE v_clean_term <> '' 
          AND regexp_replace(a.hts_code, '[^0-9]', '', 'g') LIKE v_clean_term || '%'
        
        UNION
        
        -- 2. Full Text Search (Uses search_vector GIN index)
        SELECT 
            a.id,
            a.hts_code,
            a.description,
            a.category,
            a.search_vector
        FROM public.aes_hts_codes a
        WHERE a.search_vector @@ v_search_query
        
        UNION
        
        -- 3. Trigram Similarity (Uses idx_aes_hts_codes_description_trgm)
        SELECT 
            a.id,
            a.hts_code,
            a.description,
            a.category,
            a.search_vector
        FROM public.aes_hts_codes a
        WHERE a.description % p_search_term
    )
    SELECT 
        m.id,
        m.hts_code,
        m.description,
        m.category,
        (
            -- Scoring Logic
            (CASE 
                WHEN v_clean_term <> '' AND regexp_replace(m.hts_code, '[^0-9]', '', 'g') = v_clean_term THEN 3.0
                WHEN v_clean_term <> '' AND regexp_replace(m.hts_code, '[^0-9]', '', 'g') LIKE v_clean_term || '%' THEN 2.0
                ELSE 0 
            END) +
            (similarity(m.description, p_search_term) * 1.5) +
            (ts_rank(m.search_vector, v_search_query) * 0.5)
        )::REAL as rank
    FROM matches m
    ORDER BY rank DESC, m.hts_code ASC
    LIMIT p_limit;
END;
$$;

COMMIT;
