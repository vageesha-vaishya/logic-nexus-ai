-- Phase 4: Advanced Contract Lifecycle Management (CLM)
-- Adds Clause Library, Redlining/Comments, and Signature Status

BEGIN;

-----------------------------------------------------------------------------
-- 1. Clause Library
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT, -- e.g., 'Liability', 'Payment Terms', 'Termination'
    content TEXT NOT NULL, -- HTML or Markdown content
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- RLS for Clause Library
ALTER TABLE public.contract_clauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Access Clauses" ON public.contract_clauses
    FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-----------------------------------------------------------------------------
-- 2. Contract Comments (Redlining / Negotiation)
-----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_contract_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES public.vendor_contracts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    comment TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    parent_id UUID REFERENCES public.vendor_contract_comments(id), -- Threading support
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_contract_comments_contract ON public.vendor_contract_comments(contract_id);

-- RLS for Comments
ALTER TABLE public.vendor_contract_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Access Contract Comments" ON public.vendor_contract_comments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vendor_contracts vc
            JOIN public.vendors v ON v.id = vc.vendor_id
            WHERE vc.id = vendor_contract_comments.contract_id
            AND (
                v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
                OR v.tenant_id IS NULL
            )
        )
    );

-----------------------------------------------------------------------------
-- 3. Enhanced Contract Status (Signature Tracking)
-----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_contracts' AND column_name = 'signature_status') THEN
        ALTER TABLE public.vendor_contracts 
        ADD COLUMN signature_status TEXT DEFAULT 'pending' CHECK (signature_status IN ('pending', 'sent', 'signed', 'declined')),
        ADD COLUMN signed_at TIMESTAMPTZ,
        ADD COLUMN signed_by TEXT; -- Name or Email of signer (internal or external)
    END IF;
END $$;

-----------------------------------------------------------------------------
-- 4. Audit Logging for CLM
-----------------------------------------------------------------------------
-- Add audit trigger to new tables
DROP TRIGGER IF EXISTS audit_contract_clauses ON public.contract_clauses;
CREATE TRIGGER audit_contract_clauses
AFTER INSERT OR UPDATE OR DELETE ON public.contract_clauses
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_vendor_contract_comments ON public.vendor_contract_comments;
CREATE TRIGGER audit_vendor_contract_comments
AFTER INSERT OR UPDATE OR DELETE ON public.vendor_contract_comments
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

COMMIT;
