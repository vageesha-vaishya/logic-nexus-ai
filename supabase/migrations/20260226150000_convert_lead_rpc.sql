-- Convert Lead RPC with comprehensive data
CREATE OR REPLACE FUNCTION public.convert_lead_v2(
    p_lead_id UUID,
    p_tenant_id UUID,
    p_franchise_id UUID,
    p_user_id UUID,
    p_account_data JSONB DEFAULT NULL,
    p_contact_data JSONB DEFAULT NULL,
    p_opportunity_data JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account_id UUID;
    v_contact_id UUID;
    v_opportunity_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Create Account
    IF p_account_data IS NOT NULL THEN
        INSERT INTO public.accounts (
            tenant_id, franchise_id,
            name, email, phone, website,
            billing_street, billing_city, billing_state, billing_postal_code, billing_country,
            industry, status, created_by
        )
        VALUES (
            p_tenant_id, p_franchise_id,
            p_account_data->>'name',
            p_account_data->>'email',
            p_account_data->>'phone',
            p_account_data->>'website',
            p_account_data->>'billing_street',
            p_account_data->>'billing_city',
            p_account_data->>'billing_state',
            p_account_data->>'billing_postal_code',
            p_account_data->>'billing_country',
            p_account_data->>'industry',
            'active',
            p_user_id
        )
        RETURNING id INTO v_account_id;
    END IF;

    -- 2. Create Contact
    IF p_contact_data IS NOT NULL THEN
        INSERT INTO public.contacts (
            tenant_id, franchise_id, account_id,
            first_name, last_name, email, phone, title,
            created_by
        )
        VALUES (
            p_tenant_id, p_franchise_id, v_account_id,
            p_contact_data->>'first_name',
            p_contact_data->>'last_name',
            p_contact_data->>'email',
            p_contact_data->>'phone',
            p_contact_data->>'title',
            p_user_id
        )
        RETURNING id INTO v_contact_id;
    END IF;

    -- 3. Create Opportunity
    IF p_opportunity_data IS NOT NULL THEN
        INSERT INTO public.opportunities (
            tenant_id, franchise_id, account_id, contact_id,
            name, amount, close_date, stage, lead_id,
            created_by
        )
        VALUES (
            p_tenant_id, p_franchise_id, v_account_id, v_contact_id,
            p_opportunity_data->>'name',
            (p_opportunity_data->>'amount')::numeric,
            (p_opportunity_data->>'close_date')::date,
            (p_opportunity_data->>'stage')::opportunity_stage,
            p_lead_id,
            p_user_id
        )
        RETURNING id INTO v_opportunity_id;
    END IF;

    -- 4. Update Lead Status
    UPDATE public.leads
    SET status = 'converted',
        converted_at = NOW(),
        converted_account_id = v_account_id,
        converted_contact_id = v_contact_id,
        updated_at = NOW()
    WHERE id = p_lead_id;

    -- 5. Transfer Activities
    UPDATE public.activities
    SET account_id = COALESCE(v_account_id, account_id),
        contact_id = COALESCE(v_contact_id, contact_id),
        opportunity_id = COALESCE(v_opportunity_id, opportunity_id)
    WHERE lead_id = p_lead_id;

    -- 6. Log Audit (Optional - can be handled by trigger, but explicit here for clarity)
    -- Ideally, we'd insert into an audit log table here.

    v_result := jsonb_build_object(
        'account_id', v_account_id,
        'contact_id', v_contact_id,
        'opportunity_id', v_opportunity_id
    );

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;
