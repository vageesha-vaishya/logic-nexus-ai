# Email Client SMTP/IMAP Save Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SMTP/IMAP "Save Settings" form on `/dashboard/email-management` → Email Client actually work, by routing account creation through a new edge function that stores credentials in the vault instead of inserting them into two columns a production migration already dropped.

**Architecture:** One new edge function (`create-email-client-account`) does the insert + credential-vault writes server-side, following the exact precedent `exchange-oauth-token` already established for OAuth accounts. The frontend's save handler swaps a direct table insert for one call to this function; nothing else on the page changes.

**Tech Stack:** Deno edge function (TypeScript) + `_shared/auth.ts`/`_shared/logger.ts`/`_shared/cors.ts`/`_shared/email-credentials.ts` (all pre-existing), React + `@/lib/supabase-functions`'s `invokeFunction`, vitest.

## Global Constraints

- No change to `core.write_email_account_credential`, `core.read_email_account_credential`, or their `GRANT EXECUTE` recipients — used exactly as they exist today.
- No behavior change to the OAuth (`gmail`/`office365`) account path, the "Configured Accounts" read/display logic, or `sendTestEmail` — only the SMTP/IMAP *save* mechanism changes.
- The new edge function derives `tenant_id`/`franchise_id` from the authenticated caller's own `user_roles` row server-side — never accepts these as client-supplied request-body fields (the function runs with service-role privileges and bypasses RLS).
- A credential-write failure after the account row is inserted must delete that row, and must also clean up any `core.secrets` row already written in the same attempt, before returning an error — never leave a half-configured account or an orphaned active secret pointer behind.
- Full spec: `docs/superpowers/specs/2026-09-15-email-client-smtp-save-fix-design.md`.

---

### Task 1: The `create-email-client-account` edge function

**Files:**
- Create: `supabase/functions/create-email-client-account/index.ts`
- Test: `supabase/functions/create-email-client-account/index.test.ts`

**Interfaces:**
- Consumes: `requireAuth` (`_shared/auth.ts`), `getCorsHeaders` (`_shared/cors.ts`), `serveWithLogger` (`_shared/logger.ts`), `setEmailCredential` (`_shared/email-credentials.ts`) — all pre-existing, unchanged.
- Produces: `POST .../functions/v1/create-email-client-account` with body
  `{ display_name: string | null, email_address: string, is_primary: boolean, smtp: { host, port, username, password, use_tls }, imap: { host, port, username, password, use_ssl }, settings: { preset } }`
  → `{ success: true, account: <email_accounts row> }` (200) or
  `{ error: string }` (401/400/500). Task 2 depends on this exact request/response shape.

- [ ] **Step 1: Write the failing test**

Follow this repo's vitest convention for edge functions (`supabase/functions/generate-aircraft-tasks/index.test.ts`): mock `_shared/logger.ts` to capture the handler `serveWithLogger` was called with, `_shared/cors.ts` for headers, `_shared/auth.ts`'s `requireAuth`, and `_shared/email-credentials.ts`'s `setEmailCredential`.

