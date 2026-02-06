
-- Fix Hierarchy RPC Types
-- Date: 2026-02-12
-- Description: Explicitly cast VARCHAR columns to TEXT to match RPC return type definition.

BEGIN;

CREATE OR REPLACE FUNCTION get_global_hs_hierarchy(
  level_type text, -- 'chapter', 'heading', 'subheading', 'code'
  parent_code text DEFAULT NULL,
  jurisdiction text DEFAULT 'US' -- 'US', 'EU', 'CN'
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
      g.chapter::text as code,
      MAX(g.chapter_description)::text as description, 
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
      g.heading::text as code,
      MAX(g.heading_description)::text as description,
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
      g.hs6_code::text as code,
      g.description::text as description,
      CASE 
        WHEN jurisdiction = 'US' THEN (SELECT COUNT(*) FROM public.aes_hts_codes a WHERE a.global_hs_root_id = g.id)
        ELSE 0 
      END::bigint as child_count,
      TRUE as has_children, -- Always assume extensions exist or allow drill down to see details
      g.id as id
    FROM public.global_hs_roots g
    WHERE g.heading = parent_code
    ORDER BY g.hs6_code;

  -- 4. Codes / Extensions (within a Root)
  ELSIF level_type = 'code' THEN
    
    IF jurisdiction = 'US' THEN
        RETURN QUERY
        SELECT 
          a.hts_code::text as code,
          a.description::text as description,
          0::bigint as child_count,
          FALSE as has_children,
          a.id as id
        FROM public.aes_hts_codes a
        JOIN public.global_hs_roots g ON a.global_hs_root_id = g.id
        WHERE g.hs6_code = parent_code
        ORDER BY a.hts_code;
    
    -- Placeholder for other jurisdictions
    ELSE
        RETURN QUERY
        SELECT 
          'N/A'::text as code,
          'Not implemented for this jurisdiction'::text as description,
          0::bigint as child_count,
          FALSE as has_children,
          NULL::uuid as id;
    END IF;
    
  END IF;
END;
$$;

COMMIT;
