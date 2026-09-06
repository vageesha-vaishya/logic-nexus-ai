# Platform-Wide LLM Provider Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LLM provider configuration expressible per domain, reachable from the navigation, and free of markets-specific branding, so one tenant can route different workloads to different providers.

**Architecture:** Add a nullable `domain` column to `platform.llm_provider_configs` where `NULL` means "tenant-wide default", so existing rows keep their meaning and the migration is a no-op at deploy. Teach `get_tenant_llm_config` to prefer a domain-specific row over the tenant default, and teach `resolveConfig` to derive the domain from the task ID it already receives. Move the 779-line markets settings page into a bounded `features/admin/llm-providers/` module, split along its existing seams, and give it one section per gateway domain.

**Tech Stack:** PostgreSQL 15 (Supabase self-hosted), Deno edge functions, React 18 + TypeScript, TanStack Query, react-hook-form, Shadcn/Radix UI, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-06-platform-llm-provider-settings-design.md` (commit `b0f9c9f6`). Read it for rationale; this plan is the executable form.

## Global Constraints

- **The repository `github.com/vageesha-vaishya/logic-nexus-ai` is PUBLIC.** Never commit a credential, key, token, or live hostname+secret pair. Do not push; committing locally is correct for every task here.
- **Do NOT deploy to production in this plan.** The spec's "Deployment notes" section is context for a later cutover decision. No Coolify API calls, no `scp` to the VPS, no edge-runtime restarts, no migration runs against production. Local/dev verification only.
- **The five valid domains are exactly `markets`, `logistics`, `comms`, `ops`, `security`** — used verbatim in the SQL CHECK constraint, the edge function validator, and the frontend constants. These three lists must stay identical.
- **The six valid providers are exactly `anthropic`, `openai`, `openrouter`, `gemini`, `local-qwen`, `custom`.** Do not add `mistral` or `cohere` — those exist only on the unconsumed `core.*` mirror table and are out of scope.
- **`domain IS NULL` means "tenant-wide default".** Never backfill it to a string value. Every existing row must keep `NULL` so its behaviour is unchanged.
- **Unique indexes over `domain` must use `COALESCE(domain, '*')`,** never a bare `(tenant_id, domain)`. Postgres treats NULLs as distinct in unique indexes, so a bare composite would permit two tenant-default rows with `is_default = true` — breaking the guarantee on exactly the row every unconfigured domain falls back to.
- **`get_tenant_llm_config` must be `DROP FUNCTION` then `CREATE`,** never `CREATE OR REPLACE`. Adding a defaulted parameter creates an overload, leaving two same-named functions and an ambiguous PostgREST RPC dispatch.
- **`get_tenant_llm_config` returns decrypted API keys.** After the recreate, re-apply `SECURITY DEFINER`, `SET search_path = pg_catalog, platform, vault`, `REVOKE EXECUTE ... FROM PUBLIC`, and `GRANT EXECUTE ... TO service_role`. It must never become client-callable.
- **The constraint name `llm_provider_configs_tenant_id_provider_display_name_key` must be confirmed before the migration is written**, using the `pg_constraint` query in Task 1 Step 1. The table was reconstituted from production rather than created by this repository's migration history, so its auto-generated constraint name could differ. A wrong name aborts the migration.
- **The renamed edge function must stay ABSENT from both `supabase/config.toml` and `supabase/functions/main/verify_jwt_map.ts`.** Absence from `VERIFY_JWT_MAP` is what makes `main/index.ts`'s `VERIFY_JWT_MAP[name] !== false` require a JWT. Adding an entry with `false` would open an admin CRUD endpoint to anonymous callers.
- **There is no test framework in the edge functions codebase.** Verification for edge-function and SQL work is `npm run typecheck` plus the explicit SQL assertions in Task 1. Do not scaffold a Deno test harness.
- If a command is denied by a permission classifier, **report BLOCKED and stop** — never retry it, and never work around it with a different tool.

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/20260906120000_llm_provider_configs_domain.sql` | The `domain` column, COALESCE unique indexes, domain-scoped trigger, lookup index, and the recreated `get_tenant_llm_config`. |
| `supabase/functions/llm-provider-config/index.ts` | Renamed from `markets-llm-config`; adds `domain` handling. |
| `src/features/admin/llm-providers/constants.ts` | `LLM_DOMAINS`, `LlmDomain`, `DOMAIN_LABELS`, `DOMAIN_DESCRIPTIONS`, `PROVIDER_LABELS`, `PROVIDER_HINT`, `GEMINI_KNOWN_MODELS`, `GEMINI_CUSTOM_SENTINEL`. |
| `src/features/admin/llm-providers/types.ts` | `LlmProviderKind`, `LlmProviderConfig`, `CreateLlmConfigInput`, `UpdateLlmConfigInput`. |
| `src/features/admin/llm-providers/hooks/useLlmConfigs.ts` | Moved; endpoint renamed, `domain` threaded through. |
| `src/features/admin/llm-providers/hooks/useProviderModels.ts` | Moved unchanged. |
| `src/features/admin/llm-providers/components/ProviderCard.tsx` | One configured provider row (was `LlmConfigRow`). |
| `src/features/admin/llm-providers/components/ProviderFormSheet.tsx` | Add / edit / rotate-key form (was `LlmConfigForm`). |
| `src/features/admin/llm-providers/components/ModelPickers.tsx` | `GeminiModelPicker`, `OpenRouterModelPicker`, `formatContext`. |
| `src/features/admin/llm-providers/components/DomainSection.tsx` | **New.** One domain: its providers, or its inherited state. |
| `src/features/admin/llm-providers/pages/LlmProviderSettingsPage.tsx` | Page shell; renders the platform-default section then five domain sections. |
| `src/features/admin/llm-providers/index.ts` | Barrel. |
| `src/features/admin/llm-providers/__tests__/DomainSection.test.tsx` | Vitest coverage for inherit-vs-override rendering. |
| `src/features/admin/llm-providers/__tests__/LlmProviderSettingsPage.test.tsx` | Vitest coverage for section order and add-button domain pre-selection. |

**Modified:**

| Path | Change |
| --- | --- |
| `supabase/functions/_shared/llm-gateway.ts:460-470` | Derive `domain` from `taskId`; pass `p_domain` to the RPC. |
| `supabase/functions/main/function_importers.ts:74` | Re-key `markets-llm-config` → `llm-provider-config`. |
| `src/features/markets/types.ts:65-100` | Replace the LLM type block with a re-export from the new module. |
| `src/features/markets/index.ts:12-16` | Re-export the LLM hooks from the new module. |
| `src/App.tsx:280,317,704,1276` | Drop the alias, mount the new page, redirect the markets route. |
| `src/config/navigation.ts` | Add the missing Settings → LLM Providers entry. |

**Deleted:**

| Path | Reason |
| --- | --- |
| `supabase/functions/markets-llm-config/index.ts` | Renamed (Task 3). |
| `src/features/markets/pages/LlmSettingsPage.tsx` | Split into the new module (Task 4). |
| `src/features/markets/hooks/useLlmConfigs.ts` | Moved (Task 4). |
| `src/features/markets/hooks/useProviderModels.ts` | Moved (Task 4). |

**Note on the split:** the spec lists four frontend files; this plan produces five. `LlmConfigForm` (lines 318-543) and the two model pickers (lines 544-779) are 226 and 231 lines respectively. Folding the pickers into `ProviderFormSheet.tsx` would recreate a 460-line file, which is the problem the split exists to solve. `ModelPickers.tsx` is the fifth file.

---

## Task 1: Migration — domain column and domain-aware resolution

**Files:**
- Create: `supabase/migrations/20260906120000_llm_provider_configs_domain.sql`
- Reference (do not modify): `supabase/migrations/20260515063246_platform_llm_provider_configs.sql`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `platform.get_tenant_llm_config(p_tenant_id uuid, p_provider text DEFAULT NULL, p_domain text DEFAULT NULL)` returning `TABLE (config_id uuid, provider text, base_url text, default_model text, api_key text, is_default boolean)`. Task 2 calls this with named parameters `p_tenant_id` and `p_domain`. Also produces the column `platform.llm_provider_configs.domain text NULL`, which Task 3 reads and writes.

- [ ] **Step 1: Confirm the live constraint name**

The migration drops a constraint by name. Confirm the name first — the table was reconstituted from production, so its auto-generated name is not guaranteed to match this repository's `CREATE TABLE`.

Start the local stack if it is not running, then query:

```bash
npm run supabase:start
```

```sql
SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conrelid = 'platform.llm_provider_configs'::regclass
   AND contype = 'u';
```

Expected: one row named `llm_provider_configs_tenant_id_provider_display_name_key` with definition `UNIQUE (tenant_id, provider, display_name)`.

**If the name differs, use the actual name in Step 3 and note the discrepancy in the commit message.** Do not guess.

- [ ] **Step 2: Write the SQL assertions file**

These assertions are the test for this task. Write them first; they will fail until Step 3 lands.

Create `supabase/migrations/tests/llm_provider_configs_domain.assertions.sql`:

```sql
-- Assertions for the domain-scoped LLM provider config resolution.
-- Run with:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <this file>
-- Every block raises an exception on failure; a clean exit means all passed.

BEGIN;

-- Fixture: one tenant, a tenant-default config, and a markets-specific config.
CREATE TEMP TABLE _t AS SELECT id AS tenant_id FROM public.tenants LIMIT 1;

DO $$
DECLARE
  v_tenant uuid := (SELECT tenant_id FROM _t);
  v_default_id uuid;
  v_markets_id uuid;
  v_got uuid;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No tenant rows available to run assertions against';
  END IF;

  INSERT INTO platform.llm_provider_configs
    (tenant_id, provider, display_name, default_model, vault_secret_name, domain, is_default)
  VALUES
    (v_tenant, 'anthropic', 'zz-assert-default', 'claude-sonnet-4-5', 'zz_assert_default', NULL, true)
  RETURNING id INTO v_default_id;

  INSERT INTO platform.llm_provider_configs
    (tenant_id, provider, display_name, default_model, vault_secret_name, domain, is_default)
  VALUES
    (v_tenant, 'openai', 'zz-assert-markets', 'gpt-4o-mini', 'zz_assert_markets', 'markets', true)
  RETURNING id INTO v_markets_id;

  -- 1. A domain-specific row wins over the tenant default for that domain.
  SELECT config_id INTO v_got
    FROM platform.get_tenant_llm_config(v_tenant, NULL, 'markets');
  IF v_got IS DISTINCT FROM v_markets_id THEN
    RAISE EXCEPTION 'A1 failed: markets should resolve to the markets row, got %', v_got;
  END IF;

  -- 2. A domain with no row of its own resolves to the tenant default.
  SELECT config_id INTO v_got
    FROM platform.get_tenant_llm_config(v_tenant, NULL, 'logistics');
  IF v_got IS DISTINCT FROM v_default_id THEN
    RAISE EXCEPTION 'A2 failed: logistics should fall back to the tenant default, got %', v_got;
  END IF;

  -- 3. Setting a default in one domain leaves another domain's default intact.
  IF NOT (SELECT is_default FROM platform.llm_provider_configs WHERE id = v_default_id) THEN
    RAISE EXCEPTION 'A3 failed: inserting a markets default cleared the tenant default';
  END IF;

  -- 4. Two is_default rows for the same (tenant, domain) are rejected.
  BEGIN
    INSERT INTO platform.llm_provider_configs
      (tenant_id, provider, display_name, default_model, vault_secret_name, domain, is_default)
    VALUES
      (v_tenant, 'gemini', 'zz-assert-markets-2', 'gemini-2.5-flash', 'zz_assert_markets_2', 'markets', true);
    -- The enforce-single-default trigger clears the previous one, so this must
    -- succeed AND leave exactly one default for the domain.
    IF (SELECT count(*) FROM platform.llm_provider_configs
         WHERE tenant_id = v_tenant AND domain = 'markets' AND is_default) <> 1 THEN
      RAISE EXCEPTION 'A4 failed: more than one default for (tenant, markets)';
    END IF;
  END;

  -- 5. Two is_default rows with domain IS NULL are rejected for the same tenant.
  --    This is the case a bare (tenant_id, domain) unique index would have missed.
  INSERT INTO platform.llm_provider_configs
    (tenant_id, provider, display_name, default_model, vault_secret_name, domain, is_default)
  VALUES
    (v_tenant, 'openrouter', 'zz-assert-default-2', 'anthropic/claude-3.5-sonnet', 'zz_assert_default_2', NULL, true);
  IF (SELECT count(*) FROM platform.llm_provider_configs
       WHERE tenant_id = v_tenant AND domain IS NULL AND is_default) <> 1 THEN
    RAISE EXCEPTION 'A5 failed: more than one tenant-default row with is_default';
  END IF;

  RAISE NOTICE 'All LLM domain assertions passed.';
END $$;

ROLLBACK;
```

