
-- Update get_hts_hierarchy to return ID for leaf nodes
-- This is required for the Visual HTS Browser to allow selection of codes
-- Date: 2026-02-08

DROP FUNCTION IF EXISTS get_hts_hierarchy(text, text);

CREATE OR REPLACE FUNCTION get_hts_hierarchy(
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
  IF level_type = 'chapter' THEN
    RETURN QUERY
    SELECT 
      c.chapter as code,
      -- Use MAX to pick a description, ideally category is consistent per chapter
      COALESCE(NULLIF(MAX(c.category), ''), 'Chapter ' || c.chapter) as description, 
      COUNT(*)::bigint as child_count,
      TRUE as has_children,
      NULL::uuid as id
    FROM public.aes_hts_codes c
    WHERE c.chapter IS NOT NULL
    GROUP BY c.chapter
    ORDER BY c.chapter;
    
  ELSIF level_type = 'heading' THEN
    RETURN QUERY
    SELECT 
      c.heading as code,
      COALESCE(NULLIF(MAX(c.sub_category), ''), 'Heading ' || c.heading) as description,
      COUNT(*)::bigint as child_count,
      TRUE as has_children,
      NULL::uuid as id
    FROM public.aes_hts_codes c
    WHERE c.chapter = parent_code
    GROUP BY c.heading
    ORDER BY c.heading;
    
  ELSIF level_type = 'subheading' THEN
    RETURN QUERY
    SELECT 
      c.subheading as code,
      COALESCE(NULLIF(MAX(c.sub_sub_category), ''), 'Subheading ' || c.subheading) as description,
      COUNT(*)::bigint as child_count,
      TRUE as has_children,
      NULL::uuid as id
    FROM public.aes_hts_codes c
    WHERE c.heading = parent_code
    GROUP BY c.subheading
    ORDER BY c.subheading;

  ELSIF level_type = 'code' THEN
    RETURN QUERY
    SELECT 
      c.hts_code as code,
      c.description as description,
      0::bigint as child_count,
      FALSE as has_children,
      c.id as id
    FROM public.aes_hts_codes c
    WHERE c.subheading = parent_code
    ORDER BY c.hts_code;
    
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_hts_hierarchy(text, text) TO authenticated;
