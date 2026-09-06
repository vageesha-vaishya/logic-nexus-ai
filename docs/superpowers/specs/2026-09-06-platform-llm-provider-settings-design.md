# Platform-Wide LLM Provider Settings — Design

## Background

The platform has a working LLM provider configuration UI. It was built for one
module and never generalised, and the attempt to generalise it stopped at an
alias.

`src/App.tsx:317`:

```ts
// Platform-wide LLM provider settings — same component, reachable from main settings hub.
const PlatformLlmSettings = MarketsLlmSettings;
```

That alias mounts `src/features/markets/pages/LlmSettingsPage.tsx` at
`/dashboard/settings/llm-providers`. The component is good — 779 lines covering
provider listing with keys never exposed, add/edit via a Sheet, six provider
kinds each with hint copy, model selection, Vault-backed key storage, and role
gating — but its copy is markets-branded. A tenant admin arriving at the
*platform* settings page is told they are configuring "which LLM provider + API
key the **markets domain** uses for AI briefs" (`LlmSettingsPage.tsx:130`), and
the empty state reads "**Markets-domain** AI features (briefs, sentiment,
research) need an LLM provider" (line 161).

The route also has no navigation entry: `grep llm-providers src/config/navigation.ts`
returns nothing. The page exists, is aliased to a platform path, and is
unreachable from the menu.

### The deeper gap

Generalising the copy alone would not deliver a platform-wide feature, because
the data model cannot express platform-wide configuration.

`platform.llm_provider_configs` is keyed by tenant only. The schema enforces
this directly:

```sql
CREATE UNIQUE INDEX llm_provider_configs_one_default_per_tenant
  ON platform.llm_provider_configs (tenant_id)
  WHERE is_default = true;
```

One default per tenant, guaranteed by the database. And while
`platform.get_tenant_llm_config(p_tenant_id, p_provider)` accepts a provider
argument, `resolveConfig` never passes it
(`supabase/functions/_shared/llm-gateway.ts:468`):

```ts
.rpc("get_tenant_llm_config", { p_tenant_id: ctx.tenantId });
```

So all fourteen task IDs resolve to the same row. `taskId` is used only to look
up `MAX_OUTPUT_TOKENS[taskId]`. The system cannot express "markets on Claude,
logistics on the local rig, compliance on Gemini" — the sentence that describes
what a platform-wide setting is for.

The observability side already models this granularity. `core.llm_invocations`
carries `module` and `feature` columns, indexed
`(tenant_id, module, feature, occurred_at DESC)`. Configuration is the half that
was never given the axis.

### Why `platform.*` and not `core.*`

Two provider-config tables exist. `platform.llm_provider_configs` is live and
serving. `core.llm_provider_configs` was created by migration
`20260528130400_create_core_llm.sql` as a Phase 1.5 "lift from platform.*" with
extra columns (`fallback_model`, `rate_limit_qps`) and a wider provider CHECK,
but it has **no reader function** and **zero code references**. Its own header
defers the data lift and consumer cutover to "Phase 1.6, after
`@platform/llm-client` is wired in Phase 9."

This design targets `platform.*` — the working path. Doing the `core.*` cutover
here would mean a data migration on live tenant credentials plus a gateway
repoint, a far larger blast radius than the UI generalisation being asked for.
The `core.*` lift remains its own project and inherits the `domain` column when
it happens.

## Goal

Make LLM provider configuration expressible per domain, visible in the
navigation, and free of module-specific branding — so one tenant can route
different workloads to different providers from a page that is honestly
platform-wide.

## Scope decisions

Three decisions were made before design and are settled inputs, not open
questions:

1. **Scoping is per tenant × per domain**, with a per-tenant default covering
   anything unconfigured.
2. **The `domain` column lands on `platform.llm_provider_configs`**, not `core.*`.
3. **The configurable rows are the five gateway domains**, not the platform's
   module list.