```typescript
// supabase/functions/create-email-client-account/index.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

type EdgeHandler = (
  req: Request,
  logger: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> },
  supabase: any,
) => Promise<Response>;

let capturedHandler: EdgeHandler | null = null;
const requireAuthMock = vi.fn();
const setEmailCredentialMock = vi.fn();

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

vi.mock("../_shared/email-credentials.ts", () => ({
  setEmailCredential: setEmailCredentialMock,
}));

function loggerMock() {
  return {
    info: vi.fn(async () => undefined),
    error: vi.fn(async () => undefined),
  };
}

const VALID_BODY = {
  display_name: "Test Account",
  email_address: "test@example.com",
  is_primary: false,
  smtp: { host: "smtp.gmail.com", port: 587, username: "test@example.com", password: "smtp-secret", use_tls: true },
  imap: { host: "imap.gmail.com", port: 993, username: "test@example.com", password: "imap-secret", use_ssl: true },
  settings: { preset: "gmail" },
};

function supabaseMock(opts: {
  userRolesRow?: { tenant_id: string | null; franchise_id: string | null } | null;
  insertedAccount?: Record<string, unknown> | null;
  insertError?: unknown;
}) {
  const insertedAccount = opts.insertedAccount ?? { id: "new-account-id", ...VALID_BODY };
  const capturedInserts: unknown[] = [];
  const deleteEmailAccountsCalls: string[] = [];
  const deleteSecretsCalls: Array<{ subject_kind: string; subject_id: string }> = [];

  const from = vi.fn((table: string) => {
    if (table === "user_roles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: opts.userRolesRow ?? { tenant_id: "tenant-1", franchise_id: null },
                error: null,
              }),
            })),
          })),
        })),
      };
    }
    if (table === "email_accounts") {
      return {
        insert: vi.fn((payload: unknown) => {
          capturedInserts.push(payload);
          return {
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: opts.insertError ? null : insertedAccount,
                error: opts.insertError ?? null,
              }),
            })),
          };
        }),
        delete: vi.fn(() => ({
          eq: vi.fn((_col: string, id: string) => {
            deleteEmailAccountsCalls.push(id);
            return Promise.resolve({ error: null });
          }),
        })),
      };
    }
    throw new Error(`Unexpected table in from(): ${table}`);
  });

  const schema = vi.fn((name: string) => {
    if (name !== "core") throw new Error(`Unexpected schema: ${name}`);
    return {
      from: vi.fn((table: string) => {
        if (table !== "secrets") throw new Error(`Unexpected core table: ${table}`);
        return {
          delete: vi.fn(() => ({
            eq: vi.fn((col1: string, val1: string) => ({
              eq: vi.fn((col2: string, val2: string) => {
                deleteSecretsCalls.push({ subject_kind: val1, subject_id: val2 });
                return Promise.resolve({ error: null });
              }),
            })),
          })),
        };
      }),
    };
  });

  return { from, schema, capturedInserts, deleteEmailAccountsCalls, deleteSecretsCalls };
}

describe("create-email-client-account edge function", () => {
  beforeEach(async () => {
    capturedHandler = null;
    requireAuthMock.mockReset();
    setEmailCredentialMock.mockReset();
    vi.resetModules();
    await import("./index.ts");
  });

  it("returns 401 when not authenticated", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: null, error: "no session" });
    const supabase = supabaseMock({});

    const res = await handler(
      new Request("https://example.com/create-email-client-account", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
      loggerMock(),
      supabase,
    );

    expect(res.status).toBe(401);
    expect(supabase.capturedInserts).toHaveLength(0);
  });

  it("creates the account and both credentials on the happy path", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    setEmailCredentialMock.mockResolvedValue({ ok: true });
    const supabase = supabaseMock({});

    const res = await handler(
      new Request("https://example.com/create-email-client-account", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
      loggerMock(),
      supabase,
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.account.id).toBe("new-account-id");

    // The insert payload must carry user_id, and must NEVER carry the
    // dropped smtp_password/imap_password columns -- the two concrete
    // regression guards for the original bug.
    const insertPayload = supabase.capturedInserts[0] as Record<string, unknown>;
    expect(insertPayload.user_id).toBe("user-1");
    expect(insertPayload).not.toHaveProperty("smtp_password");
    expect(insertPayload).not.toHaveProperty("imap_password");

    expect(setEmailCredentialMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ account_id: "new-account-id", purpose: "smtp_password", value: "smtp-secret" }),
      expect.anything(),
    );
    expect(setEmailCredentialMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ account_id: "new-account-id", purpose: "imap_password", value: "imap-secret" }),
      expect.anything(),
    );
  });

  it("rolls back the account row when the smtp_password write fails, and never attempts imap_password", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    setEmailCredentialMock.mockResolvedValueOnce({ ok: false, error: "vault error" });
    const supabase = supabaseMock({});

    const res = await handler(
      new Request("https://example.com/create-email-client-account", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
      loggerMock(),
      supabase,
    );

    expect(res.status).toBe(500);
    expect(setEmailCredentialMock).toHaveBeenCalledTimes(1);
    expect(supabase.deleteEmailAccountsCalls).toEqual(["new-account-id"]);
    // Nothing was written to core.secrets yet -- no cleanup call needed.
    expect(supabase.deleteSecretsCalls).toHaveLength(0);
  });

  it("rolls back the account row AND cleans up the already-written smtp_password secret when imap_password fails", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    setEmailCredentialMock
      .mockResolvedValueOnce({ ok: true }) // smtp_password succeeds
      .mockResolvedValueOnce({ ok: false, error: "vault error" }); // imap_password fails
    const supabase = supabaseMock({});

    const res = await handler(
      new Request("https://example.com/create-email-client-account", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
      loggerMock(),
      supabase,
    );

    expect(res.status).toBe(500);
    expect(supabase.deleteEmailAccountsCalls).toEqual(["new-account-id"]);
    expect(supabase.deleteSecretsCalls).toEqual([
      { subject_kind: "comms.email_account", subject_id: "new-account-id" },
    ]);
  });

  it("returns 400 when required fields are missing", async () => {
    const handler = capturedHandler as EdgeHandler;
    requireAuthMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const supabase = supabaseMock({});

    const res = await handler(
      new Request("https://example.com/create-email-client-account", {
        method: "POST",
        body: JSON.stringify({ ...VALID_BODY, email_address: undefined }),
      }),
      loggerMock(),
      supabase,
    );

    expect(res.status).toBe(400);
    expect(supabase.capturedInserts).toHaveLength(0);
  });

  it("returns CORS headers for OPTIONS with no auth check", async () => {
    const handler = capturedHandler as EdgeHandler;

    const res = await handler(
      new Request("https://example.com/create-email-client-account", { method: "OPTIONS" }),
      loggerMock(),
      {} as any,
    );

    expect(res.status).toBeLessThan(400);
    expect(requireAuthMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run supabase/functions/create-email-client-account/index.test.ts`
