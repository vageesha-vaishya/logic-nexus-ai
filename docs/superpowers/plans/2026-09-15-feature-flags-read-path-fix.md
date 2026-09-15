# Feature Flags Read Path Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/dashboard/settings/feature-flags` actually control real app
behavior, by building the missing `feature-flags` edge function and fixing
the caller bug that currently makes every flag silently use its hardcoded
local default — while guaranteeing zero visible behavior change on the day
this ships, and fixing two independently-discovered bugs the investigation
surfaced along the way.

**Architecture:** One new edge function (`supabase/functions/feature-flags`)
wraps the existing `platform.resolve_flags` SQL RPC for public reads and
gates admin list/upsert behind a `platform_admin` check, following this
repo's established edge-function pattern. A seed migration grants the
missing table privileges, hardens `resolve_flags`'s search_path, and inserts
rows matching every affected call site's *current* behavior exactly. Three
small frontend fixes close the loop: the one-line caller bug, a fail-safe
(not fail-`false`) fetch-catch, and a genuinely separate read-bug in two
Lead pages.

**Tech Stack:** React 18 + TypeScript + TanStack Query (frontend), Deno edge
functions + PostgreSQL/Supabase (backend), vitest (all tests — this repo
tests edge functions with vitest, not Deno test).

## Global Constraints

- No task in this plan applies the seed migration or deploys the edge
  function to any live database or instance — local or self-hosted. Both
  are written, tested, reviewed artifacts only.
- No task runs `npm run supabase:db:push`, `scripts/supabase-exec.sh`, a
  Supabase CLI deploy command, or any other command that writes schema or
  function code to a live instance.
- Every seeded flag's `enabled` value must exactly match that flag's
  *actual current production behavior* (not necessarily its nominal
  `defaultValue` argument — see Task 1's `lead_three_section_layout` row,
  which is `true` because of the Task 4 bug, not `false`).
- `platform.resolve_flags` is called via `.schema('platform').rpc(...)` —
  never a bare `.rpc(...)`, which targets `public` and 404s.
- Secrets convention: no new secrets are needed by this work. If any
  environment value is required during implementation, it goes in the
  gitignored repo-root `env` file, never in a report or doc file.
- Full spec: `docs/superpowers/specs/2026-09-15-feature-flags-read-path-fix-design.md`.

---

### Task 1: Seed migration — grants, hardening, seed rows, smoke test

**Files:**
- Create: `supabase/migrations/20260915120000_seed_app_feature_flags.sql`
- Create: `supabase/tests/feature_flags_seed.sql`
- Modify: `supabase/tests/README.md` (add one manifest row)

**Interfaces:**
- Consumes: `platform.feature_flags`, `platform.feature_flag_overrides`,
  `platform.resolve_flags(p_keys text[], p_tenant_id uuid, p_user_id uuid,
  p_franchise_id uuid) RETURNS jsonb` — all defined in
  `supabase/migrations/20260516080945_platform_feature_flags.sql`, unchanged
  except for the `SET search_path` addition below.
- Produces: 10 rows in `platform.feature_flags` (keys below) that Task 2's
  edge function and Task 3/4's frontend fixes depend on for their
  before/after behavior to actually match. **Not applied to any database by
  this task** — a written, reviewed SQL artifact only.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260915120000_seed_app_feature_flags.sql