On (3): the task-ID prefixes are `markets` (6 tasks), `logistics` (4), `comms`
(2), `ops` (1), `security` (1). These deliberately do not mirror the nav's
module list (`amro`, `crm`, `quotation`, `logistics`, `finance`, `compliance`,
`communications`). Five of those modules have no LLM tasks at all, so offering
rows for them would present controls that silently do nothing; and `ops` and
`security` are cross-cutting, so a module-shaped page could not express their
config at all. The configuration axis must match the routing axis.

## Data model

A single migration on `platform.llm_provider_configs`.

### The column

```sql
ALTER TABLE platform.llm_provider_configs
  ADD COLUMN domain text NULL
  CHECK (domain IS NULL OR domain IN ('markets','logistics','comms','ops','security'));
```

**`domain IS NULL` means "tenant-wide default."** This is the load-bearing
choice. Every existing row keeps its exact current meaning, so there is no
backfill, no data migration, and no behaviour change at deploy time: a tenant
with one configured provider today keeps that provider as the fallback for all
five domains.

### Uniqueness

The one-default index must be rewritten, and the rewrite must not use a plain
composite index:

```sql
DROP INDEX platform.llm_provider_configs_one_default_per_tenant;

CREATE UNIQUE INDEX llm_provider_configs_one_default_per_tenant_domain
  ON platform.llm_provider_configs (tenant_id, COALESCE(domain, '*'))
  WHERE is_default = true;
```

`COALESCE` rather than a bare `(tenant_id, domain)`: Postgres treats NULLs as
distinct in unique indexes, so a bare composite would allow two rows with
`domain IS NULL` and `is_default = true` for the same tenant. The "one default"
guarantee would break precisely on the tenant-default row — the one every
unconfigured domain falls back to. `NULLS NOT DISTINCT` would also work but
requires PG15+; `COALESCE` is version-independent.

The natural-key constraint widens the same way, so the same display name can be
reused across domains:

```sql
ALTER TABLE platform.llm_provider_configs
  DROP CONSTRAINT llm_provider_configs_tenant_id_provider_display_name_key;

CREATE UNIQUE INDEX llm_provider_configs_tenant_domain_provider_name_key
  ON platform.llm_provider_configs (tenant_id, COALESCE(domain, '*'), provider, display_name);
```

That constraint name is Postgres's auto-generated name for the inline
`UNIQUE (tenant_id, provider, display_name)` in the original `CREATE TABLE`, and
it fits within the 63-character identifier limit so it is not truncated. It must
still be **confirmed against the live database before the migration runs** — the
table was reconstituted from production rather than created by this repository's
migration history, so its constraint could carry a different name. Confirm with:

```sql
SELECT conname FROM pg_constraint
 WHERE conrelid = 'platform.llm_provider_configs'::regclass AND contype = 'u';
```

### The trigger

`platform.llm_configs_enforce_single_default` currently clears every other
default for the tenant. It must clear only within the same domain, or setting a
logistics default would silently unset the markets one:

```sql
UPDATE platform.llm_provider_configs
   SET is_default = false
 WHERE tenant_id = NEW.tenant_id
   AND COALESCE(domain, '*') = COALESCE(NEW.domain, '*')
   AND id <> NEW.id
   AND is_default = true;
```

### Lookup index

```sql
CREATE INDEX llm_provider_configs_tenant_domain_idx
  ON platform.llm_provider_configs (tenant_id, domain, is_active);
```

## Resolution

`platform.get_tenant_llm_config` gains a domain parameter and a precedence
order:

```sql
  WHERE c.tenant_id = p_tenant_id
    AND c.is_active = true
    AND (c.domain = p_domain OR c.domain IS NULL)
    AND (
      (p_provider IS NULL AND c.is_default = true)
      OR (p_provider IS NOT NULL AND c.provider = p_provider)
    )
  ORDER BY (c.domain IS NOT NULL) DESC,  -- domain-specific beats tenant default
           c.is_default DESC,
           c.created_at ASC
  LIMIT 1;
```

This must be written as `DROP FUNCTION` followed by `CREATE`, **not**
`CREATE OR REPLACE`. Adding a defaulted parameter to a Postgres function creates
an *overload* rather than replacing it, leaving two same-named functions and an
ambiguous resolution for PostgREST's RPC dispatch.