- [ ] **Step 3: Run the assertions to verify they fail**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/tests/llm_provider_configs_domain.assertions.sql
```

Expected: FAIL with `column "domain" of relation "llm_provider_configs" does not exist`.

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/20260906120000_llm_provider_configs_domain.sql`:

```sql
-- ====================================================================
-- Per-domain LLM provider configuration.
--
-- Adds a nullable `domain` to platform.llm_provider_configs, where
-- NULL means "tenant-wide default". Existing rows are untouched and keep
-- their exact current meaning: a tenant's single configured provider
-- becomes the fallback for all five domains. No backfill is required.
--
-- Domains are the task-ID prefixes the gateway routes on
-- (see LlmTaskId in supabase/functions/_shared/llm-gateway.ts).
-- ====================================================================

ALTER TABLE platform.llm_provider_configs
  ADD COLUMN domain text NULL
  CHECK (domain IS NULL OR domain IN ('markets','logistics','comms','ops','security'));

COMMENT ON COLUMN platform.llm_provider_configs.domain IS
  'Gateway domain this config serves (task-ID prefix). NULL = tenant-wide default, used by any domain without its own config.';

-- ── Uniqueness ──────────────────────────────────────────────────────
-- COALESCE, not a bare (tenant_id, domain): Postgres treats NULLs as
-- distinct in unique indexes, so a bare composite would allow two
-- tenant-default rows with is_default = true — breaking the guarantee
-- on precisely the row every unconfigured domain falls back to.

DROP INDEX IF EXISTS platform.llm_provider_configs_one_default_per_tenant;

CREATE UNIQUE INDEX llm_provider_configs_one_default_per_tenant_domain
  ON platform.llm_provider_configs (tenant_id, COALESCE(domain, '*'))
  WHERE is_default = true;

-- Widen the natural key so the same display name can be reused per domain.
ALTER TABLE platform.llm_provider_configs
  DROP CONSTRAINT llm_provider_configs_tenant_id_provider_display_name_key;

CREATE UNIQUE INDEX llm_provider_configs_tenant_domain_provider_name_key
  ON platform.llm_provider_configs (tenant_id, COALESCE(domain, '*'), provider, display_name);

-- ── Lookup index ────────────────────────────────────────────────────

CREATE INDEX llm_provider_configs_tenant_domain_idx
  ON platform.llm_provider_configs (tenant_id, domain, is_active);

-- ── Trigger: single default per (tenant, domain), not per tenant ─────
-- Without the COALESCE predicate, setting a logistics default would
-- silently clear the markets one.

CREATE OR REPLACE FUNCTION platform.llm_configs_enforce_single_default()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, platform
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE platform.llm_provider_configs
       SET is_default = false
     WHERE tenant_id = NEW.tenant_id
       AND COALESCE(domain, '*') = COALESCE(NEW.domain, '*')
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Resolution ──────────────────────────────────────────────────────
-- DROP then CREATE, not CREATE OR REPLACE: adding a defaulted parameter
-- creates an overload rather than replacing, leaving two same-named
-- functions and an ambiguous PostgREST RPC dispatch.

DROP FUNCTION IF EXISTS platform.get_tenant_llm_config(uuid, text);

CREATE FUNCTION platform.get_tenant_llm_config(
  p_tenant_id uuid,
  p_provider  text DEFAULT NULL,
  p_domain    text DEFAULT NULL
)
RETURNS TABLE (
  config_id      uuid,
  provider       text,
  base_url       text,
  default_model  text,
  api_key        text,    -- DECRYPTED — never expose this to clients
  is_default     boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, vault
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id                AS config_id,
    c.provider          AS provider,
    c.base_url          AS base_url,
    c.default_model     AS default_model,
    vs.decrypted_secret AS api_key,
    c.is_default        AS is_default
  FROM platform.llm_provider_configs c
  LEFT JOIN vault.decrypted_secrets vs ON vs.name = c.vault_secret_name
  WHERE c.tenant_id = p_tenant_id
    AND c.is_active = true
    AND (p_domain IS NULL OR c.domain = p_domain OR c.domain IS NULL)
    AND (
      (p_provider IS NULL AND c.is_default = true)
      OR (p_provider IS NOT NULL AND c.provider = p_provider)
    )
  ORDER BY (c.domain IS NOT NULL) DESC,  -- domain-specific beats tenant default
           c.is_default DESC,
           c.created_at ASC
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION platform.get_tenant_llm_config(uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION platform.get_tenant_llm_config(uuid, text, text) TO service_role;

COMMENT ON FUNCTION platform.get_tenant_llm_config(uuid, text, text) IS
  'Gateway helper. SECURITY DEFINER + service_role-only. Returns the tenant active LLM provider config for a domain (falling back to the tenant-wide default) WITH the decrypted API key. Never expose to clients.';
```

- [ ] **Step 5: Apply the migration locally and re-run the assertions**

```bash
npm run supabase:db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/tests/llm_provider_configs_domain.assertions.sql
```

Expected: `NOTICE: All LLM domain assertions passed.` and exit code 0.

- [ ] **Step 6: Verify the old two-argument function is gone**

An overload surviving the migration is the specific failure this task guards against.

```sql
SELECT p.oid::regprocedure
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'platform' AND p.proname = 'get_tenant_llm_config';
```

Expected: exactly one row, `platform.get_tenant_llm_config(uuid,text,text)`. If two rows appear, the `DROP FUNCTION` signature did not match the live function — drop the stale one explicitly by its printed signature.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260906120000_llm_provider_configs_domain.sql \
        supabase/migrations/tests/llm_provider_configs_domain.assertions.sql
git commit -m "feat(llm): scope provider configs by domain

Adds a nullable domain column to platform.llm_provider_configs where NULL
means tenant-wide default, so existing rows keep their meaning and no
backfill is needed. Rewrites the one-default index and the natural key
over COALESCE(domain,'*') because Postgres treats NULLs as distinct in
unique indexes. Recreates get_tenant_llm_config with p_domain, preferring
a domain-specific row over the tenant default."
```

---

## Task 2: Gateway — resolve by the task's domain

**Files:**
- Modify: `supabase/functions/_shared/llm-gateway.ts` (the `resolveConfig` function, ~line 460; the RPC call is at line 468)

**Interfaces:**
- Consumes: `platform.get_tenant_llm_config(p_tenant_id uuid, p_provider text DEFAULT NULL, p_domain text DEFAULT NULL)` from Task 1.
- Produces: no new exports. `resolveConfig`'s existing `ResolvedConfig` return shape is unchanged.

- [ ] **Step 1: Read the current call site**

```bash
sed -n '455,500p' supabase/functions/_shared/llm-gateway.ts
```

You are looking for this block, which ignores the `taskId` parameter it was given:

```ts
      const { data, error } = await (ctx.supabaseAdmin as any)
        .schema("platform")
        .rpc("get_tenant_llm_config", { p_tenant_id: ctx.tenantId });