--
-- Fixes the feature-flags read path (docs/investigation/
-- FEATURE_FLAGS_READ_PATH_BROKEN.md, docs/superpowers/specs/
-- 2026-09-15-feature-flags-read-path-fix-design.md). Three things:
--
-- 1. platform.feature_flags / platform.feature_flag_overrides have RLS
--    policies but NO table-level GRANTs anywhere in their migration
--    history -- table privileges are checked before RLS, so the existing
--    "anyone_read_flags USING (true)" policy is currently decorative for
--    direct table access, and the admin list/upsert path (which reads/
--    writes the table directly via a service-role client, not through
--    resolve_flags) would hit "permission denied for table feature_flags"
--    without this.
-- 2. platform.resolve_flags is SECURITY DEFINER with a mutable search_path
--    (Supabase's own advisor flags this). It's being promoted to back a
--    public, unauthenticated endpoint by this fix, which is the point at
--    which that gets hardened.
-- 3. None of the app's FEATURE_FLAGS.* keys (src/lib/feature-flags.ts)
--    have rows in platform.feature_flags except ux_feedback_widget
--    (seeded by 20260915000000_create_ux_feedback.sql). Every resolved
--    value below is chosen to exactly match that key's CURRENT real
--    production behavior -- see the design spec's "Two independently-
--    discovered bugs" section for why lead_three_section_layout is `true`
--    and not its nominal `false` default.
--
-- Do not apply this to any database (local or self-hosted) without first
-- running the read-only inventory check in the design spec's "Pre-Deploy
-- Step" section -- if any of these keys already has a row, this
-- migration's ON CONFLICT DO NOTHING is a silent no-op and the existing
-- row wins.

-- ── 1. Grants ─────────────────────────────────────────────────────────────
-- The GET (public resolve) path goes through resolve_flags, which is
-- SECURITY DEFINER and runs as its owner -- it does not need these grants
-- to function. The POST (admin list/upsert) path reads/writes the table
-- directly via a service-role client and does need them. Granted to
-- anon/authenticated too so the RLS policies' stated intent ("anyone can
-- read") is actually true, matching how platform.llm_provider_configs was
-- granted.
GRANT SELECT ON platform.feature_flags TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON platform.feature_flags TO service_role;
GRANT SELECT ON platform.feature_flag_overrides TO anon, authenticated, service_role;

-- Defense-in-depth: no earlier migration REVOKEs this (grepped the full
-- migration tree), so PUBLIC almost certainly already has EXECUTE by
-- Postgres's default CREATE FUNCTION behavior -- this just removes any
-- doubt for whoever next reads this function's privileges.
GRANT EXECUTE ON FUNCTION platform.resolve_flags(text[], uuid, uuid, uuid)
  TO anon, authenticated, service_role;

-- ── 2. Harden resolve_flags: pin search_path ─────────────────────────────
-- Identical body to 20260516080945_platform_feature_flags.sql's original
-- definition -- only the SET search_path clause is new.
CREATE OR REPLACE FUNCTION platform.resolve_flags(
  p_keys      text[],
  p_tenant_id uuid DEFAULT NULL,
  p_user_id   uuid DEFAULT NULL,
  p_franchise_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = platform, public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  rec    record;
  val    boolean;
BEGIN
  FOR rec IN
    SELECT f.key, f.enabled, f.rollout_pct,
           (SELECT o.enabled
            FROM platform.feature_flag_overrides o
            WHERE o.flag_key = f.key
              AND (  (p_user_id      IS NOT NULL AND o.scope_type = 'user'      AND o.scope_id = p_user_id)
                  OR (p_tenant_id    IS NOT NULL AND o.scope_type = 'tenant'    AND o.scope_id = p_tenant_id)
                  OR (p_franchise_id IS NOT NULL AND o.scope_type = 'franchise' AND o.scope_id = p_franchise_id)
                  )
            ORDER BY CASE o.scope_type WHEN 'user' THEN 1 WHEN 'franchise' THEN 2 ELSE 3 END
            LIMIT 1
           ) AS override
    FROM platform.feature_flags f
    WHERE f.key = ANY(p_keys)
  LOOP
    IF rec.override IS NOT NULL THEN
      val := rec.override;
    ELSIF rec.enabled AND rec.rollout_pct < 100 THEN
      val := rec.enabled AND
             (abs(hashtext(rec.key || coalesce(p_tenant_id::text, 'global'))) % 100) < rec.rollout_pct;
    ELSE
      val := rec.enabled;
    END IF;
    result := result || jsonb_build_object(rec.key, val);
  END LOOP;

  DECLARE k text;
  BEGIN
    FOREACH k IN ARRAY p_keys LOOP
      IF NOT (result ? k) THEN
        result := result || jsonb_build_object(k, false);
      END IF;
    END LOOP;
  END;

  RETURN result;
END;
$$;

-- ── 3. Seed rows ──────────────────────────────────────────────────────────
-- enabled matches each key's CURRENT real behavior exactly (see file header
-- for the lead_three_section_layout note). rollout_pct=100 explicit on
-- every row -- at 100 the rollout branch above never evaluates, so this is
-- a hard guarantee, not a probabilistic one.
INSERT INTO platform.feature_flags (key, name, description, enabled, rollout_pct, tags) VALUES

  ('amro_rbac_fix_enabled',
   'AMRO RBAC Fix',
   'AMRO role-based access control fix. Consumed by CommandCenterNav.tsx.',
   true, 100, '{amro}'),

  ('hybrid_route_configuration_v1',
   'Hybrid Route Configuration V1',
   'Hybrid route configuration in rate fetching. Consumed by useRateFetching.ts.',
   true, 100, '{routing}'),

  ('quotation_import_export_v2',
   'Quotation Import/Export V2',
   'Quotation import/export v2 UI. Consumed by QuoteDetail.tsx, Quotes.tsx.',
   true, 100, '{quotation}'),

  ('hybrid_route_metrics_dashboard_v1',
   'Hybrid Route Metrics Dashboard V1',
   'Hybrid route metrics dashboard. Consumed by useRateFetching.ts.',
   false, 100, '{routing}'),

  ('domain_grouped_nav',
   'Domain-Grouped Navigation',
   'MV-3: replace legacy CommandCenterNav with domain-grouped sidebar. Consumed by AppSidebar.tsx.',
   false, 100, '{navigation}'),

  ('user_info_header_module',
   'User Info Header Module',
   'User info header module. Consumed by DashboardLayout.tsx.',
   false, 100, '{layout}'),

  ('user_info_header_dual_mode',
   'User Info Header Dual Mode',
   'User info header dual mode. Consumed by DashboardLayout.tsx.',
   false, 100, '{layout}'),

  ('composer_multi_leg_autofill',
   'Composer Multi-Leg Autofill',
   'Quotation composer multi-leg autofill. Consumed by LegsConfigurationStep.tsx.',
   false, 100, '{quotation}'),

  ('quotation_phase2_guards',
   'Quotation Phase 2 Guards',
   'Quotation phase 2 guards. Consumed by useQuoteRepository.ts.',
   false, 100, '{quotation}'),

  ('lead_three_section_layout',
   'Lead Three-Section Layout',
   'Three-section lead workspace layout. Consumed by LeadDetail.tsx, LeadNew.tsx. Seeded true: this has been rendering unconditionally in production due to a read bug fixed in the same change that makes this flag real (see docs/superpowers/specs/2026-09-15-feature-flags-read-path-fix-design.md, "Bug A") -- true preserves that exact current behavior.',
   true, 100, '{leads}')

ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Write the smoke test**

Follow `supabase/tests/ux_feedback_rls.sql`'s exact convention: self-contained
`DO $$ ... $$`, `RAISE EXCEPTION` assertions, run via
`scripts/run-supabase-smokes.sh`, never invoked automatically.

```sql
-- supabase/tests/feature_flags_seed.sql
--
-- Feature-flags seed smoke test. Run manually against a database with
-- 20260915120000_seed_app_feature_flags.sql applied -- local dev
-- (supabase db reset) or the self-hosted instance, never automatically.
-- Run with: npm run supabase:exec -- supabase/tests/feature_flags_seed.sql
-- Read-only: asserts against existing platform.feature_flags /
-- feature_flag_overrides rows, creates and deletes nothing.
--
-- Asserts:
--   A1. resolve_flags returns the expected value for each of the 10 seeded
--       keys (matching the call-site defaults table in the design spec).
--   A2. resolve_flags on an unknown key returns false.
--   A3. All 10 seeded rows have rollout_pct = 100.
--   A4. No row in platform.feature_flag_overrides references any of the
--       10 seeded keys -- this is the assertion that actually backs the
--       "byte-for-byte identical behavior" safety claim; nothing else
--       checks it.

DO $$
DECLARE
  v_result jsonb;
  v_count  integer;
  v_expected jsonb := jsonb_build_object(
    'amro_rbac_fix_enabled',             true,
    'hybrid_route_configuration_v1',     true,
    'quotation_import_export_v2',        true,
    'hybrid_route_metrics_dashboard_v1', false,
    'domain_grouped_nav',                false,
    'user_info_header_module',           false,
    'user_info_header_dual_mode',        false,
    'composer_multi_leg_autofill',       false,
    'quotation_phase2_guards',           false,
    'lead_three_section_layout',         true
  );
  k text;
BEGIN
  -- A1: resolve_flags matches the expected table, key by key.
  SELECT platform.resolve_flags(
    ARRAY(SELECT jsonb_object_keys(v_expected))
  ) INTO v_result;

  FOR k IN SELECT jsonb_object_keys(v_expected) LOOP
    IF (v_result -> k) IS DISTINCT FROM (v_expected -> k) THEN
      RAISE EXCEPTION 'A1 FAILED: % expected %, resolve_flags returned %',
        k, v_expected -> k, v_result -> k;
    END IF;
  END LOOP;

  -- A2: unknown key resolves to false.
  SELECT platform.resolve_flags(ARRAY['definitely_not_a_real_flag_key'])
    INTO v_result;
  IF (v_result -> 'definitely_not_a_real_flag_key') IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'A2 FAILED: unknown key should resolve to false, got %',
      v_result -> 'definitely_not_a_real_flag_key';
  END IF;

  -- A3: rollout_pct = 100 on every seeded row.
  SELECT count(*) INTO v_count
    FROM platform.feature_flags
    WHERE key = ANY(ARRAY(SELECT jsonb_object_keys(v_expected)))
      AND rollout_pct <> 100;
  IF v_count != 0 THEN
    RAISE EXCEPTION 'A3 FAILED: % seeded row(s) have rollout_pct != 100', v_count;
  END IF;

  -- A4: no override rows for any seeded key -- the check that actually
  -- backs the "byte-for-byte identical" claim.
  SELECT count(*) INTO v_count
    FROM platform.feature_flag_overrides
    WHERE flag_key = ANY(ARRAY(SELECT jsonb_object_keys(v_expected)));
  IF v_count != 0 THEN
    RAISE EXCEPTION 'A4 FAILED: % override row(s) exist for seeded keys -- the "byte-for-byte identical" claim does not hold; reconcile by hand before treating this seed as safe', v_count;
  END IF;

  RAISE NOTICE 'feature_flags_seed.sql: all assertions passed (A1-A4)';
END $$;
```

- [ ] **Step 3: Add a manifest row to `supabase/tests/README.md`**

Find the `## Suite manifest (27 tests)` table and add a row (update the count
in the heading to 28):

```markdown
| `feature_flags_seed.sql` | Feature flags read path fix | resolve_flags matches call-site defaults; no override rows shadow the seed |
```

- [ ] **Step 4: Verify SQL syntax without a database**

Since no database is available to apply this against in this environment,
verify syntactically instead:
```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('supabase/migrations/20260915120000_seed_app_feature_flags.sql','utf8'); const opens=(s.match(/\$\$/g)||[]).length; if(opens%2!==0) throw new Error('unbalanced \$\$ delimiters'); console.log('dollar-quote balance OK, length', s.length);"
node -e "const fs=require('fs'); const s=fs.readFileSync('supabase/tests/feature_flags_seed.sql','utf8'); const opens=(s.match(/\$\$/g)||[]).length; if(opens%2!==0) throw new Error('unbalanced \$\$ delimiters'); console.log('dollar-quote balance OK, length', s.length);"
```
Expected: both print "dollar-quote balance OK" with no error. Also
re-read both files once for typos against the code blocks above — no
automated linter covers `.sql` files in this repo.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260915120000_seed_app_feature_flags.sql supabase/tests/feature_flags_seed.sql supabase/tests/README.md
git commit -m "feat(feature-flags): grants, resolve_flags hardening, seed 10 flag rows"
```

---

### Task 2: The `feature-flags` edge function

**Files:**
- Create: `supabase/functions/feature-flags/index.ts`
- Test: `supabase/functions/feature-flags/index.test.ts`
- Modify: `supabase/config.toml` (add a `[functions.feature-flags]` block)

**Interfaces:**
- Consumes: `platform.resolve_flags` (Task 1), `serveWithLogger`,
  `getCorsHeaders`, `requireAuth` from `supabase/functions/_shared/`
  (unchanged, pre-existing).
- Produces: `GET .../functions/v1/feature-flags?keys=a,b&tenant_id=..&user_id=..`
  → `{ data: { flags: Record<string, boolean> } }`; `POST` body
  `{action:"list"}` → `{ ok: true, data: { flags: FlagRow[] } }`; `POST` body
  `{action:"upsert", key, name, enabled}` → `{ ok: true, data: { flag: FlagRow } }`
  where `FlagRow = { id, key, name, description, enabled, rollout_pct, tags, updated_at }`.
  Task 3 does not depend on this task's code (only on Task 1's DB state,
  once deployed) — `useFeatureFlags.ts`'s HTTP call shape is unchanged by
  this plan.

- [ ] **Step 1: Write the failing test**

Follow `supabase/functions/generate-aircraft-tasks/index.test.ts`'s
convention exactly: mock `_shared/logger.ts` to capture the handler,
`_shared/cors.ts` for headers, and `_shared/auth.ts`'s `requireAuth`.

```typescript
// supabase/functions/feature-flags/index.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

type EdgeHandler = (
  req: Request,
  logger: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> },
  supabase: {
    schema: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
  },
) => Promise<Response>;

