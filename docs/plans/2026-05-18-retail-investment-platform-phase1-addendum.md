# Retail Investment Platform — Phase 1 Addendum (Mobile, AI, Risk, Layman UX)

**Status:** Brainstormed and validated 2026-05-18.
**Relationship:** Extends `2026-05-18-retail-investment-platform-phase1.md` (existing 12-task SEBI plan). All 12 original tasks ship unchanged; this addendum adds 12 new tasks plus targeted extensions to Tasks 5, 7, 8, 9, 10.
**Ship target:** Apr 1 2026 (SEBI deadline).
**Out of scope (deferred to Phase 1.5 / Phase 2):** GDPR, MiFID II, SEC 17a-4, PCI DSS, 50+ page global research report, 500-user beta UAT, aggregator KYC for users without brokers, conversational AI Q&A, iOS app at launch, within-tier rebalancing, multi-language UI, CAS import, practice mode, family accounts, video education, round-ups.

---

## Locked Decisions

| # | Area | Decision |
|---|---|---|
| 1 | Mobile shell | Capacitor wrap of existing React/Vite app; Android-first (iOS fast-follow); biometric for login **and** per-trade confirmation; read-only offline via TanStack Query persistence |
| 2 | AI insights | Daily Portfolio Health Diagnostic (interpretation only) + holdings-aware Market Commentary; defer Conversational Q&A |
| 3 | Rebalancing | Drift-based triggers, tier-level only (no within-tier), ±5% threshold, one-tap basket execute via extended ExecutionBottomSheet |
| 4 | Risk trio | Stop-loss (broker-side) → Dynamic risk score → Stress testing (3 historical scenarios); built sequentially |
| 5 | KYC | Broker-passthrough only — no aggregator integration in Phase 1; targets ~5-min time-to-first-investment |
| 6a | Perf budgets | CI-enforced: 200KB initial JS, 80KB per route, Lighthouse mobile perf ≥90, LCP ≤2.0s on Slow 4G |
| 6b | Mobile nav | 5-tab bottom nav: Home / Portfolio / Signals / Goals / More |
| 7 | Layman UX layer | All seven additions in scope: glossary/Why pattern, goal calculator + inflation, starter templates, signal confidence badges, mistake rails, LTCG tracker, withdraw flow |

---

## 1. Scope & Relationship to Existing Plan

This design **extends** `docs/plans/2026-05-18-retail-investment-platform-phase1.md` (12 tasks, intact). New work splits into three groups:

- **Group A — Mandate items (6):** mobile shell, AI insights, rebalancing, risk trio, KYC, perf/nav.
- **Group B — Layman UX layer (7):** glossary/Why pattern, goal calculator + inflation, starter templates, signal confidence, mistake rails, LTCG tracker, withdraw flow.

**Totals:** existing 12 tasks + 12 new tasks (T13–T24) + folded extensions to Tasks 5, 7, 8, 9, 10 = Phase 1 release artifact.

**Dependencies (drive sequencing):**
- Group B mostly extends existing Tasks 7, 8, 9, 10 — can interleave with original plan rather than wait.
- Group A mostly depends on Tasks 1–12 completing — runs after.
- Capacitor shell is last (wraps the finished web app).

**Phase 1 release definition:** Android app + web app live, all 24 tasks complete, internal QA pass on real low-end Android device, Lighthouse mobile ≥90.

---

## 2. Capacitor Mobile Shell Architecture

The existing app is React 18 + Vite + Shadcn, SPA. Capacitor wraps the same built bundle in a native shell — no source-tree fork.

**Project structure:**
- Add `capacitor.config.ts` at repo root.
- Generate `android/` (Phase 1) and `ios/` (Phase 1.5) directories via `npx cap add android`.
- Existing `dist/` becomes the `webDir`.

**Required plugins:**
- `@capacitor/biometric-auth` — Face/Touch/fingerprint
- `@capacitor/push-notifications` — FCM on Android
- `@capacitor/preferences` — secure key-value (broker API tokens)
- `@capacitor/network` — online/offline detection
- `@capacitor/app` — lifecycle hooks for re-auth on background return
- `@capacitor/haptics` — confirmation feedback on trade execute