```

- [ ] **Step 2: Derive the domain and pass it**

Replace that call with:

```ts
      // Task IDs are '<domain>.<feature>' (see LlmTaskId). The domain selects
      // which of the tenant's provider configs serves this call; the RPC falls
      // back to the tenant-wide default (domain IS NULL) when the domain has
      // no config of its own.
      const domain = taskId.split(".")[0];
      const { data, error } = await (ctx.supabaseAdmin as any)
        .schema("platform")
        .rpc("get_tenant_llm_config", { p_tenant_id: ctx.tenantId, p_domain: domain });
```

Do not change the `if (!error && Array.isArray(data) && data.length > 0)` block below it, the `row` destructuring, the returned `ResolvedConfig`, or any of the three env-fallback legs. The only behavioural change is which row the RPC selects.

- [ ] **Step 3: Verify the domain derivation covers every task ID**

Every member of the `LlmTaskId` union must yield one of the five valid domains. Confirm by inspection:

```bash
sed -n "/export type LlmTaskId/,/;/p" supabase/functions/_shared/llm-gateway.ts \
  | grep -o '"[a-z_]*\.' | sort -u
```

Expected exactly five lines: `"comms.`, `"logistics.`, `"markets.`, `"ops.`, `"security.`

If a sixth appears, the CHECK constraint in Task 1 and the validator in Task 3 are missing a domain — stop and report BLOCKED rather than widening only one of the three lists.

- [ ] **Step 4: Type check**

```bash
npm run typecheck
```

Expected: PASS with no new errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/llm-gateway.ts
git commit -m "feat(llm-gateway): resolve provider config by task domain

resolveConfig received taskId but used it only for MAX_OUTPUT_TOKENS, so
all 14 task IDs resolved to one provider row. Derive the domain from the
task ID prefix and pass it to get_tenant_llm_config."
```

---

## Task 3: Edge function — rename and accept `domain`

**Files:**
- Create: `supabase/functions/llm-provider-config/index.ts` (via `git mv`, then edit)
- Delete: `supabase/functions/markets-llm-config/index.ts`
- Modify: `supabase/functions/main/function_importers.ts:74`

**Interfaces:**
- Consumes: `platform.llm_provider_configs.domain` from Task 1.
- Produces: HTTP endpoint `llm-provider-config` with `GET` (returns `domain` on every row), `POST` (accepts optional `domain`), `PATCH` (accepts optional `domain`), `DELETE` (unchanged). Task 4's `useLlmConfigs` calls this by name.

- [ ] **Step 1: Rename the directory**

```bash
git mv supabase/functions/markets-llm-config supabase/functions/llm-provider-config
```

- [ ] **Step 2: Re-key the importer**

In `supabase/functions/main/function_importers.ts`, line 74 currently reads:

```ts
  "markets-llm-config": () => import("../markets-llm-config/index.ts"),
```

Replace with:

```ts
  "llm-provider-config": () => import("../llm-provider-config/index.ts"),
```

Keep the surrounding entries in their existing alphabetical position — move the line if the map is sorted, so `llm-provider-config` sits between its alphabetical neighbours.

- [ ] **Step 3: Confirm the function stays absent from both JWT-relevant files**

```bash
grep -n "llm-provider-config\|markets-llm-config" supabase/config.toml supabase/functions/main/verify_jwt_map.ts
```

Expected: **no output.** Absence from `VERIFY_JWT_MAP` is what makes `main/index.ts`'s `VERIFY_JWT_MAP[name] !== false` require a JWT for this endpoint. If you are tempted to add an entry, do not — an entry with `false` would open admin CRUD to anonymous callers.

- [ ] **Step 4: Update the file header**

Replace the header block at the top of `supabase/functions/llm-provider-config/index.ts` (lines 4-15) with:

```ts
// llm-provider-config — CRUD for platform.llm_provider_configs.
//
// Endpoints:
//   GET    /llm-provider-config                       → list configs for x-tenant-id
//   POST   /llm-provider-config                       → create (stores api_key in vault)
//          body: { provider, display_name, default_model, api_key, base_url?, is_default?, domain? }
//   PATCH  /llm-provider-config?id=<uuid>             → update non-secret fields + optionally rotate api_key
//          body: { display_name?, default_model?, base_url?, is_active?, is_default?, api_key?, domain? }
//   DELETE /llm-provider-config?id=<uuid>             → hard delete of the row + vault key deletion
//
// `domain` is the gateway task-ID prefix this config serves; null/omitted
// means the tenant-wide default, used by any domain without its own config.
//
// Auth: tenant_admin / franchise_admin / platform_admin.
// API keys: stored in supabase_vault, never returned to the client.
```

The DELETE line is corrected deliberately: the handler issues `.delete()` against the table, so the previous "soft delete (is_active=false)" comment was wrong about its own behaviour.

- [ ] **Step 5: Add the domain type and validator**

Below the existing `VALID_PROVIDERS` declaration (~line 26), add:

```ts
type LlmDomain = "markets" | "logistics" | "comms" | "ops" | "security";
const VALID_DOMAINS: LlmDomain[] = ["markets","logistics","comms","ops","security"];

/** null = tenant-wide default. Returns an error string, or null when valid. */
function validateDomain(d: unknown): string | null {
  if (d === undefined || d === null) return null;
  if (typeof d !== "string" || !VALID_DOMAINS.includes(d as LlmDomain)) {
    return `domain must be null or one of ${VALID_DOMAINS.join(", ")}`;
  }
  return null;
}
```

Add `domain?: LlmDomain | null;` to both the `CreateBody` and `PatchBody` interfaces.

- [ ] **Step 6: Validate `domain` on create**

In `validateCreate`, add this as the final check before `return null;`:

```ts
  const domainErr = validateDomain(b.domain);
  if (domainErr) return domainErr;
```

- [ ] **Step 7: Return `domain` on GET**

In the `GET` handler, the `.select(...)` string currently ends `..., created_at, updated_at, last_used_at`. Add `domain` to it:

```ts
        .select(
          "id, tenant_id, provider, display_name, base_url, default_model, domain, is_active, is_default, created_at, updated_at, last_used_at",
        )
```

- [ ] **Step 8: Persist `domain` on POST**

In the `POST` handler's `insertPayload`, add the field after `default_model`:

```ts
        default_model: body.default_model.trim(),
        domain: body.domain ?? null,
