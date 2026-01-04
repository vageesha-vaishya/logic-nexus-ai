-- Advanced Lead Scoring Schema

-- 1. Lead Activities Table
CREATE TABLE IF NOT EXISTS public.lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g., 'email_opened', 'link_clicked', 'page_view', 'form_submission'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tenant_id UUID REFERENCES public.tenants(id) -- Optional, for multi-tenancy if leads are tenant-scoped
);

-- Index for faster querying of activities by lead
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON public.lead_activities(created_at);

-- 2. Lead Score Configuration Table
CREATE TABLE IF NOT EXISTS public.lead_score_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    weights_json JSONB NOT NULL DEFAULT '{
        "demographic": {
            "title_cxo": 20,
            "title_vp": 15,
            "title_manager": 10
        },
        "behavioral": {
            "email_opened": 5,
            "link_clicked": 10,
            "page_view": 2,
            "form_submission": 20
        },
        "logistics": {
            "high_value_cargo": 20,
            "urgent_shipment": 15
        },
        "decay": {
            "weekly_percentage": 10
        }
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- 3. RLS Policies

-- Enable RLS
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_score_config ENABLE ROW LEVEL SECURITY;

-- Policies for lead_activities
-- Assuming users can view activities for leads they have access to
CREATE POLICY "Users can view activities for their leads" ON public.lead_activities
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = lead_activities.lead_id
            -- Add additional checks here if leads are scoped by user/tenant
        )
    );

CREATE POLICY "Users can insert activities" ON public.lead_activities
    FOR INSERT
    WITH CHECK (true); -- Or restrict to authenticated users

-- Policies for lead_score_config
CREATE POLICY "Users can view their tenant score config" ON public.lead_score_config
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
    );

CREATE POLICY "Admins can update their tenant score config" ON public.lead_score_config
    FOR UPDATE
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND public.has_role(auth.uid(), 'tenant_admin')
    );

-- 4. Lead Score Logs (Optional, for audit/history)
CREATE TABLE IF NOT EXISTS public.lead_score_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    old_score INTEGER,
    new_score INTEGER,
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_score_logs_lead_id ON public.lead_score_logs(lead_id);

ALTER TABLE public.lead_score_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view score logs for their leads" ON public.lead_score_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = lead_score_logs.lead_id
        )
    );