The signature becomes:

```sql
platform.get_tenant_llm_config(
  p_tenant_id uuid,
  p_provider  text DEFAULT NULL,
  p_domain    text DEFAULT NULL
)
```

Grants and the `SECURITY DEFINER` / service-role-only posture are re-applied
unchanged after the recreate — this function returns decrypted API keys and must
never become client-callable.

In `supabase/functions/_shared/llm-gateway.ts`, `resolveConfig` derives the
domain from the task ID it already receives:

```ts
const domain = taskId.split(".")[0];
const { data, error } = await (ctx.supabaseAdmin as any)
  .schema("platform")
  .rpc("get_tenant_llm_config", { p_tenant_id: ctx.tenantId, p_domain: domain });
```

Full precedence after this change: **domain config → tenant default →
`ANTHROPIC_API_KEY` → vLLM env → 503.** The final three legs are untouched.

## Frontend

### Structure

The 779-line page is doing four jobs — page shell, provider cards, the add/edit
sheet, and two constant maps. Adding a domain axis to it as-is would push it past
900 lines. It moves out of `markets` and splits along those existing seams:

```
src/features/admin/llm-providers/
  pages/LlmProviderSettingsPage.tsx   — shell, domain sections, role gate
  components/DomainSection.tsx        — one domain: its providers and default
  components/ProviderFormSheet.tsx    — add / edit / rotate key
  constants.ts                        — PROVIDER_LABELS, PROVIDER_HINT, DOMAIN_LABELS
  hooks/useLlmConfigs.ts              — moved
  hooks/useProviderModels.ts          — moved
  types.ts                            — moved
  index.ts                            — public exports
```

The whole LLM-config surface is currently self-contained within
`features/markets` and re-exported only from its `index.ts`; nothing outside that
feature imports these types or hooks. `features/markets/types.ts` re-exports
`LlmProviderKind` and `LlmProviderConfig` from the new location so intra-markets
imports keep working.

`LlmProviderConfig` gains `domain: string | null`, and `CreateLlmConfigInput` /
`UpdateLlmConfigInput` gain an optional `domain`.

### Page shape

A **Platform default** section first (`domain = null`), then one section per
gateway domain in a fixed order: Markets, Logistics, Communications, Automation
& Agents, Security.

A domain with no configuration of its own does not render as empty. It renders
its inherited state — "Inherits platform default — Anthropic /
claude-sonnet-4-5" — so the provider that will actually serve that domain's
calls is always visible without the reader having to infer it. A domain with its
own config shows that config and an explicit control to revert to inheriting.

"Revert to inheriting" performs the same soft delete the page already uses for
removing a provider — `DELETE` on the edge function, which sets
`is_active = false` and removes the Vault secret. It does not null the `domain`
column, which would silently promote a domain's provider to the tenant default
and change behaviour for every other domain.

`DOMAIN_LABELS` maps gateway vocabulary to user-facing names, because the
routing keys are not what users see elsewhere in the product:

| domain | label | description |
| --- | --- | --- |
| `markets` | Markets | Briefs, sentiment, research, strategy explanations |
| `logistics` | Logistics | Quotes, invoice extraction, demand narratives, transport mode |
| `comms` | Communications | Smart replies and message drafting |
| `ops` | Automation & Agents | Agent planning |
| `security` | Security | Email threat analysis |

Adding a provider from within a domain section pre-selects that domain in the
form; the form still allows changing it.

### Routes and reachability

- Delete the `PlatformLlmSettings = MarketsLlmSettings` alias (`src/App.tsx:317`)
  and the now-unused `MarketsLlmSettings` lazy import.
- `/dashboard/settings/llm-providers` renders `LlmProviderSettingsPage`.
- `/dashboard/markets/settings/llm` becomes
  `<Navigate to="/dashboard/settings/llm-providers" replace />`, preserving the
  markets entry point rather than breaking a known URL.
