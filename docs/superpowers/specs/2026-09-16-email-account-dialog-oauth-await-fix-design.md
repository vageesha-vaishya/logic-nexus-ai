# EmailAccountDialog OAuth Silent-Failure Fix — Design

## Background

Discovered live today while testing OAuth re-authorization in production,
as a direct follow-up to the orphaned-vault-credentials remediation
(`docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md`).
Clicking "Connect with Microsoft Office 365" in the "Manual Configure
Email Account" dialog produced zero visible feedback — no toast, no
error, no navigation. Reading the browser console (not guessing)
revealed the real cause: an `Unhandled Promise Rejection` carrying
`Error: Office 365 OAuth not configured. System administrator must set
VITE_MICROSOFT_CLIENT_ID or User must provide custom configuration.` —
reproduced 3 separate times against live production (once via the
Accounts tab's "Re-authorize" button, twice via this dialog's own
"Connect with Microsoft Office 365" button).

**Correction, added after the final whole-branch review:** the
Accounts tab's "Re-authorize" button (`EmailAccounts.tsx`'s
`handleReauthorize`) already correctly `await`s and already surfaces a
toast on error — it was not silent. Its reproduction demonstrated the
same *underlying* unconfigured-Office-365 error (via a visible toast),
not the *silent-failure symptom* that only this dialog's `handleConnect`
exhibits. The silence itself was observed specifically via this
dialog's own "Connect with Microsoft Office 365" button, twice.

### Root cause

`src/features/module-communications/components/email/EmailAccountDialog.tsx`'s
`handleConnect` (lines 89-122):

```ts
const handleConnect = async (provider: string) => {
  const { email_address, display_name, is_primary } = formConfig;
  if (!email_address) {
    toast({ title: "Error", description: "Please enter your email address first", variant: "destructive" });
    return;
  }
  try {
    sessionStorage.setItem("oauth_hint_email", email_address);
    sessionStorage.setItem("oauth_hint_name", display_name || email_address.split('@')[0]);
    sessionStorage.setItem("oauth_hint_is_primary", String(is_primary));
    if (provider === "gmail") {
      initiateGoogleOAuth(context.userId || (supabase.auth.getUser() as any)?.id);
    } else if (provider === "office365") {
      initiateMicrosoftOAuth(context.userId || (supabase.auth.getUser() as any)?.id);
    } else {
      setMode('manual');
    }
  } catch (error: any) {
    toast({ title: "Error", description: error.message, variant: "destructive" });
  }
};
```

`initiateGoogleOAuth`/`initiateMicrosoftOAuth`
(`src/lib/oauth.ts`) are both `async function`s that `throw` on real
failure conditions (missing OAuth configuration being the one hit
today). Because the calls above have no `await`, the `try` block
returns control immediately — the promise these calls return hasn't
settled yet. By the time it later rejects, the surrounding `try/catch`
has already exited; there is nothing left to catch it. The rejection
becomes a fully unhandled promise rejection, visible only in the browser
console, invisible to the actual user. This affects both branches
identically — Gmail's path isn't currently *exercised* in production
(all 3 Gmail `oauth_configurations` rows already carry real client IDs,
so `initiateGoogleOAuth` never reaches its own throw today), but the
missing `await` is present on both calls, not just Office 365's.

### The correct pattern already exists in this codebase

`src/features/module-communications/components/email/EmailAutoSetup.tsx`'s
own `handleOAuth` calls the exact same two functions correctly:

```ts
const handleOAuth = async (provider: string) => {
  try {
    sessionStorage.setItem("oauth_hint_email", email);
    sessionStorage.setItem("oauth_hint_name", email.split('@')[0]);
    sessionStorage.setItem("oauth_hint_is_primary", "false");
    if (provider === 'gmail') {
      await initiateGoogleOAuth(context.userId);
    } else if (provider === 'office365') {
      await initiateMicrosoftOAuth(context.userId);
    } else {
      throw new Error(`OAuth provider ${provider} not supported yet`);
    }
  } catch (err: any) {
    setError(err.message);
  }
};
```

This is exactly why testing the same account through *that* dialog (the
"Add Email Account" auto-detect flow) today showed a proper inline red
error message, while `EmailAccountDialog.tsx`'s manual-configure flow
showed nothing at all for the identical underlying failure.

