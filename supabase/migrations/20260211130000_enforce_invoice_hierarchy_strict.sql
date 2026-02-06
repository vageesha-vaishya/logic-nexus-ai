BEGIN;

-- 1. Invoices
-- Drop the broad policy that allowed cross-franchise access
DROP POLICY IF EXISTS "Users view invoices" ON public.invoices;
-- Drop the specific policy from previous migration (consolidating into one smart policy)
DROP POLICY IF EXISTS "Franchise users view franchise invoices" ON public.invoices;

-- Create unified view policy that enforces hierarchy
CREATE POLICY "Users view invoices" ON public.invoices
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            -- HQ Users (no franchise_id) see all
            public.get_user_franchise_id(auth.uid()) IS NULL
            OR
            -- Franchise Users only see their franchise
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );

-- 2. Payments
DROP POLICY IF EXISTS "Users view payments" ON public.payments;
DROP POLICY IF EXISTS "Franchise users view franchise payments" ON public.payments;

CREATE POLICY "Users view payments" ON public.payments
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            public.get_user_franchise_id(auth.uid()) IS NULL
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );

-- 3. Line Items
DROP POLICY IF EXISTS "Users view invoice items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Franchise users view invoice items" ON public.invoice_line_items;

CREATE POLICY "Users view invoice items" ON public.invoice_line_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE id = public.invoice_line_items.invoice_id
            AND tenant_id = public.get_user_tenant_id(auth.uid())
            AND (
                public.get_user_franchise_id(auth.uid()) IS NULL
                OR
                franchise_id = public.get_user_franchise_id(auth.uid())
            )
        )
    );

COMMIT;
