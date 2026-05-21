-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515113604; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- ── Step 2: Enforce contacts.account_id NOT NULL at DB level ─────────────────
--
-- Pre-condition: 0 orphaned contacts (verified above).
--
-- Changes:
--   a) Tighten FK from ON DELETE SET NULL → ON DELETE RESTRICT
--      Prevents an account deletion from silently orphaning its contacts.
--   b) Add NOT NULL constraint
--      Enforces the business rule: every contact must have a parent account.

-- a) Re-declare FK as RESTRICT
ALTER TABLE public.contacts
  DROP CONSTRAINT contacts_account_id_fkey,
  ADD  CONSTRAINT contacts_account_id_fkey
    FOREIGN KEY (account_id)
    REFERENCES public.accounts(id)
    ON DELETE RESTRICT;

-- b) Make account_id mandatory
ALTER TABLE public.contacts
  ALTER COLUMN account_id SET NOT NULL;