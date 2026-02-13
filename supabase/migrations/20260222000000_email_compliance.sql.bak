-- Migration: 20260222000000_email_compliance.sql
-- Description: Adds tables for Email Compliance (Retention Policies & Legal Holds)

-- Ensure helper function exists
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Retention Policies Table
CREATE TABLE IF NOT EXISTS public.compliance_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    scope TEXT NOT NULL CHECK (scope IN ('global', 'folder', 'label', 'sender_domain')),
    scope_value TEXT, -- e.g., 'inbox', 'important', 'example.com'. NULL for global.
    retention_days INTEGER NOT NULL CHECK (retention_days > 0),
    action TEXT NOT NULL CHECK (action IN ('archive', 'delete', 'permanent_delete')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Legal Holds Table
-- Prevents deletion/archiving even if retention policy applies
CREATE TABLE IF NOT EXISTS public.compliance_legal_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    target_type TEXT NOT NULL CHECK (target_type IN ('user', 'email_address', 'domain', 'subject_keyword')),
    target_value TEXT NOT NULL, -- UUID for user, email string for others
    start_date TIMESTAMPTZ DEFAULT now(),
    end_date TIMESTAMPTZ, -- NULL means indefinite
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Compliance Audit Log (optional, but good for compliance)
CREATE TABLE IF NOT EXISTS public.compliance_actions_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID REFERENCES public.compliance_retention_policies(id),
    email_id UUID REFERENCES public.emails(id) ON DELETE SET NULL,
    action_taken TEXT NOT NULL, -- 'archived', 'deleted'
    executed_at TIMESTAMPTZ DEFAULT now(),
    details JSONB
);

-- 4. RLS Policies

-- Enable RLS
ALTER TABLE public.compliance_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_actions_log ENABLE ROW LEVEL SECURITY;

-- Policies (Admin only usually, but for now we'll allow tenant access)
CREATE POLICY "Tenant admins can manage retention policies" ON public.compliance_retention_policies
    FOR ALL
    TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "Tenant admins can manage legal holds" ON public.compliance_legal_holds
    FOR ALL
    TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "Tenant admins can view compliance logs" ON public.compliance_actions_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.compliance_retention_policies p 
            WHERE p.id = compliance_actions_log.policy_id 
            AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
        )
    );

-- 5. Trigger for updated_at
CREATE TRIGGER update_compliance_retention_policies_modtime
    BEFORE UPDATE ON public.compliance_retention_policies
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 6. RPC to execute a retention policy
CREATE OR REPLACE FUNCTION public.execute_retention_policy(p_policy_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_policy RECORD;
    v_rows_affected INTEGER := 0;
    v_legal_hold_emails UUID[];
    v_target_emails UUID[];
    v_action_result JSONB;
BEGIN
    -- 1. Get Policy Details
    SELECT * INTO v_policy FROM public.compliance_retention_policies WHERE id = p_policy_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Policy not found');
    END IF;

    -- 2. Identify Emails under Legal Hold (Global or specific)
    -- This is a simplified check. In production, we'd need complex matching.
    -- For now: Check holds on the Tenant, or specific User (Sender), or Subject match.
    
    WITH active_holds AS (
        SELECT * FROM public.compliance_legal_holds
        WHERE tenant_id = v_policy.tenant_id
          AND is_active = true
          AND (end_date IS NULL OR end_date > now())
    ),
    held_emails AS (
        SELECT e.id
        FROM public.emails e
        JOIN active_holds h ON 
            (h.target_type = 'domain' AND e.from_email LIKE '%' || h.target_value) OR
            (h.target_type = 'email_address' AND e.from_email = h.target_value) OR
            (h.target_type = 'subject_keyword' AND e.subject ILIKE '%' || h.target_value || '%')
        WHERE e.tenant_id = v_policy.tenant_id
    )
    SELECT array_agg(id) INTO v_legal_hold_emails FROM held_emails;

    -- 3. Select Candidate Emails (Respecting Scope and Retention Days)
    WITH candidates AS (
        SELECT id 
        FROM public.emails
        WHERE tenant_id = v_policy.tenant_id
          AND received_at < (now() - (v_policy.retention_days || ' days')::INTERVAL)
          -- Exclude emails already in target state to avoid redundant work
          AND (
             (v_policy.action = 'archive' AND folder != 'archive') OR
             (v_policy.action = 'delete' AND folder != 'trash') OR
             (v_policy.action = 'permanent_delete') -- Always process if exists
          )
          -- Apply Scope
          AND (
            v_policy.scope = 'global' OR
            (v_policy.scope = 'folder' AND folder = v_policy.scope_value) OR
            (v_policy.scope = 'sender_domain' AND from_email LIKE '%' || v_policy.scope_value)
            -- 'label' scope requires checking JSONB or relation, skipped for brevity in this iteration
          )
          -- Exclude Legal Holds
          AND (v_legal_hold_emails IS NULL OR id != ALL(v_legal_hold_emails))
        LIMIT 1000 -- Batch limit
    )
    SELECT array_agg(id) INTO v_target_emails FROM candidates;

    IF v_target_emails IS NULL OR array_length(v_target_emails, 1) IS NULL THEN
        RETURN jsonb_build_object('success', true, 'processed_count', 0, 'message', 'No matching emails found');
    END IF;

    -- 4. Perform Action
    IF v_policy.action = 'archive' THEN
        UPDATE public.emails SET folder = 'archive' WHERE id = ANY(v_target_emails);
        v_rows_affected := array_length(v_target_emails, 1);
    ELSIF v_policy.action = 'delete' THEN
        UPDATE public.emails SET folder = 'trash' WHERE id = ANY(v_target_emails);
        v_rows_affected := array_length(v_target_emails, 1);
    ELSIF v_policy.action = 'permanent_delete' THEN
        DELETE FROM public.emails WHERE id = ANY(v_target_emails);
        v_rows_affected := array_length(v_target_emails, 1);
    END IF;

    -- 5. Log Action (Bulk insert for performance, or summary)
    -- Here we just log a summary for now to avoid massive insert volume
    INSERT INTO public.compliance_actions_log (policy_id, action_taken, details)
    VALUES (p_policy_id, v_policy.action, jsonb_build_object('count', v_rows_affected, 'sample_ids', v_target_emails[1:5]));

    RETURN jsonb_build_object('success', true, 'processed_count', v_rows_affected, 'action', v_policy.action);
END;
$$;
