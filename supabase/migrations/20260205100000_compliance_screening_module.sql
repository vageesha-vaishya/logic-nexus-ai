-- Enable pg_trgm for fuzzy matching if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Restricted Party Lists (The Source Data)
DROP TABLE IF EXISTS public.restricted_party_lists CASCADE;
CREATE TABLE public.restricted_party_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_list TEXT NOT NULL, -- e.g., 'BIS_DPL', 'BIS_EL', 'OFAC_SDN'
    entity_name TEXT NOT NULL,
    alias_type TEXT, -- e.g., 'aka', 'fka'
    address TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country_code TEXT, -- ISO 2-char
    effective_date DATE,
    expiration_date DATE,
    remarks TEXT,
    meta_data JSONB DEFAULT '{}'::jsonb, -- Stores raw source data
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for search performance
CREATE INDEX IF NOT EXISTS idx_restricted_party_name_trgm ON public.restricted_party_lists USING gin (entity_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_restricted_party_source ON public.restricted_party_lists(source_list);
CREATE INDEX IF NOT EXISTS idx_restricted_party_country ON public.restricted_party_lists(country_code);

-- 2. Compliance Screenings (The Audit Log)
-- Records every screening attempt and its result
DROP TABLE IF EXISTS public.compliance_screenings CASCADE;
CREATE TABLE public.compliance_screenings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID, -- Optional if we want to isolate screenings per tenant, though the lists are global
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ DEFAULT now(),
    
    -- The input data used for screening
    search_name TEXT NOT NULL,
    search_country TEXT,
    search_address TEXT,
    
    -- Link to internal entities if applicable
    linked_entity_type TEXT, -- 'contact', 'account', 'lead'
    linked_entity_id UUID,
    
    -- Result
    status TEXT NOT NULL DEFAULT 'clear', -- 'clear', 'potential_match', 'confirmed_match', 'override'
    match_score NUMERIC(5,2) DEFAULT 0, -- Highest match score found (0-100)
    matches_found JSONB DEFAULT '[]'::jsonb, -- Details of the matches found
    
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_compliance_screenings_performed_at ON public.compliance_screenings(performed_at);
CREATE INDEX IF NOT EXISTS idx_compliance_screenings_entity ON public.compliance_screenings(linked_entity_type, linked_entity_id);

-- RLS
ALTER TABLE public.restricted_party_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_screenings ENABLE ROW LEVEL SECURITY;

-- Policies for Restricted Party Lists (Public Read, Admin Write)
-- Drop existing policies first to avoid conflict if table wasn't dropped (but we dropped it)
-- Since we dropped the table, policies are gone.
CREATE POLICY "Authenticated users can read restricted lists" ON public.restricted_party_lists
    FOR SELECT TO authenticated USING (true);

-- Policies for Screenings
CREATE POLICY "Users can view their own screenings or tenant screenings" ON public.compliance_screenings
    FOR SELECT TO authenticated USING (
        performed_by = auth.uid() OR 
        (tenant_id IS NOT NULL AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY "Users can create screenings" ON public.compliance_screenings
    FOR INSERT TO authenticated WITH CHECK (
        performed_by = auth.uid()
    );

-- 3. RPC Function for Screening
CREATE OR REPLACE FUNCTION public.screen_restricted_party(
    p_name TEXT,
    p_country TEXT DEFAULT NULL,
    p_threshold NUMERIC DEFAULT 0.6 -- 60% similarity threshold
)
RETURNS TABLE (
    id UUID,
    source_list TEXT,
    entity_name TEXT,
    address TEXT,
    country_code TEXT,
    similarity NUMERIC,
    remarks TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.source_list,
        r.entity_name,
        r.address,
        r.country_code,
        GREATEST(similarity(r.entity_name, p_name), word_similarity(p_name, r.entity_name))::NUMERIC as sim,
        r.remarks
    FROM public.restricted_party_lists r
    WHERE 
        (p_country IS NULL OR r.country_code IS NULL OR r.country_code = p_country)
        AND (similarity(r.entity_name, p_name) >= p_threshold OR word_similarity(p_name, r.entity_name) >= p_threshold)
    ORDER BY sim DESC
    LIMIT 20;
END;
$$;
