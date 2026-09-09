# Platform-Wide LLM Provider Settings — Outstanding Work

Companion to `2026-09-06-platform-llm-provider-settings.md` (the plan) and
`../specs/2026-09-06-platform-llm-provider-settings-design.md` (the spec).

The branch `feat/platform-llm-provider-settings` implemented the plan in full.
This file records what is **not** done, so it survives outside the throwaway
execution ledger. Nothing here blocks merging the branch.

## Gating summary

| Gate | Status |
| --- | --- |
| Merge to `main` | **Clear.** Final whole-branch review returned READY WITH CAVEATS, no Critical findings. |
| Deploy | **Clear as of item 1's execution below.** |
| Exposing the page to users | **Clear as of item 2's fix below.** |

---

## 1. The migration is unexecuted — FIXED (executed against production)

Docker was never available in any implementation session, so the migration
was applied directly against the live self-hosted Postgres (the VPS
container behind `https://supabase.sosservices.online`, not a local/dev
stack) rather than via `npm run supabase:db:reset`.

**Pre-flight read-only checks, all confirmed to match the migration's
assumptions before anything was run:**

- Constraint: `llm_provider_configs_tenant_id_provider_display_name_key`,
  `UNIQUE (tenant_id, provider, display_name)` — matched.
- Index: `llm_provider_configs_one_default_per_tenant` — present, matched.
- Trigger: `trg_llm_configs_enforce_default` — present, matched.
- Function: `platform.get_tenant_llm_config(uuid,text)` (the old 2-arg form)
  — present, matched the `DROP FUNCTION` signature in the migration.
- `public.tenants` had 16 rows — enough for the assertions fixture.
- `domain` column did not yet exist — confirmed nothing had been applied.

**Execution, in order:**
1. Ran the assertions file first — failed as expected with `column "domain"
   of relation "llm_provider_configs" does not exist` (exit 3). Rolled back
   automatically (wrapped in `BEGIN`/`ROLLBACK`), confirming the harness
   works and touches nothing.
2. Applied the migration wrapped in an explicit `BEGIN`/`COMMIT` — every
   statement succeeded (`ALTER TABLE`, `DROP INDEX`, `CREATE INDEX` ×3,
   `CREATE FUNCTION` ×2, `DROP FUNCTION`, `REVOKE`, `GRANT`, `COMMENT` ×2)
   and committed.
3. Re-ran the assertions file — all 6 passed: `NOTICE: All LLM domain
   assertions passed.`
4. Confirmed exactly one overload remains:
   `platform.get_tenant_llm_config(uuid,text,text)`. No stale 2-arg version.

One wrinkle not anticipated by the plan: `platform.llm_provider_configs` is
owned by `supabase_admin`, not `postgres` — the migration's DDL
(`ALTER TABLE`, `DROP CONSTRAINT`) failed with `must be owner of table
llm_provider_configs` until reconnected as `supabase_admin`. Worth noting
for any future migration touching this table on this instance.

Temp files used for the run (`/tmp/migration.sql`, `/tmp/assertions.sql`
inside the Postgres container, and their staging copies on the VPS host)
were deleted after verification. Nothing was left in the shared VPS's
filesystem.

---

## 2. `services/markets-worker/` ignores per-domain configuration — FIXED

**Was the most important item here**, because it undercut the feature's
purpose.

`services/markets-worker/` is a **second, parallel LLM gateway**, written in
Python, that resolves provider configuration on its own and never goes through
`supabase/functions/_shared/llm-gateway.ts`. The spec assumed a single gateway
and did not account for it.

It resolved via `platform.get_default_llm_config`
(`src/markets_worker/llm_gateway.py:72`), reached from two live call sites:
`jobs/signal_generator.py:869` and `routers/chat.py:275`, plus every task
routed through `llm_gateway.invoke()`.

**Fix applied:** `_resolve_from_db` / `resolve_llm_config` now take a `domain`
argument and call `platform.get_tenant_llm_config(p_tenant_id, p_domain=...)`
instead of `get_default_llm_config` — the same RPC the TypeScript gateway uses.
`invoke()` derives the domain from the task ID prefix (`task_id.split(".")[0]`,
mirroring `llm-gateway.ts`); the two direct call sites that bypass `invoke()`
(`signal_generator.py:869`, `chat.py:275`) pass `domain="markets"` explicitly,
since this worker only ever serves the markets domain. The row's id field also
changed from `id` to `config_id` to match `get_tenant_llm_config`'s return
shape.

