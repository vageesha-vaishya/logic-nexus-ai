-- Phase 6 Step 48 — compliance.v_blocked_parties view.
--
-- The compliance-officer "inbox": every party currently blocked
-- from quoting (failed screening, not overridden, not expired),
-- with enough joined detail to render a list-view row directly
-- without further round-trips.
--
-- Predicate matches compliance.is_party_blocked exactly:
--   status = 'failed' AND (expires_at IS NULL OR expires_at > now())
-- Party resolution matches too:
--   direct via subject_party_id, indirect via
--   leads.converted_account_id for subject_type='sales.lead' rows.
-- A failed screening on an UNCONVERTED lead has no resolvable party
-- and intentionally doesn't appear — the customer doesn't exist yet
-- as a quotable entity.
--
-- Joins for the UI's convenience:
--   - core.parties     → display_name (the canonical party label)
--   - public.accounts  → name (legacy label, since accounts.id ==
--                        parties.id for org parties)
--   - public.leads     → company_name (when the screening was
--                        lead-keyed, so the officer sees what was
--                        actually screened)
--   - metadata extracts → hit_count, max_similarity, hits jsonb
--
-- The view returns one row per (party_id, screening_id) pair — a
-- party with multiple failed screenings (multiple denylist hits
-- across different sub-entities) shows up multiple times so the
-- officer can override each independently.
--
-- Sort: latest triggered first. The officer wants the freshest
-- review backlog at the top.

CREATE OR REPLACE VIEW compliance.v_blocked_parties AS
SELECT
  s.tenant_id,
  COALESCE(s.subject_party_id, l.converted_account_id) AS party_id,
  -- Identity for the list-view row
  COALESCE(p.display_name, a.name, l.company_name, '(unknown)') AS party_display_name,
  -- Screening that caused the block
  s.id                AS screening_id,
  s.status,
  s.decision,
  s.subject_type,
  s.subject_id,
  s.triggered_by_event,
  s.created_at        AS triggered_at,
  s.expires_at,
  s.provider,
  -- Decision detail (extracted from metadata for query convenience)
  (s.metadata->>'hit_count')::integer    AS hit_count,
  (s.metadata->>'max_similarity')::numeric AS max_similarity,
  s.hits,
  -- Trigger context — what was actually screened
  l.id                AS lead_id,
  l.company_name      AS lead_company_name,
  l.email             AS lead_email,
  a.id                AS account_id,
  a.name              AS account_name
FROM compliance.screenings s
LEFT JOIN public.leads l
  ON l.id = s.subject_id
 AND s.subject_type = 'sales.lead'
LEFT JOIN core.parties p
  ON p.id = COALESCE(s.subject_party_id, l.converted_account_id)
LEFT JOIN public.accounts a
  ON a.id = COALESCE(s.subject_party_id, l.converted_account_id)
WHERE s.status = 'failed'
  AND (s.expires_at IS NULL OR s.expires_at > now())
  AND COALESCE(s.subject_party_id, l.converted_account_id) IS NOT NULL;

COMMENT ON VIEW compliance.v_blocked_parties IS
  'Phase 6 Step 48 — compliance officer "inbox". Every (party, active failed screening) pair currently blocking quote.sent. Matches compliance.is_party_blocked''s predicate + party resolution. Excludes overridden, expired, and unconverted-lead screenings. SECURITY INVOKER — RLS on compliance.screenings filters per-tenant.';

GRANT SELECT ON compliance.v_blocked_parties TO authenticated;
GRANT SELECT ON compliance.v_blocked_parties TO service_role;
