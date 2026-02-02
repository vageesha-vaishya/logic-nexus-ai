
-- Compliance Screening Module (RPS)
-- Date: 2026-02-07
-- Description: Adds RPS Watchlist and screening RPCs.

BEGIN;

--------------------------------------------------------------------------------
-- 1. RPS Watchlist (Mock Data Source)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rps_watch_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  country TEXT, -- ISO 2-char
  list_source TEXT NOT NULL, -- e.g., 'OFAC', 'BIS', 'EU_SANCTIONS'
  reason TEXT,
  match_score_threshold INTEGER DEFAULT 80, -- Minimum score to trigger match
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fuzzy search (using trigram if available, else simple index)
CREATE INDEX IF NOT EXISTS idx_rps_name ON public.rps_watch_list(name);

-- RLS
ALTER TABLE public.rps_watch_list ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rps_watch_list' AND policyname = 'Public read rps list'
  ) THEN
    CREATE POLICY "Public read rps list" ON public.rps_watch_list FOR SELECT USING (true);
  END IF;
END $$;

--------------------------------------------------------------------------------
-- 2. RPS Screening RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.perform_rps_screening(
  p_name TEXT,
  p_country TEXT DEFAULT NULL
)
RETURNS TABLE (
  match_found BOOLEAN,
  match_details JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_details JSONB := '[]'::jsonb;
  v_found BOOLEAN := false;
BEGIN
  -- Simple fuzzy matching logic (case-insensitive substring)
  -- In production, use pg_trgm or external API
  FOR v_match IN 
    SELECT * FROM public.rps_watch_list 
    WHERE name ILIKE '%' || p_name || '%'
       OR (p_country IS NOT NULL AND country = p_country AND name ILIKE '%' || split_part(p_name, ' ', 1) || '%')
    LIMIT 5
  LOOP
    v_found := true;
    v_details := v_details || jsonb_build_object(
      'list_source', v_match.list_source,
      'matched_name', v_match.name,
      'reason', v_match.reason,
      'score', 100 -- Mock score
    );
  END LOOP;

  RETURN QUERY SELECT v_found, v_details;
END;
$$;

COMMIT;