let capturedHandler: EdgeHandler | null = null;
const requireAuthMock = vi.fn();

vi.mock("../_shared/logger.ts", () => ({
  serveWithLogger: (handler: EdgeHandler) => {
    capturedHandler = handler;
  },
}));

vi.mock("../_shared/cors.ts", () => ({
  getCorsHeaders: () => ({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  }),
}));

vi.mock("../_shared/auth.ts", () => ({
  requireAuth: requireAuthMock,
}));

function loggerMock() {
  return {
    info: vi.fn(async () => undefined),
    error: vi.fn(async () => undefined),
  };
}

function schemaSupabaseMock(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { schema: vi.fn(() => ({ rpc })), rpc };
}

function tableSupabaseMock(opts: {
  userRoleRow?: { role: string } | null;
  listData?: unknown[];
  listError?: unknown;
  updateData?: unknown;
  updateError?: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: opts.userRoleRow ?? null,
    error: null,
  });
  const order = vi.fn().mockResolvedValue({
    data: opts.listData ?? [],
    error: opts.listError ?? null,
  });
  const selectSingle = vi.fn().mockResolvedValue({
    data: opts.updateData ?? null,
    error: opts.updateError ?? null,
  });
  const eqChainForRoleCheck = { eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) };
  const from = vi.fn((table: string) => {
    if (table === "user_roles") {
      return { select: vi.fn(() => eqChainForRoleCheck) };
    }
    // platform.feature_flags direct table access for list/upsert
    return {
      select: vi.fn(() => ({ order })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ select: vi.fn(() => ({ single: selectSingle })) })),
      })),
    };
  });
  return { from };
}