```

and add `domain` to that handler's `.select(...)` so the created row echoes it:

```ts
        .select("id, provider, display_name, base_url, default_model, domain, is_active, is_default, created_at")
```

- [ ] **Step 9: Persist `domain` on PATCH**

In the `PATCH` handler, immediately after the `body` is parsed and before the existing-row lookup, validate:

```ts
      const domainErr = validateDomain(body.domain);
      if (domainErr) {
        return new Response(JSON.stringify({ error: domainErr }), { status: 400, headers: jsonHeaders });
      }
```

Then in the `updates` object, add alongside the other optional fields:

```ts
      if (body.domain !== undefined) updates.domain = body.domain ?? null;
```

and add `domain` to both `.select(...)` strings in that handler:

```ts
          .select("id, provider, display_name, base_url, default_model, domain, is_active, is_default, updated_at, last_used_at")
```

- [ ] **Step 10: Update the trailing logger label**

The `serveWithLogger` call closes with its function name as the second argument (~line 283):

```ts
}, "markets-llm-config");
```

Change to:

```ts
}, "llm-provider-config");
```

Also update the `logger.error("markets-llm-config unhandled", ...)` call just above it to `"llm-provider-config unhandled"`.

- [ ] **Step 11: Confirm no stale references remain**

```bash
grep -rn "markets-llm-config" supabase/ src/ services/ || echo "CLEAN"
```

Expected at this point: matches in `src/features/markets/hooks/useLlmConfigs.ts` only (Task 4 fixes those). No matches under `supabase/`.

- [ ] **Step 12: Type check**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add supabase/functions/llm-provider-config supabase/functions/main/function_importers.ts
git commit -m "feat(llm-provider-config): rename from markets-llm-config, accept domain

The function was always table-generic; only its name was module-specific.
Adds domain accept/validate/return on POST/PATCH/GET, validated against
the same five values as the CHECK constraint. Stays absent from
config.toml and VERIFY_JWT_MAP so the main router keeps requiring a JWT.
Corrects the header comment, which described DELETE as a soft delete
while the handler does a hard delete."
```

---

## Task 4: Frontend — move, split, and add the domain axis

**Files:**
- Create: the ten files under `src/features/admin/llm-providers/` listed in File Structure
- Delete: `src/features/markets/pages/LlmSettingsPage.tsx`, `src/features/markets/hooks/useLlmConfigs.ts`, `src/features/markets/hooks/useProviderModels.ts`
- Modify: `src/features/markets/types.ts`, `src/features/markets/index.ts`

**Interfaces:**
- Consumes: the `llm-provider-config` endpoint from Task 3, including the `domain` field on every returned row.
- Produces:
  - `LlmDomain = "markets" | "logistics" | "comms" | "ops" | "security"` and `LLM_DOMAINS: readonly LlmDomain[]` from `constants.ts`
  - `LlmProviderConfig` with `domain: LlmDomain | null` from `types.ts`
  - `useLlmConfigs()`, `useSaveLlmConfig()`, `useDeleteLlmConfig()`, `defaultModelFor(provider: string): string` from `hooks/useLlmConfigs.ts`
  - `DomainSection` (props below) and `LlmProviderSettingsPage` (default export), both consumed by Task 5.

- [ ] **Step 1: Move the files with history preserved**

```bash
mkdir -p src/features/admin/llm-providers/{pages,components,hooks,__tests__}
git mv src/features/markets/hooks/useLlmConfigs.ts     src/features/admin/llm-providers/hooks/useLlmConfigs.ts
git mv src/features/markets/hooks/useProviderModels.ts src/features/admin/llm-providers/hooks/useProviderModels.ts
git mv src/features/markets/pages/LlmSettingsPage.tsx  src/features/admin/llm-providers/pages/LlmProviderSettingsPage.tsx
```

- [ ] **Step 2: Create `types.ts`**

Cut the LLM type block from `src/features/markets/types.ts` (the `LlmProviderKind` union at line 67 through the end of `UpdateLlmConfigInput`) into a new `src/features/admin/llm-providers/types.ts`, adding `domain` to the three shapes:

```ts
/**
 * LLM provider configuration types.
 *
 * `domain` is the gateway task-ID prefix a config serves. `null` means the
 * tenant-wide default, used by any domain without a config of its own.
 */

/**
 * `LlmDomain` lives here rather than in constants.ts so the dependency runs
 * one way: constants.ts imports types, never the reverse. LLM_DOMAINS in
 * constants.ts is typed `readonly LlmDomain[]` against this union.
 */
export type LlmDomain = "markets" | "logistics" | "comms" | "ops" | "security";

export type LlmProviderKind =
  | "anthropic"
  | "openai"
  | "openrouter"
  | "gemini"
  | "local-qwen"
  | "custom";

export interface LlmProviderConfig {
  id: string;
  tenant_id: string;
  provider: LlmProviderKind;
  display_name: string;
  base_url: string | null;
  default_model: string;
  domain: LlmDomain | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface CreateLlmConfigInput {
  provider: LlmProviderKind;
  display_name: string;
  default_model: string;
  api_key: string;
  base_url?: string | null;
  is_default?: boolean;
  domain?: LlmDomain | null;
}

export interface UpdateLlmConfigInput {
  display_name?: string;
  default_model?: string;
  base_url?: string | null;
  is_active?: boolean;
  is_default?: boolean;
  api_key?: string;
  domain?: LlmDomain | null;
}
```

Then replace the removed block in `src/features/markets/types.ts` with a re-export, so intra-markets imports keep working:

```ts
// ─── LLM provider configs ──────────────────────────────────────────────
// Moved to features/admin/llm-providers (platform-wide, not markets-scoped).
// Re-exported here for the markets barrel's existing consumers.
export type {
  LlmProviderKind,
  LlmProviderConfig,
  CreateLlmConfigInput,
  UpdateLlmConfigInput,
} from "@/features/admin/llm-providers/types";
```

- [ ] **Step 3: Create `constants.ts`**

Move `PROVIDER_LABELS` (line 80) and `PROVIDER_HINT` (line 89) out of the page file verbatim, move `GEMINI_KNOWN_MODELS` and `GEMINI_CUSTOM_SENTINEL` (lines 105-113) verbatim, and add the domain constants:

```ts
import type { LlmDomain, LlmProviderKind } from "./types";

/**
 * Gateway domains — the task-ID prefixes in LlmTaskId
 * (supabase/functions/_shared/llm-gateway.ts). This list must stay identical
 * to the SQL CHECK constraint on platform.llm_provider_configs.domain and to
 * VALID_DOMAINS in the llm-provider-config edge function.
 *
 * Fixed order: this is the order the settings page renders its sections in.
 */
export const LLM_DOMAINS: readonly LlmDomain[] =
  ["markets", "logistics", "comms", "ops", "security"] as const;

/** Gateway routing keys are not the vocabulary users see elsewhere. */
export const DOMAIN_LABELS: Record<LlmDomain, string> = {
  markets:   "Markets",
  logistics: "Logistics",
  comms:     "Communications",
  ops:       "Automation & Agents",
  security:  "Security",
};

export const DOMAIN_DESCRIPTIONS: Record<LlmDomain, string> = {
  markets:   "Briefs, sentiment, research, strategy explanations",
  logistics: "Quotes, invoice extraction, demand narratives, transport mode",
  comms:     "Smart replies and message drafting",
  ops:       "Agent planning",
  security:  "Email threat analysis",
};

// PROVIDER_LABELS, PROVIDER_HINT, GEMINI_KNOWN_MODELS, GEMINI_CUSTOM_SENTINEL
// follow here, moved verbatim from the old page file.
```

Keep the existing `Record<LlmProviderKind, string>` annotations on the two provider maps.

- [ ] **Step 4: Update the hooks**

In `hooks/useLlmConfigs.ts`: change the three endpoint strings from `markets-llm-config` to `llm-provider-config`, change the import `from "../types"` to `from "../types"` (unchanged — the file moved with its sibling), remove the now-unused `import { marketsKeys } from "./queryKeys";`, and change the query key off the markets namespace:

```ts
    queryKey: ["llm-providers", "configs", { tenantId }] as const,
```

and both invalidations:

```ts
      queryClient.invalidateQueries({ queryKey: ["llm-providers", "configs"] });
```

Update the file's header comment, replacing "Markets — LLM provider configs (per-tenant)." with:

```ts
/**
 * LLM provider configs — per tenant, per domain.
 *
 * Hooks for tenant_admin / franchise_admin / platform_admin to manage which
 * provider + API key the LLM Gateway uses for each domain's workloads. A
 * config with domain === null is the tenant-wide default.
 */
```

In `hooks/useProviderModels.ts`: change `import type { LlmProviderKind } from "../types";` — the relative path is unchanged after the move, so this file needs no edit. Confirm with `npm run typecheck` in Step 9.

- [ ] **Step 5: Extract the components**

Create three files by moving code out of `pages/LlmProviderSettingsPage.tsx` verbatim, adding imports and an `export` to each:

`components/ProviderCard.tsx` — the `LlmConfigRow` function (old lines 210-306), renamed to `ProviderCard`. Its props are unchanged from the original:

```tsx
export function ProviderCard({
  config,
  onEdit,
}: {
  config: LlmProviderConfig;
  onEdit: () => void;
}) {
  // body moved verbatim from LlmConfigRow (old lines 219-306), including its
  // internal useSaveLlmConfig() / useDeleteLlmConfig() calls.
}
```

The card already calls `useDeleteLlmConfig()` internally and renders a `Trash2`
delete control — that control **is** the spec's "revert to inheriting" action, because
deleting a domain's row makes that domain fall back to the tenant default. Do not
add a second control. On a card whose `config.domain !== null`, relabel the
existing delete action to "Remove — revert to platform default" and leave the
mutation it calls unchanged. Keep the plain "Delete" label when
`config.domain === null`, where there is nothing to fall back to.

Import the design-system primitives from `@/design-system` (the barrel this
codebase uses), not `@/components/ui`.

`components/ProviderFormSheet.tsx` — the `FormValues` interface and `LlmConfigForm` function (old lines 307-543), renamed to `ProviderFormSheet`. Add one prop so the form knows which domain it is creating for:

```tsx
export interface ProviderFormSheetProps {
  /** Existing config to edit, or null to create. */
  editing: LlmProviderConfig | null;
  /** Domain pre-selected when creating. null = tenant-wide default. */
  defaultDomain: LlmDomain | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

Inside, seed react-hook-form's `domain` field from `editing?.domain ?? defaultDomain`, and render a `Select` for it above the provider field:

```tsx
<Select
  value={form.watch("domain") ?? "__default__"}
  onValueChange={(v) => form.setValue("domain", v === "__default__" ? null : (v as LlmDomain))}
