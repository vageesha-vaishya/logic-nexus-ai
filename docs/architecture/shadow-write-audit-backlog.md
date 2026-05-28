# Shadow-write audit backlog

Tracks the **16 remaining audit-table shadow-write triggers** that need to be installed to satisfy the master design doc's audit-log consolidation goal (master §1B.8(1) + §3.5).

The first trigger (`platform.audit_log` → `core.audit_log`) shipped in migration `20260528150100_shadow_write_platform_audit_log.sql` as the canonical example. Each remaining source table follows the same template: write its own AFTER INSERT trigger that maps source columns into `core.audit_log`'s polymorphic shape, then ship a parity-check function alongside.

## How to write a shadow-write trigger

1. Open the source table's `CREATE TABLE` migration to learn its column shape.
2. Identify the **subject_type** convention — the schema-qualified entity name per master §2.4. E.g., `public.amro_work_order_audit_log` writes events about AMRO work orders, so `subject_type = 'amro.work_order'`.
3. Identify the **column mapping** — source columns to `core.audit_log` columns. See the platform.audit_log trigger for the template.
4. Write the trigger function + AFTER INSERT trigger.
5. Write the parity-check function `core.audit_shadow_parity_<source>(start, end)` that compares source rows vs shadow rows.
6. Test in a sandbox: insert 1 row into the source table, verify it appears in `core.audit_log` with `shadow_source_table = '<source>'`.

## No-break invariants every trigger must honour

1. **Falls open on error** — `EXCEPTION WHEN OTHERS THEN RAISE WARNING ...; RETURN NEW;`. Shadow-write failures must NEVER block source inserts.
2. **Skips unsuppliable rows** — if `tenant_id` is null in the source but required in `core.audit_log`, return NEW without writing. Don't error.
3. **Idempotent via shadow_source_id** — if the trigger runs twice for the same source row (e.g. during dual-write reconciliation), the second write will succeed but the parity check shows `shadow_rows > source_rows`. That's the signal to investigate.
4. **Subject_id must be UUID** — if the source uses text/bigint PKs, either coerce or skip. Most modern tables use UUID.

## Status — 16 remaining sources

Tracked in priority order (most-written tables first, since they generate the most reconciliation data).

