# Supabase smoke tests

Each `*.sql` here is a self-contained `DO` block that exercises a Phase 6
slice end-to-end against a real Postgres + Supabase environment. Tests
create synthetic data, assert behavior via `RAISE EXCEPTION`, and `DELETE`
the data at the end. A few intentionally leave append-only residue
(documented per-test in the file header).

## Running

```bash
# Single test:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/compliance_gating_saga.sql

# Full suite via the harness:
DATABASE_URL="postgresql://..." ./scripts/run-supabase-smokes.sh

# Glob subset:
DATABASE_URL="..." ./scripts/run-supabase-smokes.sh 'compliance_*' 'core_*'

# Against prod via Supabase pooler:
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres" \
  ./scripts/run-supabase-smokes.sh
```

Harness exits 0 if every test passes, 1 if any fails. Pass it through CI
to catch regressions on schema/trigger/RPC changes.

## Suite manifest (22 tests)

| File | Slice | Verifies |
|---|---|---|
| `compliance_gating_saga.sql` | Steps 19-23 | lead.created → outbox → screen_subject → failed → quote.sent blocked |
| `compliance_override.sql` | Steps 33-34 | override_screening writes audit_decisions + core.audit_log + flips status; gate unblocks |
| `compliance_revoke_override.sql` | Step 45 | revoke flips overridden back to previous_status; gate re-blocks |
| `compliance_screening_decisions.sql` | Step 50 | per-screening decision chain view returns chronological history |
| `compliance_blocked_parties.sql` | Step 48 | officer-inbox view: appears on failed, disappears on override, reappears on revoke, disappears on expiry |
| `compliance_evidence_retention.sql` | Steps 38-40 | evidence_file_ids auto-bump retention; delete-guard blocks premature DELETE |
| `comms_do_not_contact_bridge.sql` | Steps 27-31 | flip dnc=true → outbox → upsert RPC → suppressions present |
| `comms_do_not_contact_cleared.sql` | Steps 42-44 | flip dnc=false → outbox → remove RPC → dnc suppressions gone; unsubscribe canary survives |
| `comms_suppressions_gc.sql` | Step 47 | v_suppressions_active filters expired; prune fn deletes expired |
| `comms_delivery_health.sql` | Step 52 | queued/sent_in_flight/failed transitions in v_delivery_health |
| `finance_invoice_overdue.sql` | Step 53 | status→overdue emits exactly one core.notifications row; payload+severity+recipient correct |
| `logistics_shipment_exception.sql` | Step 54 | status→exception emits multi-channel notification; severity=critical |
| `saga_state_view.sql` | Step 46 | core.v_saga_state surfaces screening + audit_decision + suppression + outbox for one party |
| `outbox_partition_autoprovisioner.sql` | Step 41 | ensure_outbox_partition_for idempotent on existing; creates missing; routing works; cron registered |
| `outbox_health.sql` | Step 51 | is_stale=true on 15min-old unpublished; flips false after publish |
| `core_gen_emit_trigger.sql` | Step 55 | codegen produces working outbox + notifications emit triggers; skip-if-null guard fires |
| `core_gen_dual_write_trigger.sql` | Step 57 | codegen mirrors INSERT/UPDATE/DELETE; UPDATE replaces stale target row |
| `core_roles_permissions.sql` | Step 56 | user_has_permission wildcards (module:*, *:*, action=*); status/expires gates |
| `markets_multibroker_rls.sql` | (pre-session) | markets multi-broker portfolio RLS routing |
| `finance_missing_schema.sql` | Slice A (gap-fill) | 13 finance.* tables exist + RLS + policies + FK + updated_at triggers + CHECK constraints |
| `gateway_phase_p1_schema.sql` | LLM Gateway P1.3 | 5 gateway.* tables + RLS + seeds (5 models, 9 residency, 1 platform_default) + pin_only_on_feature_pin CHECK + append-only trigger on llm_invocations |
| `gateway_service_tokens.sql` | LLM Gateway P2.2 | service_tokens table + mint_service_token RPC stores hash (not plaintext) + scope CHECK rejects unknown values + revoke_service_token flips status + arg validation |

## Authoring conventions

When adding a new smoke:

1. **Self-cleaning by default.** Cleanup happens at the end of the DO
   block. If any `RAISE EXCEPTION` fires mid-test, the DO block aborts
   and the implicit transaction rolls back — no residue.

2. **Document expected residue in the file header.** Some smokes
   intentionally leave append-only rows (e.g. `core.audit_log` from
   override flows). Tag them with a `[smoke_test]` prefix in the
   reason / payload so they're trivially filterable.

3. **Use `gen_random_uuid()` for synthetic actor uuids.** Tests should
   not reuse real user_ids.

4. **Look up `tenant_id` + `franchise_id` dynamically.** Don't hardcode
   prod uuids — use `SELECT id FROM public.tenants ORDER BY created_at
   LIMIT 1`.

5. **Sequence assertions A1, A2, A3 …** Each `RAISE NOTICE 'A<N> OK'`
   gives a quick scan of what passed in the psql output.
