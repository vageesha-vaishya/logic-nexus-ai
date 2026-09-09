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
| Deploy | **Blocked** on item 1 — the migration has never been executed. |
| Exposing the page to users | **Clear as of item 2's fix below.** |

---

## 1. The migration is unexecuted (blocks deploy)

Docker was unavailable for the whole implementation session, so **every line of
SQL in this feature is unverified by running**. It has had careful review and
nothing more. The spec's own success criterion "the SQL assertions above hold"
is therefore unmet.

Failure modes were deliberately made loud — `DROP INDEX`, `DROP CONSTRAINT` and
`DROP FUNCTION` all omit `IF EXISTS`, so a name mismatch aborts the migration
rather than half-applying it — but that is a design choice, not evidence.

**Run when Docker is available:**

```bash
npm run supabase:start
npm run supabase:db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/tests/llm_provider_configs_domain.assertions.sql
```

Expect `NOTICE: All LLM domain assertions passed.` and exit code 0.

**The assertions need at least one row in `public.tenants`.** A clean
`db:reset` with no seed data aborts with "No tenant rows available to run
assertions against". That is a runbook gap, not a bug — seed a tenant first.

**Then confirm no function overload survived:**

```sql
SELECT p.oid::regprocedure
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'platform' AND p.proname = 'get_tenant_llm_config';
```

Expect exactly one row: `platform.get_tenant_llm_config(uuid,text,text)`. Two
rows means the drop missed and PostgREST's RPC dispatch is ambiguous between a
two-arg and three-arg `SECURITY DEFINER` function that returns decrypted API
keys.

**Before applying to production**, confirm both object names really match, since
that database was reconstituted from prod rather than built from this
repository's migrations:

```sql
SELECT conname FROM pg_constraint
 WHERE conrelid = 'platform.llm_provider_configs'::regclass AND contype = 'u';
SELECT indexname FROM pg_indexes
 WHERE schemaname = 'platform' AND tablename = 'llm_provider_configs';
```

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

## 3. Pre-existing: `get_default_llm_config` can leak another tenant's API key

**Not introduced by this work. Belongs with the AI/LLM audit findings.**

`platform.get_default_llm_config(p_tenant_id uuid DEFAULT NULL)` filters with
`(p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)`. Called with no argument it
returns **an arbitrary tenant's configuration including the decrypted API key**,
and it is `SECURITY DEFINER`.

There is a reachable route in code: `resolve_llm_config(tenant_id: str | None =
None)` defaults to `None`, and `jobs/signal_generator.py:869` calls
`resolve_llm_config(state.get("tenant_id"))` — `.get()` yields `None` when the
key is absent.

To be precise: **it has not been proven that `state` can lack `tenant_id`.** The
code permits it; whether it happens needs checking. Worth confirming, along with
who holds EXECUTE on that function.

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
