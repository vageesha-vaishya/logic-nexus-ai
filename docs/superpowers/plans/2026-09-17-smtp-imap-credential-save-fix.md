# SMTP/IMAP Credential Save & Test Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SMTP/IMAP email-account credential saving and connection testing actually work, by routing both through new, tenant-scoped, authenticated edge functions that write/read credentials via vault instead of the browser writing/reading dropped `email_accounts` columns directly.

**Architecture:** Two new single-purpose edge functions (`save-smtp-imap-account`, `test-email-account-credentials`), each requiring auth and deriving the caller's tenant from `user_roles` (never a client-supplied field), mirroring `exchange-oauth-token`'s existing pattern of writing non-credential fields to `email_accounts` and credential fields to vault via `setEmailCredential`/`getEmailCredential`. Two frontend call sites (`EmailAccountDialog.tsx`'s `handleSave`, `EmailAccounts.tsx`'s `testImap`) are updated to call these functions via `invokeFunction` instead of touching `email_accounts` credential columns directly.

**Tech Stack:** Deno edge functions (Supabase self-hosted), React + TypeScript frontend, Vitest + Testing Library.

## Global Constraints

- Neither new edge function ever reads or writes `smtp_password`/`imap_password`/`access_token`/`refresh_token`/`pop3_password` on `public.email_accounts` — those columns don't exist (dropped by migration `20260529010000_drop_email_accounts_plaintext_credentials.sql`). Credentials go through `setEmailCredential`/`getEmailCredential` (`supabase/functions/_shared/email-credentials.ts`) exclusively.
- Both new functions derive the caller's `tenant_id` from `SELECT tenant_id FROM user_roles WHERE user_id = <requireAuth's verified user.id>` — never from a client-supplied `userId`/`tenantId` field. If that lookup yields no `tenant_id`, reject with `403`.
- `verify-email-credentials` (`supabase/functions/verify-email-credentials/index.ts`) is not modified.
- Both new functions must be registered in three places before the deploy is considered complete: `supabase/functions/main/function_importers.ts`, `supabase/functions/main/verify_jwt_map.ts` (entry `false`, matching `exchange-oauth-token`'s pattern of doing its own `requireAuth()` internally), and `supabase/config.toml` (`verify_jwt = false`). Forgetting the first of these caused a real "function not found" production bug earlier today.
- Deploying to the live self-hosted Supabase instance and live-smoke-testing there happens **after** this plan's tasks are merged, done by the coordinator outside this plan's task loop (per `deploy/selfhosted-supabase/README.md`'s established procedure) — no task below performs a live deploy.

---

### Task 1: `save-smtp-imap-account` edge function

**Files:**
- Create: `supabase/functions/save-smtp-imap-account/index.ts`
- Modify: `supabase/functions/main/function_importers.ts:105` (insert after)
- Modify: `supabase/functions/main/verify_jwt_map.ts:54` (insert after)
- Modify: `supabase/config.toml:409` (insert after, before `[functions.search-emails]`)

**Interfaces:**
- Consumes: `requireAuth` from `supabase/functions/_shared/auth.ts` (returns `{ user: { id, email, ... } | null, error, supabaseClient }`); `serveWithLogger` from `supabase/functions/_shared/logger.ts` (calls `handler(req, logger, supabaseAdmin)` where `supabaseAdmin` is a service-role `SupabaseClient`); `getCorsHeaders` from `supabase/functions/_shared/cors.ts`; `setEmailCredential` from `supabase/functions/_shared/email-credentials.ts` (signature: `setEmailCredential(supabase, { account_id: string, purpose: "smtp_password"|"imap_password", value: string, tenant_id?: string|null }, logger) => Promise<{ ok: boolean, error?: unknown }>`).
- Produces: `POST /functions/v1/save-smtp-imap-account`. Request body: `{ accountId?: string, provider?: string, display_name: string, email_address: string, is_primary?: boolean, smtp_host: string, smtp_port: number, smtp_username: string, smtp_password: string, smtp_use_tls?: boolean, imap_host: string, imap_port: number, imap_username: string, imap_password: string, imap_use_ssl?: boolean }`. Success response: `200 { id: string }`. Error responses: `401 { error }`, `400 { error }`, `403 { error }`, `404 { error }`, `500 { error }`. Task 3 (`EmailAccountDialog.tsx`) calls this via `invokeFunction("save-smtp-imap-account", { body: { accountId, provider: providerId, ...formConfig } })`.

- [ ] **Step 1: Write the edge function**

Create `supabase/functions/save-smtp-imap-account/index.ts`:

```ts
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { serveWithLogger } from "../_shared/logger.ts";
import { setEmailCredential } from "../_shared/email-credentials.ts";

