-- Migration: Enforce Hierarchy on Compliance Screenings
-- Description: Adds franchise_id, makes tenant_id mandatory, and enforces strict RLS.

-- 1. Add franchise_id column
ALTER TABLE public.compliance_screenings 
ADD COLUMN IF NOT EXISTS franchise_id UUID;

-- 2. Backfill tenant_id and franchise_id from user_roles
-- This is a best-effort backfill for existing records
-- We use user_roles because that's where franchise_id and tenant_id authority lives
UPDATE public.compliance_screenings cs
SET 
    tenant_id = ur.tenant_id,
    franchise_id = ur.franchise_id
FROM public.user_roles ur
WHERE cs.performed_by = ur.user_id
AND (cs.tenant_id IS NULL OR cs.franchise_id IS NULL);

-- 3. Make tenant_id mandatory (after backfill)
-- Delete orphans that can't be attributed
DELETE FROM public.compliance_screenings WHERE tenant_id IS NULL;
ALTER TABLE public.compliance_screenings ALTER COLUMN tenant_id SET NOT NULL;

-- 4. Create Index on franchise_id
CREATE INDEX IF NOT EXISTS idx_compliance_screenings_franchise ON public.compliance_screenings(franchise_id);
CREATE INDEX IF NOT EXISTS idx_compliance_screenings_tenant ON public.compliance_screenings(tenant_id);

-- 5. Drop old loose RLS policies
DROP POLICY IF EXISTS "Users can view their own screenings or tenant screenings" ON public.compliance_screenings;
DROP POLICY IF EXISTS "Users can create screenings" ON public.compliance_screenings;

-- 6. Create Strict RLS Policies

-- Policy: Users view screenings
-- Rules:
-- 1. Platform Admin: See all
-- 2. HQ User (franchise_id is NULL): See all in Tenant
-- 3. Franchise User: See only their Franchise
CREATE POLICY "Users view screenings" ON public.compliance_screenings
    FOR SELECT
    USING (
        -- 1. Platform Admin (bypass all)
        (SELECT public.is_platform_admin(auth.uid()))
        OR
        (
            -- Must belong to same Tenant
            tenant_id = public.get_user_tenant_id(auth.uid())
            AND (
                -- 2. HQ User (sees all in tenant)
                public.get_user_franchise_id(auth.uid()) IS NULL
                OR
                -- 3. Franchise User (sees only their franchise)
                franchise_id = public.get_user_franchise_id(auth.uid())
            )
        )
    );

-- Policy: Users create screenings
-- Must insert their own tenant_id/franchise_id
CREATE POLICY "Users create screenings" ON public.compliance_screenings
    FOR INSERT
    WITH CHECK (
        -- Must match user's tenant
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND
        -- Must match user's franchise (or be null if user is HQ)
        (
            franchise_id = public.get_user_franchise_id(auth.uid())
            OR 
            (franchise_id IS NULL AND public.get_user_franchise_id(auth.uid()) IS NULL)
        )
    );

-- Policy: Users update screenings? 
-- Generally screenings are immutable audit logs. But if we allow adding notes/overrides:
CREATE POLICY "Users update screenings" ON public.compliance_screenings
    FOR UPDATE
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            public.get_user_franchise_id(auth.uid()) IS NULL
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );
