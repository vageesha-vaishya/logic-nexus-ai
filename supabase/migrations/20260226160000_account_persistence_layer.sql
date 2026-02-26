-- Migration: 20260226160000_account_persistence_layer.sql
-- Description: Enhances Accounts schema and adds References/Notes tables for comprehensive data persistence.

-- 1. Enhance Accounts Table
DO $$
BEGIN
    -- Add Tax ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'tax_id') THEN
        ALTER TABLE public.accounts ADD COLUMN tax_id TEXT;
    END IF;

    -- Add Shipping Address Fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'shipping_street') THEN
        ALTER TABLE public.accounts 
            ADD COLUMN shipping_street TEXT,
            ADD COLUMN shipping_city TEXT,
            ADD COLUMN shipping_state TEXT,
            ADD COLUMN shipping_postal_code TEXT,
            ADD COLUMN shipping_country TEXT;
    END IF;

    -- Add constraints/indexes
    CREATE INDEX IF NOT EXISTS idx_accounts_tax_id ON public.accounts(tax_id);
    CREATE INDEX IF NOT EXISTS idx_accounts_name_trgm ON public.accounts USING gin (name gin_trgm_ops); -- Requires pg_trgm extension, ensure it's enabled
END $$;

-- Ensure pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create Account References Table
CREATE TABLE IF NOT EXISTS public.account_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    reference_type TEXT NOT NULL, -- 'customer_po', 'vendor_ref', 'project_code'
    reference_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_account_ref_type_val UNIQUE (account_id, reference_type, reference_value)
);

-- RLS for References
ALTER TABLE public.account_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account references" ON public.account_references;
CREATE POLICY "Users can view account references" ON public.account_references
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can manage account references" ON public.account_references;
CREATE POLICY "Users can manage account references" ON public.account_references
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())
    );

-- 3. Create Account Notes Table
CREATE TABLE IF NOT EXISTS public.account_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    note_type TEXT DEFAULT 'general', -- 'internal', 'instruction', 'terms'
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- RLS for Notes
ALTER TABLE public.account_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account notes" ON public.account_notes;
CREATE POLICY "Users can view account notes" ON public.account_notes
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can manage account notes" ON public.account_notes;
CREATE POLICY "Users can manage account notes" ON public.account_notes
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())
    );

-- 4. Audit Trail Function (Generic)
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
BEGIN
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
    END IF;
    
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        v_new_data := to_jsonb(NEW);
    END IF;

    INSERT INTO public.audit_logs (
        tenant_id,
        user_id,
        action,
        resource_type,
        resource_id,
        details
    ) VALUES (
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        v_user_id,
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        jsonb_build_object(
            'old', v_old_data,
            'new', v_new_data
        )
    );
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach Audit Trigger to new tables
DROP TRIGGER IF EXISTS trg_audit_account_refs ON public.account_references;
CREATE TRIGGER trg_audit_account_refs
    AFTER INSERT OR UPDATE OR DELETE ON public.account_references
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_account_notes ON public.account_notes;
CREATE TRIGGER trg_audit_account_notes
    AFTER INSERT OR UPDATE OR DELETE ON public.account_notes
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


