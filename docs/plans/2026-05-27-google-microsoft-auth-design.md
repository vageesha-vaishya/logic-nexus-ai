# Google + Microsoft 365 Authentication

**Status:** Design — ready for implementation
**Date:** 2026-05-27
**Author:** brainstorm session, auth thread

## Context

The platform's only sign-in mechanism today is email + password, wired in
`src/pages/Auth.tsx` and `src/features/markets/sthira/SthiraSplashRoute.tsx`.
Supabase Auth supports Google and Azure (Microsoft) OAuth providers natively
but they're not enabled on the server, no UI buttons exist, and there's no
native deep-link handling on the Sthira Capacitor app.

This design adds **Continue with Google** and **Continue with Microsoft**
to both the web and mobile sign-in surfaces, with a frictionless new-user
flow: brand-new OAuth users auto-create a Sthira retail account with zero
extra screens. The same buttons work for existing email/password users
(auto-linking by email), B2B tenant admins, and invite-link recipients.

## Decision summary

- **Audience:** B2C retail + B2B together, single OAuth surface.
- **New users:** auto-create Sthira retail. They can convert to B2B via
  invite or by adding an organisation from Settings later. Matches the
  current `/auth` email/password default which already does this.
- **Native flow:** system browser via `@capacitor/browser` (already in the
  bundle). One code path shared with web; no native SDKs.
- **OAuth providers:** Google + Azure/Microsoft. Sign in with Apple is
  deferred — keeping email/password as a fallback satisfies App Store
  Guideline 4.8.
- **No per-user, no per-tenant config.** One-time platform setup in
  Google Cloud + Azure Portal + Supabase Dashboard, ~20 minutes.
- **Rollback:** `VITE_ENABLE_OAUTH` flag gates the buttons. Flip to false
  and the existing email/password path is untouched.

## Architecture: one OAuth surface, two button taps

`src/pages/Auth.tsx` and `SthiraSplashRoute.tsx` both add two buttons
above the existing email field: `[G] Continue with Google` and
`[⊞] Continue with Microsoft`. Both invoke a shared helper
`signInWithProviderOAuth(provider)` that wraps:

```ts
supabase.auth.signInWithOAuth({
  provider,                                    // 'google' | 'azure'
  options: {
    redirectTo: getOAuthRedirectUrl(),         // web URL or native deep-link
    queryParams: provider === 'azure'
      ? { prompt: 'select_account' }
      : { access_type: 'offline', prompt: 'consent select_account' },
    scopes: provider === 'azure'
      ? 'email openid profile offline_access'
      : 'email openid profile',
  },
});
```

`getOAuthRedirectUrl()` returns:
- **Web:** `https://app.sosservices.online/oauth/callback` (route already
  exists in `App.tsx`).
- **Native (Capacitor):** `com.sos.sthira://auth-callback` (registered as
  Android intent-filter + iOS URL scheme).

**Server-side enablement** lives in Supabase Dashboard → Auth → Providers:
- Google: client ID + secret from Google Cloud Console.
- Microsoft (Azure AD): client ID + secret from Azure Portal app
  registration. Tenant = `common` so work, school, and personal
  Microsoft accounts all work.

**Post-callback handling** is unified: the `/oauth/callback` page (web) and
the deep-link handler (native) both call `supabase.auth.getSession()`,
then delegate to `RootRedirect`, which already routes signed-in users by
their active membership (`useIsRetailOnly` → Sthira; else `/dashboard`).

No code path duplication: web and native share `supabase.auth.signInWithOAuth`.
Capacitor Browser is just the URL opener for native. The provider config,
the helper, and the callback handler are identical.

## Web flow: two buttons, four code touchpoints

### Where the buttons live

1. **`src/pages/Auth.tsx`** — existing email/password card. Above the
   email field: two full-width buttons stacked, then a
   `── or continue with email ──` divider, then the existing form.
   Same buttons on sign-in and sign-up tabs — Supabase decides existing
   vs new automatically.

2. **`src/features/markets/sthira/SthiraSplashRoute.tsx`** — Sthira's
   pre-auth landing. The current `Continue` CTA stays for
   email/password; the two OAuth buttons go above it, in the
   copper theme.

### The shared helper

`src/lib/auth/oauthSignIn.ts`:

