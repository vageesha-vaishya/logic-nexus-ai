-- Fix Invoice Hierarchy: Add franchise_id and RLS policies
-- Description: Enforces Franchise-level isolation for Invoices and Payments

BEGIN;

-----------------------------------------------------------------------------
-- 1. Update Invoices Table
-----------------------------------------------------------------------------

-- Add franchise_id column
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_invoices_franchise ON public.invoices(franchise_id);

-- RLS: Franchise Admin (Manage)
DROP POLICY IF EXISTS "Franchise admins manage franchise invoices" ON public.invoices;
CREATE POLICY "Franchise admins manage franchise invoices" ON public.invoices
    FOR ALL
    USING (
        public.has_role(auth.uid(), 'franchise_admin'::public.app_role) 
        AND franchise_id = public.get_user_franchise_id(auth.uid())
    );

-- RLS: Franchise User (View)
DROP POLICY IF EXISTS "Franchise users view franchise invoices" ON public.invoices;
CREATE POLICY "Franchise users view franchise invoices" ON public.invoices
    FOR SELECT
    USING (
        franchise_id = public.get_user_franchise_id(auth.uid())
    );

-----------------------------------------------------------------------------
-- 2. Update Payments Table
-----------------------------------------------------------------------------

-- Add franchise_id column
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_payments_franchise ON public.payments(franchise_id);

-- RLS: Franchise Admin (Manage)
DROP POLICY IF EXISTS "Franchise admins manage franchise payments" ON public.payments;
CREATE POLICY "Franchise admins manage franchise payments" ON public.payments
    FOR ALL
    USING (
        public.has_role(auth.uid(), 'franchise_admin'::public.app_role) 
        AND franchise_id = public.get_user_franchise_id(auth.uid())
    );

-- RLS: Franchise User (View)
DROP POLICY IF EXISTS "Franchise users view franchise payments" ON public.payments;
CREATE POLICY "Franchise users view franchise payments" ON public.payments
    FOR SELECT
    USING (
        franchise_id = public.get_user_franchise_id(auth.uid())
    );

-----------------------------------------------------------------------------
-- 3. Update Invoice Line Items RLS
-----------------------------------------------------------------------------

-- We need to update the policies to allow Franchise Admins/Users to see line items 
-- for invoices they have access to. The existing "Tenant admins" policy uses EXISTS, 
-- but we need explicit Franchise policies to be safe and consistent.

DROP POLICY IF EXISTS "Franchise admins manage invoice items" ON public.invoice_line_items;
CREATE POLICY "Franchise admins manage invoice items" ON public.invoice_line_items
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE id = public.invoice_line_items.invoice_id
            AND franchise_id = public.get_user_franchise_id(auth.uid())
        )
        AND public.has_role(auth.uid(), 'franchise_admin'::public.app_role)
    );

DROP POLICY IF EXISTS "Franchise users view invoice items" ON public.invoice_line_items;
CREATE POLICY "Franchise users view invoice items" ON public.invoice_line_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE id = public.invoice_line_items.invoice_id
            AND franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );

COMMIT;
