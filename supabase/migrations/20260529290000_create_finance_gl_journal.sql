-- Phase 5 — proper GL journal with debit=credit invariant.
--
-- The existing finance.journal_entries table is used by GLPosterService
-- as a sync-recording log (reference_id / external_id / sync_status /
-- retry_count) — NOT a real GL journal. Leave that one alone. Build a
-- fresh pair beside it:
--
--   - finance.gl_journal_entries (header)
--   - finance.gl_journal_lines   (debit/credit lines, FK to gl_accounts)
--
-- Invariants enforced:
--   1. line.debit + line.credit > 0, and exactly one of them is
--      positive (no zero-amount or both-sided rows).
--   2. status = 'posted' requires sum(debit) = sum(credit) across all
--      lines belonging to the entry.
--   3. lines are immutable once the entry is 'posted' or 'reversed' —
--      append a reversal entry instead of editing history.
--
-- The finance.gl_post_entry() function does the post atomically:
-- recomputes totals, validates balance, flips status to 'posted',
-- stamps posted_at.

-- ══════════════════════════════════════════════════════════════════════
-- 1. Tables
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.gl_journal_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  posting_date    date NOT NULL DEFAULT CURRENT_DATE,
  description     text,
  -- reference back to whatever originated this entry. Polymorphic to
  -- match §2.4 — examples: ('finance.invoice', uuid), ('finance.payment', uuid).
  reference_type  text,
  reference_id    uuid,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  -- Cached totals updated by trigger when lines change while draft.
  -- Once posted, these are frozen (the line-immutability trigger
  -- prevents drift).
  total_debit     numeric(14,2) NOT NULL DEFAULT 0,
  total_credit    numeric(14,2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'INR',
  posted_at       timestamptz,
  posted_by       uuid,
  reversed_at     timestamptz,
  reversed_by     uuid,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE finance.gl_journal_entries IS
  'Phase 5 — proper GL journal entries. Separate from finance.journal_entries (which is a sync-tracking log).';

CREATE INDEX gl_journal_entries_tenant_status_idx ON finance.gl_journal_entries (tenant_id, status, posting_date DESC);
CREATE INDEX gl_journal_entries_reference_idx    ON finance.gl_journal_entries (reference_type, reference_id) WHERE reference_id IS NOT NULL;

ALTER TABLE finance.gl_journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY gl_journal_entries_tenant_select ON finance.gl_journal_entries
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY gl_journal_entries_tenant_insert ON finance.gl_journal_entries
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY gl_journal_entries_tenant_update ON finance.gl_journal_entries
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())))
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_gl_journal_entries_updated_at
  BEFORE UPDATE ON finance.gl_journal_entries
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT, INSERT, UPDATE ON finance.gl_journal_entries TO authenticated;
GRANT ALL ON finance.gl_journal_entries TO service_role;

CREATE TABLE finance.gl_journal_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        uuid NOT NULL REFERENCES finance.gl_journal_entries(id) ON DELETE CASCADE,
  line_no         integer NOT NULL,
  account_id      uuid NOT NULL REFERENCES finance.gl_accounts(id) ON DELETE RESTRICT,
  debit           numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit          numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  currency        text NOT NULL DEFAULT 'INR',
  memo            text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Invariant #1 baked into the row: amount strictly on one side.
  CHECK (debit + credit > 0),
  CHECK (NOT (debit > 0 AND credit > 0)),
  UNIQUE (entry_id, line_no)
);

COMMENT ON TABLE finance.gl_journal_lines IS
  'Phase 5 — debit/credit lines for finance.gl_journal_entries. Row CHECK enforces exactly-one-side; entry-level balance enforced by trigger at post time.';

CREATE INDEX gl_journal_lines_entry_idx   ON finance.gl_journal_lines (entry_id);
CREATE INDEX gl_journal_lines_account_idx ON finance.gl_journal_lines (account_id);

ALTER TABLE finance.gl_journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY gl_journal_lines_tenant_select ON finance.gl_journal_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM finance.gl_journal_entries e
    WHERE e.id = finance.gl_journal_lines.entry_id
      AND e.tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  ));
CREATE POLICY gl_journal_lines_tenant_insert ON finance.gl_journal_lines
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM finance.gl_journal_entries e
    WHERE e.id = finance.gl_journal_lines.entry_id
      AND e.tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  ));
CREATE POLICY gl_journal_lines_tenant_update ON finance.gl_journal_lines
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM finance.gl_journal_entries e
    WHERE e.id = finance.gl_journal_lines.entry_id
      AND e.tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  ));

CREATE TRIGGER trg_gl_journal_lines_updated_at
  BEFORE UPDATE ON finance.gl_journal_lines
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON finance.gl_journal_lines TO authenticated;
GRANT ALL ON finance.gl_journal_lines TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. Immutability: lines can't be touched once the entry is posted/reversed
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION finance.enforce_gl_line_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM finance.gl_journal_entries
  WHERE id = COALESCE(NEW.entry_id, OLD.entry_id);
  IF v_status IN ('posted','reversed') THEN
    RAISE EXCEPTION 'gl_journal_lines: entry % is %, lines are immutable. Append a reversal entry instead.',
      COALESCE(NEW.entry_id, OLD.entry_id), v_status
      USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_gl_journal_lines_immutable_insert
  BEFORE INSERT ON finance.gl_journal_lines
  FOR EACH ROW EXECUTE FUNCTION finance.enforce_gl_line_immutability();