**Auth boundary:** Supabase Auth handles the actual session. Biometric is a local re-confirmation layered on top — not a separate identity. Per-trade biometric wraps the existing `ExecutionBottomSheet` submit handler; same submit path, gated.

**Offline strategy:**
- TanStack Query persistence to encrypted storage (Android `EncryptedSharedPreferences` via Capacitor Preferences).
- Whitelist query keys for offline: `portfolio`, `portfolioTiers`, `riskProfile`, `retailSignals` (last fetched), `diagnostic` (latest).
- Mutations blocked offline with explicit UI state — never queued.

**Push events shipped in Phase 1:**
- Daily Portfolio Health Diagnostic ready
- Drift-triggered rebalance available
- Stop-loss triggered (broker-fired, ingested via webhook)
- SIP debit success/failure
- Material signal change on a held stock

**CI:** Android build job (`npx cap sync android && cd android && ./gradlew assembleRelease`). iOS deferred.

---

## 3. AI Insights Layer

Two sub-features, both implemented as scheduled jobs in `services/markets-worker` with thin frontend renders. Neither generates new buy/sell recommendations — both interpret existing data, staying inside SEBI RA boundaries.

### 3a) Portfolio Health Diagnostic

A nightly job per active user computes:
- Concentration ratio (top holding %, top-3 %)
- Weighted portfolio beta vs Nifty
- 6-month max drawdown
- Sector skew vs target tier allocation
- Goal trajectory: months ahead / behind plan at current SIP + return rate

These feed an LLM prompt that emits **structured JSON** (not free prose):

```json
{
  "headline": "Your portfolio is leaning aggressive this month",
  "findings": ["Top holding ICICI now 28% of portfolio (target ≤25%)"],
  "suggested_actions": [
    {"type": "rebalance", "tier": "foundation"},
    {"type": "set_stop_loss", "symbol": "ICICIBANK"}
  ]
}
```

Each action points at an existing platform feature — the diagnostic never invents new advice paths.

**Storage:** new table `portfolio_diagnostics(user_id, generated_at, payload jsonb)`. One row per user per day; serve latest. Idempotent re-runs.

**Cost control:** Haiku model. Cache prompt skeleton. Budget ₹0.50/user/day. Skip inactive users (no portfolio activity in 30 days). Circuit breaker falls back to a templated non-LLM diagnostic if monthly budget exceeded.

### 3b) Holdings-aware Market Commentary

Reuses the existing news pipeline. For each user's top-3 holdings, pulls last-24h news headlines, summarizes via LLM into 2–3-line "what happened" cards. Renders as a horizontal carousel on `Home` between Diagnostic and signal feed.

**Storage:** `holdings_news_summaries(user_id, symbol, generated_at, summary)`. TTL 24h.

**SEBI guardrails:** explicit "do not recommend buy or sell" in prompt; output describes events only. Pre-deployment, dump 500 sample outputs for compliance review.

**Frontend:** new `useDiagnostic()` and `useHoldingsNews()` hooks; new `<DiagnosticCard />` and `<HoldingsNewsCarousel />` on `RetailDashboard`.

---

## 4. Drift-Based Rebalancing

Triggered when any tier's actual allocation drifts more than ±5% from its target (set at onboarding in Task 1's `portfolio_tiers` table). Tier-level only — no within-tier stock rotation in Phase 1.

**Detection:** Extend the nightly diagnostic job (§3a) to compute drift per tier. When drift exceeds threshold, write to `rebalance_recommendations(user_id, generated_at, payload jsonb, status enum('pending','executed','dismissed','expired','partially_executed'))`. Recommendations expire after 7 days.

**Payload:**
```json
{
  "reason": "Foundation tier 47% (target 55%)",
  "orders": [
    {"action": "sell", "symbol": "X", "qty": 10, "tier_from": "opportunistic"},
    {"action": "buy", "symbol": "Y", "qty": 5, "tier_to": "foundation"}
  ],
  "net_cash_impact": 0,
  "estimated_brokerage": 42
}
```

