-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515114554; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- ── markets.portfolios: CRM integration ─────────────────────────────────────
--
-- Adds account + contact ownership to portfolios so the markets module
-- participates in the platform's CRM structure (accounts → contacts → portfolios).
--
-- holder_type:
--   individual   — one contact, one personal account (same name)
--   huf          — one account (HUF entity), primary contact = Karta
--   corporate    — one account (company), primary contact = authorized signatory
--   joint        — one account (joint entity), primary contact = primary holder
--   self_directed— RM/user's own portfolio, no CRM contact (backward compat)

-- ── 1. New columns ────────────────────────────────────────────────────────────
ALTER TABLE markets.portfolios
  ADD COLUMN contact_id  UUID REFERENCES public.contacts(id)  ON DELETE RESTRICT,
  ADD COLUMN account_id  UUID REFERENCES public.accounts(id)  ON DELETE RESTRICT,
  ADD COLUMN managed_by  UUID REFERENCES public.profiles(id)  ON DELETE SET NULL,
  ADD COLUMN holder_type TEXT NOT NULL DEFAULT 'self_directed'
    CHECK (holder_type IN ('individual','huf','corporate','joint','self_directed'));

-- ── 2. Integrity: managed portfolios must have both contact and account ────────
ALTER TABLE markets.portfolios
  ADD CONSTRAINT portfolios_managed_requires_contact_account
    CHECK (
      holder_type = 'self_directed'
      OR (contact_id IS NOT NULL AND account_id IS NOT NULL)
    );

-- ── 3. Trigger: contact must belong to the portfolio's account ────────────────
CREATE OR REPLACE FUNCTION markets.check_portfolio_contact_account()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL AND NEW.account_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.contacts
      WHERE id = NEW.contact_id
        AND account_id = NEW.account_id
    ) THEN
      RAISE EXCEPTION
        'Contact (%) does not belong to account (%). Assign the contact to this account first.',
        NEW.contact_id, NEW.account_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_portfolio_contact_account
  BEFORE INSERT OR UPDATE ON markets.portfolios
  FOR EACH ROW EXECUTE FUNCTION markets.check_portfolio_contact_account();

-- ── 4. Backfill managed_by for existing portfolios ───────────────────────────
UPDATE markets.portfolios
SET managed_by = owner_user_id
WHERE managed_by IS NULL;

-- ── 5. Replace narrow owner-only RLS with account-aware policies ──────────────
DROP POLICY IF EXISTS portfolios_owner_select ON markets.portfolios;
DROP POLICY IF EXISTS portfolios_owner_insert ON markets.portfolios;
DROP POLICY IF EXISTS portfolios_owner_update ON markets.portfolios;
DROP POLICY IF EXISTS portfolios_owner_delete ON markets.portfolios;

-- SELECT: own portfolios + explicitly managed + RM for any contact in the account
CREATE POLICY portfolios_select ON markets.portfolios
FOR SELECT USING (
  owner_user_id = auth.uid()
  OR managed_by  = auth.uid()
  OR account_id IN (
    SELECT c.account_id
    FROM   public.contacts c
    WHERE  c.owner_id = auth.uid()
  )
);

-- INSERT: creating as self-directed owner or as RM (managed_by = self)
CREATE POLICY portfolios_insert ON markets.portfolios
FOR INSERT WITH CHECK (
  owner_user_id = auth.uid()
  OR managed_by  = auth.uid()
);

-- UPDATE / DELETE: only the RM or original owner
CREATE POLICY portfolios_update ON markets.portfolios
FOR UPDATE
USING (owner_user_id = auth.uid() OR managed_by = auth.uid())
WITH CHECK (owner_user_id = auth.uid() OR managed_by = auth.uid());

CREATE POLICY portfolios_delete ON markets.portfolios
FOR DELETE USING (owner_user_id = auth.uid() OR managed_by = auth.uid());

-- ── 6. Useful indexes ─────────────────────────────────────────────────────────
CREATE INDEX ON markets.portfolios (contact_id)  WHERE contact_id  IS NOT NULL;
CREATE INDEX ON markets.portfolios (account_id)  WHERE account_id  IS NOT NULL;
CREATE INDEX ON markets.portfolios (managed_by)  WHERE managed_by  IS NOT NULL;
CREATE INDEX ON markets.portfolios (holder_type) WHERE holder_type <> 'self_directed';