describe("feature-flags edge function", () => {
  beforeEach(async () => {
    capturedHandler = null;
    requireAuthMock.mockReset();
    vi.resetModules();
    await import("./index.ts");
  });

  it("GET resolves flags via platform.resolve_flags and returns {data:{flags}}", async () => {
    const handler = capturedHandler as EdgeHandler;
    const supabase = schemaSupabaseMock({
      data: { amro_rbac_fix_enabled: true, domain_grouped_nav: false },
      error: null,
    });

    const res = await handler(
      new Request("https://example.com/feature-flags?keys=amro_rbac_fix_enabled,domain_grouped_nav"),
      loggerMock(),
      supabase as any,
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.flags).toEqual({ amro_rbac_fix_enabled: true, domain_grouped_nav: false });
    expect(supabase.schema).toHaveBeenCalledWith("platform");
    expect(supabase.rpc).toHaveBeenCalledWith("resolve_flags", expect.objectContaining({
      p_keys: ["amro_rbac_fix_enabled", "domain_grouped_nav"],
    }));
  });

  it("GET with missing keys returns 400", async () => {
    const handler = capturedHandler as EdgeHandler;
    const supabase = schemaSupabaseMock({ data: {}, error: null });

    const res = await handler(
      new Request("https://example.com/feature-flags"),
      loggerMock(),
      supabase as any,
    );

    expect(res.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("GET with more than 50 keys returns 400", async () => {
    const handler = capturedHandler as EdgeHandler;
    const supabase = schemaSupabaseMock({ data: {}, error: null });
    const manyKeys = Array.from({ length: 51 }, (_, i) => `k${i}`).join(",");

    const res = await handler(
      new Request(`https://example.com/feature-flags?keys=${manyKeys}`),
      loggerMock(),
      supabase as any,
    );

    expect(res.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("POST list with no Authorization header returns 401", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: null, error: "Missing Authorization header" });

    const res = await handler(
      new Request("https://example.com/feature-flags", {
        method: "POST",
        body: JSON.stringify({ action: "list" }),
      }),
      loggerMock(),
      {} as any,
    );

    expect(res.status).toBe(401);
  });

  it("POST list with auth but no platform_admin row returns 403", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "u1" }, error: null });
    const supabase = tableSupabaseMock({ userRoleRow: null });

    const res = await handler(
      new Request("https://example.com/feature-flags", {
        method: "POST",
        body: JSON.stringify({ action: "list" }),
      }),
      loggerMock(),
      supabase as any,
    );

    expect(res.status).toBe(403);
  });

  it("POST list with platform_admin returns all FlagRow fields", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "admin-1" }, error: null });
    const flagRow = {
      id: "id-1", key: "amro_rbac_fix_enabled", name: "AMRO RBAC Fix",
      description: "d", enabled: true, rollout_pct: 100, tags: ["amro"],
      updated_at: "2026-01-01T00:00:00Z",
    };
    const supabase = tableSupabaseMock({
      userRoleRow: { role: "platform_admin" },
      listData: [flagRow],
    });

    const res = await handler(
      new Request("https://example.com/feature-flags", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: JSON.stringify({ action: "list" }),
      }),
      loggerMock(),
      supabase as any,
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.flags).toEqual([flagRow]);
  });

  it("POST upsert against an unknown key returns 404", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "admin-1" }, error: null });
    const supabase = tableSupabaseMock({
      userRoleRow: { role: "platform_admin" },
      updateData: null,
      updateError: null,
    });

    const res = await handler(
      new Request("https://example.com/feature-flags", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: JSON.stringify({ action: "upsert", key: "nope", name: "Nope", enabled: true }),
      }),
      loggerMock(),
      supabase as any,
    );

    expect(res.status).toBe(404);
  });

  it("POST with an unrecognized action returns 400", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "admin-1" }, error: null });
    const supabase = tableSupabaseMock({ userRoleRow: { role: "platform_admin" } });

    const res = await handler(
      new Request("https://example.com/feature-flags", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: JSON.stringify({ action: "delete_everything" }),
      }),
      loggerMock(),
      supabase as any,
    );

    expect(res.status).toBe(400);
  });

  it("OPTIONS returns CORS headers with no auth check", async () => {
    const handler = capturedHandler as EdgeHandler;

    const res = await handler(
      new Request("https://example.com/feature-flags", { method: "OPTIONS" }),
      loggerMock(),
      {} as any,
    );

    expect(res.status).toBeLessThan(400);
    expect(requireAuthMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run supabase/functions/feature-flags/index.test.ts`
Expected: FAIL — cannot resolve `./index.ts`.

- [ ] **Step 3: Write the edge function**

```typescript
// supabase/functions/feature-flags/index.ts
//
// Public GET resolve (wraps platform.resolve_flags) + admin-gated POST
// list/upsert against platform.feature_flags. See
// docs/superpowers/specs/2026-09-15-feature-flags-read-path-fix-design.md.
import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

const MAX_KEYS = 50;

function json(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serveWithLogger(async (req, logger, supabase) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const keysParam = url.searchParams.get("keys");
      if (!keysParam) {
        return json({ error: "Missing 'keys' query parameter" }, 400, corsHeaders);
      }
      const keys = keysParam.split(",").map((k) => k.trim()).filter(Boolean);
      if (keys.length === 0) {
        return json({ error: "Missing 'keys' query parameter" }, 400, corsHeaders);
      }
      if (keys.length > MAX_KEYS) {
        return json({ error: `Too many keys (max ${MAX_KEYS})` }, 400, corsHeaders);
      }

      const tenantId = url.searchParams.get("tenant_id");
      const userId = url.searchParams.get("user_id");

      const { data, error } = await supabase.schema("platform").rpc("resolve_flags", {
        p_keys: keys,
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_franchise_id: null,
      });

      if (error) {
        logger.error("resolve_flags failed", { error: error.message });
        return json({ error: error.message }, 500, corsHeaders);
      }

      return json({ data: { flags: data ?? {} } }, 200, corsHeaders);
    }

    if (req.method === "POST") {
      const { user, error: authError } = await requireAuth(req);
      if (authError || !user) {
        return json({ error: "Unauthorized" }, 401, corsHeaders);
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "platform_admin")
        .maybeSingle();
      if (!roleData) {
        return json({ ok: false, error: "Forbidden: platform_admin required" }, 403, corsHeaders);
      }

      const body = await req.json();
      const action = body?.action;

      if (action === "list") {
        const { data, error } = await supabase
          .from("feature_flags")
          .select("id, key, name, description, enabled, rollout_pct, tags, updated_at")
          .order("key");
        if (error) {
          logger.error("list failed", { error: error.message });
          return json({ ok: false, error: error.message }, 500, corsHeaders);
        }
        return json({ ok: true, data: { flags: data ?? [] } }, 200, corsHeaders);
      }

      if (action === "upsert") {
        const key = body?.key;
        const name = body?.name;
        const enabled = body?.enabled;
        if (!key || typeof name !== "string" || typeof enabled !== "boolean") {
          return json({ ok: false, error: "Invalid payload" }, 400, corsHeaders);
        }
        const { data, error } = await supabase
          .from("feature_flags")
          .update({ name, enabled })
          .eq("key", key)
          .select("id, key, name, description, enabled, rollout_pct, tags, updated_at")
          .single();
        if (error) {
          if (error.code === "PGRST116") {
            return json({ ok: false, error: `Unknown flag key: ${key}` }, 404, corsHeaders);
          }
          logger.error("upsert failed", { error: error.message });
          return json({ ok: false, error: error.message }, 500, corsHeaders);
        }
        if (!data) {
          return json({ ok: false, error: `Unknown flag key: ${key}` }, 404, corsHeaders);
        }
        return json({ ok: true, data: { flag: data } }, 200, corsHeaders);
      }

      return json({ ok: false, error: `Unrecognized action: ${action}` }, 400, corsHeaders);
    }

    return json({ error: "Method not allowed" }, 405, corsHeaders);
  } catch (error: any) {
    logger.error("Unhandled error", { error: error?.message ?? String(error) });
    return json({ error: error?.message ?? "Internal Server Error" }, 500, corsHeaders);
  }
}, "feature-flags");
```

Note on the test's `tableSupabaseMock`: the `upsert` test case supplies
`updateData: null, updateError: null` to exercise the "no row matched" path
— real PostgREST `.single()` on zero rows returns `error.code === 'PGRST116'`
in practice; the handler above checks both that code and a null/absent
`data` so the test's simplified mock (which returns `null`/`null` rather
than constructing a real PGRST116 error object) still exercises the 404
branch via the `if (!data)` fallback. This is intentional — don't "fix" the
mock to match `PGRST116` unless the test itself is being revised.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run supabase/functions/feature-flags/index.test.ts`
Expected: 9 passed.

- [ ] **Step 5: Register the function in `supabase/config.toml`**

The ~85 existing `[functions.<name>]` blocks are alphabetically ordered
(confirmed: `[functions.admin-reset-password]` at line 200 through
`[functions.fleet-utilization]` at line 293 through the rest). Insert
immediately before `[functions.fleet-utilization]` (line 293):

```toml
[functions.feature-flags]
verify_jwt = false

```
(blank line after, matching the existing spacing between every other block)

This matters specifically for the GET path — `fetchFlagsFromEdge`
(`src/hooks/useFeatureFlags.ts`) sends only an `apikey` header, never
`Authorization`. Without `verify_jwt = false`, the edge runtime would
reject every GET request before the handler runs, at which point
`fetchFlagsFromEdge`'s catch block would fire on every single call — this
is the exact harm this whole fix exists to prevent, reproduced by a missing
config line.

- [ ] **Step 6: Lint**

Run: `npx eslint supabase/functions/feature-flags/index.ts supabase/functions/feature-flags/index.test.ts`
Expected: clean, or the same "file ignored" message this repo's other
`supabase/functions/*` files already get if `supabase/` is excluded from
ESLint's scope — check `eslint.config.*`'s ignore list first; either
outcome is fine, but confirm which one it is and record it in the report.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/feature-flags/index.ts supabase/functions/feature-flags/index.test.ts supabase/config.toml
git commit -m "feat(feature-flags): edge function — public resolve + admin-gated list/upsert"
```

---

### Task 3: Fix the caller bug and the fail-`false` catch

**Files:**
- Modify: `src/lib/feature-flags.ts:40`
- Modify: `src/hooks/useFeatureFlags.ts` (the `fetchFlagsFromEdge` catch block)
- Test: `src/lib/feature-flags.test.ts` (new)
- Test: `src/hooks/useFeatureFlags.test.ts` (new)

**Interfaces:**
- Consumes: `useFeatureFlags(keys: string[])` (unchanged signature).
- Produces: `useAppFeatureFlag(key, defaultValue)` now actually queries
  live flag state; `fetchFlagsFromEdge` now fails safe. No signature
  changes — every existing call site (Task 4's two included) keeps
  working unmodified.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/feature-flags.test.ts
import { describe, expect, it, vi } from 'vitest';

const useFeatureFlagsMock = vi.fn();

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlags: (keys?: string[]) => useFeatureFlagsMock(keys),
}));

import { useAppFeatureFlag, FEATURE_FLAGS } from './feature-flags';

describe('useAppFeatureFlag', () => {
  it('calls useFeatureFlags with an array containing the requested key', () => {
    useFeatureFlagsMock.mockReturnValue({
      isEnabled: () => false,
      isLoading: false,
      error: null,
    });

    useAppFeatureFlag(FEATURE_FLAGS.AMRO_RBAC_FIX_ENABLED, true);

    expect(useFeatureFlagsMock).toHaveBeenCalledWith(['amro_rbac_fix_enabled']);
  });

  it('falls back to defaultValue when the resolved flags do not include the key', () => {
    useFeatureFlagsMock.mockReturnValue({
      isEnabled: (key: string, defaultValue: boolean) => defaultValue,
      isLoading: false,
      error: null,
    });

    const { enabled } = useAppFeatureFlag(FEATURE_FLAGS.DOMAIN_GROUPED_NAV, true);

    expect(enabled).toBe(true);
  });
});
```

Note: `isFlagEnabled` (this module's non-React export) always returns
`false` on a failed fetch, both before and after Bug B's fix — it has no
`defaultValue` parameter of its own (`Boolean(result[key])`). Bug B's real,
observable effect is on `useAppFeatureFlag`'s `defaultValue` fallback,
which requires exercising the full `useFeatureFlags` React-Query path — so
the test below goes through `useFeatureFlags` directly via
`renderHook`, not through `isFlagEnabled`.

```typescript
// src/hooks/useFeatureFlags.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({ context: { tenantId: 'tenant-1' }, user: { id: 'user-1' } }),
}));

import { useFeatureFlags } from './useFeatureFlags';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useFeatureFlags', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('on a failed fetch, resolvedFlags stays empty so isEnabled falls back to the caller default (Bug B)', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useFeatureFlags(['some_flag_key']), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Before the fix: isEnabled('some_flag_key', true) would return false,
    // because the catch block put {some_flag_key: false} in resolvedFlags
    // (key present -> isEnabled never reaches the defaultValue branch).
    // After the fix: the catch returns {}, the key is absent, isEnabled
    // falls back to the caller's own default.
    expect(result.current.isEnabled('some_flag_key', true)).toBe(true);
    expect(result.current.isEnabled('some_flag_key', false)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/feature-flags.test.ts src/hooks/useFeatureFlags.test.ts`
Expected: the `useAppFeatureFlag` call-with-array test FAILs (currently
called with no arguments); the `useFeatureFlags` fail-safe test FAILs
(`isEnabled('some_flag_key', true)` currently returns `false`, not `true`).

- [ ] **Step 3: Fix `useAppFeatureFlag`**

In `src/lib/feature-flags.ts`, change:
```ts
export function useAppFeatureFlag(key: FeatureFlagKey, defaultValue: boolean = false) {
  const { isEnabled, isLoading, error } = useFeatureFlags();
```
to:
```ts
export function useAppFeatureFlag(key: FeatureFlagKey, defaultValue: boolean = false) {
  const { isEnabled, isLoading, error } = useFeatureFlags([key]);
```

- [ ] **Step 4: Fix the fetch failure fallback**

In `src/hooks/useFeatureFlags.ts`, in `fetchFlagsFromEdge`, change:
```ts
  } catch {
    // Graceful degradation: default all to false
    return Object.fromEntries(keys.map(k => [k, false]));
  }
```
to:
```ts
  } catch {
    // Fail-safe, not fail-false: an empty result means every key is
    // ABSENT from resolvedFlags, so isEnabled(key, defaultValue) falls
    // back to each caller's own default instead of forcing false. A
    // transient failure (cold start, timeout, 5xx) must never override a
    // call site whose default is `true`.
    return {};
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/feature-flags.test.ts src/hooks/useFeatureFlags.test.ts`
Expected: all passing.

- [ ] **Step 6: Run the existing suites that touch these files, to confirm no regression**

Run: `npx vitest run src/components/navigation/CommandCenterNav.test.tsx src/components/quotation/composer/LegsConfigurationStep.test.tsx`
(and any other test file that currently `vi.mock`s `@/lib/feature-flags` —
grep for it first: `grep -rl "vi.mock('@/lib/feature-flags'" src/`)
Expected: all still passing — these mock `useAppFeatureFlag` entirely, so
its internal implementation change doesn't affect them.

- [ ] **Step 7: Commit**

```bash
git add src/lib/feature-flags.ts src/hooks/useFeatureFlags.ts src/lib/feature-flags.test.ts src/hooks/useFeatureFlags.test.ts
git commit -m "fix(feature-flags): useAppFeatureFlag now passes keys; fail-safe fetch fallback"
```

---

### Task 4: Fix the `LEAD_THREE_SECTION_LAYOUT` read bug

**Files:**
- Modify: `src/pages/dashboard/LeadDetail.tsx:52`, `:919`
- Modify: `src/pages/dashboard/LeadNew.tsx:25`, `:183`
- Modify: `src/pages/dashboard/LeadDetail.test.tsx` (add flag mock + two cases)
- Test: `src/pages/dashboard/LeadNew.test.tsx` (new — no existing file for this page)

**Interfaces:**
- Consumes: `useAppFeatureFlag` (Task 3, unchanged signature),
  `FEATURE_FLAGS.LEAD_THREE_SECTION_LAYOUT` (unchanged).
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Write the failing tests**

`LeadDetail.test.tsx` currently has no `@/lib/feature-flags` mock and no
`LeadWorkspaceSections` mock at all (confirmed by reading the full file —
only `LeadForm` is mocked, at its existing lines 21-23). Add both, next to
the file's other `vi.mock` calls (e.g. right after the existing `LeadForm`
mock at line 23):

```typescript
vi.mock('@/features/module-sales/components/LeadWorkspaceSections', () => ({
  LeadWorkspaceSections: () => <div data-testid="lead-workspace-sections" />,
}));

const mockUseAppFeatureFlag = vi.fn();
vi.mock('@/lib/feature-flags', () => ({
  FEATURE_FLAGS: { LEAD_THREE_SECTION_LAYOUT: 'lead_three_section_layout' },
  useAppFeatureFlag: () => mockUseAppFeatureFlag(),
}));
```

In the existing `describe('LeadDetail', ...)` block's `beforeEach` (which
currently resets `locationState` and `fetchMock` — lines 193-230), add a
default mock return value so the file's existing tests (which don't touch
the flag) keep passing unmodified — without this, `mockUseAppFeatureFlag()`
returns `undefined` and the component throws destructuring `.enabled` off
it:

```typescript
    mockUseAppFeatureFlag.mockReturnValue({ enabled: false, isLoading: false, error: null });
```

Then add two new test cases inside the same `describe` block, reusing the
file's existing edit-mode entry mechanism (`locationState = { openEdit:
true, returnTo: '/dashboard/leads' }`, the same mechanism the existing
"opens in edit mode when navigation state requests it" test at lines
252-262 already uses):

```typescript
  it('renders LeadWorkspaceSections in edit mode when the flag is enabled', async () => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: true, isLoading: false, error: null });
    locationState = { openEdit: true, returnTo: '/dashboard/leads' };

    render(
      <BrowserRouter>
        <LeadDetail />
      </BrowserRouter>,
    );

    expect(await screen.findByTestId('lead-workspace-sections')).toBeInTheDocument();
    expect(screen.queryByTestId('lead-form')).not.toBeInTheDocument();
  });

  it('renders the legacy LeadForm in edit mode when the flag is disabled', async () => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: false, isLoading: false, error: null });
    locationState = { openEdit: true, returnTo: '/dashboard/leads' };

    render(
      <BrowserRouter>
        <LeadDetail />
      </BrowserRouter>,
    );

    expect(await screen.findByTestId('lead-form')).toBeInTheDocument();
    expect(screen.queryByTestId('lead-workspace-sections')).not.toBeInTheDocument();
  });