```ts
export async function signInWithProviderOAuth(
  provider: 'google' | 'azure',
  options: { intent?: 'sthira' | 'b2b' | 'invite' } = {},
) {
  const isNative = Capacitor.isNativePlatform();
  const redirectTo = isNative
    ? 'com.sos.sthira://auth-callback'
    : `${window.location.origin}/oauth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, queryParams: providerHints(provider) },
  });
  if (error) throw error;
  if (isNative && data?.url) await Browser.open({ url: data.url });
  // web: Supabase auto-redirects, no further action needed
}
```

### Callback handling

`OAuthCallback.tsx` at `/oauth/callback` (already in `App.tsx`) calls
`supabase.auth.getSession()`, then renders `<Navigate to="/" replace />`.
`RootRedirect` routes signed-in users to their correct shell.

### Account linking

When an existing email/password user clicks Google with the same email,
Supabase **auto-links** the OAuth identity to the existing `auth.users`
row. No "merge accounts" dialog, no duplicate user. Subsequent sign-ins
work either way (email/password OR OAuth).

### Toast + error surface

`signInWithProviderOAuth` rejects on network failure or provider misconfig.
Caller wraps in try/catch + `toast.error(e?.message ?? "Sign-in failed")`.
No silent failures.

## Native iOS / Android: deep-link plumbing

### The flow on a device

1. User taps **Continue with Google** in the Sthira APK.
2. `signInWithProviderOAuth` resolves `data.url` (Supabase-built Google
   authorize URL) and calls `Browser.open({ url })` — Chrome Custom Tabs
   on Android, SFSafariViewController on iOS.
3. User signs in at Google.
4. Google redirects to Supabase's `/auth/v1/callback`, which exchanges
   the code for a session, then issues a **302** to our app's
   `redirectTo` =
   `com.sos.sthira://auth-callback#access_token=…&refresh_token=…`.
5. The OS sees the custom scheme, hands the URL to our app via deep-link,
   the browser tab auto-closes.
6. An `App.addListener('appUrlOpen', …)` handler parses the URL fragment
   and calls `supabase.auth.setSession({ access_token, refresh_token })`.
7. React-Query refetches `useAuth` / `useMemberships`; `RootRedirect`
   routes to the right shell.

### Three files to register the scheme

- **`android/app/src/main/AndroidManifest.xml`** — add to `MainActivity`:
  ```xml
  <intent-filter android:autoVerify="false">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.sos.sthira" android:host="auth-callback" />
  </intent-filter>
  ```
- **`ios/App/App/Info.plist`** — add a `CFBundleURLTypes` entry with
  `CFBundleURLSchemes = ["com.sos.sthira"]`.
- **`src/main.tsx`** (or a new `useDeepLinkAuth` hook mounted in
  `<App />`) — register `App.addListener('appUrlOpen', handler)` once
  at boot.

### Gotchas captured

- Use **lowercase scheme** (`com.sos.sthira`) — Android Intent matchers
  are case-sensitive; iOS tolerates mixed-case but lowercase keeps
  both platforms aligned.
- `BROWSABLE` category is required for Chrome Custom Tabs to route
  back.
- The Capacitor Browser `open` returns immediately; do NOT `await` a
  close — closing happens implicitly when the OS hands the URL to
  our app.
- iOS: when the user taps **Cancel** in SFSafariViewController, no URL
  is delivered. Listen for `browserFinished` and surface a
  "Sign-in cancelled" toast instead of leaving a spinner.

## Onboarding & multi-membership routing

### Three users to handle

**A. Brand-new user.** Google/Microsoft returns an email Supabase has
never seen. `auth.users` row created automatically; existing
`handle_new_user` DB trigger creates the Sthira retail `user_roles`
membership, the `profiles` row, and (if onboarding-foundation tables
apply) the wizard-progress row. `RootRedirect` sees the session, sees
`is_retail` on the active membership, sends them to `/sthira/splash`
→ onboarding wizard. **No email-verification step** because Google /
Microsoft pre-verify — `email_confirmed_at` is set by the OAuth
handshake. **One less step than email/password signup.**

**B. Existing user, single membership.** Email matches a known
`auth.users` row. Supabase auto-links the OAuth identity. `RootRedirect`
routes to their one shell. Done.

**C. Existing user, multiple memberships.** This is where the
trap-pattern from the 2026-05-27 session bites. We add a
**login-time membership chooser**: after OAuth callback, if
`memberships.length >= 2` AND `user_active_membership` is either
missing OR older than 30 days, route to a new `/oauth/choose-account`
page listing all memberships (reuse `MembershipSwitcher`'s row
component). User picks one → writes `user_active_membership` →
`RootRedirect` proceeds. Stale `user_active_membership` is the root
cause of the trap; refreshing it at login closes that loop forever.

### Invite tokens

If the user arrived via `/invite/:token`, `InviteAccept` writes the
token to `localStorage` (`pending_invite_token`) before redirecting to
`/auth`. After the OAuth callback succeeds, the post-callback handler
reads the token, calls the existing `accept-invite` edge function,
adds the new tenant membership, and lands the user in that tenant's
shell. **Zero extra clicks**: the user typed nothing, Google verified
the address, the invite is consumed.