-- 5. RPC: Manage Account with Validation & Duplicate Check
CREATE OR REPLACE FUNCTION public.manage_account(
    p_account_id UUID,
    p_tenant_id UUID,
    p_name TEXT,
    p_tax_id TEXT,
    p_billing_address JSONB, -- { street, city, state, zip, country }
    p_shipping_address JSONB, -- { street, city, state, zip, country }
    p_contact_data JSONB, -- { first_name, last_name, email, phone, title }
    p_references JSONB, -- Array of { type, value, description }
    p_notes JSONB, -- Array of { content, type, is_pinned }
    p_website TEXT DEFAULT NULL,
    p_account_email TEXT DEFAULT NULL,
    p_account_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account_id UUID;
    v_contact_id UUID;
    v_existing_id UUID;
BEGIN
    -- Validation: Mandatory Name
    IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
        RAISE EXCEPTION 'Company Name is required';
    END IF;

    -- Validation: Mandatory Primary Contact Email if Contact Data provided
    IF p_contact_data IS NOT NULL THEN
        IF (p_contact_data->>'email') IS NULL OR (p_contact_data->>'email') !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
            RAISE EXCEPTION 'Valid Primary Contact Email is required';
        END IF;
    END IF;

    -- Duplicate Detection
    -- 1. Check Tax ID (Exact Match)
    IF p_tax_id IS NOT NULL AND length(p_tax_id) > 0 THEN
        SELECT id INTO v_existing_id FROM public.accounts 
        WHERE tenant_id = p_tenant_id AND tax_id = p_tax_id AND (p_account_id IS NULL OR id != p_account_id);
        
        IF v_existing_id IS NOT NULL THEN
            RAISE EXCEPTION 'Duplicate Account detected with Tax ID: %', p_tax_id;
        END IF;
    END IF;

    -- 2. Check Name (Fuzzy Match - utilizing pg_trgm if available, else simple ILIKE)
    -- Using simple ILIKE for exact-ish match to be safe in standard SQL function
    SELECT id INTO v_existing_id FROM public.accounts 
    WHERE tenant_id = p_tenant_id AND lower(name) = lower(p_name) AND (p_account_id IS NULL OR id != p_account_id);
    
    IF v_existing_id IS NOT NULL THEN
        RAISE EXCEPTION 'Duplicate Account detected with Name: %', p_name;
    END IF;

    -- Upsert Account
    IF p_account_id IS NOT NULL THEN
        UPDATE public.accounts
        SET name = p_name,
            tax_id = p_tax_id,
            website = p_website,
            email = p_account_email,
            phone = p_account_phone,
            billing_street = p_billing_address->>'street',
            billing_city = p_billing_address->>'city',
            billing_state = p_billing_address->>'state',
            billing_postal_code = p_billing_address->>'zip',
            billing_country = p_billing_address->>'country',
            shipping_street = p_shipping_address->>'street',
            shipping_city = p_shipping_address->>'city',
            shipping_state = p_shipping_address->>'state',
            shipping_postal_code = p_shipping_address->>'zip',
            shipping_country = p_shipping_address->>'country',
            updated_at = NOW()
        WHERE id = p_account_id
        RETURNING id INTO v_account_id;
    ELSE
        INSERT INTO public.accounts (
            tenant_id, name, tax_id, website, email, phone,
            billing_street, billing_city, billing_state, billing_postal_code, billing_country,
            shipping_street, shipping_city, shipping_state, shipping_postal_code, shipping_country,
            status, created_by
        )
        VALUES (
            p_tenant_id, p_name, p_tax_id, p_website, p_account_email, p_account_phone,
            p_billing_address->>'street', p_billing_address->>'city', p_billing_address->>'state', p_billing_address->>'zip', p_billing_address->>'country',
            p_shipping_address->>'street', p_shipping_address->>'city', p_shipping_address->>'state', p_shipping_address->>'zip', p_shipping_address->>'country',
            'active', auth.uid()
        )
        RETURNING id INTO v_account_id;
    END IF;

    -- Upsert Primary Contact
    IF p_contact_data IS NOT NULL THEN
        -- Check if primary contact exists for this account
        SELECT id INTO v_contact_id FROM public.contacts 
        WHERE account_id = v_account_id AND is_primary = true LIMIT 1;

        IF v_contact_id IS NOT NULL THEN
            UPDATE public.contacts
            SET first_name = p_contact_data->>'first_name',
                last_name = p_contact_data->>'last_name',
                email = p_contact_data->>'email',
                phone = p_contact_data->>'phone',
                title = p_contact_data->>'title',
                updated_at = NOW()
            WHERE id = v_contact_id;
        ELSE
            INSERT INTO public.contacts (
                tenant_id, account_id, first_name, last_name, email, phone, title, is_primary, created_by
            )
            VALUES (
                p_tenant_id, v_account_id, 
                p_contact_data->>'first_name', p_contact_data->>'last_name', 
                p_contact_data->>'email', p_contact_data->>'phone', 
                p_contact_data->>'title', true, auth.uid()
            )
            RETURNING id INTO v_contact_id;
        END IF;
    END IF;

    -- Handle References (Replace all? Or Append? Let's assume Append/Update logic is complex, for now simple insert)
    -- For simplicity in this RPC, we'll iterate and insert if new
    IF p_references IS NOT NULL THEN
        -- Loop logic in SQL is verbose, using jsonb_to_recordset
        INSERT INTO public.account_references (tenant_id, account_id, reference_type, reference_value, description, created_by)
        SELECT p_tenant_id, v_account_id, r.type, r.value, r.description, auth.uid()
        FROM jsonb_to_recordset(p_references) AS r(type text, value text, description text)
        ON CONFLICT (account_id, reference_type, reference_value) DO NOTHING;
    END IF;

    -- Handle Notes
    IF p_notes IS NOT NULL THEN
        INSERT INTO public.account_notes (tenant_id, account_id, content, note_type, is_pinned, created_by)
        SELECT p_tenant_id, v_account_id, n.content, n.type, COALESCE(n.is_pinned, false), auth.uid()
        FROM jsonb_to_recordset(p_notes) AS n(content text, type text, is_pinned boolean);
    END IF;

    RETURN jsonb_build_object(
        'account_id', v_account_id,
        'contact_id', v_contact_id,
        'status', 'success'
    );
END;
$$;
