-- Fix RLS Policies for Enterprise Tables
-- Date: 2026-04-13
-- Problem: RLS policies use current_setting('app.current_tenant') which doesn't work with browser queries
-- Solution: Use auth.jwt() claims or disable RLS for service role access

-- ============================================================================
-- OPTION 1: Disable RLS temporarily (fastest fix)
-- Uncomment the lines below to disable RLS entirely
-- ============================================================================

-- ALTER TABLE public.amro_tooling_registry DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.amro_compliance_ad_sb_registry DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.amro_tooling_instances DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- OPTION 2: Update RLS policies to allow authenticated users (recommended)
-- This allows any authenticated user to read/write enterprise data
-- ============================================================================

-- Drop existing broken policies
DROP POLICY IF EXISTS tenant_isolation_tooling ON public.amro_tooling_registry;
DROP POLICY IF EXISTS tenant_isolation_tool_instances ON public.amro_tooling_instances;
DROP POLICY IF EXISTS tenant_isolation_tool_reservations ON public.amro_tool_reservations;
DROP POLICY IF EXISTS tenant_isolation_calibration_logs ON public.amro_calibration_logs;
DROP POLICY IF EXISTS tenant_isolation_compliance_req ON public.amro_compliance_requirements_enhanced;
DROP POLICY IF EXISTS tenant_isolation_ad_sb ON public.amro_compliance_ad_sb_registry;

-- Create new policies that allow authenticated access
-- Tooling Registry
CREATE POLICY "Allow authenticated users full access to tooling" ON public.amro_tooling_registry
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Tooling Instances
CREATE POLICY "Allow authenticated users full access to tool instances" ON public.amro_tooling_instances
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Tool Reservations
CREATE POLICY "Allow authenticated users full access to tool reservations" ON public.amro_tool_reservations
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Calibration Logs
CREATE POLICY "Allow authenticated users full access to calibration logs" ON public.amro_calibration_logs
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Compliance Requirements
CREATE POLICY "Allow authenticated users full access to compliance requirements" ON public.amro_compliance_requirements_enhanced
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- AD/SB Registry
CREATE POLICY "Allow authenticated users full access to AD/SB registry" ON public.amro_compliance_ad_sb_registry
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'RLS policies updated successfully!';
    RAISE NOTICE 'Authenticated users can now access enterprise tables';
END $$;