>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="__default__">Platform default (all domains)</SelectItem>
    {LLM_DOMAINS.map((d) => (
      <SelectItem key={d} value={d}>{DOMAIN_LABELS[d]}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

Add `domain: LlmDomain | null` to `FormValues`, and include it in the payload passed to `useSaveLlmConfig`.

`components/ModelPickers.tsx` — `GeminiModelPicker` (old lines 544-603), `OpenRouterModelPicker` (604-774), and `formatContext` (775-779), all moved verbatim and exported. `formatContext` stays module-private (no `export`) since only the pickers use it.

- [ ] **Step 6: Write the failing test for `DomainSection`**

Create `src/features/admin/llm-providers/__tests__/DomainSection.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DomainSection } from "../components/DomainSection";
import type { LlmProviderConfig } from "../types";

function cfg(over: Partial<LlmProviderConfig> = {}): LlmProviderConfig {
  return {
    id: "c1",
    tenant_id: "t1",
    provider: "anthropic",
    display_name: "Primary",
    base_url: null,
    default_model: "claude-sonnet-4-5",
    domain: null,
    is_active: true,
    is_default: true,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    last_used_at: null,
    ...over,
  };
}

describe("DomainSection", () => {
  it("names the inherited provider when the domain has no config of its own", () => {
    render(
      <DomainSection
        domain="logistics"
        configs={[]}
        inheritedFrom={cfg()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText("Logistics")).toBeInTheDocument();
    expect(screen.getByText(/Inherits platform default/i)).toBeInTheDocument();
    expect(screen.getByText(/claude-sonnet-4-5/)).toBeInTheDocument();
  });

  it("renders the domain's own config instead of the inherited state", () => {
    render(
      <DomainSection
        domain="markets"
        configs={[cfg({ id: "c2", domain: "markets", provider: "openai", default_model: "gpt-4o-mini" })]}
        inheritedFrom={cfg()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText(/gpt-4o-mini/)).toBeInTheDocument();
    expect(screen.queryByText(/Inherits platform default/i)).not.toBeInTheDocument();
  });

  it("tells the user nothing is configured when there is no inherited default either", () => {
    render(
      <DomainSection
        domain="ops"
        configs={[]}
        inheritedFrom={null}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText(/No provider configured/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

```bash
npx vitest run src/features/admin/llm-providers/__tests__/DomainSection.test.tsx
```

Expected: FAIL — cannot resolve `../components/DomainSection`.

- [ ] **Step 8: Implement `DomainSection`**

Create `src/features/admin/llm-providers/components/DomainSection.tsx`:

```tsx
import { Plus } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/design-system";
import { ProviderCard } from "./ProviderCard";
import { DOMAIN_DESCRIPTIONS, DOMAIN_LABELS } from "../constants";
import type { LlmDomain, LlmProviderConfig } from "../types";

export interface DomainSectionProps {
  /** null renders the tenant-wide default section. */
  domain: LlmDomain | null;
  /** Configs whose domain matches this section. */
  configs: LlmProviderConfig[];
  /** The tenant-wide default, shown when this domain has no config. */
  inheritedFrom: LlmProviderConfig | null;
  onAdd: (domain: LlmDomain | null) => void;
  onEdit: (config: LlmProviderConfig) => void;
}

export function DomainSection({
  domain,
  configs,
  inheritedFrom,
  onAdd,
  onEdit,
}: DomainSectionProps) {
  const title = domain ? DOMAIN_LABELS[domain] : "Platform default";
  const description = domain
    ? DOMAIN_DESCRIPTIONS[domain]
    : "Used by any domain without a provider of its own.";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onAdd(domain)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Add provider
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {configs.length > 0 ? (
          configs.map((cfg) => (
            <ProviderCard key={cfg.id} config={cfg} onEdit={() => onEdit(cfg)} />
          ))
        ) : inheritedFrom ? (
          <p className="text-sm text-muted-foreground">
            Inherits platform default — {inheritedFrom.provider} / {inheritedFrom.default_model}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No provider configured. Calls for this domain will fall back to the
            server's environment configuration.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 9: Run the test to verify it passes**

```bash
npx vitest run src/features/admin/llm-providers/__tests__/DomainSection.test.tsx
npm run typecheck
```

Expected: 3 tests PASS, typecheck PASS.

- [ ] **Step 10: Rewrite the page shell**

Replace the body of `pages/LlmProviderSettingsPage.tsx` (what remains after Step 5's extractions) with a shell that groups configs by domain. Rename the default export to `LlmProviderSettingsPage` and replace the markets-branded header and empty-state copy:

```tsx
export default function LlmProviderSettingsPage() {
  const configs = useLlmConfigs();
  const [editing, setEditing] = useState<LlmProviderConfig | null>(null);
  const [createFor, setCreateFor] = useState<LlmDomain | null | undefined>(undefined);

  const byDomain = useMemo(() => {
    const rows = configs.data ?? [];
    return {
      platformDefault: rows.filter((c) => c.domain === null),
      forDomain: (d: LlmDomain) => rows.filter((c) => c.domain === d),
      inherited: rows.find((c) => c.domain === null && c.is_default) ?? null,
    };
  }, [configs.data]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            LLM Providers
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Choose which LLM provider and API key each part of the platform uses.
            A domain without its own provider falls back to the platform default.
            Keys are stored encrypted in Supabase Vault and never returned to the
            browser.
          </p>
        </header>

        {configs.isPending && (
          <div className="space-y-2 rounded-lg border p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonRow key={i} columns={4} />
            ))}
          </div>
        )}

        {configs.isError && (
          <ErrorState
            title="Failed to load LLM configs"
            message={configs.error?.message ?? "Unknown error"}
            onRetry={() => configs.refetch()}
          />
        )}

        {configs.isSuccess && (
          <div className="space-y-4">
            <DomainSection
              domain={null}
              configs={byDomain.platformDefault}
              inheritedFrom={null}
              onAdd={setCreateFor}
              onEdit={setEditing}
            />
            {LLM_DOMAINS.map((d) => (
              <DomainSection
                key={d}
                domain={d}
                configs={byDomain.forDomain(d)}
                inheritedFrom={byDomain.inherited}
                onAdd={setCreateFor}
                onEdit={setEditing}
              />
            ))}
          </div>
        )}

        <ProviderFormSheet
          editing={editing}
          defaultDomain={createFor ?? null}
          open={editing !== null || createFor !== undefined}
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
              setCreateFor(undefined);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
}
```

`createFor` uses `undefined` for "sheet closed" so that `null` remains a meaningful value — "create a platform-default config". Do not collapse the two.

- [ ] **Step 11: Create the barrel**

Create `src/features/admin/llm-providers/index.ts`:

```ts
export * from "./types";
export * from "./constants";
export { useLlmConfigs, useSaveLlmConfig, useDeleteLlmConfig, defaultModelFor } from "./hooks/useLlmConfigs";
export { useProviderModels } from "./hooks/useProviderModels";
export { DomainSection } from "./components/DomainSection";
export { default as LlmProviderSettingsPage } from "./pages/LlmProviderSettingsPage";
```

Update `src/features/markets/index.ts` lines 12-16 to re-export from the new location instead of the deleted local hooks:

```ts
export {
  useLlmConfigs,
  useSaveLlmConfig,
  useDeleteLlmConfig,
  defaultModelFor,
} from "@/features/admin/llm-providers";
```

- [ ] **Step 12: Confirm no stale endpoint references remain**

```bash
grep -rn "markets-llm-config" src/ supabase/ services/ || echo "CLEAN"
```

Expected: `CLEAN`.

- [ ] **Step 13: Type check and run the module's tests**

```bash
npm run typecheck
npx vitest run src/features/admin/llm-providers
```

Expected: both PASS.

- [ ] **Step 14: Commit**

```bash
git add src/features/admin/llm-providers src/features/markets
git commit -m "feat(llm-providers): move settings out of markets and add domain sections

Moves the 779-line markets-scoped settings page into a bounded
features/admin/llm-providers module, split along its existing seams
(page shell, provider card, form sheet, model pickers, constants).
Adds DomainSection, which renders each domain's own config or names the
platform default it inherits, so the effective provider is always visible
without inferring it. markets/types.ts and markets/index.ts re-export for
existing intra-markets consumers."
```

---

## Task 5: Routes and navigation

**Files:**
- Modify: `src/App.tsx` (lines 280, 317, 704, 1276)
- Modify: `src/config/navigation.ts`
- Test: `src/features/admin/llm-providers/__tests__/LlmProviderSettingsPage.test.tsx`

**Interfaces:**
- Consumes: `LlmProviderSettingsPage` (default export) from `src/features/admin/llm-providers/pages/LlmProviderSettingsPage.tsx`, and `LLM_DOMAINS` / `DOMAIN_LABELS` from Task 4's `constants.ts`.
- Produces: nothing consumed by later tasks (final task).

- [ ] **Step 1: Write the failing test for section order and add-button wiring**

Create `src/features/admin/llm-providers/__tests__/LlmProviderSettingsPage.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import LlmProviderSettingsPage from "../pages/LlmProviderSettingsPage";
import type { LlmProviderConfig } from "../types";

vi.mock("@/components/layout/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const tenantDefault: LlmProviderConfig = {
  id: "c1",
  tenant_id: "t1",
  provider: "anthropic",
  display_name: "Primary",
  base_url: null,
  default_model: "claude-sonnet-4-5",
  domain: null,
  is_active: true,
  is_default: true,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  last_used_at: null,
};

vi.mock("../hooks/useLlmConfigs", () => ({
  useLlmConfigs: () => ({
    data: [tenantDefault],
    isPending: false,
    isError: false,
    isSuccess: true,
    error: null,
    refetch: vi.fn(),
  }),
  useSaveLlmConfig: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteLlmConfig: () => ({ mutate: vi.fn(), isPending: false }),
  defaultModelFor: () => "claude-sonnet-4-5",
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LlmProviderSettingsPage />
    </QueryClientProvider>,
  );
}

describe("LlmProviderSettingsPage", () => {
  it("renders the platform default first, then the five domains in order", () => {
    renderPage();
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual([
      "Platform default",
      "Markets",
      "Logistics",
      "Communications",
      "Automation & Agents",
      "Security",
    ]);
  });

  it("shows every domain inheriting the tenant default", () => {
    renderPage();
    expect(screen.getAllByText(/Inherits platform default/i)).toHaveLength(5);
  });

  it("does not describe the page as markets-specific", () => {
    renderPage();
    expect(screen.queryByText(/markets domain/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Markets-domain/i)).not.toBeInTheDocument();
  });
});
```

If `CardTitle` does not render as an `h3`, adjust the `getAllByRole` level in the first test to match what it does render — check with `screen.debug()` rather than guessing.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/features/admin/llm-providers/__tests__/LlmProviderSettingsPage.test.tsx
```

Expected: FAIL. Before Task 5's route work this may already pass if Task 4 is complete — that is acceptable; it is a regression guard for the copy change. If it fails on heading level, fix the assertion per Step 1's note.

- [ ] **Step 3: Remove the alias and repoint the platform route**

In `src/App.tsx`, delete line 317 and its comment:

```ts
// Platform-wide LLM provider settings — same component, reachable from main settings hub.
const PlatformLlmSettings = MarketsLlmSettings;
```

Replace the markets lazy import at line 280:

```ts
const MarketsLlmSettings        = lazy(() => import("./features/markets/pages/LlmSettingsPage"));
```

with:

```ts
const LlmProviderSettings = lazy(() => import("./features/admin/llm-providers/pages/LlmProviderSettingsPage"));
```

At line 704, change `<PlatformLlmSettings />` to `<LlmProviderSettings />`.

- [ ] **Step 4: Redirect the markets route**

At line 1276, replace:

```tsx
<Route path="/dashboard/markets/settings/llm" element={<ProtectedRoute requiredModule="markets"><MarketsLlmSettings /></ProtectedRoute>} />
```

with:

```tsx
{/* Moved to the platform-wide settings hub; kept so the old URL still resolves. */}
<Route path="/dashboard/markets/settings/llm" element={<Navigate to="/dashboard/settings/llm-providers" replace />} />
```

Confirm `Navigate` is imported from `react-router-dom` at the top of the file; add it to the existing import if absent.

- [ ] **Step 5: Add the missing navigation entry**

In `src/config/navigation.ts`, add an entry to the Settings section. Match the shape of the existing LLM Gateway entry at line 350:

```ts
{ name: 'LLM Providers', path: '/dashboard/settings/llm-providers', icon: Sparkles, description: 'Choose the LLM provider and API key each domain uses', roles: ['tenant_admin', 'franchise_admin', 'platform_admin'] },
```

`Sparkles` is already imported in this file for the LLM Gateway entry — reuse it rather than adding an import.

- [ ] **Step 6: Verify nothing still references the removed identifiers**

```bash
grep -n "MarketsLlmSettings\|PlatformLlmSettings" src/App.tsx || echo "CLEAN"
grep -rn "features/markets/pages/LlmSettingsPage" src/ || echo "CLEAN"
```

Expected: `CLEAN` from both.

- [ ] **Step 7: Run the full check**

```bash
npm run typecheck
npx vitest run src/features/admin/llm-providers
npm run lint
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/config/navigation.ts src/features/admin/llm-providers/__tests__
git commit -m "feat(llm-providers): mount platform settings page and add nav entry

Removes the PlatformLlmSettings = MarketsLlmSettings alias that served
markets copy on the platform route. /dashboard/settings/llm-providers now
renders the domain-scoped page, the old markets URL redirects to it, and
the route finally has a navigation entry — it was previously unreachable
from the menu."
```

---

## Verification summary

After all five tasks:

```bash
npm run typecheck
npm run lint
npx vitest run src/features/admin/llm-providers
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/tests/llm_provider_configs_domain.assertions.sql
grep -rn "markets-llm-config" src/ supabase/ services/ || echo "CLEAN"
```

Success criteria from the spec, and where each is met:

| Criterion | Task |
| --- | --- |
| Different providers for markets and logistics; `resolveConfig` routes each domain's tasks to its own provider | 1, 2 (SQL assertions A1/A2) |
| A domain with no config resolves to the tenant default, and the UI states which provider that is | 1 (A2), 4 (DomainSection test 1) |
| LLM provider settings reachable from the navigation menu | 5 (Step 5) |
| No page describes platform-wide LLM configuration as markets-specific | 4 (Step 10), 5 (page test 3) |
| Existing single-provider tenants see no behaviour change | 1 (nullable column, no backfill; A2 proves fallback) |
| `npm run typecheck` passes and the SQL assertions hold | Verification summary above |

## Not in this plan

- **Deployment.** No Coolify calls, no bind-mount updates, no production migration. The spec's deployment notes stand as context for a separate, explicitly authorised cutover.
- **`LlmGatewayAdminPage`'s hardcoded 503** — audit sub-project B; requires deciding the fate of the undeployed `services/llm-gateway` first.
- **The `platform.*` → `core.*` lift** — separate project; inherits the `domain` column when it runs.
- **Per-task overrides** — three-level precedence for an unstated need. YAGNI.
- **The vLLM credential** — unresolved separately and orthogonal to configuration being expressible.