Expected: FAIL — cannot resolve `./index.ts`.

- [ ] **Step 3: Write the edge function**

```typescript
// supabase/functions/create-email-client-account/index.ts
//
// Creates an SMTP/IMAP email_accounts row and stores its credentials in
// the vault via core.write_email_account_credential, instead of the
// plaintext smtp_password/imap_password columns dropped by
// 20260529010000_drop_email_accounts_plaintext_credentials.sql. Follows
// the same shape exchange-oauth-token already established for OAuth
// accounts. See docs/superpowers/specs/2026-09-15-email-client-smtp-save-fix-design.md.
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { serveWithLogger } from "../_shared/logger.ts";
import { setEmailCredential } from "../_shared/email-credentials.ts";

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

  const { user, error: authError } = await requireAuth(req);
  if (authError || !user) {
    return json({ error: "Unauthorized" }, 401, corsHeaders);
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, corsHeaders);
    }

    const { display_name, email_address, is_primary, smtp, imap, settings } = body || {};
    if (!email_address || !smtp?.host || !smtp?.password || !imap?.host || !imap?.password) {
      return json({ error: "Missing required fields: email_address, smtp.host, smtp.password, imap.host, imap.password" }, 400, corsHeaders);
    }

    // Derive tenant/franchise from the caller's own role row -- never
    // trust a client-supplied tenant id, since this function runs as
    // service-role and bypasses RLS. .limit(1).maybeSingle(), not bare
    // .single(): user_roles allows multiple rows per user (one per
    // distinct role), so .single() would throw for a user holding two
    // roles.
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("tenant_id, franchise_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const accountPayload = {
      user_id: user.id,
      provider: "smtp_imap",
      email_address,
      display_name: display_name || null,
      is_primary: Boolean(is_primary),
      smtp_host: smtp.host,
      smtp_port: smtp.port,
      smtp_username: smtp.username,
      smtp_use_tls: Boolean(smtp.use_tls),
      imap_host: imap.host,
      imap_port: imap.port,
      imap_username: imap.username,
      imap_use_ssl: Boolean(imap.use_ssl),
      tenant_id: userRole?.tenant_id ?? null,
      franchise_id: userRole?.franchise_id ?? null,
      is_active: true,
      settings: settings ?? {},
    };

    const { data: account, error: insertError } = await supabase
      .from("email_accounts")
      .insert(accountPayload)
      .select()
      .single();

    if (insertError || !account) {
      logger.error("create-email-client-account: insert failed", { error: insertError });
      return json({ error: insertError?.message ?? "Failed to create account" }, 500, corsHeaders);
    }

    const smtpResult = await setEmailCredential(
      supabase,
      { account_id: account.id, purpose: "smtp_password", value: smtp.password, tenant_id: userRole?.tenant_id ?? null },
      logger,
    );
    if (!smtpResult.ok) {
      await supabase.from("email_accounts").delete().eq("id", account.id);
      logger.error("create-email-client-account: smtp_password write failed, rolled back", { error: smtpResult.error });
      return json({ error: "Failed to store SMTP password" }, 500, corsHeaders);
    }

    const imapResult = await setEmailCredential(
      supabase,
      { account_id: account.id, purpose: "imap_password", value: imap.password, tenant_id: userRole?.tenant_id ?? null },
      logger,
    );
    if (!imapResult.ok) {
      await supabase.from("email_accounts").delete().eq("id", account.id);
      // smtp_password already landed in core.secrets before this failure
      // -- core.secrets.subject_id has no FK to email_accounts.id, so
      // deleting the account row above does not cascade-clean it.
      await supabase.schema("core").from("secrets").delete()
        .eq("subject_kind", "comms.email_account")
        .eq("subject_id", account.id);
      logger.error("create-email-client-account: imap_password write failed, rolled back", { error: imapResult.error });
      return json({ error: "Failed to store IMAP password" }, 500, corsHeaders);
    }

    return json({ success: true, account }, 200, corsHeaders);
  } catch (error: any) {
    logger.error("create-email-client-account: unhandled error", { error });
    return json({ error: error?.message ?? "Internal Server Error" }, 500, corsHeaders);
  }
}, "create-email-client-account");
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run supabase/functions/create-email-client-account/index.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Lint**

Run: `npx eslint supabase/functions/create-email-client-account/index.ts supabase/functions/create-email-client-account/index.test.ts`
Expected: clean, or the same "file ignored" outcome this repo's other `supabase/functions/*` files get if `eslint.config.*` excludes that directory — check which applies and record it, matching how prior tasks in this project handled the same check.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/create-email-client-account/index.ts supabase/functions/create-email-client-account/index.test.ts
git commit -m "feat(email-client): create-email-client-account edge function stores credentials in vault"
```

---

### Task 2: Wire `EmailClientSettings.tsx` to the new edge function

**Files:**
- Modify: `src/features/module-communications/components/email/EmailClientSettings.tsx:177-225`
- Test: `src/features/module-communications/components/email/EmailClientSettings.test.tsx` (new)

**Interfaces:**
- Consumes: `create-email-client-account` (Task 1) — request body
  `{ display_name, email_address, is_primary, smtp, imap, settings }`,
  response `{ success: true, account }` / `{ error: string }`, via
  `invokeFunction` (`@/lib/supabase-functions`, pre-existing — already
  used by `EmailAccounts.tsx` for `sync-emails-v2`).
- Produces: nothing consumed elsewhere — last task.

- [ ] **Step 1: Write the failing test**

No existing test file for this component (confirmed via a direct search).
This component is large (581 lines) with several unrelated sections
(Domain Management, Outlook Client Defaults, Configured Accounts) — mock
`DomainManagement` and `EmailAccountDialog` (its only two child-component
imports) as simple stubs so the test only exercises the save form.

```typescript
// src/features/module-communications/components/email/EmailClientSettings.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./DomainManagement', () => ({
  DomainManagement: () => <div data-testid="domain-management" />,
}));
vi.mock('./EmailAccountDialog', () => ({
  EmailAccountDialog: () => null,
}));
vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

const invokeFunctionMock = vi.fn();
vi.mock('@/lib/supabase-functions', () => ({
  invokeFunction: (...args: unknown[]) => invokeFunctionMock(...args),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    context: { tenantId: 'tenant-1', franchiseId: null },
    scopedDb: {
      client: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) } },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    },
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
}));

import { EmailClientSettings } from './EmailClientSettings';
import { toast } from '@/components/ui/use-toast';

async function fillMinimalForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email address'), 'test@example.com');
  await user.type(screen.getByLabelText('SMTP username'), 'test@example.com');
  await user.type(screen.getByLabelText('SMTP password'), 'smtp-secret');
  await user.type(screen.getByLabelText('IMAP username'), 'test@example.com');
  await user.type(screen.getByLabelText('IMAP password'), 'imap-secret');
}

describe('EmailClientSettings save form', () => {
  beforeEach(() => {
    invokeFunctionMock.mockReset();
    (toast as ReturnType<typeof vi.fn>).mockReset();
  });

  it('calls create-email-client-account with no plaintext password columns and no client-supplied tenant/user ids', async () => {
    invokeFunctionMock.mockResolvedValue({ data: { success: true, account: { id: 'new-id' } }, error: null });
    const user = userEvent.setup();
    render(<EmailClientSettings />);

    await fillMinimalForm(user);
    await user.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => expect(invokeFunctionMock).toHaveBeenCalled());
    const [fnName, options] = invokeFunctionMock.mock.calls[0];
    expect(fnName).toBe('create-email-client-account');
    const body = options.body;
    expect(body).not.toHaveProperty('user_id');
    expect(body).not.toHaveProperty('tenant_id');
    expect(body).not.toHaveProperty('franchise_id');
    expect(body).not.toHaveProperty('smtp_password');
    expect(body).not.toHaveProperty('imap_password');
    expect(body.smtp.password).toBe('smtp-secret');
    expect(body.imap.password).toBe('imap-secret');
  });

  it('shows a success toast and resets the form when the function succeeds', async () => {
    invokeFunctionMock.mockResolvedValue({ data: { success: true, account: { id: 'new-id' } }, error: null });
    const user = userEvent.setup();
    render(<EmailClientSettings />);

    await fillMinimalForm(user);
    await user.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Email account saved' }),
      ),
    );
    expect((screen.getByLabelText('Email address') as HTMLInputElement).value).toBe('');
  });

  it('shows a failure toast and does not reset the form when the function errors', async () => {
    invokeFunctionMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const user = userEvent.setup();
    render(<EmailClientSettings />);

    await fillMinimalForm(user);
    await user.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to save account', description: 'boom' }),
      ),
    );
    expect((screen.getByLabelText('Email address') as HTMLInputElement).value).toBe('test@example.com');
  });
});
```

If any label text above doesn't exactly match what's rendered (e.g. the
real accessible name differs slightly), inspect the actual JSX for that
field and adjust the query to match — don't guess a second time.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/module-communications/components/email/EmailClientSettings.test.tsx`
Expected: FAIL — `invokeFunctionMock` is never called (the component still calls `scopedDb.from("email_accounts").insert(...)` directly).

- [ ] **Step 3: Add the `invokeFunction` import**

At the top of `EmailClientSettings.tsx`, add one import line after the existing `supabase` import (line 2):

```tsx
import { invokeFunction } from "@/lib/supabase-functions";
```

- [ ] **Step 4: Replace the save handler's insert with the edge-function call**

Replace lines 177-225 (the entire `handleSubmit` function body) with:

```tsx
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data, error } = await invokeFunction("create-email-client-account", {
      body: {
        display_name: form.display_name || null,
        email_address: form.email_address,
        is_primary: form.is_primary,
        smtp: form.smtp,
        imap: form.imap,
        settings: { preset: form.preset },
      },
    });
    setSaving(false);

    if (error || !(data as any)?.success) {
      toast({ title: "Failed to save account", description: error?.message ?? "Failed to save account", variant: "destructive" });
      return;
    }
    toast({ title: "Email account saved", description: "SMTP/IMAP settings stored successfully." });
    setForm(emptyForm());
    // refresh list
    const { data: accountsData } = await scopedDb
      .from("email_accounts")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setAccounts((accountsData as EmailAccountRow[]) || []);
  };
```

This removes the client-side "not signed in" pre-check
(`scopedDb.client.auth.getUser()`) — it existed only to populate the
old payload's `user_id` field, which the edge function now derives
itself from the caller's session server-side. `invokeFunction` already
returns a clear `"Unauthorized: no active Supabase user session found"`
error if there's no session, surfaced through the same failure-toast
path above, so the check is now redundant rather than removed
behavior.

The `TablesInsert<"email_accounts">` type import (line 3) may now be
unused in this file — check with a repo-wide search
(`grep -n "TablesInsert" src/features/module-communications/components/email/EmailClientSettings.tsx`)
before removing it; leave it if anything else in the file still
references it, remove the now-dead import if not.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/features/module-communications/components/email/EmailClientSettings.test.tsx`
Expected: 3 passed.

- [ ] **Step 6: Run the combined scope once more**

Run: `npx vitest run supabase/functions/create-email-client-account/index.test.ts src/features/module-communications/components/email/EmailClientSettings.test.tsx`
Expected: 9 passed, 0 failures.

Run: `npx eslint src/features/module-communications/components/email/EmailClientSettings.tsx src/features/module-communications/components/email/EmailClientSettings.test.tsx`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/module-communications/components/email/EmailClientSettings.tsx src/features/module-communications/components/email/EmailClientSettings.test.tsx
git commit -m "fix(email-client): save via create-email-client-account instead of a direct insert with dropped columns"
```
