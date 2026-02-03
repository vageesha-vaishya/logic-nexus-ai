-- China CN HS Integration (Phase 2)
-- Date: 2026-02-09
-- Description: Implements the cn_hs_codes schema for China 13-digit tariff classification.

BEGIN;

--------------------------------------------------------------------------------
-- 1. Create cn_hs_codes table
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cn_hs_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cn_code TEXT NOT NULL, -- 13-digit code
    description TEXT,
    
    -- Hierarchy derived columns (Virtual/Stored)
    chapter TEXT GENERATED ALWAYS AS (substring(cn_code, 1, 2)) STORED,
    heading TEXT GENERATED ALWAYS AS (substring(cn_code, 1, 4)) STORED,
    hs6_code TEXT GENERATED ALWAYS AS (substring(cn_code, 1, 6)) STORED,
    
    -- Relationship to Global Hub
    global_hs_root_id UUID REFERENCES public.global_hs_roots(id),
    
    -- Extended Data (JSONB for flexibility)
    attributes JSONB DEFAULT '{}'::jsonb,
    
    -- Validity & Regulatory
    effective_date DATE,
    regulatory_status JSONB DEFAULT '{}'::jsonb,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT uq_cn_code_effective UNIQUE (cn_code, effective_date),
    CONSTRAINT check_cn_code_format CHECK (cn_code ~ '^\d{13}$')
);

-- 2. Create Indices for Performance
CREATE INDEX IF NOT EXISTS idx_cn_hs_codes_code ON public.cn_hs_codes(cn_code);
CREATE INDEX IF NOT EXISTS idx_cn_hs_codes_hs6 ON public.cn_hs_codes(hs6_code);
CREATE INDEX IF NOT EXISTS idx_cn_hs_codes_global_root ON public.cn_hs_codes(global_hs_root_id);
CREATE INDEX IF NOT EXISTS idx_cn_hs_codes_description ON public.cn_hs_codes USING GIN(to_tsvector('english', description));

-- 3. Enable RLS
ALTER TABLE public.cn_hs_codes ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
DROP POLICY IF EXISTS "Authenticated users can view cn_hs_codes" ON public.cn_hs_codes;
CREATE POLICY "Authenticated users can view cn_hs_codes"
    ON public.cn_hs_codes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage cn_hs_codes" ON public.cn_hs_codes;
CREATE POLICY "Admins can manage cn_hs_codes"
    ON public.cn_hs_codes FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role::text IN ('admin', 'super_admin', 'platform_admin')
        )
    );

-- 5. Trigger for Linking to Global Root on Insert/Update
CREATE OR REPLACE FUNCTION public.link_cn_to_global_root()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.global_hs_root_id IS NULL THEN
        SELECT id INTO NEW.global_hs_root_id
        FROM public.global_hs_roots
        WHERE hs6_code = substring(NEW.cn_code, 1, 6);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_link_cn_global_root ON public.cn_hs_codes;
CREATE TRIGGER trg_link_cn_global_root
    BEFORE INSERT OR UPDATE OF cn_code
    ON public.cn_hs_codes
    FOR EACH ROW
    EXECUTE FUNCTION public.link_cn_to_global_root();

-- 6. Update Hierarchy RPC to support CN Jurisdiction
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
      CASE 
        WHEN jurisdiction = 'US' THEN (SELECT COUNT(*) FROM public.aes_hts_codes a WHERE a.global_hs_root_id = g.id)
        WHEN jurisdiction = 'EU' THEN (SELECT COUNT(*) FROM public.taric_codes t WHERE t.global_hs_root_id = g.id)
        WHEN jurisdiction = 'CN' THEN (SELECT COUNT(*) FROM public.cn_hs_codes c WHERE c.global_hs_root_id = g.id)
        ELSE 0
      END::bigint as child_count,
      TRUE as has_children,
      g.id as id
    FROM public.global_hs_roots g
    WHERE g.heading = parent_code
    GROUP BY g.hs6_code, g.description, g.id
    ORDER BY g.hs6_code;

  -- 4. Codes / Extensions (within a Root)
  ELSIF level_type = 'code' THEN
    IF jurisdiction = 'US' THEN
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
        
    ELSIF jurisdiction = 'EU' THEN
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
        
    ELSIF jurisdiction = 'CN' THEN
        RETURN QUERY
        SELECT 
          c.cn_code as code,
          c.description as description,
          0::bigint as child_count,
          FALSE as has_children,
          c.id as id
        FROM public.cn_hs_codes c
        JOIN public.global_hs_roots g ON c.global_hs_root_id = g.id
        WHERE g.hs6_code = parent_code
        ORDER BY c.cn_code;
    END IF;
    
  END IF;
END;
$$;

COMMIT;