declare const Deno: any;

const REQUIRED_FIELDS = [
  "display_name", "email_address",
  "smtp_host", "smtp_port", "smtp_username", "smtp_password",
  "imap_host", "imap_port", "imap_username", "imap_password",
] as const;

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { user, error: authError } = await requireAuth(req);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const field of REQUIRED_FIELDS) {
      if (!payload?.[field]) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const {
      accountId, provider, display_name, email_address, is_primary,
      smtp_host, smtp_port, smtp_username, smtp_password, smtp_use_tls,
      imap_host, imap_port, imap_username, imap_password, imap_use_ssl,
    } = payload;

    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("tenant_id, franchise_id")
      .eq("user_id", user.id)
      .single();

    if (!userRole?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Unable to resolve your tenant. Contact your administrator." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nonCredentialFields = {
      provider: provider || "smtp_imap",
      display_name,
      email_address,
      is_primary: Boolean(is_primary),
      smtp_host,
      smtp_port: Number(smtp_port),
      smtp_username,
      smtp_use_tls: smtp_use_tls !== false,
      imap_host,
      imap_port: Number(imap_port),
      imap_username,
      imap_use_ssl: imap_use_ssl !== false,
      updated_at: new Date().toISOString(),
    };

    let savedAccountId: string;

    if (accountId) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("email_accounts")
        .select("id, tenant_id")
        .eq("id", accountId)
        .maybeSingle();

      if (existingError || !existing || existing.tenant_id !== userRole.tenant_id) {
        return new Response(JSON.stringify({ error: "Account not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from("email_accounts")
        .update(nonCredentialFields)
        .eq("id", accountId);

      if (updateError) throw updateError;
      savedAccountId = accountId;
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("email_accounts")
        .insert({
          ...nonCredentialFields,
          user_id: user.id,
          tenant_id: userRole.tenant_id,
          franchise_id: userRole.franchise_id ?? null,
          is_active: true,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      savedAccountId = inserted.id;
    }

    const smtpResult = await setEmailCredential(
      supabaseAdmin,
      { account_id: savedAccountId, purpose: "smtp_password", value: smtp_password, tenant_id: userRole.tenant_id },
      logger,
    );
    const imapResult = await setEmailCredential(
      supabaseAdmin,
      { account_id: savedAccountId, purpose: "imap_password", value: imap_password, tenant_id: userRole.tenant_id },
      logger,
    );

    if (!smtpResult.ok || !imapResult.ok) {
      return new Response(
        JSON.stringify({ error: "Account saved, but credential storage failed. Please try saving again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ id: savedAccountId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logger.error("Error saving SMTP/IMAP account:", { error });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}, "save-smtp-imap-account");
```

- [ ] **Step 2: Register in `function_importers.ts`**

In `supabase/functions/main/function_importers.ts`, insert this line immediately after the `"save-quotation-version"` line (currently line 105), before `"scheduled-reconcile"`:

```ts
  "save-smtp-imap-account": () => import("../save-smtp-imap-account/index.ts"),
```

- [ ] **Step 3: Register in `verify_jwt_map.ts`**

In `supabase/functions/main/verify_jwt_map.ts`, insert this line immediately after the `"save-quotation-version": false,` line (currently line 54), before `"search-emails": false,`:

```ts
  "save-smtp-imap-account": false,
```

- [ ] **Step 4: Register in `config.toml`**

In `supabase/config.toml`, insert this block immediately after the `[functions.save-quotation-version]` block (currently lines 407-409), before `[functions.search-emails]`:

```toml
[functions.save-smtp-imap-account]
verify_jwt = false

```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/save-smtp-imap-account/index.ts supabase/functions/main/function_importers.ts supabase/functions/main/verify_jwt_map.ts supabase/config.toml
git commit -m "feat(email): add save-smtp-imap-account edge function

Routes SMTP/IMAP account saves through vault via setEmailCredential
instead of the browser writing smtp_password/imap_password directly
to email_accounts, columns dropped by the 2026-05-29 vault migration."
```

---

### Task 2: `test-email-account-credentials` edge function

**Files:**
- Create: `supabase/functions/test-email-account-credentials/index.ts`
- Modify: `supabase/functions/main/function_importers.ts:115` (insert after, from Task 1's committed state — line number may shift by 1; insert after `"sync-hts-data"`, before `"track-email"`)
- Modify: `supabase/functions/main/verify_jwt_map.ts:63` (insert after `"sync-hts-data": false,`, before `"win-probability": false,`; line number may shift by 1 from Task 1)
- Modify: `supabase/config.toml` (insert after the `[functions.sync-hts-data]` block, before `[functions.win-probability]`; line numbers may shift from Task 1)

**Interfaces:**
- Consumes: same shared helpers as Task 1, plus `getEmailCredential` from `supabase/functions/_shared/email-credentials.ts` (signature: `getEmailCredential(supabase, { account_id: string, purpose: "smtp_password"|"imap_password", fallback?: string|null }, logger) => Promise<string | null>`). Calls the existing `verify-email-credentials` function via a plain `fetch()` to `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-email-credentials` with `Authorization: Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, matching its documented request shape: `{ imap: { host, port, username, password, secure } }` → response `{ success: boolean, message?: string, error?: string }`.
- Produces: `POST /functions/v1/test-email-account-credentials`. Request body: `{ accountId: string }`. Response is **always** HTTP `200` with `{ success: boolean, message?: string, error?: string }` for any outcome where the test itself ran (host/username missing, no password saved, real connection failure, or success) — non-200 statuses (`401`, `400`, `403`, `404`) are reserved for request-level failures (bad auth, malformed body, account not found). Task 4 (`EmailAccounts.tsx`) calls this via `invokeFunction("test-email-account-credentials", { body: { accountId } })` and reads `data.success`/`data.error` for the always-200 outcomes, and `error.message` only for the request-level failures.

- [ ] **Step 1: Write the edge function**

Create `supabase/functions/test-email-account-credentials/index.ts`:

```ts
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { serveWithLogger } from "../_shared/logger.ts";
import { getEmailCredential } from "../_shared/email-credentials.ts";

declare const Deno: any;

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { user, error: authError } = await requireAuth(req);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { accountId } = payload || {};
    if (!accountId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: accountId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!userRole?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Unable to resolve your tenant. Contact your administrator." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("email_accounts")
      .select("tenant_id, imap_host, imap_port, imap_username, imap_use_ssl, email_address")
      .eq("id", accountId)
      .maybeSingle();

    if (accountError || !account || account.tenant_id !== userRole.tenant_id) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!account.imap_host || !account.imap_username) {
      return new Response(
        JSON.stringify({ success: false, error: "IMAP host/username not configured for this account." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const imapPassword = await getEmailCredential(
      supabaseAdmin,
      { account_id: accountId, purpose: "imap_password" },
      logger,
    );

    if (!imapPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No IMAP password saved for this account yet — save your SMTP/IMAP credentials first.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const functionsBaseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
    const verifyResponse = await fetch(`${functionsBaseUrl}/verify-email-credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        imap: {
          host: account.imap_host,
          port: account.imap_port || 993,
          username: account.imap_username || account.email_address,
          password: imapPassword,
          secure: account.imap_use_ssl ?? true,
        },
      }),
    });
    const verifyResult = await verifyResponse.json().catch(() => ({}));

    if (verifyResult?.success) {
      return new Response(
        JSON.stringify({ success: true, message: verifyResult.message || "Connection successful" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: verifyResult?.error || "Connection test failed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    logger.error("Error testing email account credentials:", { error });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}, "test-email-account-credentials");
```

- [ ] **Step 2: Register in `function_importers.ts`**

In `supabase/functions/main/function_importers.ts`, insert this line immediately after the `"sync-hts-data"` line, before `"track-email"`:

```ts
  "test-email-account-credentials": () => import("../test-email-account-credentials/index.ts"),
```

- [ ] **Step 3: Register in `verify_jwt_map.ts`**

In `supabase/functions/main/verify_jwt_map.ts`, insert this line immediately after the `"sync-hts-data": false,` line, before `"win-probability": false,`:

```ts
  "test-email-account-credentials": false,
```

- [ ] **Step 4: Register in `config.toml`**

In `supabase/config.toml`, insert this block immediately after the `[functions.sync-hts-data]` block, before `[functions.win-probability]`:

```toml
[functions.test-email-account-credentials]
verify_jwt = false

```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/test-email-account-credentials/index.ts supabase/functions/main/function_importers.ts supabase/functions/main/verify_jwt_map.ts supabase/config.toml
git commit -m "feat(email): add test-email-account-credentials edge function

Fixes the 'Test IMAP Connection' button, which has read a dropped
imap_password column from local state (always undefined) since the
same 2026-05-29 migration that broke Save Account."
```

---

### Task 3: Fix `EmailAccountDialog.tsx`'s Save Account path

**Files:**
- Modify: `src/features/module-communications/components/email/EmailAccountDialog.tsx:124-180` (the `handleSave` function)
- Test: `src/features/module-communications/components/email/EmailAccountDialog.test.tsx`

**Interfaces:**
- Consumes: `invokeFunction` from `@/lib/supabase-functions` (already imported in this file — signature: `invokeFunction<T>(functionName: string, options: { body?: any }) => Promise<{ data: T | null, error: any }>`); Task 1's `save-smtp-imap-account` contract (request body `{ accountId?, provider, ...formConfig }`, success `200 { id }`, error `{ error: string }` with a non-2xx status, which `invokeFunction` surfaces as `error.message`).
- Produces: `handleSave` calling `invokeFunction("save-smtp-imap-account", { body: { accountId: account?.id, provider: providerId, ...formConfig } })` instead of `supabase.from("email_accounts").update()/.insert()`.

- [ ] **Step 1: Replace `handleSave`**

In `src/features/module-communications/components/email/EmailAccountDialog.tsx`, replace the entire `handleSave` function (currently lines 124-180) with:

```ts
  const handleSave = async () => {
    const provider = emailPluginRegistry.getPlugin(providerId);
    if (!provider) return;

    // Validate config
    const validation = await provider.validateConfig(formConfig);
    if (!validation.isValid) {
        toast({
            title: "Error",
            description: validation.error || "Invalid configuration",
            variant: "destructive"
        });
        return;
    }

    setSaving(true);
    try {
      const { error } = await invokeFunction("save-smtp-imap-account", {
        body: {
          accountId: account?.id,
          provider: providerId,
          ...formConfig,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: account ? "Account updated successfully" : "Account added successfully",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
```

No other line in this file changes. `invokeFunction` is already imported at the top of the file (line 7); `supabase` stays imported and used by `handleConnect`'s fallback (`supabase.auth.getUser()`).

- [ ] **Step 2: Add the failing tests**

In `src/features/module-communications/components/email/EmailAccountDialog.test.tsx`, add a mock for `@/lib/supabase-functions` right after the existing `@/integrations/supabase/client` mock (after line 25):

```ts
const invokeFunctionMock = vi.fn();
vi.mock('@/lib/supabase-functions', () => ({
  invokeFunction: (...args: unknown[]) => invokeFunctionMock(...args),
}));
```

Add a new fixture function after `gmailAccount()` (after line 47):

```ts
function smtpImapAccount() {
  return {
    id: 'acc-smtp-imap',
    provider: 'smtp_imap',
    email_address: 'test@example.com',
    display_name: 'Test SMTP Account',
    is_primary: false,
    smtp_host: 'smtp.example.com',
    smtp_port: 587,
    smtp_username: 'test@example.com',
    smtp_use_tls: true,
    imap_host: 'imap.example.com',
    imap_port: 993,
    imap_username: 'test@example.com',
    imap_use_ssl: true,
    // smtp_password / imap_password intentionally absent: those columns
    // were dropped from email_accounts, so a real fetched row never has
    // them -- the user must always retype the password to save it.
  };
}
```

Add `vi.mock('./EmailAutoSetup', ...)` right after the `EmailAccountDialog` import (after line 27), for the create-path test:

```ts
vi.mock('./EmailAutoSetup', () => ({
  EmailAutoSetup: ({ onManual }: { onManual: () => void }) => (
    <button onClick={onManual}>Manual Configure (test)</button>
  ),
}));
```

Add a new `describe` block at the end of the file, after the existing `describe('EmailAccountDialog OAuth connect', ...)` block's closing `});`:

```ts
describe('EmailAccountDialog SMTP/IMAP save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves SMTP/IMAP credentials via the save-smtp-imap-account edge function (the exact live bug fixed today)', async () => {
    invokeFunctionMock.mockResolvedValue({ data: { id: 'acc-smtp-imap' }, error: null });
    const user = userEvent.setup();
    render(
      <EmailAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={smtpImapAccount()}
        onSuccess={vi.fn()}
      />,
    );

    await user.type(await screen.findByLabelText(/SMTP Password/i), 'new-smtp-app-password');
    await user.type(screen.getByLabelText(/IMAP Password/i), 'new-imap-app-password');
    await user.click(screen.getByRole('button', { name: /Save Account/i }));

    await waitFor(() =>
      expect(invokeFunctionMock).toHaveBeenCalledWith('save-smtp-imap-account', {
        body: expect.objectContaining({
          accountId: 'acc-smtp-imap',
          provider: 'smtp_imap',
          smtp_host: 'smtp.example.com',
          smtp_password: 'new-smtp-app-password',
          imap_host: 'imap.example.com',
          imap_password: 'new-imap-app-password',
        }),
      }),
    );
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Success', description: 'Account updated successfully' }),
      ),
    );
  });

  it('shows an error toast when save-smtp-imap-account returns an error (e.g. the old dropped-column failure)', async () => {
    invokeFunctionMock.mockResolvedValue({
      data: null,
      error: { message: "Could not find the 'imap_password' column of 'email_accounts' in the schema cache" },
    });
    const user = userEvent.setup();
    render(
      <EmailAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={smtpImapAccount()}
        onSuccess={vi.fn()}
      />,
    );

    await user.type(await screen.findByLabelText(/SMTP Password/i), 'new-smtp-app-password');
    await user.type(screen.getByLabelText(/IMAP Password/i), 'new-imap-app-password');
    await user.click(screen.getByRole('button', { name: /Save Account/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: "Could not find the 'imap_password' column of 'email_accounts' in the schema cache",
          variant: 'destructive',
        }),
      ),
    );
  });

  it('passes accountId: undefined when creating a brand-new SMTP/IMAP account', async () => {
    invokeFunctionMock.mockResolvedValue({ data: { id: 'new-acc' }, error: null });
    const user = userEvent.setup();
    render(
      <EmailAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={undefined}
        onSuccess={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /Manual Configure \(test\)/i }));
    await user.click(screen.getByRole('tab', { name: /SMTP \/ IMAP/i }));

    await user.type(screen.getByLabelText(/Display Name/i), 'New SMTP Account');
    await user.type(screen.getByLabelText(/Email Address/i), 'new@example.com');
    await user.type(screen.getByLabelText(/SMTP Host/i), 'smtp.new.com');
    await user.type(screen.getByLabelText(/SMTP Port/i), '587');
    await user.type(screen.getByLabelText(/SMTP Username/i), 'new@example.com');
    await user.type(screen.getByLabelText(/SMTP Password/i), 'smtp-pw');
    await user.type(screen.getByLabelText(/IMAP Host/i), 'imap.new.com');
    await user.type(screen.getByLabelText(/IMAP Port/i), '993');
    await user.type(screen.getByLabelText(/IMAP Username/i), 'new@example.com');
    await user.type(screen.getByLabelText(/IMAP Password/i), 'imap-pw');
    await user.click(screen.getByRole('button', { name: /Save Account/i }));

    await waitFor(() =>
      expect(invokeFunctionMock).toHaveBeenCalledWith('save-smtp-imap-account', {
        body: expect.objectContaining({
          accountId: undefined,
          provider: 'smtp_imap',
          display_name: 'New SMTP Account',
        }),
      }),
    );
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail against the pre-fix code**

Run: `npx vitest run src/features/module-communications/components/email/EmailAccountDialog.test.tsx`
Expected: the 3 new tests in `EmailAccountDialog SMTP/IMAP save` FAIL (the mock `invokeFunctionMock` is never called, since the pre-fix `handleSave` calls `supabase.from(...)` instead) — the existing 3 tests in `EmailAccountDialog OAuth connect` still PASS.

- [ ] **Step 4: Apply Step 1's `handleSave` replacement, then rerun**

Run: `npx vitest run src/features/module-communications/components/email/EmailAccountDialog.test.tsx`
Expected: all 6 tests PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/module-communications/components/email/EmailAccountDialog.tsx src/features/module-communications/components/email/EmailAccountDialog.test.tsx
git commit -m "fix(email): route SMTP/IMAP account save through save-smtp-imap-account

handleSave was spreading smtp_password/imap_password directly into a
browser-side email_accounts .update()/.insert(), which has failed
every time since those columns were dropped on 2026-05-29. Now calls
the new vault-backed edge function instead."
```

---

### Task 4: Fix `EmailAccounts.tsx`'s Test IMAP Connection path

**Files:**
- Modify: `src/features/module-communications/components/email/EmailAccounts.tsx:8` (import line) and `:179-208` (the `testImap` function)
- Test: `src/features/module-communications/components/email/EmailAccounts.test.tsx`

**Interfaces:**
- Consumes: `invokeFunction` from `@/lib/supabase-functions` (already imported in this file); Task 2's `test-email-account-credentials` contract (request `{ accountId }`, response always `200 { success, message?, error? }` for a completed test, or a non-2xx `{ error }` for a request-level failure).
- Produces: `testImap` calling `invokeFunction("test-email-account-credentials", { body: { accountId } })` instead of reading `acc.imap_password` from local state and calling `verify-email-credentials` via `invokeAnonymous`.

- [ ] **Step 1: Replace the import and `testImap`**

In `src/features/module-communications/components/email/EmailAccounts.tsx`, change line 8 from:

```ts
import { invokeFunction, invokeAnonymous } from "@/lib/supabase-functions";
```

to:

```ts
import { invokeFunction } from "@/lib/supabase-functions";
```

(`invokeAnonymous` becomes unused once `testImap` no longer calls `verify-email-credentials` directly — it has no other call site in this file.)

Replace the entire `testImap` function (currently lines 179-208) with:

```ts
  const testImap = async (accountId: string) => {
    try {
      const acc = accounts.find(a => a.id === accountId) as any;
      if (!acc) {
        toast({ title: "Error", description: "Account not found", variant: "destructive" });
        return;
      }
      const { data, error } = await invokeFunction("test-email-account-credentials", {
        body: { accountId },
      });
      if (error) {
        toast({ title: "IMAP Test Failed", description: error.message || "Connection failed", variant: "destructive" });
        return;
      }
      if (data?.success) {
        toast({ title: "IMAP OK", description: data?.message || "Connection successful" });
      } else {
        toast({ title: "IMAP Test Failed", description: data?.error || "Connection failed", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "IMAP Test Failed", description: e?.message || "Connection failed", variant: "destructive" });
    }
  };
```

- [ ] **Step 2: Add the failing tests**

In `src/features/module-communications/components/email/EmailAccounts.test.tsx`:

Replace the existing `@/hooks/use-toast` mock (lines 5-11) with one that exposes a stable, assertable mock (the current one returns a fresh `vi.fn()` on every `useToast()` call, so no test can assert against it):

```ts
const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toasts: [],
    toast: (...args: unknown[]) => toastMock(...args),
    dismiss: vi.fn(),
  }),
}));
```

Add a mock for `@/lib/supabase-functions` right after the `@/hooks/use-toast` mock:

```ts
const invokeFunctionMock = vi.fn();
vi.mock('@/lib/supabase-functions', () => ({
  invokeFunction: (...args: unknown[]) => invokeFunctionMock(...args),
}));
```

Change the imports on line 1 from:

```ts
import { render, screen, within } from '@testing-library/react';
```

to:

```ts
import { render, screen, within, waitFor } from '@testing-library/react';
```

and add, immediately after it:

```ts
import userEvent from '@testing-library/user-event';
```

Add a new account to the `ACCOUNTS` array (after the `acc-smtp` entry, currently line 26):

```ts
  { id: 'acc-smtp-imap', provider: 'smtp_imap', email_address: 'smtpimap@example.com', display_name: 'SMTP IMAP Test Account', is_primary: false, is_active: true, last_sync_at: null, created_at: '2026-01-01T00:00:00Z', user_id: 'u1' },
```

Add a new `describe` block at the end of the file, after the existing `describe('EmailAccounts status badge', ...)` block's closing `});`:

```ts
describe('EmailAccounts testImap', () => {
  beforeEach(() => {
    invokeFunctionMock.mockReset();
    toastMock.mockClear();
  });

  it('shows "IMAP OK" when the test succeeds', async () => {
    invokeFunctionMock.mockResolvedValue({ data: { success: true, message: 'Connection successful' }, error: null });
    const user = userEvent.setup();
    render(<EmailAccounts />);
    const card = await screen.findByText('SMTP IMAP Test Account');
    const cardEl = card.closest('.border-2') as HTMLElement;
    await user.click(within(cardEl).getByRole('button', { name: /Test IMAP/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'IMAP OK', description: 'Connection successful' }),
      ),
    );
    expect(invokeFunctionMock).toHaveBeenCalledWith('test-email-account-credentials', {
      body: { accountId: 'acc-smtp-imap' },
    });
  });

  it('shows the specific "no password saved" message when credentials were never saved', async () => {
    invokeFunctionMock.mockResolvedValue({
      data: { success: false, error: 'No IMAP password saved for this account yet — save your SMTP/IMAP credentials first.' },
      error: null,
    });
    const user = userEvent.setup();
    render(<EmailAccounts />);
    const card = await screen.findByText('SMTP IMAP Test Account');
    const cardEl = card.closest('.border-2') as HTMLElement;
    await user.click(within(cardEl).getByRole('button', { name: /Test IMAP/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'IMAP Test Failed',
          description: 'No IMAP password saved for this account yet — save your SMTP/IMAP credentials first.',
          variant: 'destructive',
        }),
      ),
    );
  });

  it('shows the real connection-failure message from a bad password', async () => {
    invokeFunctionMock.mockResolvedValue({ data: { success: false, error: 'Invalid credentials' }, error: null });
    const user = userEvent.setup();
    render(<EmailAccounts />);
    const card = await screen.findByText('SMTP IMAP Test Account');
    const cardEl = card.closest('.border-2') as HTMLElement;
    await user.click(within(cardEl).getByRole('button', { name: /Test IMAP/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'IMAP Test Failed', description: 'Invalid credentials', variant: 'destructive' }),
      ),
    );
  });

  it('shows an error toast when the edge function call itself fails', async () => {
    invokeFunctionMock.mockResolvedValue({ data: null, error: { message: 'Network error' } });
    const user = userEvent.setup();
    render(<EmailAccounts />);
    const card = await screen.findByText('SMTP IMAP Test Account');
    const cardEl = card.closest('.border-2') as HTMLElement;
    await user.click(within(cardEl).getByRole('button', { name: /Test IMAP/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'IMAP Test Failed', description: 'Network error', variant: 'destructive' }),
      ),
    );
  });
});
```

- [ ] **Step 3: Run the tests to verify the new ones fail against the pre-fix code**

Run: `npx vitest run src/features/module-communications/components/email/EmailAccounts.test.tsx`
Expected: the 4 new tests in `EmailAccounts testImap` FAIL (pre-fix `testImap` never calls `invokeFunction` — it calls `invokeAnonymous`, which isn't mocked, and its own local `acc.imap_host`/`imap_username`/`imap_password` guard fires the unrelated `"Missing IMAP settings"` toast instead) — the existing 4 tests in `EmailAccounts status badge` still PASS.

- [ ] **Step 4: Apply Step 1's `testImap` replacement, then rerun**

Run: `npx vitest run src/features/module-communications/components/email/EmailAccounts.test.tsx`
Expected: all 8 tests PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no new errors. (This step also confirms `invokeAnonymous` was fully removed and doesn't trip an unused-import error.)

- [ ] **Step 6: Commit**

```bash
git add src/features/module-communications/components/email/EmailAccounts.tsx src/features/module-communications/components/email/EmailAccounts.test.tsx
git commit -m "fix(email): route Test IMAP Connection through test-email-account-credentials

testImap read acc.imap_password from local state, a column dropped
from email_accounts on 2026-05-29 -- always undefined, so the button
has always failed with 'Missing IMAP settings' regardless of whether
credentials were ever saved. Now calls the new vault-backed edge
function, which distinguishes 'never saved' from a real connection
failure."
```
