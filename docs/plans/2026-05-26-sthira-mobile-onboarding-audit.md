# Sthira mobile onboarding — audit + remediation plan

**Date:** 2026-05-26
**Scope:** Customer onboarding journey for the Sthira mobile APK (Capacitor wrapper around the React/Vite codebase). From cold launch through to a usable Home screen with a working portfolio view.
**Status:** 2 BLOCKERS fixed in this session. 5 MAJORs + assorted MINORs + dead code + manifest issues queued for follow-up — scheduled to land before the deferred Play Store upload (~2026-05-31, also gated on keystore rotation per `project_sthira_keystore_rotation` memory).

---

## Onboarding journey (as it stands today)

Cold launch → native Capacitor splash (`launchAutoHide: true`, 1500 ms) → React mounts → `/sthira/splash` → `useSthiraOnboardingProgress` decides one of:

- `auth` → `/auth` *(fixed today, was `/auth/login` — dead route)*
- `risk` → `/sthira/onboarding` → 7-step `SelfOnboardingWizard`
- `complete` → `/dashboard/markets/retail/home` → `SthiraMobileGuard` renders `HomeMobilePage`

The wizard's 7 steps in `STEP_ORDER` (`src/features/markets/retail/self-onboarding/types.ts:21`):

| # | Step | File | Writes |
|---|---|---|---|
| 1 | `welcome` (4 SEBI ack checkboxes) | `steps/StepWelcome.tsx:60` | `retail_profile.disclosure_accepted_at` |
| 2 | `risk_quiz` (10 Q) | `steps/StepRiskQuiz.tsx:33` | `risk_profiles.{risk_tag, experience_level, behavioral_flags, quiz_answers}` |
| 3 | `goals` (1–3 goals + priority) | `steps/StepGoals.tsx:25` | `risk_profiles.goals` |
| 4 | `tiers` (Safety / Core / Experimental sliders) | `steps/StepTiers.tsx:30` | 3 rows in `markets.portfolio_tiers` |
| 5 | `starter` (template card) | `steps/StepStarter.tsx:38` | `risk_profiles.starter_template_slug` |
| 6 | `nominee` (skippable) | `steps/StepNominee.tsx:37` | `retail_profile.nominee` |
| 7 | `summary` → "Take me home" | `steps/StepSummary.tsx:42` | `risk_profiles.onboarding_complete = true` |

Draft persisted to `localStorage` keyed `sthira.onboarding.draft.<uid>`. Resume on a fresh device derived from canonical DB rows via `computeResumeStep` (`useResumeStep.ts:28`).

---

## 🔴 BLOCKERS

### [✅ FIXED 2026-05-26] BLOCKER 1 — Splash routed to non-existent `/auth/login`

- **Where:** `src/features/markets/sthira/SthiraSplashRoute.tsx:26`
- **What broke:** First-install signed-out users land on a blank page (no Route match for `/auth/login`; only `/auth` is defined at `src/App.tsx:363`).
- **Fix shipped:** Changed `auth: "/auth/login"` → `auth: "/auth"` plus the comment header.

### [✅ FIXED 2026-05-26] BLOCKER 2 — SEBI disclosure link 404s + WebView-incompatible `target="_blank"`

- **Where:** `src/features/markets/retail/self-onboarding/steps/StepWelcome.tsx:119`
- **What broke:** "Read full disclosure" linked to `/legal/retail-disclosure` (no such route in `App.tsx`) with `target="_blank"` (silently no-ops inside a Capacitor WebView — there's no second window to open).
- **Fix shipped:** Replaced the `<a target="_blank">` with an inline `<Sheet>` modal that opens in-flow. Sheet contains plain-English expansion of all 4 acks + grievance contact. Marked as draft pending SEBI legal review.

### [❌ FALSE POSITIVE — agent error] BLOCKER 3 — "Lazy Sthira routes have no Suspense boundary"

- **Audit claim:** Sthira lazy routes sit outside the dashboard's Suspense boundary.
- **Reality:** There is a `<Suspense>` at `src/App.tsx:354` wrapping the entire `<Routes>` block (closing at line 1239). All Sthira lazy routes ARE inside that boundary. The audit agent misread the file structure.
- **Action:** None needed. Documenting so future audits don't re-flag this.

---

## 🟠 MAJOR (severely degrade UX — do before Play Store)

### MAJOR 4 — Hardware Back button kills the app mid-onboarding

- **Where:** No `App.addListener('backButton', …)` anywhere in `src/`. Verified via grep.
- **What breaks:** On Android, hardware Back during onboarding triggers the WebView's default — which in Capacitor closes the app at the root route. A user on Step 3 who taps Back loses everything (draft persists in `localStorage`, but they're back at the launcher and have to find the icon again).
- **Suggested fix:** New `useAndroidBack` hook subscribed to `App.addListener('backButton', …)`. When stepIdx > 0, call `goBack()`. When stepIdx === 0, call `App.exitApp()` (or show a confirm dialog first).
- **Effort:** ~30 min.