**Cash-neutral baskets first.** If user is adding fresh capital (detected via SIP debit signal), generate buy-only baskets toward the underweight tier — gentler UX, no realized gains.

**Frontend:**
- `<RebalanceCard />` on `Home` when a pending recommendation exists.
- `<RebalanceSheet />` — basket variant of `ExecutionBottomSheet`. Shows all proposed orders, brokerage cost prominently, post-trade tier view, single biometric confirm.
- On partial failure, per-order status; mark as `partially_executed` with retained pending orders.

**Backend:** new `services/markets-worker/src/markets_worker/routers/rebalance.py`. Endpoints: `GET /rebalance/pending`, `POST /rebalance/{id}/execute`, `POST /rebalance/{id}/dismiss`. Reuses Task 10's broker submission path.

**SEBI line:** Every executed rebalance is logged with the user's explicit biometric confirmation timestamp + the recommendation payload — clean audit trail that the user initiated the trade.

---

## 5. Risk Management Trio

Built sequentially. Each compounds on the previous one's data.

### 5a) Stop-loss (cheapest, ships first)

Extend `ExecutionBottomSheet` (Task 10) with an optional stop-loss field on buy orders. Default at −10% from entry, user-editable. Translates to a broker `SL` or `SL-M` order alongside the primary order — broker handles trigger.

Add `<StopLossManager />` modal from each holding row in `PortfolioTierView` (Task 8) — list, modify, cancel, or add stop-loss to existing holdings. **No platform-side monitoring** — all trigger logic on broker.

### 5b) Dynamic risk score

Daily scalar (1–10) on dashboard. Simple formula, no ML:

```
risk_score = w1*concentration_z + w2*weighted_beta + w3*max_drawdown_6m + w4*tier_skew
```

Weights `0.3, 0.3, 0.2, 0.2` (env-tunable). Computed in the same nightly job as §3a/§4. Persists to `portfolio_risk_history(user_id, computed_at, score, components jsonb)` — history table enables a 30-day sparkline.