### Skipped steps that email/password still requires

- ❌ Confirm-email screen (OAuth pre-verified)
- ❌ Password creation
- ❌ Password recovery flow (Supabase keeps email/password as fallback;
  OAuth users don't need it)
- ❌ CAPTCHA (OAuth provider rate-limits + risk-scores upstream)

## Edge cases + testing

### Edge cases that must work

| Case | Handling |
|---|---|
| User cancels in Google chooser | iOS `browserFinished` event with no deep-link → `toast.info("Sign-in cancelled")`, dismiss spinner. Android: same shape via `Browser` plugin. |
| Email matches existing account that has a different OAuth identity already linked | Supabase returns `{ error: 'identity_already_exists' }`. We show a recovery dialog: "This email already uses Microsoft. Continue with Microsoft?" — link to the other provider button. |
| Apple App Store Guideline 4.8 | Required when ONLY third-party social login is offered. We keep email/password as fallback, which satisfies the guideline. Sign-in with Apple deferred. |
| Provider down (5xx) | `signInWithOAuth` rejects → toast `"Google sign-in unavailable, try email instead"`. Email/password path stays alive. |
| Refresh token expiry | Supabase rotates automatically. No app code. |
| Multi-account Google | `prompt: 'select_account'` query param forces the account chooser. No silent reuse of stale sessions. |
| Web cookies disabled | `signInWithOAuth` fails fast → toast `"Enable cookies to sign in"`. |

### Test plan

- **Unit (vitest):** mock `supabase.auth.signInWithOAuth` returning
  `{ url, error: null }` and `{ url: null, error: … }`; assert the
  `oauthSignIn` helper calls `Browser.open` only on native + only with
  a valid URL. ~6 cases.
- **E2E happy-path (Playwright):** intercept the OAuth provider with a
  stub that returns a known `id_token`; assert the user lands on
  `/sthira/splash` for new signups, `/dashboard` for B2B existing.
  2 cases.
- **Manual smoke matrix** (one-time before ship): web Chrome / Safari /
  Firefox × Sthira APK × iOS TestFlight × {brand-new Google account,
  existing email/pw user, multi-membership user, invite-token flow}.

### Rollback

OAuth buttons hidden behind a `VITE_ENABLE_OAUTH` env flag. Flip to
`false` and the existing email/password path is untouched. Zero
migration risk; no DB changes required.

## One-time external setup (~20 minutes)

| Where | What | Stored |
|---|---|---|
| Google Cloud Console → APIs & Services → Credentials | Create one **OAuth 2.0 Web Application** client. Authorized redirect URI: `https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/callback`. | client_id + secret |
| Azure Portal → App registrations → New | Create one app. Supported account types = "Accounts in any organizational directory and personal Microsoft accounts". Redirect URI (Web): same Supabase callback URL. API permissions: `email`, `openid`, `profile`, `offline_access`. | client_id + secret |
| Supabase Dashboard → Auth → Providers | Toggle **Google** + **Azure (Microsoft)** on. Paste the four values from above. | — (lives only in Supabase) |
| Supabase Dashboard → Auth → URL Configuration | Add to **Redirect URLs** allow-list: `https://app.sosservices.online/oauth/callback` AND `com.sos.sthira://auth-callback`. | — |

**Zero per-tenant, zero per-user setup.** The same Google client + Azure
app registration serve every tenant and every user. Provider keys rotate
at platform level, never at user level.

## Out of scope (v1)

- **Sign in with Apple.** Adds Apple-specific OAuth setup, complicates
  the App Store submission window. Email/password fallback satisfies
  4.8.
- **Google Workspace domain restriction** (`hd` param) for B2B
  tenants. Useful when an Acme Corp admin wants only `@acme.com`
  users to sign in. Defer until a tenant requests it.
- **Magic links** (passwordless email). Different surface; not in this
  brief.
- **WebAuthn / passkeys.** Different surface; future.
- **Linking flow UI** — a "Linked accounts" page in Settings where
  users see which providers they've connected. v1 just shows the
  buttons on the sign-in surface; we can add the management UI later.

## Migration / rollout

1. Wire the external setup (Google Cloud + Azure + Supabase Dashboard)
   — one platform owner, 20 minutes.
2. Land the code (one PR per slice, three slices: web buttons, helper +
   callback, native deep-link).
3. Behind `VITE_ENABLE_OAUTH=false` in `.env.example`; flip per
   environment.
4. Smoke-test on staging.
5. Flip the flag in production, monitor `auth.users` table for unusual
   signups for the first 24h.
6. Once stable, remove the flag.

No DB migration required. No edge-function changes (Supabase Auth
handles the OAuth handshake server-side).