CREATE TRIGGER trg_gl_journal_lines_immutable_update
  BEFORE UPDATE ON finance.gl_journal_lines
  FOR EACH ROW EXECUTE FUNCTION finance.enforce_gl_line_immutability();
CREATE TRIGGER trg_gl_journal_lines_immutable_delete
  BEFORE DELETE ON finance.gl_journal_lines
  FOR EACH ROW EXECUTE FUNCTION finance.enforce_gl_line_immutability();

-- ══════════════════════════════════════════════════════════════════════
-- 3. Balance invariant: status='posted' requires sum(debit)=sum(credit)
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION finance.enforce_gl_entry_balance()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_total_debit  numeric(14,2);
  v_total_credit numeric(14,2);
BEGIN
  -- Only validate transitions INTO 'posted'.
  IF NEW.status <> 'posted' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'posted' THEN RETURN NEW; END IF;

  SELECT COALESCE(sum(debit), 0), COALESCE(sum(credit), 0)
  INTO v_total_debit, v_total_credit
  FROM finance.gl_journal_lines
  WHERE entry_id = NEW.id;

  IF v_total_debit = 0 AND v_total_credit = 0 THEN
    RAISE EXCEPTION 'gl_journal_entries: cannot post entry % with no lines', NEW.id
      USING ERRCODE = '23514';
  END IF;

  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'gl_journal_entries: entry % unbalanced (debit=%, credit=%, delta=%)',
      NEW.id, v_total_debit, v_total_credit, v_total_debit - v_total_credit
      USING ERRCODE = '23514';
  END IF;

  -- Freeze cached totals on post.
  NEW.total_debit  := v_total_debit;
  NEW.total_credit := v_total_credit;
  IF NEW.posted_at IS NULL THEN
    NEW.posted_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gl_journal_entries_enforce_balance
  BEFORE UPDATE OF status ON finance.gl_journal_entries
  FOR EACH ROW EXECUTE FUNCTION finance.enforce_gl_entry_balance();
CREATE TRIGGER trg_gl_journal_entries_enforce_balance_insert
  BEFORE INSERT ON finance.gl_journal_entries
  FOR EACH ROW EXECUTE FUNCTION finance.enforce_gl_entry_balance();

-- ══════════════════════════════════════════════════════════════════════
-- 4. Recompute cached totals while draft
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION finance.refresh_gl_entry_totals(p_entry_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE finance.gl_journal_entries e
  SET total_debit  = COALESCE((SELECT sum(debit)  FROM finance.gl_journal_lines WHERE entry_id = e.id), 0),
      total_credit = COALESCE((SELECT sum(credit) FROM finance.gl_journal_lines WHERE entry_id = e.id), 0)
  WHERE e.id = p_entry_id AND e.status = 'draft';
$$;

CREATE OR REPLACE FUNCTION finance.gl_lines_refresh_parent_totals()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM finance.refresh_gl_entry_totals(COALESCE(NEW.entry_id, OLD.entry_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_gl_journal_lines_refresh_totals_iu
  AFTER INSERT OR UPDATE ON finance.gl_journal_lines
  FOR EACH ROW EXECUTE FUNCTION finance.gl_lines_refresh_parent_totals();

-- ══════════════════════════════════════════════════════════════════════
-- 5. Atomic post + balance check function
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION finance.gl_post_entry(p_entry_id uuid)
RETURNS finance.gl_journal_entries
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = finance, pg_catalog AS $$
DECLARE
  v_result finance.gl_journal_entries;
BEGIN
  -- The BEFORE UPDATE trigger handles the actual validation +
  -- total freezing + posted_at stamping.
  UPDATE finance.gl_journal_entries
  SET status = 'posted', posted_by = auth.uid()
  WHERE id = p_entry_id AND status = 'draft'
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'gl_post_entry: entry % not found or not in draft', p_entry_id
      USING ERRCODE = 'P0002';
  END IF;
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION finance.gl_post_entry IS
  'Atomically post a draft GL entry. Trigger enforces debit=credit balance; raises 23514 if unbalanced.';

GRANT EXECUTE ON FUNCTION finance.gl_post_entry TO authenticated;
GRANT EXECUTE ON FUNCTION finance.gl_post_entry TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 6. Helper: balance summary
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION finance.gl_entry_balance(p_entry_id uuid)
RETURNS TABLE (total_debit numeric, total_credit numeric, delta numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = finance, pg_catalog AS $$
  SELECT
    COALESCE(sum(debit), 0)::numeric AS total_debit,
    COALESCE(sum(credit), 0)::numeric AS total_credit,
    COALESCE(sum(debit), 0)::numeric - COALESCE(sum(credit), 0)::numeric AS delta
  FROM finance.gl_journal_lines
  WHERE entry_id = p_entry_id;
$$;

COMMENT ON FUNCTION finance.gl_entry_balance IS
  'Returns the running debit/credit totals + delta for a journal entry. Delta=0 means the entry would post cleanly.';

GRANT EXECUTE ON FUNCTION finance.gl_entry_balance TO authenticated;
GRANT EXECUTE ON FUNCTION finance.gl_entry_balance TO service_role;
