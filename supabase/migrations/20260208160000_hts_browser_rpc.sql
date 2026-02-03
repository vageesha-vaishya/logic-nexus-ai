-- Backfill hierarchy columns if they are null
-- This ensures that existing data has the necessary columns populated for the browser to work
UPDATE public.aes_hts_codes
SET
  chapter = substring(regexp_replace(hts_code, '[^0-9]', '', 'g'), 1, 2),
  heading = substring(regexp_replace(hts_code, '[^0-9]', '', 'g'), 1, 4),
  subheading = substring(regexp_replace(hts_code, '[^0-9]', '', 'g'), 1, 6),
  tariff_item = substring(regexp_replace(hts_code, '[^0-9]', '', 'g'), 1, 8)
WHERE chapter IS NULL;

-- Create RPC to fetch HTS hierarchy levels
-- This function supports browsing: Chapters -> Headings -> Subheadings -> Codes
CREATE OR REPLACE FUNCTION get_hts_hierarchy(
  level_type text, -- 'chapter', 'heading', 'subheading', 'code'
  parent_code text DEFAULT NULL
)
RETURNS TABLE (
  code text,
  description text,
  child_count bigint,
  has_children boolean
) LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF level_type = 'chapter' THEN
    RETURN QUERY
    SELECT 
      c.chapter as code,
      -- Use MAX to pick a description, ideally category is consistent per chapter
      -- If category is generic 'Export Commodity', this might be unhelpful, but it's the best we have in the flat table
      COALESCE(NULLIF(MAX(c.category), ''), 'Chapter ' || c.chapter) as description, 
      COUNT(*)::bigint as child_count,
      TRUE as has_children
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
      TRUE as has_children
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
      TRUE as has_children
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
      FALSE as has_children
    FROM public.aes_hts_codes c
    WHERE c.subheading = parent_code
    ORDER BY c.hts_code;
    
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_hts_hierarchy(text, text) TO authenticated;
