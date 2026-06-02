-- Phase 6 Compliance — reconcile and drop public.compliance_records_duplicate.
--
-- Investigation result (recorded for future archaeologists):
--   canonical (public.compliance_records)        : 2,446 rows
--   duplicate (public.compliance_records_duplicate): 2,546 rows
--   compliance.records mirror                    : 2,446 rows (sourced from canonical)
--
-- The 100-row diff is a strict superset (duplicate ⊃ canonical) — every
-- row in canonical exists in duplicate, but duplicate has 100 extras
-- that never landed in canonical. Inspection of those 100 rows:
--   - all created at the exact same timestamp (2026-03-28 11:55:13.544)
--   - all by the same created_by user
--   - generic decision_reason "Awaiting final release checks"
--   - synthetic evidence_reference labels (EVID-CYCLES, EVID-E-DATE, etc.)
--   - spread across 14 tenants — a mix of placeholder tenants
--     (00000000-..., 11111111-..., 22222222-...) AND real prod tenants
--     (SOS Services, Miami Global Lines, Deccan, etc.)
--
-- Conclusion: looks like a one-off seeding pass that targeted the
-- duplicate table by mistake. No FKs reference compliance_records_duplicate,
-- no views read from it, no app code queries it.
--
-- This migration:
--   1. Creates compliance.archived_duplicate_records (id, payload jsonb,
--      archived_at) to retain the raw 100-row diff forever in case anyone
--      needs the evidence trail later.
--   2. Copies the diff into the archive table.
--   3. Drops public.compliance_records_duplicate.
--
-- After this, regenerate the TypeScript types
-- (`npm run supabase:types:gen`) — types.ts currently has a stale
-- compliance_records_duplicate Row definition.

-- 1) Archive table
CREATE TABLE IF NOT EXISTS compliance.archived_duplicate_records (
  id          uuid PRIMARY KEY,
  payload     jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  note        text NOT NULL DEFAULT 'Phase 6: 100-row diff between public.compliance_records and public.compliance_records_duplicate. See migration 20260603180000.'
);

COMMENT ON TABLE compliance.archived_duplicate_records IS
  'Frozen evidence table — preserves the 100-row diff (duplicate \\ canonical) at the moment compliance_records_duplicate was dropped. Read-only.';

ALTER TABLE compliance.archived_duplicate_records ENABLE ROW LEVEL SECURITY;

-- Service-role full access only; this table is for forensic lookup,
-- not application reads.
CREATE POLICY archived_duplicate_records_service_only
  ON compliance.archived_duplicate_records
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2) Copy the diff rows. row_to_json + ::jsonb retains every column
--    name + value pair without us having to enumerate the 21 columns.
INSERT INTO compliance.archived_duplicate_records (id, payload)
SELECT d.id, to_jsonb(d)
FROM public.compliance_records_duplicate d
WHERE NOT EXISTS (
  SELECT 1 FROM public.compliance_records c WHERE c.id = d.id
)
ON CONFLICT (id) DO NOTHING;

-- Sanity-check that we actually archived 100 rows.
DO $sanity$
DECLARE
  v_archived int;
  v_diff     int;
BEGIN
  SELECT count(*) INTO v_archived FROM compliance.archived_duplicate_records;
  SELECT count(*) INTO v_diff
    FROM public.compliance_records_duplicate d
   WHERE NOT EXISTS (SELECT 1 FROM public.compliance_records c WHERE c.id = d.id);
  IF v_archived <> v_diff THEN
    RAISE EXCEPTION 'archive mismatch: archived=% expected_diff=%', v_archived, v_diff;
  END IF;
  RAISE NOTICE 'archived % rows from compliance_records_duplicate (diff)', v_archived;
END
$sanity$;

-- 3) Drop the duplicate table. No FKs, no views, no app refs.
DROP TABLE IF EXISTS public.compliance_records_duplicate;
