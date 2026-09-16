# Domain Verification Fix (Group C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `domains-verify` edge function actually persist verification results, and set the `is_verified` flag both UI badges read, instead of every call crashing on a database update that references a column that has never existed.

**Architecture:** One edge function, two line-level changes: delete the line that sets a non-existent `status` column (the crash), and add a line that sets `is_verified = spf_verified && dkim_verified` (the missing badge flag). No DNS-lookup logic changes, no schema changes, no other files touched.

**Tech Stack:** Deno edge function (TypeScript), vitest for tests, `_shared/auth.ts`/`_shared/cors.ts`/`_shared/logger.ts` (pre-existing, unchanged).

## Global Constraints

- No schema changes, no new migration — pure application-code fix.
- No change to the DNS-lookup logic itself (SPF TXT check, DMARC TXT check, DKIM CNAME check) — only to what gets persisted afterward.
- No change to `domains-register`, `DomainManagement.tsx`, `DomainHealth.tsx`, `DomainVerificationService.ts`, or `TenantForm.tsx`.
- DMARC does not gate `is_verified` — only SPF and DKIM do.
- `Boolean(...)` must be used so a never-set `dkim_verified` (identity provisioning failed and no DKIM tokens were ever available) computes `is_verified: false`, not a crash or `undefined`.
- Full spec: `docs/superpowers/specs/2026-09-16-domain-verification-fix-design.md`.

---

### Task 1: Fix `domains-verify` to persist correctly

**Files:**
- Modify: `supabase/functions/domains-verify/index.ts:301-330`
- Test: `supabase/functions/domains-verify/index.test.ts` (new — none exists today)

