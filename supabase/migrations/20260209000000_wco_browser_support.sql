-- WCO Browser Support & Optimization
-- Date: 2026-02-09
-- Description: optimizes global_hs_roots for browsing and adds hierarchy descriptions

BEGIN;

--------------------------------------------------------------------------------
-- 1. Add Description Columns for Hierarchy Levels
--------------------------------------------------------------------------------
ALTER TABLE public.global_hs_roots
ADD COLUMN IF NOT EXISTS chapter_description TEXT,
ADD COLUMN IF NOT EXISTS heading_description TEXT;

-- 2. Populate Descriptions from existing AES HTS Data (Best Effort)
-- We take the most frequent or first available category/sub_category for each chapter/heading
UPDATE public.global_hs_roots g
SET 
    chapter_description = (
        SELECT category 
        FROM public.aes_hts_codes a 
        WHERE a.chapter = g.chapter 
        AND category IS NOT NULL 
        LIMIT 1
    ),
    heading_description = (
        SELECT sub_category 
        FROM public.aes_hts_codes a 
        WHERE a.heading = g.heading 
        AND sub_category IS NOT NULL 
        LIMIT 1
    )
WHERE chapter_description IS NULL OR heading_description IS NULL;

-- Fallback for missing descriptions
UPDATE public.global_hs_roots
SET 
    chapter_description = COALESCE(chapter_description, 'Chapter ' || chapter),
    heading_description = COALESCE(heading_description, 'Heading ' || heading);

--------------------------------------------------------------------------------
-- 3. Add Performance Indices
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_global_hs_roots_chapter ON public.global_hs_roots(chapter);
CREATE INDEX IF NOT EXISTS idx_global_hs_roots_heading ON public.global_hs_roots(heading);
-- Composite index for hierarchy browsing
CREATE INDEX IF NOT EXISTS idx_global_hs_roots_browsing ON public.global_hs_roots(chapter, heading);

--------------------------------------------------------------------------------
-- 4. Create Global HS Hierarchy RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_global_hs_hierarchy(
  level_type text, -- 'chapter', 'heading', 'subheading', 'code'
  parent_code text DEFAULT NULL
)
RETURNS TABLE (
  code text,
  description text,
  child_count bigint,
  has_children boolean,
  id uuid
) LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  -- 1. Chapters (Top Level)
  IF level_type = 'chapter' THEN
    RETURN QUERY
    SELECT 
      g.chapter as code,
      MAX(g.chapter_description) as description, 
      COUNT(*)::bigint as child_count,
      TRUE as has_children,
      NULL::uuid as id
    FROM public.global_hs_roots g
    GROUP BY g.chapter
    ORDER BY g.chapter;
    
  -- 2. Headings (within a Chapter)
  ELSIF level_type = 'heading' THEN
    RETURN QUERY
    SELECT 
      g.heading as code,
      MAX(g.heading_description) as description,
      COUNT(*)::bigint as child_count,
      TRUE as has_children,
      NULL::uuid as id
    FROM public.global_hs_roots g
    WHERE g.chapter = parent_code
    GROUP BY g.heading
    ORDER BY g.heading;
    
  -- 3. Subheadings / Roots (within a Heading) - These are the 6-digit Global Roots
  ELSIF level_type = 'subheading' THEN
    RETURN QUERY
    SELECT 
      g.hs6_code as code,
      g.description as description,
      (SELECT COUNT(*) FROM public.aes_hts_codes a WHERE a.global_hs_root_id = g.id)::bigint as child_count,
      TRUE as has_children, -- Always assume extensions exist or allow drill down to see details
      g.id as id
    FROM public.global_hs_roots g
    WHERE g.heading = parent_code
    ORDER BY g.hs6_code;

  -- 4. Codes / Extensions (within a Root) - Fetching National Extensions (AES HTS)
  ELSIF level_type = 'code' THEN
    RETURN QUERY
    SELECT 
      a.hts_code as code,
      a.description as description,
      0::bigint as child_count,
      FALSE as has_children,
      a.id as id
    FROM public.aes_hts_codes a
    JOIN public.global_hs_roots g ON a.global_hs_root_id = g.id
    WHERE g.hs6_code = parent_code
    ORDER BY a.hts_code;
    
  END IF;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION get_global_hs_hierarchy(text, text) TO authenticated;

COMMIT;
