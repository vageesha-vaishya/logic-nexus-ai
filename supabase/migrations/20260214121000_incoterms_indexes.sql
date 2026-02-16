-- Ensure performant and consistent Incoterms lookups
BEGIN;

-- Unique per-tenant code
CREATE UNIQUE INDEX IF NOT EXISTS incoterms_tenant_code_key
ON public.incoterms (tenant_id, incoterm_code);

-- Fast code-based filtering
CREATE INDEX IF NOT EXISTS idx_incoterms_code
ON public.incoterms (incoterm_code);

-- Fast active-only reads
CREATE INDEX IF NOT EXISTS idx_incoterms_active
ON public.incoterms (is_active);

COMMIT;