```

`LeadNew.tsx` has no existing test file (confirmed — only `LeadDetail.test.tsx`
exists in `src/pages/dashboard/`). Create one. `LeadNew.tsx`'s full import
list (read in full) is: `useNavigate` (react-router-dom), `DashboardLayout`,
`Card`/`CardContent`/`CardHeader`/`CardTitle` (`@/components/ui/card` —
plain presentational primitives, left unmocked), `H1`, `LeadForm`,
`LeadWorkspaceSections`, `useCRM`, `useCrmApiHeaders` (itself just wraps
`useCRM` — no separate mock needed, mocking `useCRM` covers it), `toast`
(sonner), `logger` (`@/lib/logger`), `Sentry`, `CRMModuleHeaderNavigation`
+ `CRM_HEADER_PRIMARY_CONTROL_SEQUENCE`, `themeStyleFromPreset`, `useTheme`,
`useLeadsViewState`. Mirrors `Accounts.test.tsx`'s established mock shapes
for `CRMModuleHeaderNavigation`, `useTheme`, and `useCRM`'s `context`/
`scopedDb` shape (that file is the closest existing precedent for a
dashboard page with this exact header/theme/CRM dependency set):

```typescript
// src/pages/dashboard/LeadNew.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import LeadNew from './LeadNew';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/crm/CRMModuleHeaderNavigation', () => ({
  CRMModuleHeaderNavigation: () => <div data-testid="crm-module-header-nav" />,
  CRM_HEADER_PRIMARY_CONTROL_SEQUENCE: [],
}));

