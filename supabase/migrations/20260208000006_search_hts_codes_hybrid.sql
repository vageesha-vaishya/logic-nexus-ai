CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'master_hts'
  ) THEN
    EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.search_hts_codes_hybrid(
      q text,
      q_embedding vector(1536),
      k int DEFAULT 25
    )
    RETURNS TABLE(
      id uuid,
      hts_code text,
      description text,
      score double precision
    )
    LANGUAGE sql
    STABLE
    AS $func$
    WITH vec AS (
      SELECT id, hts_code, description,
             1 - (embedding <=> q_embedding) AS vec_score
      FROM public.master_hts
      WHERE embedding IS NOT NULL AND q_embedding IS NOT NULL
      ORDER BY embedding <=> q_embedding
      LIMIT k
    ),
    trgm AS (
      SELECT id, hts_code, description,
             GREATEST(similarity(description, q), similarity(hts_code, q)) AS trgm_score
      FROM public.master_hts
      WHERE q IS NOT NULL
      ORDER BY trgm_score DESC
      LIMIT k
    ),
    fts AS (
      SELECT id, hts_code, description,
             ts_rank_cd(
               to_tsvector('english', COALESCE(description,'')),
               plainto_tsquery('english', q)
             ) AS fts_score
      FROM public.master_hts
      WHERE q IS NOT NULL
      ORDER BY fts_score DESC
      LIMIT k
    ),
    merged AS (
      SELECT m.id, m.hts_code, m.description,
             COALESCE(vec.vec_score, 0) * 0.5
           + COALESCE(trgm.trgm_score, 0) * 0.3
           + COALESCE(fts.fts_score, 0) * 0.2 AS score
      FROM public.master_hts m
      LEFT JOIN vec ON vec.id = m.id
      LEFT JOIN trgm ON trgm.id = m.id
      LEFT JOIN fts ON fts.id = m.id
    )
    SELECT id, hts_code, description, score
    FROM merged
    ORDER BY score DESC
    LIMIT k;
    $func$;
    $fn$;

    -- helpful trigram indexes for faster text similarity
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_master_hts_desc_trgm ON public.master_hts USING gin (description gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_master_hts_code_trgm ON public.master_hts USING gin (hts_code gin_trgm_ops)';
  ELSE
    -- Create a stub function that returns no rows until master_hts exists
    EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.search_hts_codes_hybrid(
      q text,
      q_embedding vector(1536),
      k int DEFAULT 25
    )
    RETURNS TABLE(
      id uuid,
      hts_code text,
      description text,
      score double precision
    )
    LANGUAGE sql
    STABLE
    AS $func$
    SELECT NULL::uuid AS id,
           NULL::text AS hts_code,
           NULL::text AS description,
           NULL::double precision AS score
    WHERE FALSE;
    $func$;
    $fn$;
  END IF;
END $$;
