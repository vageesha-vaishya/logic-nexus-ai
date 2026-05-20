# Sthira Mobile — Onboarding & Markets UX Design

**Date:** 2026-05-20
**Status:** Design — agreed, not yet implemented
**Author:** vimalbahuguna (with Claude)
**Related:** `docs/plans/2026-05-18-retail-investment-platform-design.md`, `docs/plans/2026-05-20-multi-domain-platform-sequence-design.md`, T24a-e mobile shell work, today's broker/portfolio binding work

## Context

The Sthira Android Capacitor shell (`com.sos.sthira`) currently boots into the unified web SPA without any mobile-specific UX, branding, or onboarding. The web SPA itself is tenant-branded via `TenantBrandingContext` and was designed first for desktop. On mobile this means: small touch targets, no bottom nav, no native gestures, and a generic Capacitor splash. The Markets module — the consumer-facing Retail Investment Platform — needs a thumb-first UX and a recognisable consumer brand if Sthira is to ship to Play Store as a standalone product.

This design covers two interlocking pieces: (1) an end-to-end onboarding flow optimised for net-new mobile users, with the existing-user flow falling out as a subset; (2) a mobile UX for the Markets module post-onboarding, anchored in a brand direction the platform doesn't have yet.

## Brand Strategy

**Approach: hybrid (Sthira app brand + tenant theming layered on top).**

Sthira is the consumer-facing identity — logo, splash, app icon, base palette, voice. It does not change per tenant. Tenant-specific theming layers on top for tenant-branded products inside the app (white-label flows, partner accents). This is how Robinhood / Groww / Zerodha Kite operate — strong app identity, partner branding scoped to specific areas.

**Direction: "Calm Wealth".**

The name *Sthira* (Sanskrit स्थिर — *steady, stable*) and the product's three-tier portfolio (Safety Net / Core / Experimental) point toward a thoughtful, advisory tone, not high-FOMO trading-app vibes.

| Token | Value | Use |
|---|---|---|
| `sthira.navy` | `#0F1A2E` | Primary surface, status bar, headers |
| `sthira.cream` | `#F7F3EB` | Default background, cards |
| `sthira.copper` | `#B07645` | Primary action, active states, focus rings |
| `sthira.sage` | `#7C9B7E` | Positive P&L, success states |
| `sthira.terracotta` | `#A8553E` | Negative P&L, destructive actions |
| `sthira.ink` | `#2C2C2C` | Body text |
| `sthira.fog` | `#6B7280` | Secondary text |