vi.mock('@/features/module-sales/components/LeadForm', () => ({
  LeadForm: () => <div data-testid="lead-form" />,
}));

vi.mock('@/features/module-sales/components/LeadWorkspaceSections', () => ({
  LeadWorkspaceSections: () => <div data-testid="lead-workspace-sections" />,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false }),
}));

vi.mock('@/hooks/useLeadsViewState', () => ({
  useLeadsViewState: () => ({
    state: { theme: 'Azure Sky' },
    setTheme: vi.fn(),
    setView: vi.fn(),
    setPipeline: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
    context: { tenantId: 'tenant-1', userId: 'user-1', franchiseId: null },
    scopedDb: { logViewPreference: vi.fn() },
  }),
}));

const mockUseAppFeatureFlag = vi.fn();
vi.mock('@/lib/feature-flags', () => ({
  FEATURE_FLAGS: { LEAD_THREE_SECTION_LAYOUT: 'lead_three_section_layout' },
  useAppFeatureFlag: () => mockUseAppFeatureFlag(),
}));

describe('LeadNew — three-section layout flag', () => {
  beforeEach(() => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: false, isLoading: false, error: null });
  });

  it('renders LeadWorkspaceSections when the flag is enabled', () => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: true, isLoading: false, error: null });
    render(
      <BrowserRouter>
        <LeadNew />
      </BrowserRouter>,
    );
    expect(screen.getByTestId('lead-workspace-sections')).toBeInTheDocument();
    expect(screen.queryByTestId('lead-form')).not.toBeInTheDocument();
  });

  it('renders the legacy LeadForm when the flag is disabled', () => {
    render(
      <BrowserRouter>
        <LeadNew />
      </BrowserRouter>,
    );
    expect(screen.getByTestId('lead-form')).toBeInTheDocument();
    expect(screen.queryByTestId('lead-workspace-sections')).not.toBeInTheDocument();
  });
});
```

If rendering `LeadNew` throws on an import this list missed (unlikely,
but `sonner`/`Sentry`/`logger` are left deliberately unmocked as
side-effect-free in jsdom, matching this repo's convention elsewhere),
add the minimal mock needed and note it in the task report — this mirrors
how Plan 3's Task 4 needed more mocks than its brief anticipated for
`DashboardLayout.test.tsx`, which was an accepted, documented outcome, not
a plan defect.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/pages/dashboard/LeadDetail.test.tsx src/pages/dashboard/LeadNew.test.tsx`
Expected: FAIL — both pages currently render `LeadWorkspaceSections`
regardless of `mockUseAppFeatureFlag`'s return value (the bug: they check
the whole object's truthiness, not `.enabled`), so the "disabled" case's
assertion fails.

