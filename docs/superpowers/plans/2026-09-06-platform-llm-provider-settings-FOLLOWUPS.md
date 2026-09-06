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
| Exposing the page to users | **Blocked** on item 2 — the markets domain control silently does nothing. |

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

## 2. `services/markets-worker/` ignores per-domain configuration (blocks release)

**This is the most important item here**, because it undercuts the feature's
purpose.

`services/markets-worker/` is a **second, parallel LLM gateway**, written in
Python, that resolves provider configuration on its own and never goes through
`supabase/functions/_shared/llm-gateway.ts`. The spec assumed a single gateway
and did not account for it.

It resolves via `platform.get_default_llm_config`
(`src/markets_worker/llm_gateway.py:72`), reached from two live call sites:
`jobs/signal_generator.py:869` and `routers/chat.py:275`.

That function selects `WHERE is_active AND is_default ORDER BY updated_at DESC
LIMIT 1` with no domain filter. Before this work the unique index guaranteed one
`is_default` row per tenant, so that was deterministic. Afterwards the guarantee
becomes one per `(tenant, domain)`, so it would have returned an arbitrary row.
The migration therefore adds `AND c.domain IS NULL` to keep it deterministic.

**Consequence:** the markets-worker always uses the tenant-wide default. A user
who sets "Markets → OpenAI" in the new settings page changes nothing for market
signals or chat — the domain the page lists first.

This is **not a regression** — behaviour is byte-identical to today, and the
`AND c.domain IS NULL` predicate was the correct call. But shipping a per-domain
control that silently no-ops for the most prominent domain is worse than not
shipping it.

**Fix before users see the page.** Either:
- add `p_domain text DEFAULT NULL` to `get_default_llm_config` mirroring
  `get_tenant_llm_config`'s precedence, and have the worker pass `'markets'`; or
- repoint the worker at `get_tenant_llm_config`, which already takes a domain.

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
