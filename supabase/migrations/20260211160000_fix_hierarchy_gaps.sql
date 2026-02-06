-- Fix Hierarchy Gaps: HQ Visibility for Invoices, Shipments, Activities, Opportunities
-- Description: Updates RLS policies to correctly handle HQ Users (who have NULL franchise_id)
-- ensuring they can access records owned by the Tenant directly (NULL franchise_id).

BEGIN;

-----------------------------------------------------------------------------
-- 1. Invoices (Fix HQ Visibility - Strict Enforcement)
-----------------------------------------------------------------------------
-- Drop potential legacy/loose policies
DROP POLICY IF EXISTS "Franchise users view franchise invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users view invoices" ON public.invoices;

CREATE POLICY "Users view invoices" ON public.invoices
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            (public.get_user_franchise_id(auth.uid()) IS NULL AND franchise_id IS NULL)
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );

-----------------------------------------------------------------------------
-- 2. Activities (Fix HQ Visibility)
-----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view franchise activities" ON public.activities;
-- Drop potential legacy policy name
DROP POLICY IF EXISTS "Users can view activities" ON public.activities;

CREATE POLICY "Users can view franchise activities" ON public.activities
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            (public.get_user_franchise_id(auth.uid()) IS NULL AND franchise_id IS NULL)
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );

-----------------------------------------------------------------------------
-- 3. Opportunities (Fix HQ Visibility)
-----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view franchise opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can view opportunities" ON public.opportunities;

CREATE POLICY "Users can view franchise opportunities" ON public.opportunities
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            (public.get_user_franchise_id(auth.uid()) IS NULL AND franchise_id IS NULL)
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );

-----------------------------------------------------------------------------
-- 4. Shipments & Logistics (Fix HQ Visibility)
-----------------------------------------------------------------------------

-- 4.1 Shipments
DROP POLICY IF EXISTS "Users can view franchise shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can view shipments" ON public.shipments;

CREATE POLICY "Users can view franchise shipments" ON public.shipments
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            (public.get_user_franchise_id(auth.uid()) IS NULL AND franchise_id IS NULL)
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );

-- 4.2 Shipment Items (Update to rely on Shipments RLS)
DROP POLICY IF EXISTS "Users can manage items for accessible shipments" ON public.shipment_items;

CREATE POLICY "Users can manage items for accessible shipments" ON public.shipment_items
    FOR ALL
    USING (
        shipment_id IN (SELECT id FROM public.shipments)
    );

-- 4.3 Tracking Events (Update to rely on Shipments RLS)
DROP POLICY IF EXISTS "Users can view tracking for accessible shipments" ON public.tracking_events;
DROP POLICY IF EXISTS "Users can create tracking events for accessible shipments" ON public.tracking_events;

CREATE POLICY "Users can view tracking for accessible shipments" ON public.tracking_events
    FOR SELECT
    USING (
        shipment_id IN (SELECT id FROM public.shipments)
    );

CREATE POLICY "Users can create tracking events for accessible shipments" ON public.tracking_events
    FOR INSERT
    WITH CHECK (
        shipment_id IN (SELECT id FROM public.shipments)
    );

-- 4.4 Customs Documents (Update to rely on Shipments RLS)
DROP POLICY IF EXISTS "Users can manage customs documents for accessible shipments" ON public.customs_documents;

CREATE POLICY "Users can manage customs documents for accessible shipments" ON public.customs_documents
    FOR ALL
    USING (
        shipment_id IN (SELECT id FROM public.shipments)
    );

COMMIT;
