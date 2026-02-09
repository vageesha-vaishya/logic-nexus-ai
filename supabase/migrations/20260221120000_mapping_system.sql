-- Migration to add audit logging and validation for Booking-Quote Mapping
-- Created at: 2026-02-07

-- 1. Create Mapping Audit Log Table
CREATE TABLE IF NOT EXISTS public.mapping_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id), -- Assuming auth.users is accessible or use profiles
    source_id UUID NOT NULL, -- Quote ID
    target_id UUID, -- Booking ID (nullable if validation failed)
    action TEXT NOT NULL, -- 'VALIDATE', 'MAP', 'PREVIEW'
    status TEXT NOT NULL, -- 'SUCCESS', 'FAILURE', 'WARNING'
    details JSONB DEFAULT '{}'::jsonb, -- Validation errors, field diffs
    metadata JSONB DEFAULT '{}'::jsonb, -- IP, User Agent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS for Audit Logs
ALTER TABLE public.mapping_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view audit logs" ON public.mapping_audit_logs
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.user_roles 
            WHERE role = 'tenant_admin' AND tenant_id = mapping_audit_logs.tenant_id
        )
        OR 
        EXISTS (
             SELECT 1 FROM public.profiles
             WHERE id = auth.uid() AND tenant_id = mapping_audit_logs.tenant_id
             -- Add more granular permissions if needed
        )
    );

CREATE POLICY "Users can insert audit logs" ON public.mapping_audit_logs
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
    );

-- 2. Validation RPC
CREATE OR REPLACE FUNCTION public.validate_quote_for_booking(
    p_quote_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_quote record;
    v_account_id UUID;
    v_results JSONB;
    v_errors TEXT[] := ARRAY[]::TEXT[];
    v_warnings TEXT[] := ARRAY[]::TEXT[];
    v_is_valid BOOLEAN := TRUE;
BEGIN
    -- Fetch Quote
    SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;

    IF v_quote IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'errors', ARRAY['Quote not found']);
    END IF;

    -- 1. Check Status
    IF v_quote.status NOT IN ('approved', 'accepted') THEN
        v_errors := array_append(v_errors, 'Quote status is ' || v_quote.status || '. Must be approved or accepted.');
        v_is_valid := FALSE;
    END IF;

    -- 2. Check Expiry
    IF v_quote.valid_until < CURRENT_DATE THEN
        v_errors := array_append(v_errors, 'Quote expired on ' || v_quote.valid_until);
        v_is_valid := FALSE;
    END IF;

    -- 3. Check Account/Credit (Mock)
    IF v_quote.account_id IS NULL THEN
        v_warnings := array_append(v_warnings, 'Quote has no associated account.');
    ELSE
        -- Example credit check (could be a real table query)
        -- SELECT credit_status INTO v_credit FROM accounts WHERE id = v_quote.account_id;
        -- IF v_credit = 'hold' THEN ...
        NULL;
    END IF;

    -- 4. Check Line Items
    -- IF NOT EXISTS (SELECT 1 FROM quote_line_items WHERE quote_id = p_quote_id) THEN
    --    v_warnings := array_append(v_warnings, 'Quote has no line items.');
    -- END IF;

    v_results := jsonb_build_object(
        'valid', v_is_valid,
        'errors', v_errors,
        'warnings', v_warnings,
        'quote_summary', jsonb_build_object(
            'total', v_quote.total_amount,
            'currency', v_quote.currency,
            'account_id', v_quote.account_id
        )
    );

    -- Log the validation attempt
    INSERT INTO public.mapping_audit_logs (
        tenant_id, user_id, source_id, action, status, details
    ) VALUES (
        v_quote.tenant_id,
        auth.uid(),
        p_quote_id,
        'VALIDATE',
        CASE WHEN v_is_valid THEN 'SUCCESS' ELSE 'FAILURE' END,
        v_results
    );

    RETURN v_results;
END;
$$;
