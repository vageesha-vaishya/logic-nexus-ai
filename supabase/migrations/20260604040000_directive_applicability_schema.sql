-- Directive Applicability S1 — schema additions + amro.directive_applicability.
-- Per docs/plans/2026-06-04-directive-applicability-surface-design.md slice S1.
--
-- Smaller column adds than the design originally specified — auditing
-- public.directives revealed many of the LLM input fields are ALREADY
-- present under existing column names:
--
--   LLM input field            ← public.directives column
--   ────────────────────────────────────────────────────────────────
--   applies_to                 ← applicability (already exists)
--   compliance_action          ← method_of_compliance (already exists)
--   effective_date             ← effective_date (already exists)
--
-- So this migration only adds the 5 truly missing columns:
--   issuing_authority, kind, relevant_ata_chapters (multi-chapter),
--   source_url, published_at
--
-- All additions are nullable for backward compat. Existing rows
-- continue to work; new rows fill them in as the LLM workflow
-- demands.

-- ── 1. directives column additions ──────────────────────────────────

ALTER TABLE public.directives
  ADD COLUMN IF NOT EXISTS issuing_authority text
    CHECK (issuing_authority IS NULL OR issuing_authority IN (
      'FAA', 'EASA', 'CAAC', 'SACAA', 'OTHER'
    ));

ALTER TABLE public.directives
  ADD COLUMN IF NOT EXISTS kind text
    CHECK (kind IS NULL OR kind IN ('AD', 'SB', 'TCDS', 'OTHER'));

ALTER TABLE public.directives
  ADD COLUMN IF NOT EXISTS relevant_ata_chapters jsonb
    NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.directives
  ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE public.directives
  ADD COLUMN IF NOT EXISTS published_at date;

COMMENT ON COLUMN public.directives.issuing_authority IS
  'Regulatory authority that issued this directive. Required for the '
  'amro.directive.applicability LLM feature input.';

COMMENT ON COLUMN public.directives.kind IS
  'AD (Airworthiness Directive) | SB (Service Bulletin) | TCDS (Type '
  'Certificate Data Sheet revision) | OTHER. Distinct from the existing '
  'directives_type_id which is a tenant-customizable taxonomy.';

COMMENT ON COLUMN public.directives.relevant_ata_chapters IS
  'jsonb string array of ATA-100 chapter codes the directive touches. '
  'Multi-chapter directives are common; the existing singular ata_code '
  'column captures only one. Example: ["32", "27-50"].';

COMMENT ON COLUMN public.directives.source_url IS
  'URL of the authoritative source PDF/web page on the regulator''s site. '
  'For audit + re-fetch by the ingestion track.';

COMMENT ON COLUMN public.directives.published_at IS
  'Date the regulator first published the directive (distinct from '
  'effective_date when there is a grace period). Drives the "new since X" '
  'queue.';

-- Useful index for the applicability eval worker that batches by recently-published.
CREATE INDEX IF NOT EXISTS idx_directives_published_at_desc
  ON public.directives (published_at DESC NULLS LAST)
  WHERE published_at IS NOT NULL;

-- ── 2. amro.directive_applicability table ──────────────────────────

