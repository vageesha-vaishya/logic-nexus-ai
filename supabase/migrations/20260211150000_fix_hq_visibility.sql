-- Migration: Fix HQ Visibility (Handle NULL franchise_id)
-- Description: Updates RLS policies to correctly handle HQ Users (NULL franchise_id).
-- Pattern: HQ Users see HQ Data (franchise_id IS NULL). Franchise Users see Franchise Data.
-- Tenant Admins continue to see ALL via their specific policies.

-- Helper macro for the condition:
-- (get_user_franchise_id() IS NULL AND franchise_id IS NULL) OR franchise_id = get_user_franchise_id()
-- Note: We can't use macros in SQL, so we repeat the logic.

-- =====================================================
-- 1. ACCOUNTS
-- =====================================================
DROP POLICY IF EXISTS "Users can view franchise accounts" ON public.accounts;
CREATE POLICY "Users can view franchise accounts" ON public.accounts
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            (public.get_user_franchise_id(auth.uid()) IS NULL AND franchise_id IS NULL)
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can create franchise accounts" ON public.accounts;
CREATE POLICY "Users can create franchise accounts" ON public.accounts
    FOR INSERT
    WITH CHECK (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            (public.get_user_franchise_id(auth.uid()) IS NULL AND franchise_id IS NULL)
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );

-- =====================================================
-- 2. CONTACTS
-- =====================================================
-- Drop old policies (names might vary, dropping likely candidates)
DROP POLICY IF EXISTS "Users can view franchise contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can view contacts" ON public.contacts; 

CREATE POLICY "Users can view franchise contacts" ON public.contacts
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            (public.get_user_franchise_id(auth.uid()) IS NULL AND franchise_id IS NULL)
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );

-- =====================================================
-- 3. LEADS
-- =====================================================
DROP POLICY IF EXISTS "Users can view assigned leads" ON public.leads;
-- Leads often have owner_id override
CREATE POLICY "Users can view assigned leads" ON public.leads
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            owner_id = auth.uid()
            OR
            (public.get_user_franchise_id(auth.uid()) IS NULL AND franchise_id IS NULL)
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );

-- =====================================================
-- 4. OPPORTUNITIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view franchise opportunities" ON public.opportunities;
CREATE POLICY "Users can view franchise opportunities" ON public.opportunities
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            owner_id = auth.uid()
            OR
            (public.get_user_franchise_id(auth.uid()) IS NULL AND franchise_id IS NULL)
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );

-- =====================================================
-- 5. QUOTES
-- =====================================================
DROP POLICY IF EXISTS "Users can view own quotes" ON public.quotes;
CREATE POLICY "Users can view own quotes" ON public.quotes
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            owner_id = auth.uid()
            OR
            (public.get_user_franchise_id(auth.uid()) IS NULL AND franchise_id IS NULL)
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );

-- =====================================================
-- 6. SHIPMENTS
-- =====================================================
DROP POLICY IF EXISTS "Users can view own shipments" ON public.shipments;
CREATE POLICY "Users can view own shipments" ON public.shipments
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            (public.get_user_franchise_id(auth.uid()) IS NULL AND franchise_id IS NULL)
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );
