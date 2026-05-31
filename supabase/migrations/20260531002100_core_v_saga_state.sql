-- Phase 6 Step 46 — core.v_saga_state observability view.
--
-- One read-only query answers "show me everything that's happened to
-- party X in the compliance saga + comms suppression chain". The
-- compliance officer UI's per-party timeline keys off this; the
-- saga smoke tests can use it for end-to-end assertions; ops can
-- grep it to debug a stuck flow.
--
-- Long-form view: each row is one event. UNION of 4 sources:
--   1. compliance.screenings        → 'screening'      events
--   2. compliance.audit_decisions   → 'audit_decision' events
--   3. comms.suppressions (do_not_  → 'suppression'    events
--      contact only — bounce /
--      complaint / unsubscribe are
--      not saga events, just
--      delivery facts)
--   4. core.outbox (CRM dnc.set/    → 'outbox'         events
--      cleared only — lead.created
--      doesn't carry party_id in
--      payload until the lead is
--      converted, and the lead-
--      keyed screening surfaces in
--      source (1) anyway)
--
-- party_id resolution: direct via subject_party_id / payload party_id
-- where available; indirect via leads.converted_account_id for
-- sales.lead-keyed screenings.
--
-- RLS: SECURITY INVOKER (the default for views). compliance.screenings
-- + audit_decisions + comms.suppressions have tenant-scoped policies
-- for authenticated. core.outbox is service-role-only. Result: an
-- authenticated user sees screenings/audit_decisions/suppressions
-- in their tenant + zero outbox rows; the service role (used by
-- admin tooling / ops queries) sees everything. Both shapes are the
-- intended view of the saga.

CREATE OR REPLACE VIEW core.v_saga_state AS

-- ──────────────────────────────────────────────────────────────────
-- 1. Screenings — the gating saga state per party
-- ──────────────────────────────────────────────────────────────────
SELECT
  s.tenant_id,
  COALESCE(s.subject_party_id, l.converted_account_id) AS party_id,
  'screening'::text AS event_kind,
  s.created_at      AS event_at,
  s.status          AS event_status,
  s.subject_type,
  s.subject_id,
  jsonb_build_object(
    'screening_id',       s.id,
    'decision',           s.decision,
    'provider',           s.provider,
    'hit_count',          s.metadata->>'hit_count',
    'max_similarity',     s.metadata->>'max_similarity',
    'triggered_by_event', s.triggered_by_event,
    'expires_at',         s.expires_at,
    'decided_at',         s.decided_at,
    'decided_by_user_id', s.decided_by_user_id
  ) AS detail
FROM compliance.screenings s
LEFT JOIN public.leads l
  ON l.id = s.subject_id
 AND s.subject_type = 'sales.lead'
WHERE COALESCE(s.subject_party_id, l.converted_account_id) IS NOT NULL

UNION ALL

-- ──────────────────────────────────────────────────────────────────
-- 2. Audit decisions — overrides + revokes against the screening
-- ──────────────────────────────────────────────────────────────────
SELECT
  ad.tenant_id,
  COALESCE(s.subject_party_id, l.converted_account_id) AS party_id,
  'audit_decision'::text AS event_kind,
  ad.decided_at          AS event_at,
  ad.new_status          AS event_status,
  s.subject_type,
  s.subject_id,
  jsonb_build_object(
    'audit_decision_id',   ad.id,
    'screening_id',        ad.screening_id,
    'override_decision',   ad.override_decision,
    'previous_status',     ad.previous_status,
    'new_status',          ad.new_status,
    'reason',              ad.reason,
    'decided_by_user_id',  ad.decided_by_user_id,
    'evidence_file_count', COALESCE(array_length(ad.evidence_file_ids, 1), 0)
  ) AS detail
FROM compliance.audit_decisions ad
JOIN compliance.screenings s ON s.id = ad.screening_id
LEFT JOIN public.leads l
  ON l.id = s.subject_id
 AND s.subject_type = 'sales.lead'
WHERE COALESCE(s.subject_party_id, l.converted_account_id) IS NOT NULL

UNION ALL

-- ──────────────────────────────────────────────────────────────────
-- 3. Suppressions — do_not_contact only (other reasons aren't saga)
-- ──────────────────────────────────────────────────────────────────
SELECT
  sup.tenant_id,
  (sup.source_metadata->>'party_id')::uuid AS party_id,
  'suppression'::text AS event_kind,
  sup.added_at        AS event_at,
  sup.reason          AS event_status,
  'comms.suppression'::text AS subject_type,
  sup.id              AS subject_id,
  jsonb_build_object(
    'suppression_id',    sup.id,
    'address',           sup.address,
    'channel_kind',      sup.channel_kind,
    'reason',            sup.reason,
    'party_kind',        sup.source_metadata->>'party_kind',
    'source_outbox_id',  sup.source_metadata->>'source_outbox_id',
    'expires_at',        sup.expires_at,
    'added_by_kind',     sup.added_by_kind
  ) AS detail
FROM comms.suppressions sup
WHERE sup.reason = 'do_not_contact'
  AND (sup.source_metadata->>'party_id') IS NOT NULL

UNION ALL

-- ──────────────────────────────────────────────────────────────────
-- 4. Outbox — CRM do_not_contact set/cleared producer events
-- ──────────────────────────────────────────────────────────────────
SELECT
  o.tenant_id,
  (o.payload->>'party_id')::uuid AS party_id,
  'outbox'::text     AS event_kind,
  o.occurred_at      AS event_at,
  o.event_type       AS event_status,
  o.entity_type      AS subject_type,
  o.entity_id        AS subject_id,
  jsonb_build_object(
    'outbox_id',    o.id,
    'event_type',   o.event_type,
    'published_at', o.published_at,
    'payload',      o.payload
  ) AS detail
FROM core.outbox o
WHERE o.event_type IN ('crm.do_not_contact.set', 'crm.do_not_contact.cleared')
  AND (o.payload->>'party_id') IS NOT NULL;

COMMENT ON VIEW core.v_saga_state IS
  'Phase 6 Step 46 — long-form observability view across the compliance saga + comms suppression chain. One row per event for a party (screening, audit_decision, suppression, outbox). Caller filters by party_id and ORDER BY event_at DESC for a timeline. SECURITY INVOKER — RLS on underlying tables governs visibility; outbox rows are service-role-only.';

GRANT SELECT ON core.v_saga_state TO authenticated;
GRANT SELECT ON core.v_saga_state TO service_role;
