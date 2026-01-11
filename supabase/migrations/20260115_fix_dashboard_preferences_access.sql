-- Fix dashboard_preferences RLS and Permissions
-- Handles potential RLS recursion and ensures correct access for own/team dashboards

-- 1. Ensure table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.dashboard_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id),
    franchise_id UUID REFERENCES public.franchises(id),
    widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- 3. Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_preferences TO authenticated;

-- 4. Re-create Policies (Drop all first to ensure clean state)

DROP POLICY IF EXISTS "Users can view own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can insert own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can update own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can delete own dashboard preferences" ON public.dashboard_preferences;
DROP POLICY IF EXISTS "Users can view team dashboard preferences" ON public.dashboard_preferences;

-- Policy 1: Users can view/manage their own preferences
CREATE POLICY "Users can view own dashboard preferences"
    ON public.dashboard_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dashboard preferences"
    ON public.dashboard_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboard preferences"
    ON public.dashboard_preferences FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboard preferences"
    ON public.dashboard_preferences FOR DELETE
    USING (auth.uid() = user_id);

-- Policy 2: Users can view team dashboard preferences (Read-Only)
-- Platform Admins can view all.
-- Tenant/Franchise users can view preferences belonging to their tenant.
CREATE POLICY "Users can view team dashboard preferences"
    ON public.dashboard_preferences FOR SELECT
    USING (
        public.is_platform_admin(auth.uid())
        OR
        (
            tenant_id IS NOT NULL 
            AND 
            tenant_id IN (
                SELECT tenant_id FROM public.user_roles 
                WHERE user_id = auth.uid() 
                AND tenant_id IS NOT NULL
            )
        )
    );

-- 5. Fix user_roles policy recursion (just in case)
-- Ensure user_roles is viewable by owner to avoid RLS recursion issues
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
    ON public.user_roles FOR SELECT
    USING (user_id = auth.uid());