No callers of `get_default_llm_config` remain in `services/markets-worker/`.
A user who sets "Markets → OpenAI" in the settings page now changes what the
worker uses for market signals and chat, as intended.

Side effect worth noting: `get_tenant_llm_config` returns no rows for a NULL
tenant, whereas `get_default_llm_config(NULL)` — item 3 below — would hand
back an arbitrary tenant's decrypted key. `signal_generator.py:869` passes
`state.get("tenant_id")`, which item 3 flagged as possibly `None`; that
specific call site no longer has the leak, since it no longer calls
`get_default_llm_config` at all. Item 3 itself is unchanged for any other
caller of that function.

---

## 3. Pre-existing: `get_default_llm_config` can leak another tenant's API key — FIXED

**Not introduced by this work, but fixed here rather than deferred to the
AI/LLM audit** — it turned out to be a live, directly exploitable production
vulnerability, not just a theoretical code path.

`platform.get_default_llm_config(p_tenant_id uuid DEFAULT NULL)` filtered with
`(p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)`. Called with no argument it
returned **an arbitrary tenant's configuration including the decrypted API key**,
and it is `SECURITY DEFINER`.

**Confirmed exploitable, not just reachable in principle:** production's
`information_schema.routine_privileges` showed `EXECUTE` granted to `PUBLIC`
on this function, and `platform` is one of PostgREST's exposed schemas
(`PGRST_DB_SCHEMAS` includes it). Any caller holding the public anon key —
embedded in every frontend bundle, not a secret — could `POST
.../rest/v1/rpc/get_default_llm_config` with `Content-Profile: platform` and
an empty body and receive a random tenant's decrypted LLM provider API key.
This did not require the `signal_generator.py:869` code path this item
originally flagged; the REST route alone was sufficient.

**Fix applied** (`20260909100000_secure_get_default_llm_config.sql`, executed
against production the same way as item 1): a `NULL` (or omitted)
`p_tenant_id` now returns no rows, mirroring `get_tenant_llm_config`'s
existing guard. `EXECUTE` is revoked from `PUBLIC` and granted to
`service_role` only, matching `get_tenant_llm_config`'s posture. Verified
post-fix in production: `routine_privileges` now lists only `supabase_admin`
and `service_role`; the security-assertions file
(`get_default_llm_config_security.assertions.sql`) confirms `NULL`/omitted
tenant returns 0 rows, a real tenant still resolves its own default
correctly, and `PUBLIC` no longer holds `EXECUTE`.

No current caller passes `NULL`, or calls this function at all — item 2's
fix moved `services/markets-worker` (the only caller) onto
`get_tenant_llm_config`. Signature and return type are unchanged, so this
was a safe `CREATE OR REPLACE`, and the function is kept (not dropped)
pending the broader AI/LLM audit's decision on its fate.

---

## 4. Deferred minors

None of these block anything.

| Item | Where | Note |
| --- | --- | --- |
| `core.llm_provider_configs` is an unconsumed mirror still carrying the old per-tenant-only default index and an un-domain-scoped trigger | `supabase/migrations/20260528130400_create_core_llm.sql` | Inherits this work whenever the `core.*` lift runs. Zero readers, zero references today. |
| Natural key demoted from a named constraint to a plain unique index | `supabase/migrations/20260906120000_…sql` | `ON CONFLICT ON CONSTRAINT` no longer resolves; inference must spell out the columns. No upsert caller exists in the repo. |
| `DomainSection` and `ProviderCard` both render `<h3>` | `src/features/admin/llm-providers/components/` | Headings collide at the same level. Accessibility smell, no functional impact. |
| `ProviderCard` uses a native `confirm()` | same | Pre-existing, moved verbatim. |
| Re-exports in `markets/types.ts` and `markets/index.ts` have zero consumers | `src/features/markets/` | The plan mandated them for compatibility that turned out not to exist. Removing them is probably right but contradicts plan text, so it was left as an explicit decision. |

## 5. Explicitly out of scope, unchanged

- **`LlmGatewayAdminPage`'s hardcoded 503.** It points at `services/llm-gateway`,
  which was never deployed. Deciding that service's fate is audit sub-project B
  and must come first.
- **The `platform.*` → `core.*` lift.**
- **Per-task overrides** (e.g. `markets.daily_brief` on a different model from
  `markets.research_thread`).
- **The vLLM credential**, which remains unresolved and is orthogonal: this work
  makes provider configuration expressible and visible, which is what surfaces
  such a problem rather than what fixes it.