### MAJOR 5 — Splash watchdog races user queries → infinite splash loop

- **Where:** `src/features/markets/sthira/SthiraSplashRoute.tsx:48-53`
- **What breaks:** The 4 s `setTimeout` always fires regardless of whether `useSthiraOnboardingProgress` resolved. On slow Indian mobile networks (>4 s for the auth query), an un-onboarded user gets forcibly dropped on `/dashboard/markets/retail/home`, where `SthiraMobileGuard.tsx:45` bounces them back to `/sthira/splash` → infinite loop until the queries finally succeed.
- **Suggested fix:** Clear the timer when `step !== "loading"`. Or change the watchdog default destination to `/sthira/onboarding` (safe default — `SelfOnboardingWizard` re-syncs from DB).
- **Effort:** 15 min.

### MAJOR 6 — `useRiskProfile()` `isPending` is `true` forever pre-auth

- **Where:** `src/hooks/useRiskProfile.ts:33` (query disabled when `!user?.id`); `src/features/markets/sthira/useSthiraOnboardingProgress.ts:37`
- **What breaks:** When the query is disabled, `isPending` stays `true`. The splash's `step !== "loading"` guard never opens, the splash hangs. Combined with the fixed-now MAJOR 5, this is the worst-case stall.
- **Suggested fix:** In `useRiskProfile`, expose `isPending: query.isPending && query.fetchStatus !== 'idle'`. Or special-case the disabled state in `useSthiraOnboardingProgress`.
- **Effort:** 15 min + careful review (this hook is used in many places).

### MAJOR 7 — Broker OAuth uses `window.open(_, "_blank")` — broken on mobile

- **Where:** `src/features/markets/.../BrokerConnectionsPage.tsx:358` and `:569`. Manifest at `android/app/src/main/AndroidManifest.xml` has no `intent-filter` for the OAuth return URL.
- **What breaks:** `window.open(url, "_blank")` inside a Capacitor WebView either no-ops or opens an orphan WebView with no back affordance. Even if it works, the broker's redirect URI has no way back into the app — user has to manually copy the auth code from the browser's address bar.
- **Suggested fix (two-part):**
  1. Replace `window.open` with `Browser.open` from `@capacitor/browser` (already a dependency; `SthiraBrokerStatusBanner.tsx:37-44` uses it correctly as a reference pattern).
  2. Add `<intent-filter>` for `com.sos.sthira://broker-callback` to AndroidManifest. Wire `App.addListener('appUrlOpen', …)` to dispatch the auth code back into the connect flow.
- **Effort:** ~2 hr (Capacitor Browser plugin swap is small; manifest + appUrlOpen handler is the bulk).

### MAJOR 8 — Onboarding draft uses raw `localStorage`

- **Where:** `useOnboardingState.ts:20,30`
- **What breaks:** WebView `localStorage` is wiped by Android "Clear cache". Not encrypted. On iOS WKWebView, third-party storage is sometimes pruned. Project already uses `@capacitor/preferences` elsewhere (see `src/lib/queryPersistence.ts`).
- **Suggested fix:** Swap to `@capacitor/preferences` wrapped in the same `useOnboardingDraft` API. Lower priority for Android-only Phase 1 but removes a class of "where did my data go" bugs.
- **Effort:** ~1 hr.

---

## 🟡 Mobile-specific MINOR

