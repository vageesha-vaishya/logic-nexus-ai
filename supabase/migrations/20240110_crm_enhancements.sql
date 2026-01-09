-- Migration: 20240110_crm_enhancements
-- Description: Adds advanced CRM features for Accounts and Contacts (Segmentation, Relationships, Extended Fields)

-- 1. Add Extended Fields to Accounts
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS social_profiles JSONB DEFAULT '{}'::jsonb;

-- 2. Add Extended Fields to Contacts
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS title_level TEXT, -- e.g., C-Level, VP, Director, Manager
ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES public.contacts(id),
ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT DEFAULT 'lead', -- subscriber, lead, mql, sql, customer, evangelist, other
ADD COLUMN IF NOT EXISTS lead_source TEXT,
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS social_profiles JSONB DEFAULT '{}'::jsonb;

-- 3. Create Account Relationships Table
CREATE TABLE IF NOT EXISTS public.account_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    from_account_id UUID NOT NULL REFERENCES public.accounts(id),
    to_account_id UUID NOT NULL REFERENCES public.accounts(id),
    relationship_type TEXT NOT NULL, -- partner, vendor, subsidiary, competitor, other
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.profiles(id),
    
    CONSTRAINT unique_account_relationship UNIQUE (from_account_id, to_account_id, relationship_type)
);

-- 4. Create Segments Table (Dynamic Lists)
CREATE TABLE IF NOT EXISTS public.segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    name TEXT NOT NULL,
    description TEXT,
    entity_type TEXT NOT NULL, -- account, contact
    criteria JSONB NOT NULL DEFAULT '{}'::jsonb, -- Filter rules
    is_dynamic BOOLEAN DEFAULT true, -- true = computed query, false = static list
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.profiles(id)
);

-- 5. Create Static Segment Members Table
CREATE TABLE IF NOT EXISTS public.segment_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL, -- account_id or contact_id
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    CONSTRAINT unique_segment_member UNIQUE (segment_id, entity_id)
);

-- 6. Enable RLS
ALTER TABLE public.account_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segment_members ENABLE ROW LEVEL SECURITY;

-- 7. Add RLS Policies (Standard Tenant Isolation)
CREATE POLICY "Users can view account relationships in their tenant" ON public.account_relationships
    FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage account relationships in their tenant" ON public.account_relationships
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view segments in their tenant" ON public.segments
    FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage segments in their tenant" ON public.segments
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view segment members via segment" ON public.segment_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.segments s 
            WHERE s.id = segment_members.segment_id 
            AND s.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can manage segment members via segment" ON public.segment_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.segments s 
            WHERE s.id = segment_members.segment_id 
            AND s.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- 8. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_accounts_custom_fields ON public.accounts USING GIN (custom_fields);
CREATE INDEX IF NOT EXISTS idx_contacts_custom_fields ON public.contacts USING GIN (custom_fields);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_account_relationships_from ON public.account_relationships(from_account_id);
CREATE INDEX IF NOT EXISTS idx_account_relationships_to ON public.account_relationships(to_account_id);