CREATE TABLE IF NOT EXISTS amro.directive_applicability (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL,
  franchise_id              uuid,
  -- Subject pair
  directive_id              uuid NOT NULL REFERENCES public.directives(id),
  aircraft_id               uuid NOT NULL REFERENCES public.aircraft(id),
  -- LLM verdict
  applies                   boolean NOT NULL,
  confidence                numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  reasoning                 text,
  matched_criteria          jsonb NOT NULL DEFAULT '[]'::jsonb,
  unmatched_criteria        jsonb NOT NULL DEFAULT '[]'::jsonb,
  ata_chapters_touched      jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_followup      text,
  -- LLM invocation provenance
  invocation_id             uuid,
  prompt_key                text NOT NULL DEFAULT 'amro.directive.applicability',
  prompt_version            int  NOT NULL DEFAULT 1,
  llm_model                 text,
  -- Lifecycle
  status                    text NOT NULL DEFAULT 'awaiting_review' CHECK (status IN (
    'awaiting_review', 'accepted', 'overridden', 'superseded', 'obsolete'
  )),
  human_reviewer_id         uuid REFERENCES auth.users(id),
  human_review_at           timestamptz,
  human_override_reason     text,
  superseded_by             uuid REFERENCES amro.directive_applicability(id),
  -- Immutable input snapshots at evaluation time (regulator audit trail)
  aircraft_snapshot_jsonb   jsonb NOT NULL,
  directive_snapshot_jsonb  jsonb NOT NULL,
  -- Audit
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE amro.directive_applicability IS
  'LLM-generated applicability verdicts (directive × aircraft). Advisory '
  'output; status flows awaiting_review → accepted | overridden | '
  'superseded. Immutable snapshots capture the inputs at evaluation '
  'time so audit + drift-detection are both clean. See '
  'docs/plans/2026-06-04-directive-applicability-surface-design.md.';

COMMENT ON COLUMN amro.directive_applicability.aircraft_snapshot_jsonb IS
  'Verbatim aircraft profile passed to the LLM at evaluation time. If '
  'hours_since_new/cycles_since_new change later, the snapshot is the '
  'evidence of what was true when the verdict was generated.';

COMMENT ON COLUMN amro.directive_applicability.superseded_by IS
  'When the directive is revised OR the aircraft profile materially '
  'changes, a new applicability row is generated and the old row''s '
  'status flips to ''superseded'' with this column pointing forward.';

-- ── 3. Indexes ──────────────────────────────────────────────────────

-- Human review queue: low-confidence awaiting_review rows surface here.
CREATE INDEX IF NOT EXISTS idx_dir_applicability_review_queue
  ON amro.directive_applicability (tenant_id, status, confidence)
  WHERE status = 'awaiting_review';

-- "Which tails does this directive apply to?"
CREATE INDEX IF NOT EXISTS idx_dir_applicability_by_directive
  ON amro.directive_applicability (directive_id, applies, status);

-- "What's pending on this tail?"
CREATE INDEX IF NOT EXISTS idx_dir_applicability_by_aircraft
  ON amro.directive_applicability (aircraft_id, applies, status);

-- Reviewer load report
CREATE INDEX IF NOT EXISTS idx_dir_applicability_reviewer
  ON amro.directive_applicability (human_reviewer_id, human_review_at DESC)
  WHERE human_reviewer_id IS NOT NULL;

-- One ACCEPTED verdict per (directive, aircraft) at a time. Partial
-- unique index — non-accepted rows are allowed to multiply (history).
CREATE UNIQUE INDEX IF NOT EXISTS idx_dir_applicability_one_accepted_per_pair
  ON amro.directive_applicability (directive_id, aircraft_id)
  WHERE status = 'accepted';

-- ── 4. RLS ──────────────────────────────────────────────────────────

ALTER TABLE amro.directive_applicability ENABLE ROW LEVEL SECURITY;

CREATE POLICY dir_applicability_tenant_isolation ON amro.directive_applicability
  FOR ALL
  USING (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY dir_applicability_service_bypass ON amro.directive_applicability
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON amro.directive_applicability TO authenticated;
GRANT ALL ON amro.directive_applicability TO service_role;

-- ── 5. updated_at trigger ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION amro.tg_dir_applicability_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS dir_applicability_set_updated_at ON amro.directive_applicability;
CREATE TRIGGER dir_applicability_set_updated_at
  BEFORE UPDATE ON amro.directive_applicability
  FOR EACH ROW EXECUTE FUNCTION amro.tg_dir_applicability_set_updated_at();

-- ── 6. Helper: latest accepted verdict view ─────────────────────────

CREATE OR REPLACE VIEW amro.v_directive_applicability_accepted AS
SELECT
  a.id,
  a.tenant_id,
  a.directive_id,
  a.aircraft_id,
  a.applies,
  a.confidence,
  a.ata_chapters_touched,
  a.recommended_followup,
  a.human_reviewer_id,
  a.human_review_at,
  a.created_at,
  a.updated_at
FROM amro.directive_applicability a
WHERE a.status = 'accepted';

COMMENT ON VIEW amro.v_directive_applicability_accepted IS
  'Convenience view: current accepted verdicts only. The fleet × '
  'directive matrix UI reads from this; review queue reads from the '
  'base table.';

GRANT SELECT ON amro.v_directive_applicability_accepted TO authenticated;