**Interfaces:**
- Consumes: `requireAuth` (`_shared/auth.ts`, unchanged) — for this function, the returned `supabaseClient` (not the handler's third `_adminSupabase` parameter, which this function ignores) is what performs both the domain fetch and the final update. `getCorsHeaders` (`_shared/cors.ts`, unchanged). `serveWithLogger` (`_shared/logger.ts`, unchanged).
- Produces: nothing consumed by other tasks — this is the only task in this plan.

- [ ] **Step 1: Write the failing tests**

This test file needs two things the SMTP/IMAP fix's edge-function tests
(`supabase/functions/create-email-client-account/index.test.ts`) didn't:
(a) a mock for the top-level `import { SESClient, VerifyDomainDkimCommand } from "npm:@aws-sdk/client-ses";` in `domains-verify/index.ts` — that specifier isn't a real installed package and has no runtime effect from its Deno-only type declaration, so without mocking it the whole test file fails to load; (b) a stub for the global `Deno.resolveDns`/`Deno.env.get`, since no shim exists anywhere in this repo's test setup and this function calls both directly.

```typescript
// supabase/functions/domains-verify/index.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type EdgeHandler = (
  req: Request,
  logger: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> },
  supabase: any,
) => Promise<Response>;

let capturedHandler: EdgeHandler | null = null;
const requireAuthMock = vi.fn();

vi.mock("npm:@aws-sdk/client-ses", () => ({
  SESClient: class {
    send() {
      return Promise.resolve({});
    }
  },
  VerifyDomainDkimCommand: class {},
}));

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

function defaultDomainRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "domain-1",
    domain_name: "example.com",
    provider_metadata: { dkim_tokens: ["tok1", "tok2", "tok3"] },
    ...overrides,
  };
}

function supabaseClientMock(opts: { domainRow?: Record<string, unknown> | null; fetchError?: unknown }) {
  const capturedUpdates: Record<string, unknown>[] = [];
  const updateEqCalls: string[] = [];

  const from = vi.fn((table: string) => {
    if (table !== "tenant_domains") throw new Error(`Unexpected table: ${table}`);
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: opts.fetchError ? null : (opts.domainRow ?? defaultDomainRow()),
            error: opts.fetchError ?? null,
          }),
        })),
      })),
      update: vi.fn((payload: Record<string, unknown>) => {
        capturedUpdates.push(payload);
        return {
          eq: vi.fn((_col: string, id: string) => {
            updateEqCalls.push(id);
            return Promise.resolve({ error: null });
          }),
        };
      }),
    };
  });

  return { from, capturedUpdates, updateEqCalls };
}

function requestWith(body: Record<string, unknown>) {
  return new Request("https://example.com/domains-verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Controls what Deno.resolveDns returns per (name, recordType) pair. */
function mockResolveDns(rules: { txt?: Record<string, string[]>; cname?: Record<string, string[]> }) {
  return vi.fn((name: string, type: string) => {
    if (type === "TXT") {
      const rec = rules.txt?.[name];
      if (rec) return Promise.resolve(rec.map((r) => [r]));
      return Promise.reject(new Error("no TXT record"));
    }
    if (type === "CNAME") {
      const rec = rules.cname?.[name];
      if (rec) return Promise.resolve(rec);
      return Promise.reject(new Error("no CNAME record"));
    }
    return Promise.reject(new Error(`unexpected DNS type ${type}`));
  });
}

describe("domains-verify edge function", () => {
  beforeEach(async () => {
    capturedHandler = null;
    requireAuthMock.mockReset();
    vi.resetModules();
    await import("./index.ts");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 when not authenticated, with no DNS lookups or update attempted", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: null, error: "no session", supabaseClient: null });
    const resolveDns = mockResolveDns({});
    vi.stubGlobal("Deno", { resolveDns, env: { get: vi.fn().mockReturnValue(undefined) } });

    const res = await handler(requestWith({ domain_id: "domain-1" }), loggerMock(), null);

    expect(res.status).toBe(401);
    expect(resolveDns).not.toHaveBeenCalled();
  });

  it("returns 400 when the domain is not found, without attempting DNS lookups or an update", async () => {
    const handler = capturedHandler as EdgeHandler;
    const client = supabaseClientMock({ fetchError: { message: "not found" } });
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null, supabaseClient: client });
    const resolveDns = mockResolveDns({});
    vi.stubGlobal("Deno", { resolveDns, env: { get: vi.fn().mockReturnValue(undefined) } });

    const res = await handler(requestWith({ domain_id: "missing-id" }), loggerMock(), null);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Domain not found or access denied");
    expect(resolveDns).not.toHaveBeenCalled();
    expect(client.capturedUpdates).toHaveLength(0);
  });

  it("never sends a status column, and sets is_verified true when SPF and DKIM pass even if DMARC fails", async () => {
    const handler = capturedHandler as EdgeHandler;
    const client = supabaseClientMock({});
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null, supabaseClient: client });
    const resolveDns = mockResolveDns({
      txt: { "example.com": ["v=spf1 include:amazonses.com ~all"] },
      cname: { "tok1._domainkey.example.com": ["tok1.dkim.amazonses.com"] },
    });
    vi.stubGlobal("Deno", { resolveDns, env: { get: vi.fn().mockReturnValue(undefined) } });

    const res = await handler(requestWith({ domain_id: "domain-1" }), loggerMock(), null);

    expect(res.status).toBe(200);
    const payload = client.capturedUpdates[0];
    expect(payload).not.toHaveProperty("status");
    expect(payload.spf_verified).toBe(true);
    expect(payload.dmarc_verified).toBe(false);
    expect(payload.dkim_verified).toBe(true);
    expect(payload.is_verified).toBe(true);
    expect(client.updateEqCalls).toEqual(["domain-1"]);
  });

  it("sets is_verified false when SPF passes but DKIM fails, and never sends a status column", async () => {
    const handler = capturedHandler as EdgeHandler;
    const client = supabaseClientMock({});
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null, supabaseClient: client });
    const resolveDns = mockResolveDns({
      txt: { "example.com": ["v=spf1 include:amazonses.com ~all"] },
      // No matching CNAME entries at all -- every DKIM token lookup rejects.
      cname: {},
    });
    vi.stubGlobal("Deno", { resolveDns, env: { get: vi.fn().mockReturnValue(undefined) } });

    const res = await handler(requestWith({ domain_id: "domain-1" }), loggerMock(), null);

    expect(res.status).toBe(200);
    const payload = client.capturedUpdates[0];
    expect(payload).not.toHaveProperty("status");
    expect(payload.spf_verified).toBe(true);
    expect(payload.dkim_verified).toBe(false);
    expect(payload.is_verified).toBe(false);
  });

  it("computes is_verified false (not a crash) when DKIM tokens are absent and identity provisioning also fails", async () => {
    const handler = capturedHandler as EdgeHandler;
    // No dkim_tokens in provider_metadata -- the function will try to
    // provision an identity. Force that to fail by requesting the
    // aws-ses provider with no AWS credentials configured, matching the
    // real getEmailProvider()'s "Missing AWS credentials" throw, which
    // the surrounding try/catch swallows (logs, doesn't rethrow).
    const client = supabaseClientMock({ domainRow: defaultDomainRow({ provider_metadata: {} }) });
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null, supabaseClient: client });
    const resolveDns = mockResolveDns({
      txt: { "example.com": ["v=spf1 include:amazonses.com ~all"] },
    });
    const envGet = vi.fn((key: string) => (key === "EMAIL_PROVIDER_TYPE" ? "aws-ses" : undefined));
    vi.stubGlobal("Deno", { resolveDns, env: { get: envGet } });

    const res = await handler(requestWith({ domain_id: "domain-1" }), loggerMock(), null);

    expect(res.status).toBe(200);
    const payload = client.capturedUpdates[0];
    expect(payload).not.toHaveProperty("status");
    expect(payload.spf_verified).toBe(true);
    expect(payload).not.toHaveProperty("dkim_verified");
    expect(payload.is_verified).toBe(false);
  });

  it("sets is_verified true when SPF, DKIM, and DMARC all pass", async () => {
    const handler = capturedHandler as EdgeHandler;
    const client = supabaseClientMock({});
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null, supabaseClient: client });
    const resolveDns = mockResolveDns({
      txt: {
        "example.com": ["v=spf1 include:amazonses.com ~all"],
        "_dmarc.example.com": ["v=DMARC1; p=none;"],
      },
      cname: { "tok1._domainkey.example.com": ["tok1.dkim.amazonses.com"] },
    });
    vi.stubGlobal("Deno", { resolveDns, env: { get: vi.fn().mockReturnValue(undefined) } });

    const res = await handler(requestWith({ domain_id: "domain-1" }), loggerMock(), null);

    expect(res.status).toBe(200);
    const payload = client.capturedUpdates[0];
    expect(payload).not.toHaveProperty("status");
    expect(payload.spf_verified).toBe(true);
    expect(payload.dmarc_verified).toBe(true);
    expect(payload.dkim_verified).toBe(true);
    expect(payload.is_verified).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail against the current, buggy code**

Run: `npx vitest run supabase/functions/domains-verify/index.test.ts`
Expected: the 401 test, the "domain not found" test, and the DKIM-provisioning-failure test PASS already (they don't depend on the bug). The three tests asserting `is_verified` and the absence of a `status` key FAIL — the mocked `.update()` call always "succeeds" (this mock doesn't simulate Postgres's real 42703 error), but the assertions `expect(payload).not.toHaveProperty("status")` fail because the current code does set it, and `expect(payload.is_verified).toBe(...)` fails because the current code never sets `is_verified` at all (`payload.is_verified` is `undefined`).

- [ ] **Step 3: Apply the fix**

In `supabase/functions/domains-verify/index.ts`, find this block (currently lines 301-330):

```typescript
    // 6. Verify DKIM
    // Check CNAMEs for each token
    if (dkimTokens && dkimTokens.length > 0) {
      let dkimVerifiedCount = 0;
      for (const token of dkimTokens) {
        try {
            // Standard DKIM CNAME: {token}._domainkey.{domain}
            const recordName = `${token}._domainkey.${domainName}`;
            const cnameRecords = await Deno.resolveDns(recordName, "CNAME");
            
            if (cnameRecords && cnameRecords.length > 0) {
                dkimVerifiedCount++;
            }
        } catch (e) {
            // Ignore DNS errors for individual tokens
        }
      }

      // If we found at least one valid record, we consider it partially verified
      // Ideally all should match
      if (dkimVerifiedCount >= 1) { // Relaxed check
        verificationResults.dkim = true;
        updates.dkim_verified = true;
      } else {
        updates.dkim_verified = false;
      }
    }

    updates.status = (updates.spf_verified && updates.dkim_verified) ? 'active' : 'pending_verification';

    // 7. Update Database
```

Replace it with:

```typescript
    // 6. Verify DKIM
    // Check CNAMEs for each token
    if (dkimTokens && dkimTokens.length > 0) {
      let dkimVerifiedCount = 0;
      for (const token of dkimTokens) {
        try {
            // Standard DKIM CNAME: {token}._domainkey.{domain}
            const recordName = `${token}._domainkey.${domainName}`;
            const cnameRecords = await Deno.resolveDns(recordName, "CNAME");
            
            if (cnameRecords && cnameRecords.length > 0) {
                dkimVerifiedCount++;
            }
        } catch (e) {
            // Ignore DNS errors for individual tokens
        }
      }

      // If we found at least one valid record, we consider it partially verified
      // Ideally all should match
      if (dkimVerifiedCount >= 1) { // Relaxed check
        verificationResults.dkim = true;
        updates.dkim_verified = true;
      } else {
        updates.dkim_verified = false;
      }
    }

    // DMARC is a policy layer on top of SPF/DKIM, not required by most
    // providers to call a domain "authenticated" -- it stays visible as
    // its own separate check in the UI, but doesn't gate this flag.
    // Boolean(...) turns a never-set dkim_verified (DKIM tokens were
    // never available and identity provisioning also failed) into
    // `false` rather than `undefined`.
    updates.is_verified = Boolean(updates.spf_verified) && Boolean(updates.dkim_verified);

    // 7. Update Database
```

The only changes are: the `updates.status = ...` line is gone (it referenced a column `tenant_domains` has never had, which made every `.update()` call fail), and the new `updates.is_verified = ...` line takes its place.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run supabase/functions/domains-verify/index.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Lint**

Run: `npx eslint supabase/functions/domains-verify/index.ts supabase/functions/domains-verify/index.test.ts`
Expected: clean (or the same "outside configured scope" outcome this repo's other `supabase/functions/**` files get — note which applies).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/domains-verify/index.ts supabase/functions/domains-verify/index.test.ts
git commit -m "fix(email-domains): persist verification results and set is_verified correctly"
```
