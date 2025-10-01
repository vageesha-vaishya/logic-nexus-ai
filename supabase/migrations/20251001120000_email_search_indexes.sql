-- Optimize email address searches
CREATE INDEX IF NOT EXISTS idx_emails_from_email_lower ON public.emails (lower(from_email));

-- GIN indexes on recipient arrays for JSONB containment lookups
CREATE INDEX IF NOT EXISTS idx_emails_to_emails_gin ON public.emails USING GIN (to_emails jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_emails_cc_emails_gin ON public.emails USING GIN (cc_emails jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_emails_bcc_emails_gin ON public.emails USING GIN (bcc_emails jsonb_path_ops);