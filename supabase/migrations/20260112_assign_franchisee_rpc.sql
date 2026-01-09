-- Migration: Assign Account and Contact to Franchisee RPC
-- Description: Function to safely assign/create Account and Contact for a Franchisee under a Tenant

CREATE OR REPLACE FUNCTION public.assign_franchisee_account_contact(
    p_tenant_id UUID,
    p_franchise_id UUID,
    p_account_data JSONB,
    p_contact_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_account_id UUID;
    v_contact_id UUID;
    v_tenant_exists BOOLEAN;
    v_franchise_exists BOOLEAN;
    v_account_name TEXT;
    v_contact_email TEXT;
    v_contact_first_name TEXT;
    v_contact_last_name TEXT;
BEGIN
    -- 1. Verify Tenant exists
    SELECT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) INTO v_tenant_exists;
    IF NOT v_tenant_exists THEN
        RAISE EXCEPTION 'Tenant with ID % does not exist', p_tenant_id;
    END IF;

    -- 2. Verify Franchisee exists and belongs to Tenant
    SELECT EXISTS (SELECT 1 FROM franchises WHERE id = p_franchise_id AND tenant_id = p_tenant_id) INTO v_franchise_exists;
    IF NOT v_franchise_exists THEN
        RAISE EXCEPTION 'Franchise with ID % does not exist or does not belong to Tenant %', p_franchise_id, p_tenant_id;
    END IF;

    -- 3. Process Account
    v_account_name := p_account_data->>'name';
    IF v_account_name IS NULL OR v_account_name = '' THEN
        RAISE EXCEPTION 'Account name is required';
    END IF;

    -- Try to find existing account by ID or Name within Tenant
    IF (p_account_data->>'id') IS NOT NULL THEN
        v_account_id := (p_account_data->>'id')::UUID;
        
        -- Check if exists
        IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = v_account_id AND tenant_id = p_tenant_id) THEN
             RAISE EXCEPTION 'Account ID % not found in Tenant %', v_account_id, p_tenant_id;
        END IF;

        UPDATE accounts 
        SET 
            franchise_id = p_franchise_id,
            updated_at = NOW()
        WHERE id = v_account_id;
    ELSE
        -- Look up by name
        SELECT id INTO v_account_id FROM accounts WHERE tenant_id = p_tenant_id AND name = v_account_name LIMIT 1;
        
        IF v_account_id IS NOT NULL THEN
            UPDATE accounts 
            SET franchise_id = p_franchise_id, updated_at = NOW() 
            WHERE id = v_account_id;
        ELSE
            INSERT INTO accounts (
                tenant_id, franchise_id, name, 
                industry, website, phone, email, 
                billing_address, shipping_address,
                created_by
            ) VALUES (
                p_tenant_id, 
                p_franchise_id, 
                v_account_name,
                p_account_data->>'industry',
                p_account_data->>'website',
                p_account_data->>'phone',
                p_account_data->>'email',
                COALESCE(p_account_data->'billing_address', '{}'::jsonb),
                COALESCE(p_account_data->'shipping_address', '{}'::jsonb),
                (p_account_data->>'created_by')::UUID
            ) RETURNING id INTO v_account_id;
        END IF;
    END IF;

    -- 4. Process Contact
    v_contact_email := p_contact_data->>'email';
    v_contact_first_name := p_contact_data->>'first_name';
    v_contact_last_name := p_contact_data->>'last_name';

    IF v_contact_first_name IS NULL OR v_contact_last_name IS NULL THEN
        RAISE EXCEPTION 'Contact first_name and last_name are required';
    END IF;

    -- Try to find existing contact by ID or Email within Tenant
    IF (p_contact_data->>'id') IS NOT NULL THEN
        v_contact_id := (p_contact_data->>'id')::UUID;

        -- Check if exists
        IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = v_contact_id AND tenant_id = p_tenant_id) THEN
             RAISE EXCEPTION 'Contact ID % not found in Tenant %', v_contact_id, p_tenant_id;
        END IF;

        UPDATE contacts 
        SET 
            franchise_id = p_franchise_id,
            account_id = v_account_id,
            updated_at = NOW()
        WHERE id = v_contact_id;
    ELSE
        -- Look up by email (if provided)
        IF v_contact_email IS NOT NULL AND v_contact_email <> '' THEN
            SELECT id INTO v_contact_id FROM contacts WHERE tenant_id = p_tenant_id AND email = v_contact_email LIMIT 1;
        END IF;
        
        IF v_contact_id IS NOT NULL THEN
            UPDATE contacts 
            SET 
                franchise_id = p_franchise_id, 
                account_id = v_account_id,
                updated_at = NOW() 
            WHERE id = v_contact_id;
        ELSE
            INSERT INTO contacts (
                tenant_id, franchise_id, account_id,
                first_name, last_name, email, phone, mobile, title,
                created_by
            ) VALUES (
                p_tenant_id,
                p_franchise_id,
                v_account_id,
                v_contact_first_name,
                v_contact_last_name,
                v_contact_email,
                p_contact_data->>'phone',
                p_contact_data->>'mobile',
                p_contact_data->>'title',
                (p_contact_data->>'created_by')::UUID
            ) RETURNING id INTO v_contact_id;
        END IF;
    END IF;

    -- 5. Return Result
    RETURN jsonb_build_object(
        'success', true,
        'tenant_id', p_tenant_id,
        'franchise_id', p_franchise_id,
        'account_id', v_account_id,
        'contact_id', v_contact_id,
        'message', 'Successfully assigned Account and Contact to Franchisee'
    );
END;
$$;