**Type system:**
- Headlines + numerals: **Source Serif Pro** (tabular numerals enabled so P&L digits don't shift on update).
- Body + UI: **Inter** (already a project dependency).
- Italic serif reserved for tier names ("Safety Net", "Core Portfolio", "Experimental").

**Voice:**
- Advisory, second-person ("Your Safety Net is on track").
- No exclamation marks, no all-caps shouting numbers.
- Sage/terracotta replace the gambling-app green/red. Small-caps fog for hierarchy ("ON TRACK FOR 2036").

## Onboarding Audience

**Primary: new user, mobile-first** — Play Store install → first holdings view in one journey. SEBI compliance enters through real onboarding (risk profile, suitability, KYC start). The existing web user flow falls out as a subset of this: they sign in, skip already-completed steps, land on Home.

## Onboarding Sequence — Tight 4-step

Step 0 to Home in ~90 seconds. Mandatory advisory steps inline (risk profile, goals). Optional/advanced steps surface on Home as inline cards (additional brokers, KYC details, tier weights tuning).

### Step 0 — Splash (1.5s + warm-up)

Full-bleed navy. Centered "Sthira" wordmark in Source Serif Pro 36pt, copper. Below in small-caps fog: "STEADY WEALTH". No spinner. Dismisses on `(supabase.session resolved) AND (tenant config loaded)`, with a 4s manual fallback.

### Step 1 — Sign up / Sign in (combined sheet)

Cream background. Copper "Sthira" mark top-left. Default: single email field with magic-link send. Secondary: "I have a password" toggle. Tertiary: "Continue with Google" if OAuth wired. Submit copy: "Send link" / "Sign in". Loading replaces the button with a 1.5px copper progress arc — no spinners.

### Step 2 — Risk profile (3 swipeable cards)

Slim progress dots at top (3 copper, rest light grey). Each card asks one question with a 5-point Likert slider. Large finger-target track, copper thumb, sage end ("Steady") to coral end ("Adventurous"). Questions:

1. Market-drop reaction
2. Time horizon
3. Investing experience

Tertiary "Skip — I'll do this later" appends a Home banner until completed. Result computed client-side, POSTed to existing `/v1/retail/risk-score`.

### Step 3 — Goals (chip picker + amount)

Heading "What are you saving for?" + 6 preset chips: *emergency fund, retirement, child's education, house, freedom, custom*. Multi-select up to 3. Tapping a chip expands an inline form for target amount + target year. No tier-weights tuning here — auto-derived from risk profile + goals via the existing risk-scoring engine.

### Step 4 — Broker connect

"Connect Groww for live holdings" card with the Groww logo and a 2-line plain-English explainer. Two buttons:

- "Connect Groww" — primary, copper. Opens the existing `<ConnectSheet>` we built today (api_key + api_secret form).
- "Skip — I'll explore in paper mode" — text link. Skipping creates a paper-mode portfolio so Home isn't empty.

## Mobile Shell + Navigation

**Activation**: a new `<MobileShell>` activates when `Capacitor.isNativePlatform() === true` OR viewport width < 768px. Same code serves the responsive web preview.

**Status bar**: translucent over splash, then opaque navy. Light icons.

**No top app bar** by default. Each screen owns its own header (title + back/close). Saves vertical pixels on small phones.

**Bottom tab bar** (4 tabs, visible on all authenticated screens):

1. **Home** — portfolio overview (tier cards)
2. **Markets** — signals, watchlist, broker holdings
3. **Goals** — goal progress
4. **You** — profile, brokers, risk, settings

Bottom bar background = cream. Active tab = copper icon + label + a 3px copper dot under the icon (no underline, no pill — keeps the ledger-like quiet). Inactive = navy at 50% opacity.

**Floating "Trade" FAB**: appears only on the Markets tab when at least one broker has `can_trade=true`. 56dp copper FAB, 16dp above tab bar. Tap → biometric prompt → bottom-sheet quick-trade form.

**Onboarding screens**: full-screen, no tab bar. Tab bar first appears when the user lands on Home.

## Home Tab — The Destination

Scrollable. No top app bar. First paint shows name + portfolio status in one breath.

```
[ 16dp ]
Hello, Sarvesh                    [ risk badge ]
Your wealth at ₹2,18,450        +₹6,240 (2.9%) today
[ 24dp ]
[ Tier card: Safety Net ─────────────────── ]
  Capital protected · Emergency access
  Current ₹40,200      target ₹2,00,000
  ▓▓▓░░░░░░░░░░░░  20% · on track for 2036
[ 12dp ]
[ Tier card: Core Portfolio  ─────────────── ]
[ 12dp ]
[ Tier card: Experimental ───────────────── ]
[ 24dp ]
Latest signals                              ›
  HDFCBANK · Hold · 78%
  CDSL     · Buy  · 64%
[ 16dp ]
[ Brokers card: 1 connected ]
  Groww · synced 2 min ago      [ Sync ]
```

**Tier cards** are the heart of Home. Cream background, 1px copper hairline border, no shadow. Tap → full-screen tier detail (existing `PortfolioDetailPage`, mobilized). Long-press → quick actions (Sync, View holdings, Rebalance).

**Brand application**:
- Big numbers in Source Serif Pro tabular numerals.
- Tier name in serif italic; tagline in Inter regular.
- Progress bar = solid copper fill, no gradient, no bouncing.
- P&L: sage positive, terracotta negative.
- "Today" delta and "on track for 2036" use small-caps fog.

**Empty / partial states**:
- No broker → "Add a broker to see real holdings" inline below tier cards with copper button. Paper mode still works.
- No goals → "Set a goal to see progress" card replaces tier cards.
- Sync error → tier card shows discreet copper warning icon + tappable banner.

**Pull-to-refresh**: syncs all connected brokers in parallel. Haptic tap on success (`@capacitor/haptics`).

## Markets / Goals / You Tabs + Trade FAB

### Markets

- **Today's signals** — horizontal carousel of chunky 140×120dp cards: serif symbol, signal badge (sage/cream/terracotta), confidence %, one-line rationale. Swipe horizontally. Tap → signal detail.
- **Your holdings** — list grouped by broker. Row: symbol, qty, current value, today's delta. Tap → instrument detail.
- **Watchlist** — symbols tracked but not held. Swipe-left reveals a copper "Trade" action.
- Pull-to-refresh = re-fetch signals + re-sync all brokers.

### Goals

- One card per goal with a circular progress meter (copper arc on cream, serif percentage centered).
- Tier allocation breakdown below: "₹40k / ₹2L · 20% · funded by Safety Net".
- "Add goal" appears as a copper outlined card at end of the list.
- Tap a goal → detail with contribution-vs-projection chart using `lightweight-charts` (already bundled).

### You

- Profile header: avatar + name + email.
- Section rows: Brokers (count badge), Risk profile (Moderate + last-updated), Goals shortcut, Notifications, Help, Sign out.
- Bottom: "Sthira v1.0 · build XYZ" in monospaced 11pt fog.

### Trade FAB

- 56dp copper FAB, bottom-right, 16dp above tab bar.
- Visible only on Markets tab when at least one broker has `can_trade=true`.
- Tap → biometric prompt via `@aparajita/capacitor-biometric-auth` (real native check, replacing the T24b web pass-through).
- On success: 90%-height bottom-sheet — symbol search → qty → market/limit → product → review → submit.
- Submit shows copper progress arc; success animates a subtle copper check, no confetti.

## Implementation Slicing — 4 PRs

Each PR is independently demoable and does not break existing live-trading.

### PR 1 — Mobile shell + theming (1-2 days)

- New `src/components/layout/MobileShell.tsx` with bottom tab bar, FAB slot, status bar config.
- Extend `useIsMobile()` to also fire on `Capacitor.isNativePlatform()`.
- Tailwind theme extension in `tailwind.config.ts` for D1 palette tokens.
- `@fontsource/source-serif-pro` dependency for serif headlines.
- Capacitor `@capacitor/splash-screen` config + 6KB SVG Sthira wordmark.
- No screen content yet — just the chrome.

### PR 2 — Onboarding flow (3-4 days)

- 5 new routes under `src/features/markets/onboarding/`: `splash`, `auth`, `risk`, `goals`, `broker`.
- Reuse existing hooks: `useRiskScore`, `usePortfolios`, `useCreatePortfolio`, broker connect.
- New `useOnboardingProgress()` reads from `markets.risk_profiles`, `markets.portfolio_tiers`, `markets.broker_connections` to decide which steps are still required (covers existing-user path).
- New users walk all 5; existing users skip whatever's done.

### PR 3 — Mobile Home (2-3 days)

- `<HomeMobilePage>` with three-tier card stack, signal preview, broker card.
- Reuses `usePortfolios`, `useRiskScore`, `useSignals`, `useBrokerConnections`.
- Pull-to-refresh hook on top of TanStack Query `refetch`.
- New `src/features/markets/copy/sthira.ts` for all brand voice strings — central tuning point.

### PR 4 — Trade FAB + Markets/Goals/You tabs (3-5 days)

- Real native biometric replaces T24b web pass-through for mobile-only.
- Bottom-sheet quick-trade form.
- Markets and Goals tabs reuse existing detail components, repackaged for mobile.
- You tab is mostly nav + existing settings reuse.

**Total: 9–14 working days.**

**Testing**: Playwright in mobile viewport for each PR. Native biometric requires manual QA on the Nord (`com.sos.sthira`).

## Alternatives Considered and Rejected

- **Brand: existing tenant branding only (option C earlier).** Rejected — Sthira loses consumer identity. Tenant theming alone produces a different look per partner, no recognisable app.
- **Brand: Modern Stoic (Direction 2) or Indian Heritage Modern (Direction 3).** Rejected — *Modern Stoic* is too close to Robinhood/Cash App and clashes with the advisory-not-transactional tone; *Indian Heritage Modern* is beautiful but harder to scale across tenants that don't want a strongly Indian visual identity.
- **Onboarding: SEBI-thorough 7-step (option B).** Rejected — required only if Sthira is registered as Investment Adviser. For distributor-only routing of orders, the 4-step suffices. Extra suitability + KYC screens can be inserted between Risk Profile and Goals later without re-architecting.
- **Onboarding: progressive disclosure on Home (option C).** Rejected — worst completion rate for the steps that gate value. Users would skip risk profile and then see signals that don't match their tolerance.
- **All in parallel.** Rejected — same SEBI Apr 2026 deadline pressure that pushed the multi-domain sequence into phases. Focused PRs preserve velocity.

## Open Questions

- Sthira logo asset doesn't exist yet — design needs a wordmark, app icon (per package `com.sos.sthira`), and a 6KB SVG for splash. Decision: commission, AI-generate, or stub with a typeset Sthira until v1.1?
- Does the existing `TenantBrandingContext` need scoping so tenant theming layers only on specific Markets surfaces (e.g. PortfolioDetailPage) and not the Sthira-branded Home/Onboarding? Needs an audit before PR 1.
- iOS deferred per CLAUDE.md (Phase 1.5). All mobile-only paths gated by `Capacitor.getPlatform() === 'android'` for now? Or platform-agnostic from the start to ease iOS port later?
- Magic-link auth — Supabase already supports it; does the existing web auth flow expose it? May need a `useMagicLinkAuth` hook.

## Next Actions

- Sign-off on this design.
- Begin PR 1 (Mobile shell + theming) in a fresh worktree.
- Resolve open questions, especially the logo asset path.