- [ ] **Step 3: Fix `LeadDetail.tsx`**

Line 52, change:
```ts
  const threeSectionLeadWorkspace = useAppFeatureFlag(FEATURE_FLAGS.LEAD_THREE_SECTION_LAYOUT);
```
to:
```ts
  const { enabled: threeSectionLeadWorkspace } = useAppFeatureFlag(FEATURE_FLAGS.LEAD_THREE_SECTION_LAYOUT);
```
Line 919's `threeSectionLeadWorkspace ? (` ternary needs no change — it
already branches on the variable, which now holds the boolean directly.

- [ ] **Step 4: Fix `LeadNew.tsx`**

Line 25, same change:
```ts
  const threeSectionLeadWorkspace = useAppFeatureFlag(FEATURE_FLAGS.LEAD_THREE_SECTION_LAYOUT);
```
to:
```ts
  const { enabled: threeSectionLeadWorkspace } = useAppFeatureFlag(FEATURE_FLAGS.LEAD_THREE_SECTION_LAYOUT);
```
Line 183's ternary again needs no change.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/pages/dashboard/LeadDetail.test.tsx src/pages/dashboard/LeadNew.test.tsx`
Expected: all passing.

- [ ] **Step 6: Run the full design-system + feature-flags-adjacent scope once more**

Run: `npx vitest run src/lib/feature-flags.test.ts src/hooks/useFeatureFlags.test.ts src/pages/dashboard/LeadDetail.test.tsx src/pages/dashboard/LeadNew.test.tsx src/components/navigation/CommandCenterNav.test.tsx src/components/quotation/composer/LegsConfigurationStep.test.tsx supabase/functions/feature-flags/index.test.ts`
Expected: all passing, 0 failures.

Run: `npx eslint src/lib/feature-flags.ts src/hooks/useFeatureFlags.ts src/pages/dashboard/LeadDetail.tsx src/pages/dashboard/LeadNew.tsx src/pages/dashboard/LeadDetail.test.tsx src/pages/dashboard/LeadNew.test.tsx src/lib/feature-flags.test.ts src/hooks/useFeatureFlags.test.ts`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/pages/dashboard/LeadDetail.tsx src/pages/dashboard/LeadNew.tsx src/pages/dashboard/LeadDetail.test.tsx src/pages/dashboard/LeadNew.test.tsx
git commit -m "fix(leads): LEAD_THREE_SECTION_LAYOUT was read as a truthy object, not .enabled"
```