- **Add the missing navigation entry** in `src/config/navigation.ts` under
  Settings, roles `tenant_admin` / `franchise_admin` / `platform_admin`. This is
  the change that makes the feature reachable at all.

### Edge function

`markets-llm-config` is renamed to `llm-provider-config`. It is
table-generic already — the markets name is the only module-specific thing about
it — and it has exactly one caller.

The rename touches `supabase/functions/main/function_importers.ts:74` and the
directory itself. It does **not** touch `supabase/config.toml` or
`supabase/functions/main/verify_jwt_map.ts`, because the function is absent from
both, and absence from `VERIFY_JWT_MAP` is what makes `main/index.ts` require a
JWT for it (`VERIFY_JWT_MAP[name] !== false`). **The new name must remain absent
from both files** so the JWT requirement carries over. This is a correctness
requirement, not an omission.

The function gains `domain` handling: accepted on POST and PATCH, validated
against the same five-value set as the CHECK constraint, returned on GET, and
`null` when not supplied.

## Error handling

- An unrecognised `domain` value is rejected by the edge function with 400
  before it reaches the database, so the CHECK constraint is a backstop rather
  than the primary validation.
- `resolveConfig`'s existing behaviour on RPC failure is retained: log a warning
  and fall through to the env chain. Adding a parameter does not change the
  failure mode.
- A domain whose configured provider has a missing Vault key already logs
  "tenant config found but api_key missing in vault" and falls through. With
  domain scoping this fall-through now lands on the tenant default before the
  env chain, which is the desired behaviour and needs no special-casing.

## Verification

The edge functions have no test framework, so verification splits by layer.

**Vitest (frontend):** domain sections render in fixed order; a domain with no
config renders inherited state naming the platform default's provider and model;
a domain with its own config renders that instead; the add form pre-selects the
originating section's domain.

**SQL assertions (run directly against the database):**
- a domain-specific row wins over the tenant default for that domain
- the tenant default is returned for a domain with no row of its own
- two `is_default` rows for the same `(tenant, domain)` are rejected
- two `is_default` rows with `domain IS NULL` for the same tenant are rejected
  (the case a bare composite index would have missed)
- setting a default in one domain leaves another domain's default intact

**Type check:** `npm run typecheck`.

## Deployment notes

The migration is reversible and has no behaviour impact at deploy: the column is
nullable and every existing row keeps its meaning.

The one step needing care is the `DROP FUNCTION` / `CREATE` on
`get_tenant_llm_config`. Between the drop and the create, the gateway's tenant
lookup fails and falls through to the env chain. On the self-hosted deployment
that chain currently terminates in a 503 rather than a working provider, so
tenant calls fail loudly rather than silently rerouting — the safe failure mode,
but a reason to run the migration during low traffic.

Edge functions on the self-hosted stack are served from a read-only bind mount
rather than the git clone, so the function rename must be applied to the mount
and the runtime restarted for `function_importers.ts` to pick up the new key.

## Out of scope

- **`LlmGatewayAdminPage`'s hardcoded 503** (audit finding F-5.5). It points at
  `services/llm-gateway`, which was never deployed; deciding that service's fate
  is audit sub-project B and must precede any fix.
- **The `platform.*` → `core.*` lift.** Separate project; inherits the `domain`
  column when it runs.
- **Per-task overrides** (e.g. `markets.daily_brief` on a cheaper model than
  `markets.research_thread`). Three-level precedence for a need nobody has
  stated. YAGNI.
- **The vLLM credential.** Unresolved separately, and orthogonal: this work makes
  provider configuration expressible and visible, which is what surfaces such a
  problem rather than what fixes it.

## Success criteria

- A tenant admin can set different providers for markets and logistics, and
  `resolveConfig` routes each domain's tasks to its own provider.
- A domain with no configuration of its own resolves to the tenant default, and
  the UI states which provider that is without the user inferring it.
- LLM provider settings are reachable from the navigation menu.
- No page in the product describes platform-wide LLM configuration as
  markets-specific.
- Existing single-provider tenants see no behaviour change across the migration.
- `npm run typecheck` passes and the SQL assertions above hold.