| # | Source table | Probable `subject_type` | Notes / blockers | Status |
|---|---|---|---|---|
| ✅ 1 | `platform.audit_log` | varies (legacy `domain` → first segment) | Example template; canonical. | **Done** (mig 20260528150100) |
| 💀 2 | `public.audit_log` (no `s`) | n/a | **DEAD** — zero writers in source code or any later migration. Created once in `20260327121500_amro_ata_hierarchy_and_planning_engine.sql:462` and never used. No shadow trigger; will be dropped in the Phase 11 cleanup sweep without a shadow window. Verified via INSERT-grep across all migrations + `src/`/`services/`/edge functions. | **Skipped — drop candidate** |
| ✅ 3 | `public.audit_logs` (with `s`) | `'<resource_type>'` (taken as-is if schema-qualified) \| `'platform.' \|\| resource_type` (else) | The ACTIVE table — UnifiedQuoteComposer.tsx writes here + 8+ migration scripts. Live schema has tenant_id + franchise_id + resource_id (added via `20260114000002_enhance_audit_logs.sql` after the original 20251001011353 create). tenant_id NULLABLE on source — skip rows that lack it. Per types.ts canonical truth. `general_2y`. | **Done** (mig 20260528200000) |
| ✅ 4 | `public.email_audit_log` | `'comms.email'` | event_type→action; subject_id = email_id OR scheduled_email_id; `general_2y`. | **Done** (mig 20260528160000) |
| ✅ 5 | `public.domain_audit_log` | `'core.domain'` | Clean source schema with actor_user_id + batch_id + metadata jsonb merged into core metadata; `general_2y`. | **Done** (mig 20260528160100) |
| ✅ 6 | `public.admin_override_audit` | `'core.user'` | Sparse source (just `enabled` bool); subject is the TARGET user; action `'rls_override_enabled/disabled'`; `compliance_evidence_7y` — forensic-heavy. **Gap:** source doesn't capture actor; trigger writes actor_kind='system'. | **Done** (mig 20260528160200) |
| 7 | `public.ai_audit_logs` | `'core.llm_invocation'` | AI-call audit. Migrate after `core.llm_invocations` consumers cut over (avoid double-writing). | TODO |
| ✅ 8 | `public.amro_work_order_audit_log` | `'amro.' \|\| entity_type` (work_order/task/material/compliance/certificate/resource_assignment) | Rich source with old_values/new_values/changed_fields + checksum; `compliance_evidence_7y` — aviation regulator-evidence (FAA/EASA/CAAC/SACAA). | **Done** (mig 20260528160300) |
| ✅ 9 | `public.amro_stock_audit_timeline` | `'amro.' \|\| event_category` (default `'amro.stock_ledger'`) | reference_id is TEXT (not always UUID) — guarded cast; non-UUID rows skipped + original preserved in metadata.original_reference_id. immutable_hash captured. `compliance_evidence_7y` — stock-movement records needed for GST / tax retention. | **Done** (mig 20260528180000) |
| ✅ 10 | `public.quotation_audit_log` | `'quotation.' \|\| lower(entity_type)` | Rich source with polymorphic entity_type/entity_id; tenant_id NOT NULL; changes → diff; parent refs preserved in metadata; `general_2y`. | **Done** (mig 20260528170000) |
| ✅ 11 | `public.quotation_version_audit_logs` | `'quotation.version'` | No tenant_id column — JOIN to quotation_versions to derive. action UPPERCASE → lowercased in core; raw preserved in metadata. `general_2y`. | **Done** (mig 20260528170100) |
| ✅ 12 | `public.quote_audits` | `'quotation.quote'` | Predates quotation_audit_log — different shape, NOT a strict duplicate. No tenant_id — JOIN to quotes. old_value/new_value → diff; metadata.source_table_legacy=true distinguishes from quotation_audit_log writes. `general_2y`. | **Done** (mig 20260528170200) |
| ✅ 13 | `public.mgl_quotation_audit_logs` | `'quotation.mgl_rate_option' \| 'quotation.version' \| 'quotation.quote'` (fallback chain) | MGL pricing-engine specific; rich source with actor_email + request_id; subject_id picks first non-null in {rate_option_id, quote_version_id, quote_id}. `general_2y`. | **Done** (mig 20260528170300) |
| ✅ 14 | `public.mapping_audit_logs` | `'uim.quote_booking_mapping'` | Quote→Booking mapping audit. subject_id = source_id (quote). UPPERCASE action lowercased; status + target_id preserved in metadata. `general_2y`. | **Done** (mig 20260528180200) |
| ✅ 15 | `public.engine_seed_audit_runs` | `'amro.aircraft'` | Engine seed/benchmark runs against an aircraft. Source has no action column → synthesised `'engine_seed_run'`. Internal tool audit; `general_2y`. | **Done** (mig 20260528180300) |
| ✅ 16 | `public.uim_amro_sync_audit` | `'uim.inventory_item' \| 'uim.reservation' \| 'uim.sync_job'` (fallback chain) | **correlation_id propagated into metadata** — master §5.9 saga key picked up by audit_log_correlation_idx. direction + outcome + error_message preserved. `compliance_evidence_7y`. | **Done** (mig 20260528180100) |
| ✅ 17a | `mro_audit.records` | `'amro.' \|\| related_entity_type` (aircraft/component/work_order/task/staff_qualification/maintenance_event/system_config/user_action/batch_operation) | Blockchain-style audit with signature + previous_hash (preserved as hex in metadata). related_entity_id is TEXT — guarded UUID cast; non-UUID rows skipped. actor_id is TEXT — guarded cast, original preserved on failure. record_type + actor_role in metadata. `compliance_evidence_7y`. | **Done** (mig 20260528190000) |
| ✅ 17b | `mro_audit.trails` | `'amro.' \|\| entity_type` (same enum as records) | Regulator-evidence trail. Uses source's `timestamp` for occurred_at (event-time), `created_at` preserved in metadata.ingested_at. Carries regulatory_context, user_email, action_description. entity_id + user_id are TEXT — guarded cast. `compliance_evidence_7y`. | **Done** (mig 20260528190100) |

## Cut-over checklist (per source table)

For each source, the cut-over follows this sequence to honour master §7.2:

1. **Ship shadow-write trigger** — both tables now receive writes.
2. **Wait 24h**, run the parity-check function. `unshadowed_rows` and `shadow_unique_rows` should both be 0.
3. **Migrate readers** — any code that `SELECT FROM <source_table>` is rewritten to `SELECT FROM core.audit_log WHERE shadow_source_table = '<source>'` OR `WHERE subject_type = '<subject>'`.
4. **30-day no-direct-read window** — confirm no readers remain via query log analysis.
5. **Drop source table** — separate migration; only after step 4 completes cleanly.

## Performance considerations

- Each AFTER INSERT trigger adds **~50–200µs** to the source INSERT on Supabase Postgres. Acceptable for normal write volume; problematic for batch-insert flows that write 10k+ rows/sec.
- For high-write sources (none of the 17 today qualify, but a future module might), consider using `LISTEN`/`NOTIFY` + a background worker instead of synchronous triggers.
- Parity-check functions are STABLE / read-only — safe to run during business hours.

## When can the `mro_audit` and `platform.*` schemas be dropped?

- `mro_audit.*` → after #17 cut-over completes (both `records` and `trails`).
- `platform.audit_log` → after #1 cut-over completes.
- `platform.*` schema entirely → after audit_log + llm_* + integration_* lifts are all complete. Per master §2.8: "After lifts to `core.*` and `uim.*`, the `platform.*` schema is dropped."

## Tracking

Add a row to this table when each migration ships. Reference the migration timestamp + the `core.audit_shadow_parity_<source>` function name. Once `unshadowed_rows = 0` for 7 consecutive days, mark the source as "ready for read-cutover."
