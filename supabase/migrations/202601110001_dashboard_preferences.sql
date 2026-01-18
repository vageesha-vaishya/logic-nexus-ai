CREATE TABLE IF NOT EXISTS public.dashboard_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id),
    franchise_id UUID REFERENCES public.franchises(id),
    widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can view own dashboard preferences"
    ON public.dashboard_preferences FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can insert own dashboard preferences"
    ON public.dashboard_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can update own dashboard preferences"
    ON public.dashboard_preferences FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy for Team View (read-only)
-- Users can view dashboards of other users in the same tenant
DROP POLICY IF EXISTS "Users can view team dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users can view team dashboard preferences"
    ON public.dashboard_preferences FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    );