- **Touch targets undersized.** `StepShell.tsx:48-55` uses default `<Button>` h-9 (36 px). Android Material Design requires ≥48 dp. Bump to `size="lg"` (h-11 = 44 px) or `min-h-[48px]`.
- **Push permission ambushes user.** `usePushRegistration.ts:29` calls `registerForPush` on `RetailMode` mount — i.e. the moment user finishes onboarding. No pre-rationale screen. Recommendation: one-screen pre-rationale ("We send price alerts and broker daily-approval reminders — turn on notifications?") with a Continue button that *then* calls `registerForPush`.
- **Splash double-flash.** `capacitor.config.ts:49` keeps `launchAutoHide: true` (comment at line 41 explicitly says "PR 2 will flip this to false"). Native splash dismisses after 1500 ms then React mounts and `SthiraSplashRoute` paints its own splash with a 100–300 ms white-flash gap on cold start. Flip to `false` now that `hideSthiraSplash()` is in place (`SthiraSplashRoute.tsx:36-38`).
- **Wizard not code-split.** `SelfOnboardingWizard.tsx:35-41` imports all 7 step components eagerly. Quiz + goals editor pull a lot. First-launch JS payload could be trimmed by lazy-loading steps 3–7.
- **Zero onboarding analytics.** No PostHog `capture()` calls in `src/features/markets/retail/self-onboarding/`. Without per-step events you can't see where users drop off — critical for a 7-step layman flow.
- **Two redundant progress UIs.** `SthiraOnboardingRoute.tsx:19` doesn't pass `totalSteps`/`activeIndex` to `SthiraOnboardingShell`, so the copper progress dots never render — `SelfOnboardingWizard` shows its own `<Progress>` bar instead. Pick one.
- **PAN field has `autoComplete="off"`** (`StepNominee.tsx:140`). Add `inputMode="text"` + `autoCapitalize="characters"` since PAN is uppercase-only.
- **Relationship chips missing `aria-pressed`** (`StepNominee.tsx:111-124`). Screen readers can't tell which is selected.

---

## ⚫ Dead code worth deleting

- **`/sthira/broker` route** (`App.tsx:424-430`) still routed but never reached: `useSthiraOnboardingProgress.ts:14-15,55` returns `"complete"` instead of `"broker"`. Only linked from `HomeMobilePage.tsx:247` as empty-state CTA. **Decision needed:** delete or restore to splash routing.
- **Legacy `src/features/markets/retail/onboarding/`** (5 files: `OnboardingWizard`, `GoalSelector`, `TierSetup`, `RiskQuiz`, `StarterTemplatePicker`) — re-exported from `index.ts:2` but nothing imports them outside the index. Whole directory is unreferenced by the active route tree (the active wizard lives in `self-onboarding/`). Safe to delete.

---

## ⚠️ AndroidManifest issues (separate from React code)

Worth flagging because they affect first-install Sthira regardless of any React-side fix:

- **Missing `android:windowSoftInputMode="adjustResize"`** on `MainActivity`. With `configChanges` covering `keyboardHidden`, Android won't fire a resize and Capacitor's `Keyboard` plugin can't push content above the soft keyboard. Step 6 (nominee, 3 text inputs) and Step 7 (PAN) will have the keyboard cover the Continue button on small phones.
- **Missing `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`**. Android 13+ requires this declared *and* requested at runtime. `@capacitor/push-notifications` adds it via Gradle merger, but verify in the merged manifest — otherwise `registerForPush` will silently fail on Pixel 7+/8.
- **`captureInput: true`** in `capacitor.config.ts:67` consumes hardware keyboard events. Combined with no back-button handler, a Bluetooth-keyboard user can't even use Esc to back out. Low priority for mobile retail but worth noting.

---

## Out-of-scope but caught during audit

- **`HomeMobilePage.tsx:140`** — Tier cards link to `/dashboard/markets/portfolios/${row?.portfolio_id ?? ""}`. When `portfolio_id` is null (tiers persisted without a portfolio bind — common right after onboarding because `StepTiers.tsx:80` writes `portfolio_id: null`), this produces a trailing-slash URL that 404s. First tap on first tier card after onboarding lands in a dead-end. **Fix:** filter the link out when `portfolio_id` is null, OR auto-bind tiers to the seeded paper portfolio in the `provision-retail-user` edge function.

---

## Recommended remediation order

Before Play Store upload (target ~2026-05-31):

1. **Keystore rotation** (per `project_sthira_keystore_rotation` memory — required)
2. **MAJOR 4 + 5 + 7** (back button + splash race + broker OAuth deep-link) — the three highest-impact fixes
3. **Manifest fixes** (POST_NOTIFICATIONS + windowSoftInputMode) — silent failures otherwise
4. **HomeMobilePage tier-card 404** — first thing a fresh-onboarded user can tap
5. **Splash double-flash** (`launchAutoHide: false`) — easy polish
6. **Push permission pre-rationale screen** — affects permission grant rate

Defer to post-launch:

- MAJOR 6 (`useRiskProfile` disabled-state hang) — needs careful review of every call site
- MAJOR 8 (`localStorage` → `@capacitor/preferences`) — works today on Android-only Phase 1
- All MINORs except the two listed above
- Dead-code cleanup — non-functional, just hygiene
- Onboarding analytics wiring — needs PostHog event taxonomy decision
