-- EU TARIC Integration (Phase 2)
-- Date: 2026-02-09
-- Description: Implements the taric_codes schema for EU 10-digit tariff classification.

BEGIN;

--------------------------------------------------------------------------------
-- 1. Create taric_codes table
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.taric_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    taric_code TEXT NOT NULL, -- 10-digit code (HS6 + CN2 + TARIC2)
    description TEXT,
    
    -- Hierarchy derived columns (Virtual/Stored)
    chapter TEXT GENERATED ALWAYS AS (substring(taric_code, 1, 2)) STORED,
    heading TEXT GENERATED ALWAYS AS (substring(taric_code, 1, 4)) STORED,
    hs6_code TEXT GENERATED ALWAYS AS (substring(taric_code, 1, 6)) STORED,
    cn_code TEXT GENERATED ALWAYS AS (substring(taric_code, 1, 8)) STORED,
    
    -- Relationship to Global Hub
    global_hs_root_id UUID REFERENCES public.global_hs_roots(id),
    
    -- Extended Data (JSONB for flexibility)
    -- Includes: duty_rates, supplementary_units, regulations, footnotes
    attributes JSONB DEFAULT '{}'::jsonb,
    
    -- Validity
    valid_from DATE,
    valid_to DATE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT uq_taric_code_validity UNIQUE (taric_code, valid_from)
);

-- 2. Create Indices for Performance
CREATE INDEX IF NOT EXISTS idx_taric_codes_code ON public.taric_codes(taric_code);
CREATE INDEX IF NOT EXISTS idx_taric_codes_hs6 ON public.taric_codes(hs6_code);
CREATE INDEX IF NOT EXISTS idx_taric_codes_global_root ON public.taric_codes(global_hs_root_id);
CREATE INDEX IF NOT EXISTS idx_taric_codes_description ON public.taric_codes USING GIN(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_taric_codes_attributes ON public.taric_codes USING GIN(attributes);

-- 3. Enable RLS
ALTER TABLE public.taric_codes ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
DROP POLICY IF EXISTS "Authenticated users can view taric_codes" ON public.taric_codes;
CREATE POLICY "Authenticated users can view taric_codes"
    ON public.taric_codes
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can manage taric_codes" ON public.taric_codes;
CREATE POLICY "Admins can manage taric_codes"
    ON public.taric_codes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role::text IN ('admin', 'super_admin', 'platform_admin')
        )
    );

-- 5. Trigger for Linking to Global Root on Insert/Update
CREATE OR REPLACE FUNCTION public.link_taric_to_global_root()
RETURNS TRIGGER AS $$
BEGIN
    -- Attempt to find the matching global root by HS6
    -- Only update if currently null or if hs6 changed
    IF NEW.global_hs_root_id IS NULL THEN
        SELECT id INTO NEW.global_hs_root_id
        FROM public.global_hs_roots
        WHERE hs6_code = substring(NEW.taric_code, 1, 6);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_link_taric_global_root ON public.taric_codes;
CREATE TRIGGER trg_link_taric_global_root
    BEFORE INSERT OR UPDATE OF taric_code
    ON public.taric_codes
    FOR EACH ROW
    EXECUTE FUNCTION public.link_taric_to_global_root();

-- 6. Update Hierarchy RPC to support Jurisdictions
-- We modify the existing RPC to accept a 'jurisdiction' parameter
-- Default is 'US' (AES) to maintain backward compatibility if needed, 
-- but ideally the UI sends it.

DROP FUNCTION IF EXISTS get_global_hs_hierarchy(text, text);

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
  -- 1. Chapters (Top Level) - Global
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
    
  -- 2. Headings (within a Chapter) - Global
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
    
  -- 3. Subheadings / Roots (within a Heading) - Global Hub
  ELSIF level_type = 'subheading' THEN
    RETURN QUERY
    SELECT 
      g.hs6_code as code,
      g.description as description,
      -- Count children based on jurisdiction
      CASE 
        WHEN jurisdiction = 'EU' THEN 
            (SELECT COUNT(*) FROM public.taric_codes t WHERE t.global_hs_root_id = g.id)::bigint
        ELSE -- Default US
            (SELECT COUNT(*) FROM public.aes_hts_codes a WHERE a.global_hs_root_id = g.id)::bigint
      END as child_count,
      TRUE as has_children, 
      g.id as id
    FROM public.global_hs_roots g
    WHERE g.heading = parent_code
    ORDER BY g.hs6_code;

  -- 4. Codes / Extensions (within a Root) - National Spoke
  ELSIF level_type = 'code' THEN
    
    IF jurisdiction = 'EU' THEN
        RETURN QUERY
        SELECT 
          t.taric_code as code,
          t.description as description,
          0::bigint as child_count,
          FALSE as has_children,
          t.id as id
        FROM public.taric_codes t
        JOIN public.global_hs_roots g ON t.global_hs_root_id = g.id
        WHERE g.hs6_code = parent_code
        ORDER BY t.taric_code;
        
    ELSE -- Default US (AES)
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
    
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_global_hs_hierarchy(text, text, text) TO authenticated;

COMMIT;
