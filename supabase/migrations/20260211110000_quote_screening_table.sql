
-- Table for storing contact screening results per quote
-- Enables persistence of screening status (Pending, Cleared, Hit) and audit trail
CREATE TABLE IF NOT EXISTS public.quote_contacts_screening (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL, -- Can be null if one-off contact? Assuming linked for now
    direction TEXT NOT NULL CHECK (direction IN ('shipper', 'consignee')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'cleared', 'hit', 'review')),
    matched_json JSONB DEFAULT '[]'::jsonb, -- Store the screening matches snapshot
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraint: Only one active screening per contact per quote per direction? 
    -- Actually we might want history. But for UI state we need the latest.
    -- Let's just index it well.
    UNIQUE(quote_id, direction) -- Enforce one status per direction per quote for simplicity in MVP
);

-- Index for fast lookup during quote load
CREATE INDEX IF NOT EXISTS idx_quote_screening_quote_id ON public.quote_contacts_screening(quote_id);

-- RLS
ALTER TABLE public.quote_contacts_screening ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view screenings for their tenant's quotes" ON public.quote_contacts_screening
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = quote_contacts_screening.quote_id
            AND (q.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) OR q.tenant_id IS NULL)
        )
    );

CREATE POLICY "Users can create/update screenings for their tenant's quotes" ON public.quote_contacts_screening
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = quote_contacts_screening.quote_id
            AND (q.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) OR q.tenant_id IS NULL)
        )
    );

-- Add 'quote.screen' permission (insert into permissions table if exists, or handled via app config)
-- We'll assume the permission system uses the 'permissions' table or config/permissions.ts.
-- Based on previous context, there is a permissions config.