**Surfacing:** `<RiskScoreCard />` on `Home`, side-by-side with target risk from onboarding (Task 7's `risk_profiles`). When `current - target > 2`, card upgrades to elevated yellow state with "How to fix this" CTA → opens rebalance flow.

### 5c) Stress testing

Three hard-coded historical scenarios:
- **2020 COVID crash** (Mar 2020 30-day window)
- **2008 GFC** (Sep–Nov 2008)
- **2024 Adani correction** (Jan 2023)

Apply each period's per-stock returns to the user's current holdings (matched by symbol; unmatched flagged but skipped). Output: "If 2020 happened today: portfolio −₹X (−Y%); largest losses: ..."

**Storage:** `stress_test_scenarios` table is **static seed data** — historical returns per symbol per scenario, pre-loaded once. Recomputation per user is pure SQL, no LLM. Cheap.

**Frontend:** `<StressTestPanel />` reached from the Risk Score card; tabbed view, one per scenario, worst-3 holdings highlighted.

---

## 6. Broker-Passthrough KYC

No aggregator integration. Identity verification delegated to the connected broker's CKYC.

**Onboarding flow (≤5 min target):**

1. **Sign up** — email + mobile OTP via Supabase Auth. (~30s)
2. **Broker selection** — Zerodha and Fyers at launch (both OAuth flow). Post-launch waves add Dhan (api_key), then Angel One (totp), then ICICI (session_token), then Kotak (otp). (~15s)
3. **Broker OAuth / API key** — redirect to broker's OAuth (Kite Connect request token; Upstox OAuth 2.0). On return, store access token in Capacitor Preferences (encrypted) on mobile, secure HTTP-only cookie on web. (~60s)
4. **Identity confirmation** — show name + PAN-masked + demat fetched from broker. User confirms "this is me." (~20s)
5. **Risk profile quiz** — Task 7 onboarding, unchanged. (~90s)
6. **Goal + tier setup** — Task 7 continuation. (~90s)
7. **Nominee** — name + relationship + share %. Skippable with warning. (~30s)
8. **First investment** — `RetailDashboard` with starter template suggestion (§8c). (~30s to first trade if user accepts starter)

**Total: ~5 minutes**, hitting the "50% faster than ~10-min industry baseline" mandate target.

**Bank account:** money moves via the broker's existing bank link — platform never touches user funds. PCI DSS auto-deferred for free.

**New table:** `user_broker_connections(user_id, broker enum, access_token_ref, refresh_token_ref, kyc_payload jsonb, connected_at)`. Tokens stored as KMS-encrypted references.

**Token refresh:** background job rotates tokens before expiry; on refresh failure, re-auth prompt next session.

**Failure modes:** broker API down → "try again in 5 min"; token revoked → inline re-auth; broker KYC incomplete → deep link to broker.

---

## 7. Performance Budgets & 5-Tab Navigation

### 7a) Perf budgets — CI-enforced

Three gates added to the build pipeline. Failing any blocks merge to `main`.

- **Initial JS bundle (RetailMode entry route):** ≤200KB gzipped. Enforced via `vite-plugin-bundle-analyzer` + CI script diffing against baseline.
- **Per-route lazy chunk:** ≤80KB gzipped each. Forces feature-level code splitting (rebalance flow, stress test, etc.).
- **Lighthouse mobile perf score:** ≥90, LCP ≤2.0s on Slow 4G. Via `@lhci/cli` against preview deploy.

**Production RUM:** Sentry already initialized. Add `web-vitals` (CLS, LCP, INP, FCP) reporting to PostHog. Dashboard tracks p50/p75/p95 LCP and INP by route and device class. Alert if p75 LCP > 2.5s for 24h.

**Asset strategy:** WebP with PNG fallback; route-level prefetch hints (`<link rel="modulepreload">`) for top-3 routes from Home (Portfolio, Signals, Goals).

### 7b) 5-tab bottom-tab IA

| Tab | Default screen | Sub-paths (≤2 more taps) |
|---|---|---|
| **Home** | `RetailDashboard` — Diagnostic, Risk Score, Rebalance card, Holdings news | Each card → detail sheet (1 tap) |
| **Portfolio** | `PortfolioTierView` (Task 8) | Holding → Stop-loss manager, LTCG tracker |
| **Signals** | `RetailSignalFeed` (Task 9) with filter chips | Signal → Execution sheet |
| **Goals** | Goal list + progress + inflation-adjusted view | Goal → Edit, Run-rate calculator |
| **More** | Settings, Withdraw flow, Stress test entry, Glossary, Support, Logout | Each one tap from More |

**Implementation:** new `RetailNavLayout.tsx` wrapping all five tab routes. On web, bottom tabs ≤768px width, left sidebar above. On Capacitor, always bottom tabs. Each tab keeps its own scroll position and route state via React Router v6 `Outlet`.

---

## 8. Layman UX Layer (Seven Additions)

Surgical, cross-cutting. None is a feature surface on its own; together they're the moat against Groww-class incumbents.

### 8a) Glossary tooltips + "Why?" pattern
Two reusable components:
- `<Term word="P/E ratio">P/E</Term>` renders with dotted underline; tap opens 2-line popover from `src/features/retail/glossary/glossary.json` (~60 entries at launch).
- `<WhyButton context={...} />` at top-right of every card showing a computed number → opens a sheet explaining the inputs.

### 8b) Goal calculator + inflation framing
Extends `GoalSelector` (Task 7). When user enters target ₹ and horizon, display three derived numbers live: (1) inflation-adjusted real value at 6% CPI, (2) required monthly SIP at 12% expected return, (3) required lumpsum today.

### 8c) Starter portfolio templates
Three pre-built tier allocations seeded into `portfolio_templates` table:
- **Conservative:** 70 / 25 / 5 (Foundation / Growth / Opportunistic)
- **Balanced:** 55 / 35 / 10
- **Growth:** 40 / 40 / 20

Each with concrete suggested holdings. In `TierSetup` (Task 7 Step 5), shown as "Not sure? Start with a template" — one-tap adoption populates target allocations and stages a starter basket on Home.

### 8d) Signal confidence badges
Extend `markets.signals` schema with `confidence enum('strong','moderate','watch')`. Set by signal generator (Task 5 extension) based on existing indicator agreement count. Render as colored chip on `SignalCard` (Task 9).

### 8e) Mistake-prevention rails in `ExecutionBottomSheet`
Three checks pre-confirm, all warnings (never blocks):
1. Post-trade concentration >25% in one stock → yellow warning with override checkbox
2. Selling within 30 days of buying → STCG impact estimate
3. SIP cancellation → goal-trajectory delta

### 8f) LTCG exemption tracker
Card on Portfolio tab: realized LTCG this FY vs ₹1L exemption, with "₹X tax-free room left." Updates on every executed sell. Backend: sum of realized LTCG events filtered by FY.

### 8g) Withdraw flow clarity
Single screen from More tab and from any holding. Shows: T+1/T+2 settlement timeline, MF exit loads, estimated STCG/LTCG impact, broker bank account for fund routing.

---

## 9. Task Sequencing & Critical Path

### Extensions to existing tasks (additive, folded into TDD flow)

| Existing | Extension | New work |
|---|---|---|
| Task 5 (signal generator) | Signal confidence enum (8d backend) | +1 d |
| Task 7 (onboarding wizard) | Broker OAuth step (§6) + goal calculator/inflation (8b) + nominee | +4 d |
| Task 8 (portfolio dashboard) | Starter template adopter UI (8c render) | +1 d |
| Task 9 (signal feed) | Confidence chip on SignalCard (8d render) | +0.5 d |
| Task 10 (ExecutionBottomSheet) | Stop-loss field (5a) + mistake rails (8e) | +3 d |

### New tasks (sequenced by dependency)

| # | Task | Depends on | Effort |
|---|---|---|---|
| T13 | Glossary + `<Term>` + `<WhyButton>` library | — | 3 d |
| T14 | Starter templates table + seed data + admin loader | T1 | 2 d |
| T15 | LTCG exemption tracker (backend + Portfolio card) | T1, T8 | 3 d |
| T16 | Withdraw flow screen | T8 | 3 d |
| T17 | Dynamic risk score (job + history + dashboard card) | T8 | 4 d |
| T18 | Stress testing (scenarios seed + panel UI) | T17 | 5 d |
| T19 | Portfolio Health Diagnostic (LLM job + Home card) | T8, T9 | 5 d |
| T20 | Holdings-aware Market Commentary (news job + carousel) | T19 | 4 d |
| T21 | Drift-based rebalancing (detector + `RebalanceSheet`) | T1, T10, T17 | 7 d |
| T22 | `RetailNavLayout` — 5-tab bottom nav | T11 | 3 d |
| T23 | Perf budget CI gates (bundle + Lighthouse + RUM) | T22 | 3 d |
| T24 | Capacitor Android shell — biometric + push + offline | All web tasks complete | 8 d |

**Totals:** ~50 dev-days new + ~9.5 dev-days of extensions = ~60 dev-days. Roughly **6 weeks with two engineers in parallel** where dependencies permit; ~12 weeks solo.

**Critical path to ship:** T1 → T7 → T10 → T11 → T21 → T22 → T24.

**Hard gate before T24 (Capacitor):** all web tasks pass smoke test on a mobile-emulated viewport. We do not start native packaging until the wrapped artifact is good.

---

## 10. Risks, Open Questions, Test Bar

### Top risks

1. **Capacitor WebView perf on low-end Android.** Mid-tier Android (4GB RAM, Snapdragon 6-series) is the realistic minimum. Target a $150 device class for QA from week one. *Mitigation:* baseline LCP on a real low-end device before T22; budget a 1-week perf-tuning sprint (not currently allocated).
2. **Broker OAuth quirks.** Each broker has idiosyncratic token flows and downtime. *Mitigation:* Phase 1 ships with **two OAuth-flow brokers** (Zerodha + Fyers, both implemented in the existing `BrokerConnectionsPage`); other broker auth flows (api_key, totp, session_token, otp) are added sequentially post-launch.
3. **LLM cost runaway.** Diagnostic + Commentary + explanations run nightly per user. At 10K active × ₹0.50/day ≈ ₹150K/month. *Mitigation:* hard per-user daily budget + circuit breaker fallback to templated non-LLM diagnostic.
4. **SEBI RA boundary on diagnostics.** Compliance signoff on prompts + 500-sample output dump non-negotiable before T19 ships. Allocate 2 weeks calendar (not engineering) for legal review.
5. **Brokerage cost surprise on rebalance baskets.** A 6-order basket can cost ₹120+. *Mitigation:* prominently display total cost; allow per-order uncheck in `RebalanceSheet`.

### Open questions (block doc finalization)

- **Q1 — Brokers at launch?** **Resolved 2026-05-18:** Zerodha + Fyers via OAuth at launch (both auth flows already implemented in `BrokerConnectionsPage.tsx`); Dhan, Angel One, ICICI, Kotak added sequentially in post-launch waves.
- **Q2 — Hosting / OAuth callback domain.** **Resolved 2026-05-18:** Dedicated subdomain `broker-callback.sosfintech.in`, served from Hostinger VPS with Let's Encrypt SSL and a reverse-proxy rule routing to the broker OAuth handler. Domain separation insulates broker registrations from future infra migrations. Registered with both Zerodha (Kite Connect) and Fyers developer consoles before T7 onboarding integration tests can run end-to-end.
- **Q3 — SEBI compliance reviewer.** **Resolved 2026-05-18:** Engage a Tier-2 SEBI specialist firm — shortlist of three to run 30-min discovery calls with: **Finsec Law Advisors** (Mumbai; SEBI-only practice; published authoritative tracker on the Jan 2025 RA/IA guideline overhaul), **Vinod Kothari Consultants** (multi-office; recent published analysis "Research Analysts v/s Investment Advisors – Is the Line Blurring?" directly relevant to AI-driven recommendation platforms), and **Argus Partners** (Delhi/Mumbai/Bangalore; strong fintech regulatory bench; advised CRED). Engagement scope: (a) RA/IA registration assessment for SOS Fintech, (b) LLM prompt + 500-sample output review for T19/T20, (c) autonomous-execution audit-trail review, (d) advertising/launch compliance. Target signed engagement by end of May 2026. Email brief in Appendix C. **Critical regulatory context:** SEBI's Dec 16 2024 amendments + Jan 8 2025 circulars introduced a tiered deposit system (replacing net worth) and an entity-form requirement (LLP / body corporate by Sep 30 2025 if no qualified individual partner). Whether SOS Fintech registers as an RA is itself a compliance question — first item on the engagement scope.
- **Q4 — Firebase project for FCM.** Already provisioned, or net-new setup?

### Test/quality bar for Phase 1 release

- All 12 existing + 12 new tasks pass unit + integration tests
- E2E Playwright covers: onboarding (with broker OAuth mock) → first trade → rebalance → withdraw
- Android APK installs and golden path completes on real Samsung M14 / Redmi Note 12 class device
- LCP ≤ 2.0s on Slow 4G via Lighthouse CI
- Sentry + PostHog wired and emitting on first launch
- Compliance signoff on diagnostic prompts + 500-sample LLM output dump

---

## Appendix A — Files & Modules Added

```
src/features/retail/
  glossary/
    glossary.json
    Term.tsx
    WhyButton.tsx
  components/
    DiagnosticCard.tsx
    HoldingsNewsCarousel.tsx
    RiskScoreCard.tsx
    StressTestPanel.tsx
    RebalanceCard.tsx
    RebalanceSheet.tsx
    StopLossManager.tsx
    LtcgTracker.tsx
    WithdrawScreen.tsx
    StarterTemplateAdopter.tsx
  layouts/
    RetailNavLayout.tsx
  hooks/
    useDiagnostic.ts
    useHoldingsNews.ts
    useRiskScore.ts
    useStressTest.ts
    useRebalance.ts
    useStopLoss.ts
    useLtcg.ts
    useStarterTemplates.ts
    useBrokerConnection.ts

services/markets-worker/src/markets_worker/
  routers/
    rebalance.py
    diagnostic.py
    risk.py
    broker_oauth.py
  jobs/
    portfolio_diagnostic.py
    holdings_news_summary.py
    risk_score_compute.py
    drift_detector.py

supabase/migrations/
  <ts>_portfolio_diagnostics.sql
  <ts>_holdings_news_summaries.sql
  <ts>_portfolio_risk_history.sql
  <ts>_rebalance_recommendations.sql
  <ts>_stress_test_scenarios.sql
  <ts>_portfolio_templates.sql
  <ts>_user_broker_connections.sql

capacitor.config.ts
android/  (generated)
```

## Appendix C — SEBI Compliance Engagement Brief (for outreach email)

**To:** Finsec Law Advisors / Vinod Kothari Consultants / Argus Partners (separate emails)
**Subject:** SEBI compliance engagement inquiry — retail investment platform launching Q1 2026

Dear [Firm],

I am writing on behalf of **SOS Fintech**, building a retail investment recommendation platform targeting Indian retail investors, with a planned Q1 2026 launch ahead of the April 1 2026 SEBI deadline.

**Platform overview:**
- Goal-anchored, three-tier portfolio framework (Foundation / Growth / Opportunistic).
- LLM-explained signals over a proprietary signal engine (the LLM interprets pre-generated signals; it does not generate buy/sell recommendations).
- Daily AI-generated portfolio health diagnostic and holdings-aware market commentary (interpretation-only, no recommendation).
- Drift-based, user-confirmed (biometric) portfolio rebalancing.
- Broker-passthrough KYC via Zerodha (Kite Connect) and Fyers OAuth at launch.
- Execution via the user's existing broker — platform never custodies user funds.

**Engagement scope (request for proposal):**

1. **RA/IA registration assessment** — given the Dec 16 2024 amendments and Jan 8 2025 circulars on the new tiered deposit system and entity-form requirements, whether SOS Fintech needs to register as a Research Analyst or Investment Adviser, and what registration class fits.
2. **LLM prompt and output review** — review of approximately 8–10 production prompts plus a 500-sample dump of LLM outputs, with written signoff that they do not cross the RA boundary (interpretation vs. recommendation).
3. **Autonomous execution audit-trail review** — sign-off that our user-consent flow (biometric per-trade confirmation logged with the recommendation payload) constitutes user-initiated execution and not discretionary management.
4. **Launch and advertising compliance** — review of marketing collateral, finfluencer-adjacent risks, and any required disclaimers.

**Timeline:**
- Engagement signed by end of May 2026.
- LLM prompt/output review complete by end of August 2026 (before T19/T20 production deploy).
- Autonomous-execution audit trail review by end of October 2026 (before T21 production deploy).
- Launch compliance review by end of January 2026 (before public launch).

**Could we schedule a 30-minute discovery call this or next week?** I am available [insert availability]. Please share any pre-call materials you would find useful — happy to NDA before sharing internal architecture.

Best regards,
[Name]
SOS Fintech

---

## Appendix B — Decision Audit Trail

This document records decisions reached through structured brainstorming on 2026-05-18 (see conversation transcript). Each locked decision was preceded by 2–3 alternatives with stated trade-offs. The user selected option B (defer global mandate items, keep SEBI-focused plan), option A across mobile shell sub-decisions, option C (all six ambiguous mandate items in Phase 1), and option A on the layman UX additions (all seven). The brainstorm explicitly considered and rejected: GDPR/MiFID II/SEC compliance, separate React Native build, PWA-only mobile, conversational AI Q&A, time-based rebalancing, within-tier rebalancing, aggregator KYC, iOS at launch, multi-language UI, CAS import, practice mode, family accounts, video education content production, round-up micro-investing.
