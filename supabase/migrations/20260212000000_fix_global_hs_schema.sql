
-- Fix Global HS Roots Schema Mismatch
-- The existing global_hs_roots table has an old schema (chapter_code, etc.)
-- We need to replace it with the new schema (hs6_code, generated chapter/heading)

BEGIN;

-- 1. Drop the old table and cascade to remove the FK constraint on aes_hts_codes
-- This drops the constraint 'aes_hts_codes_global_hs_root_id_fkey' but preserves aes_hts_codes data
DROP TABLE IF EXISTS public.global_hs_roots CASCADE;

-- 2. Recreate global_hs_roots with correct schema
CREATE TABLE public.global_hs_roots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hs6_code TEXT NOT NULL UNIQUE,
    description TEXT,
    -- Generated columns for hierarchy
    chapter TEXT GENERATED ALWAYS AS (substring(hs6_code, 1, 2)) STORED,
    heading TEXT GENERATED ALWAYS AS (substring(hs6_code, 1, 4)) STORED,
    -- Description columns for hierarchy browsing
    chapter_description TEXT,
    heading_description TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.global_hs_roots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view global_hs_roots"
    ON public.global_hs_roots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage global_hs_roots"
    ON public.global_hs_roots FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role::text IN ('admin', 'super_admin', 'platform_admin')
        )
    );

-- 4. Re-create Indexes
CREATE INDEX idx_global_hs_roots_hs6_code ON public.global_hs_roots(hs6_code);
CREATE INDEX idx_global_hs_roots_chapter ON public.global_hs_roots(chapter);
CREATE INDEX idx_global_hs_roots_heading ON public.global_hs_roots(heading);
CREATE INDEX idx_global_hs_roots_browsing ON public.global_hs_roots(chapter, heading);

-- 5. Seed Data from aes_hts_codes
-- Extract unique 6-digit roots
INSERT INTO public.global_hs_roots (hs6_code, description)
SELECT DISTINCT 
    subheading,
    -- Take the first available description
    (SELECT description FROM public.aes_hts_codes c2 WHERE c2.subheading = c1.subheading LIMIT 1)
FROM public.aes_hts_codes c1
WHERE subheading IS NOT NULL AND length(subheading) = 6
ON CONFLICT (hs6_code) DO NOTHING;

-- 6. Backfill Chapter/Heading Descriptions
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

-- 7. Restore Foreign Key on aes_hts_codes
-- First, clean up any old bad references (set to NULL)
UPDATE public.aes_hts_codes SET global_hs_root_id = NULL;

-- Re-link based on hs6_code matching subheading
UPDATE public.aes_hts_codes a
SET global_hs_root_id = g.id
FROM public.global_hs_roots g
WHERE a.subheading = g.hs6_code;

-- Add the constraint back
ALTER TABLE public.aes_hts_codes 
ADD CONSTRAINT aes_hts_codes_global_hs_root_id_fkey 
FOREIGN KEY (global_hs_root_id) REFERENCES public.global_hs_roots(id);

CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_global_hs_root_id ON public.aes_hts_codes(global_hs_root_id);

-- 8. Ensure RPC exists and is correct (just to be safe)
CREATE OR REPLACE FUNCTION get_global_hs_hierarchy(
  level_type text, 
  parent_code text DEFAULT NULL,
  jurisdiction text DEFAULT 'US'
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
    
  -- 3. Subheadings / Roots (within a Heading)
  ELSIF level_type = 'subheading' THEN
    RETURN QUERY
    SELECT 
      g.hs6_code as code,
      g.description as description,
      (SELECT COUNT(*) FROM public.aes_hts_codes a WHERE a.global_hs_root_id = g.id)::bigint as child_count,
      TRUE as has_children,
      g.id as id
    FROM public.global_hs_roots g
    WHERE g.heading = parent_code
    ORDER BY g.hs6_code;

  -- 4. Codes (Leaf)
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

COMMIT;
