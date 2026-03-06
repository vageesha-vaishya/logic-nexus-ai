# Quote Leg Deletion Persistence Fix (QUO-260303-00002)

Date: 2026-03-06
Scope: Quotationcomposer save path (`save_quote_atomic`) for option leg delete/update synchronization.

## Incident Summary
A removed transport leg (observed on Hapag-Lloyd option in `QUO-260303-00002`) reappeared after save/reload.

## Root Cause
`save_quote_atomic` in the latest deployed migration lineage did not remove stale rows from:
- `quotation_version_option_legs`
- `quote_charges` (for deleted legs and stale combined/global charges)

When users removed a leg in UI and saved, payload no longer included that leg, but existing DB rows for that option were retained. On reload, read-path hydration pulled those stale rows back into UI, appearing as if deletion had failed.

## Implemented Fix
Migration added:
- File: `supabase/migrations/20260306103000_fix_save_quote_atomic_leg_persistence.sql`

### 1) Leg synchronization delete phase
Before processing payload legs, function now:
1. Builds `v_payload_leg_ids` from valid UUID leg IDs in payload.
2. Deletes stale leg charges and stale legs based on payload state:
   - No payload legs: delete all persisted legs and leg-linked charges for option.
   - Payload legs all temporary IDs (no UUID): treat as replace-all and delete persisted legs/leg charges first.
   - Payload contains UUID IDs: delete persisted legs not present in payload (and their leg charges).

### 2) Combined/global charge replacement
Before inserting `combined_charges`, function now deletes existing option-level rows where `leg_id IS NULL` to prevent stale duplicates.

## Backward Compatibility
- No API contract changes.
- Payload shape unchanged.
- Save semantics improved from append/upsert-only to sync behavior for deletions.

## Test Coverage Added
Updated file:
- `src/components/sales/unified-composer/UnifiedQuoteComposer.save.test.tsx`

New regression tests:
1. `sends only remaining legs after a user removes one leg before save`
2. `persists added draft leg updates in save payload`

These tests validate front-end payload generation for leg removal/addition paths and protect against regressions in save mapping logic.

## Verification Run
- `npm run test -- src/components/sales/unified-composer/UnifiedQuoteComposer.save.test.tsx`
- `npm run test -- src/components/sales/unified-composer/__tests__/UnifiedQuoteComposer.integration.test.tsx`

Both suites passed in local run.

## Monitoring Procedures
Use periodic checks and alerting on data integrity mismatches:

1. Orphan leg charges
```sql
select count(*) as orphan_leg_charges
from quote_charges qc
left join quotation_version_option_legs l on l.id = qc.leg_id
where qc.leg_id is not null and l.id is null;
```

2. Duplicate combined/global charges (same option + category + side + amount fingerprint)
```sql
select quote_option_id, category_id, charge_side_id, basis_id, currency_id, quantity, rate, amount, count(*) as dup_count
from quote_charges
where leg_id is null
group by quote_option_id, category_id, charge_side_id, basis_id, currency_id, quantity, rate, amount
having count(*) > 1;
```

3. Quote option leg drift signal (optional audit job)
- Compare count of saved payload leg UUIDs vs persisted legs per option immediately after save.
- Emit warning if mismatch > 0.

4. Save-path observability
- Keep structured logs around `save_quote_atomic` requests including quote id, option id, payload leg count, and persisted leg count after commit.

## Follow-up Recommendation
Add a DB-level integration test (SQL or service-level harness) that executes `save_quote_atomic` twice for same option:
1) with N legs, then
2) with N-1 legs,
and asserts removed leg rows do not remain.
