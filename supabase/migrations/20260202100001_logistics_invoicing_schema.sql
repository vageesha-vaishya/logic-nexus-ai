-- Migration: Logistics Invoicing Schema (Phase 1)
-- Description: Adds Invoices, Invoice Line Items, and Payments tables linked to Shipments and Accounts.

BEGIN;

-----------------------------------------------------------------------------
-- 1. Enums
-----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE public.invoice_status AS ENUM (
        'draft', 'issued', 'paid', 'partial', 'void', 'overdue', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.invoice_type AS ENUM (
        'standard', 'proforma', 'credit_note', 'debit_note'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_status AS ENUM (
        'pending', 'completed', 'failed', 'refunded'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_method AS ENUM (
        'bank_transfer', 'credit_card', 'check', 'cash', 'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-----------------------------------------------------------------------------
-- 2. Invoices Table
-----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    customer_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL, -- Bill To
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL, -- Linked Shipment (Optional for consolidated)
    
    status public.invoice_status DEFAULT 'draft',
    type public.invoice_type DEFAULT 'standard',
    
    issue_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    
    currency TEXT DEFAULT 'USD',
    exchange_rate NUMERIC DEFAULT 1.0, -- For multi-currency reporting (Base/Transaction)
    
    subtotal NUMERIC DEFAULT 0,
    tax_total NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    balance_due NUMERIC DEFAULT 0,
    
    notes TEXT,
    terms TEXT, -- Payment terms e.g. "Net 30"
    
    billing_address JSONB DEFAULT '{}'::jsonb,
    shipping_address JSONB DEFAULT '{}'::jsonb,
    
    metadata JSONB DEFAULT '{}'::jsonb, -- Store external ref IDs (Xero/QBO)
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT unique_invoice_number_per_tenant UNIQUE (tenant_id, invoice_number)
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_shipment ON public.invoices(shipment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(issue_date);

-----------------------------------------------------------------------------
-- 3. Invoice Line Items Table
-----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    
    description TEXT NOT NULL,
    quantity NUMERIC DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    amount NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
    
    tax_rate NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    
    -- Linkage to Operational Costs
    charge_id UUID REFERENCES public.quote_charges(id) ON DELETE SET NULL, -- Link to Quote
    
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_charge ON public.invoice_line_items(charge_id);

-----------------------------------------------------------------------------
-- 4. Payments Table
-----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'USD',
    payment_date DATE DEFAULT CURRENT_DATE,
    
    method public.payment_method DEFAULT 'bank_transfer',
    reference TEXT, -- Check # or Transaction ID
    status public.payment_status DEFAULT 'completed',
    
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);

-----------------------------------------------------------------------------
-- 5. RLS Policies
-----------------------------------------------------------------------------

-- Invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage invoices" ON public.invoices
    FOR ALL
    USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins manage invoices" ON public.invoices
    FOR ALL
    USING (
        public.has_role(auth.uid(), 'tenant_admin'::public.app_role) 
        AND tenant_id = public.get_user_tenant_id(auth.uid())
    );

CREATE POLICY "Users view invoices" ON public.invoices
    FOR SELECT
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Line Items
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage invoice items" ON public.invoice_line_items
    FOR ALL
    USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins manage invoice items" ON public.invoice_line_items
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE id = public.invoice_line_items.invoice_id
            AND tenant_id = public.get_user_tenant_id(auth.uid())
        )
        AND public.has_role(auth.uid(), 'tenant_admin'::public.app_role)
    );

CREATE POLICY "Users view invoice items" ON public.invoice_line_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE id = public.invoice_line_items.invoice_id
            AND tenant_id = public.get_user_tenant_id(auth.uid())
        )
    );

-- Payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage payments" ON public.payments
    FOR ALL
    USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins manage payments" ON public.payments
    FOR ALL
    USING (
        public.has_role(auth.uid(), 'tenant_admin'::public.app_role) 
        AND tenant_id = public.get_user_tenant_id(auth.uid())
    );

CREATE POLICY "Users view payments" ON public.payments
    FOR SELECT
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-----------------------------------------------------------------------------
-- 6. Triggers for Balance Calculation
-----------------------------------------------------------------------------

-- Function to update invoice balance when payments change
CREATE OR REPLACE FUNCTION public.update_invoice_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_total_paid NUMERIC;
    v_invoice_total NUMERIC;
BEGIN
    -- Calculate total paid for the invoice (only completed payments)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.payments
    WHERE invoice_id = NEW.invoice_id AND status = 'completed';

    -- Get invoice total
    SELECT total INTO v_invoice_total
    FROM public.invoices
    WHERE id = NEW.invoice_id;

    -- Update balance
    UPDATE public.invoices
    SET 
        balance_due = v_invoice_total - v_total_paid,
        status = CASE 
            WHEN (v_invoice_total - v_total_paid) <= 0 THEN 'paid'::public.invoice_status
            WHEN (v_invoice_total - v_total_paid) < v_invoice_total THEN 'partial'::public.invoice_status
            ELSE status -- Keep existing status (e.g. issued/overdue) if no payment
        END,
        updated_at = now()
    WHERE id = NEW.invoice_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on Payment Insert/Update
DROP TRIGGER IF EXISTS trg_update_invoice_balance ON public.payments;
CREATE TRIGGER trg_update_invoice_balance
    AFTER INSERT OR UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_invoice_balance();

-----------------------------------------------------------------------------
-- 7. Auto-Number Generation (Sequence per Tenant)
-----------------------------------------------------------------------------
-- We use a dedicated table to track sequences to avoid locking issues with standard sequences

CREATE TABLE IF NOT EXISTS public.document_sequences (
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'invoice', 'shipment', 'quote'
    prefix TEXT DEFAULT '',
    current_value INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (tenant_id, document_type)
);

CREATE OR REPLACE FUNCTION public.get_next_document_number(
    p_tenant_id UUID,
    p_type TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_next_val INTEGER;
    v_prefix TEXT;
BEGIN
    -- Insert default if not exists
    INSERT INTO public.document_sequences (tenant_id, document_type, prefix, current_value)
    VALUES (p_tenant_id, p_type, UPPER(p_type) || '-', 0)
    ON CONFLICT (tenant_id, document_type) DO NOTHING;

    -- Increment and return
    UPDATE public.document_sequences
    SET current_value = current_value + 1, updated_at = now()
    WHERE tenant_id = p_tenant_id AND document_type = p_type
    RETURNING current_value, prefix INTO v_next_val, v_prefix;

    -- Return formatted string (e.g. INV-1001)
    RETURN v_prefix || LPAD(v_next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMIT;