**Correction, added after the final whole-branch review:** a repo-wide
grep for the static `import { initiateGoogleOAuth, initiateMicrosoftOAuth
} from ...` form finds exactly these 2 call sites — but there is a
**third**: `src/features/module-communications/components/email/EmailAccounts.tsx`'s
own `handleReauthorize` (the Accounts tab's "Re-authorize" button) calls
both functions via a dynamic `await import('@/lib/oauth')`, which that
grep pattern misses. Read directly and confirmed already correct: both
calls are properly `await`ed inside a `try` whose `catch` toasts
`error.message` — this is in fact the third real-world OAuth entry
point in the app, and it already behaves the way this fix is making
`EmailAccountDialog.tsx` behave. So "no other file needs to change" is
still the right conclusion, but it holds because that third call site
already got this right independently, not because only 2 call sites
exist.

## Goal

Make `EmailAccountDialog.tsx`'s OAuth-connect failures actually visible
to the user, by fixing the missing `await`.

## Architecture

One file, two lines. In `handleConnect`, add `await` to both calls:

```ts
    if (provider === "gmail") {
      await initiateGoogleOAuth(context.userId || (supabase.auth.getUser() as any)?.id);
    } else if (provider === "office365") {
      await initiateMicrosoftOAuth(context.userId || (supabase.auth.getUser() as any)?.id);
    } else {
      setMode('manual');
    }
```

No other line in `handleConnect`, or anywhere else in the file, changes.
The existing `try/catch` and its `toast({ title: "Error", description:
error.message, variant: "destructive" })` call are already correct —
they only needed a rejection to actually reach them.

## Non-Goals

- **Configuring Office 365 OAuth itself.** No `VITE_MICROSOFT_CLIENT_ID`
  or backend `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` exists
  anywhere in this deployment today (confirmed directly against the
  live Coolify environment). That requires a real Azure AD app
  registration — an external prerequisite this fix does not attempt.
  This fix makes the *absence* of that configuration visible and
  actionable (a clear toast instead of silence); it does not make
  Office 365 OAuth work end-to-end.
- **Changing `initiateGoogleOAuth`/`initiateMicrosoftOAuth`** in
  `src/lib/oauth.ts`. They are already correctly `async` and already
  correctly `throw` — the defect is entirely in the caller forgetting to
  `await`.
- **Changing `EmailAutoSetup.tsx`.** Already correct; serves as the
  reference pattern this fix copies.
- **A general "wrap every async call site in this codebase with a
  linter rule for missing await" effort.** Real and worth doing
  eventually (a `no-floating-promises`-style ESLint rule would have
  caught this), but a much larger, separate initiative than this
  narrowly-scoped bug fix.

## Testing

No test file exists for `EmailAccountDialog.tsx` today (confirmed via
`find src -iname "EmailAccountDialog.test.*"`). This plan creates one,
new: `src/features/module-communications/components/email/EmailAccountDialog.test.tsx`.

Required cases — each mocks `initiateMicrosoftOAuth`/`initiateGoogleOAuth`
to reject with a specific `Error`, drives the dialog to its manual
"Connect with Microsoft Office 365" / "Connect with Gmail / Google
Workspace" button, clicks it, and asserts the error toast actually fires
with that specific message:

- **The direct regression guard:** `initiateMicrosoftOAuth` rejects with
  `Error("Office 365 OAuth not configured...")` (the exact failure
  reproduced live today) — asserts the error toast fires with that
  message. This is the test that would fail against today's code (the
  rejection never reaches the `catch`, so no toast call is ever made)
  and pass once `await` is added.
- **Symmetry case for Gmail:** same shape, `initiateGoogleOAuth` rejects
  with a distinct test error message — asserts the error toast fires
  with *that* message. Not currently reachable in production (Gmail
  configs already exist), but the missing-`await` defect was present on
  this call too, so this closes the same class of bug on both branches.
- **A passing-path sanity check:** `initiateGoogleOAuth` resolves
  (doesn't reject) — asserts no error toast fires. Guards against a
  regression where `await` is added but something else breaks the
  happy path.

## Global Constraints

- Confined to `EmailAccountDialog.tsx` and its new test file — no
  change to `EmailAutoSetup.tsx`, `src/lib/oauth.ts`, or any other file.
- No change to the toast messages, button labels, or any UI text — only
  the two `await` keywords are added.
