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
| 2 | `public.audit_log` | varies | Legacy duplicate of `audit_logs` below; both exist. Audit which is active before triggering. | TODO |
| 3 | `public.audit_logs` | varies | Same — the `s`-suffixed variant. | TODO |
| 4 | `public.email_audit_log` | `'comms.email'` | Email-level audit events. Maps recipient + action. | TODO |
| 5 | `public.domain_audit_log` | `'core.domain'` | Domain-config change events. | TODO |
| 6 | `public.admin_override_audit` | `'core.admin_override'` | Manual admin overrides (forensic-heavy). | TODO |
| 7 | `public.ai_audit_logs` | `'core.llm_invocation'` | AI-call audit. Migrate after `core.llm_invocations` consumers cut over (avoid double-writing). | TODO |
| 8 | `public.amro_work_order_audit_log` | `'amro.work_order'` | AMRO WO state changes. | TODO |
| 9 | `public.amro_stock_audit_timeline` | `'amro.stock_movement'` | AMRO stock events. | TODO |
| 10 | `public.quotation_audit_log` | `'quotation.quote'` | Quote-level audit. | TODO |
| 11 | `public.quotation_version_audit_logs` | `'quotation.version'` | Per-version audit; distinct from `quote_audits`. | TODO |
| 12 | `public.quote_audits` | `'quotation.quote'` | Possible duplicate of `quotation_audit_log`. Audit which is the canonical source. | TODO |
| 13 | `public.mgl_quotation_audit_logs` | `'quotation.mgl_quote'` | MGL pricing-engine audit. | TODO |
| 14 | `public.mapping_audit_logs` | `'uim.field_mapping'` | UIM connector field-mapping changes. | TODO |
| 15 | `public.engine_seed_audit_runs` | `'core.engine_seed'` | Seeding/migration runs. Low priority — internal tool audit. | TODO |
| 16 | `public.uim_amro_sync_audit` | `'uim.amro_sync'` | AMRO↔UIM sync. | TODO |
| 17 | `mro_audit.records` + `mro_audit.trails` | `'amro.audit_record'` / `'amro.audit_trail'` | The only audit-specific *schema*. Pair migrated together. After cut-over, the `mro_audit` schema can be dropped. | TODO |

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
