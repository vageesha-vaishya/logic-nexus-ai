-- Allow Platform Admins to view/manage all transfers
DROP POLICY IF EXISTS "Users can view transfers for their tenant" ON entity_transfers;
CREATE POLICY "Users can view transfers" ON entity_transfers
    FOR SELECT
    USING (
        (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
        OR
        source_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()) 
        OR
        target_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can create transfers from their tenant" ON entity_transfers;
CREATE POLICY "Users can create transfers" ON entity_transfers
    FOR INSERT
    WITH CHECK (
        (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
        OR
        source_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Target admins can update status" ON entity_transfers;
CREATE POLICY "Users can update status" ON entity_transfers
    FOR UPDATE
    USING (
        (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
        OR
        target_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
    );

-- Items policies
DROP POLICY IF EXISTS "View transfer items" ON entity_transfer_items;
CREATE POLICY "View transfer items" ON entity_transfer_items
    FOR SELECT
    USING (
        (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
        OR
        EXISTS (
            SELECT 1 FROM entity_transfers et 
            WHERE et.id = entity_transfer_items.transfer_id
            AND (
                et.source_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()) OR
                et.target_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Create transfer items" ON entity_transfer_items;
CREATE POLICY "Create transfer items" ON entity_transfer_items
    FOR INSERT
    WITH CHECK (
        (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
        OR
        EXISTS (
            SELECT 1 FROM entity_transfers et 
            WHERE et.id = entity_transfer_items.transfer_id
            AND et.source_tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
        )
    );

-- Update dashboard_preferences policies
DROP POLICY IF EXISTS "Users can view team dashboard preferences" ON dashboard_preferences;
CREATE POLICY "Users can view team dashboard preferences"
    ON public.dashboard_preferences FOR SELECT
    USING (
        (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
        OR
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    );
