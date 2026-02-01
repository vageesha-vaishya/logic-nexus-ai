-- Enterprise Quote Architecture Enhancements
-- Aligns Quotation System with new Service Architecture & adds Enterprise Workflows

BEGIN;

-----------------------------------------------------------------------------
-- 1. Enhance Quote Options with Service Architecture
-----------------------------------------------------------------------------
-- Ensure quote_options links to the specific Service (not just generic type)
ALTER TABLE public.quote_options 
ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id);

-- Snapshot configurations to freeze business rules at time of quote
ALTER TABLE public.quote_options 
ADD COLUMN IF NOT EXISTS billing_config_snapshot JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS pricing_config_snapshot JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS fulfillment_config_snapshot JSONB DEFAULT '{}'::jsonb;

-- Add IncoTerms and other trade specifics if missing
ALTER TABLE public.quote_options 
ADD COLUMN IF NOT EXISTS incoterms TEXT,
ADD COLUMN IF NOT EXISTS incoterms_location TEXT;


-----------------------------------------------------------------------------
-- 2. Enterprise Approval Workflows
-----------------------------------------------------------------------------
-- Workflow Definitions (Rules)
CREATE TABLE IF NOT EXISTS public.quote_approval_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_criteria JSONB NOT NULL, -- e.g. {"min_margin_percent": 10, "max_discount_percent": 20}
    required_role TEXT NOT NULL, -- e.g. "manager", "director"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Approval Requests (Runtime)
CREATE TABLE IF NOT EXISTS public.quote_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES public.quote_approval_rules(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    requested_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    approval_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for Workflows
CREATE INDEX IF NOT EXISTS idx_quote_approvals_quote ON public.quote_approvals(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_approvals_status ON public.quote_approvals(status);


-----------------------------------------------------------------------------
-- 3. Advanced Pricing & Rate Management Integration
-----------------------------------------------------------------------------
-- Link Quote Charges to Vendor Contracts (if applicable)
ALTER TABLE public.quote_charges 
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id),
ADD COLUMN IF NOT EXISTS contract_reference TEXT,
ADD COLUMN IF NOT EXISTS is_system_calculated BOOLEAN DEFAULT false;

-- Audit Trail for Pricing Logic (Why was this price chosen?)
CREATE TABLE IF NOT EXISTS public.quote_pricing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_option_id UUID REFERENCES public.quote_options(id) ON DELETE CASCADE,
    charge_id UUID REFERENCES public.quote_charges(id) ON DELETE CASCADE,
    log_type TEXT CHECK (log_type IN ('auto_price', 'manual_override', 'tier_applied', 'contract_applied')),
    description TEXT,
    original_value NUMERIC,
    new_value NUMERIC,
    applied_rule JSONB, -- Snapshot of the tier/contract rule used
    created_at TIMESTAMPTZ DEFAULT now()
);


-----------------------------------------------------------------------------
-- 4. RPC: Smart Price Calculator
-----------------------------------------------------------------------------
-- Calculates base price based on Service Tiers and Configuration
CREATE OR REPLACE FUNCTION public.calculate_service_price(
    p_service_id UUID,
    p_quantity NUMERIC,
    p_currency TEXT DEFAULT 'USD'
)
RETURNS TABLE (
    unit_price NUMERIC,
    total_price NUMERIC,
    pricing_model TEXT,
    applied_tier JSONB
) AS $$
DECLARE
    v_service_config JSONB;
    v_base_price NUMERIC;
    v_pricing_model TEXT;
    v_tier RECORD;
BEGIN
    -- Get Service Config
    SELECT pricing_config, base_price INTO v_service_config, v_base_price
    FROM public.services 
    WHERE id = p_service_id;

    v_pricing_model := COALESCE(v_service_config->>'model', 'flat');

    -- Default: Flat Pricing
    unit_price := v_base_price;
    applied_tier := NULL;

    -- Tiered Pricing Logic
    IF v_pricing_model = 'tiered' THEN
        SELECT * INTO v_tier
        FROM public.service_pricing_tiers
        WHERE service_id = p_service_id
          AND min_quantity <= p_quantity
          AND (max_quantity IS NULL OR max_quantity >= p_quantity)
        ORDER BY min_quantity DESC
        LIMIT 1;

        IF v_tier IS NOT NULL THEN
            unit_price := v_tier.unit_price;
            applied_tier := row_to_json(v_tier)::jsonb;
        END IF;
    END IF;

    -- Calculate Total
    total_price := unit_price * p_quantity;
    pricing_model := v_pricing_model;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-----------------------------------------------------------------------------
-- 5. Seed Default Approval Rules
-----------------------------------------------------------------------------
INSERT INTO public.quote_approval_rules (tenant_id, name, description, trigger_criteria, required_role)
SELECT 
    id as tenant_id,
    'Low Margin Alert',
    'Requires approval for margins below 10%',
    '{"min_margin_percent": 10}'::jsonb,
    'manager'
FROM public.tenants
ON CONFLICT DO NOTHING;

INSERT INTO public.quote_approval_rules (tenant_id, name, description, trigger_criteria, required_role)
SELECT 
    id as tenant_id,
    'High Value Quote',
    'Requires director approval for quotes over $10,000',
    '{"min_total_amount": 10000}'::jsonb,
    'director'
FROM public.tenants
ON CONFLICT DO NOTHING;

COMMIT;
