# Self-onboarding wizard design — Sthira retail

**Date:** 2026-05-21
**Status:** Plan — locked via brainstorm; not yet implementing
**Author:** Vimal Bahuguna (with Claude)
**Audience:** Indian layman retail under Option A (see
`project_audience_and_automation_scope.md`)
**Replaces:** the manual `scripts/provision-sthira-friend.mjs` operator flow.

## Goal

End-to-end self-registration for the Sthira retail surface that works
on both mobile (primary) and web (secondary), targets ≤5 minutes
sign-up → Home, and matches the depth/personalisation of leading
Indian advisor-aggregator platforms (Smallcase, INDmoney, Kuvera,
ET Money) without requiring KYC up front.

## Locked decisions

Decisions reached via brainstorm 2026-05-21. Each picked between 3–5
alternatives with explicit trade-offs; rationale below.

| ID | Decision | Why this and not the alternatives |
|---|---|---|
| **A**   | Broker linking is **deferred, not required for Home** | Sthira's closest analogues (Smallcase, INDmoney, Kuvera, ET Money) all defer broker. Forcing OAuth in the first 60 seconds = abandonment. Compliance fit: SEBI RA needs risk profile before personalized advice; broker is about execution, not advice. |
| **3a**  | Day-1 Home shows a **fully-active paper-trading portfolio** | Empty cards on first visit undercut the layman pitch. Real holdings + real P&L + real signals = "wow"; paper mode keeps compliance clean. |
| **4b**  | **Email + password** for closed beta; phone OTP for public launch | Phone OTP needs Supabase SMS provider + vendor pick + 0.5–1 day setup. For 10–20 friends, email is fine. Design assumes auth surface is swap-able later. |
| **5c**  | **7-screen full wizard** | Indian users expect "set up properly upfront" for financial apps. Skipping tier customization / nominee = saves time but mismatches expectations. Progressive disclosure (Stash) is too American for this audience. |
| **6a**  | **Single responsive React tree** | Two-design (mobile + web) is 2× the work for marginal polish. Sthira's mobile-first design system scales OK to desktop — same pattern Kuvera uses. |
| **7b**  | **Supabase Auth post-signup edge function** | Supabase-native; TypeScript is easier to evolve than a plpgsql trigger. Cold-start hop is ~200 ms — invisible in a 30s signup flow. |
| **8a**  | **Rename** existing "Sthira Retail" → "SOS Services" tenant in place | Single UPDATE preserves the existing user_role + portfolio bindings. Alternative (create alongside + migrate) adds churn for no audit benefit at closed-beta scale. |
| **9d**  | **Hybrid state persistence**: localStorage for in-flight + DB for completed steps | Survives reload (good), uninstall (good), cross-device web ↔ mobile (good). What world-class platforms do. |
| **10c** | **Paper portfolio seeded 30% NIFTY 50 ETF + 70% cash** | Threads compliance (single passive index, unambiguously not advice) and engagement (a holding for signals/news/risk-score to fire on) and agency (₹70k cash to deploy via signals). |
| **11c** | **Wealthfront-grade risk quiz** (10–12 questions) | Deep enough to drive intelligent goal-aware signal filtering and drawdown alerts. SEBI RIA template is the v2 overlay post-counsel. |
| **12c** | **Multiple goals + priority weighting** | Wealthfront-grade. Cohesive with 11c — drives signal filter + drawdown sensitivity per tier. |
| **13e** | **Hybrid welcome**: static summary card → tap → Home with coach-marked tour | Acknowledges what was set up + scaffolds first usage. Robinhood-style forced first action is too railroady; Kuvera-style "drop into Home" loses the moment. |
| **14c** | **Full eager edge-function provisioning** | Friends who get distracted mid-wizard still come back to a populated paper portfolio. Signal jobs fire on their NIFTY position from day 1 — retention upside outweighs the small data waste from non-completers. |

## End-to-end flow

```
[Sign up / Sign in]    email + password (Supabase Auth)
        │              Verification email required → /auth/callback
        ▼
[Supabase post-signup Auth hook] → Edge function provision-retail-user
        │              Eagerly creates atomically:
        │                • public.user_roles  (binds user to SOS Services tenant)
        │                • markets.portfolios (paper mode)
        │                • markets.paper_capital (₹1,00,000 cash)
        │                • markets.holdings (30% → NIFTY 50 ETF at LTP)
        │              Idempotent ON CONFLICT DO NOTHING
        ▼
[Wizard route: /onboarding]    Route guard reads retail_profile.onboarding_complete
        │              Step 2  Welcome + disclosure                  ~30 s
        │              Step 3  Risk quiz (10–12 Q)                   ~120 s
        │              Step 4  Goals (multi + priority weighting)    ~90 s
        │              Step 5  Tier sliders (defaults from 3+4)      ~30 s
        │              Step 6  Starter template confirmation         ~20 s
        │              Step 7  Nominee (skippable)                   ~30 s
        │              Step 8  Summary → Open Home                   ~20 s
        │
        │              Each step writes to DB on Continue.
        │              localStorage caches in-flight typing.
        │              Re-entry guarantee: close anywhere, resume at next un-completed step.
        ▼
[Home tab with coach-marked tour]
        │              4–5 sequential overlays (Signals, Risk Score, News,
        │              Portfolio, More). Skippable. tour_completed flag persists.
        ▼
[Steady state]
```

## Step-by-step screen contract

| # | Screen | Input | DB write on Continue |
|---|---|---|---|
| 2 | Welcome + disclosure | None (read + agree) | `retail_profile.disclosure_accepted_at` |
| 3 | Risk quiz | 10–12 Q (horizon, drawdown comfort, income volatility, loss reaction, experience, dependents, objective, prior trauma, liquidity, sophistication) | `risk_profiles` (quiz_answers, score, risk_tag) |
| 4 | Goals | 1–3 goals: type / horizon / target ₹ / priority rank | `risk_profiles.goals` jsonb |
| 5 | Tier sliders | Safety Net % / Core % / Experimental % (sum to 100); defaults from quiz + goals | `portfolio_tiers` rows |
| 6 | Starter template | Single card showing recommended (Conservative / Balanced / Growth); accept or change | `risk_profiles.starter_template_slug` + `portfolios.metadata.template` |
| 7 | Nominee | Name + relationship + share %, or skip | `retail_profile.nominee` jsonb |
| 8 | Summary + Open Home | Read-only summary card + single CTA | `retail_profile.onboarding_complete = true` |

### Bridging logic across steps

- **Quiz score → `risk_tag`** ∈ {conservative, moderate, aggressive}
- **risk_tag + goals → tier defaults** (30-year retirement bumps Core; 5-year house bumps Safety Net)
- **tier defaults → starter-template default**
- **starter template → paper-portfolio holdings** (already pre-allocated 30/70 by edge function — wizard doesn't re-allocate)
- **goals + risk_tag → signal-feed filters** (Home shows only signals matching goal horizons + risk tag)
- **goals priority → drawdown-alert sensitivity** per tier

### Re-entry behaviour

- User closes mid-wizard → reopens → app reads `retail_profile` + downstream rows → resumes at the next un-completed step with all prior inputs pre-filled.
- localStorage holds `currentStep` + in-flight typing for the active step; cleared on step-complete.
- Cross-device transfer (web → mobile or vice versa) works identically because DB is authoritative.

## Data model + migrations

**Single SQL migration** + **single edge function deploy**.

### SQL migration content

1. **Rename SOS Services tenant** (per 8a):
   ```sql
   UPDATE public.tenants    SET name='SOS Services', slug='sos-services'
     WHERE slug='sthira-retail';
   UPDATE public.franchises SET name='SOS Services', code='sos-services'
     WHERE code='sthira-default';
   ```

2. **`markets.retail_profile` table** (new):
   ```sql
   CREATE TABLE markets.retail_profile (
     user_id                 uuid PRIMARY KEY,
     disclosure_accepted_at  timestamptz,
     onboarding_complete     boolean NOT NULL DEFAULT false,
     tour_completed          boolean NOT NULL DEFAULT false,
     nominee                 jsonb,
     created_at              timestamptz NOT NULL DEFAULT now(),
     updated_at              timestamptz NOT NULL DEFAULT now()
   );
   -- RLS: auth.uid() = user_id
   ```

3. **`risk_profiles` extensions:**
   ```sql
   ALTER TABLE markets.risk_profiles
     ADD COLUMN IF NOT EXISTS goals jsonb DEFAULT '[]'::jsonb,
     ADD COLUMN IF NOT EXISTS starter_template_slug text;
   ```
   Goals shape: `[{type, horizon_years, target_amount, priority}, ...]`

4. **`markets.provision_new_retail_user(user_id uuid)` SQL function:**
   - Single transaction
   - Inserts user_roles, portfolio, paper_capital, holdings
   - Idempotent (ON CONFLICT DO NOTHING per constraint)
   - Returns the new `portfolio_id`

### Edge function (`provision-retail-user`)

- Deno, deployed to `gzhxgoigflftharcmdqj`
- Triggered by Supabase Auth post-signup hook
- Service-role JWT for all writes
- Calls `provision_new_retail_user` SQL function
- Logs structured: `{ user_id, portfolio_id, status, duration_ms }`
- Failure mode: hook returns error → frontend's `/onboarding` load detects unprovisioned state → shows a "retry provisioning" path that calls the same SQL function via a worker endpoint

### Holdings seed (30/70)

- Look up `instrument_id` for NIFTY 50 ETF (`NIFTYBEES`) from `markets.instruments`
- `qty = floor(₹30,000 / latest_close)` from `markets.price_history`
- `holdings` row: qty, avg_cost = latest_close, broker_connection_id NULL, metadata = `{"source": "onboarding-seed"}`
- Remaining ₹70,000 stays in `paper_capital`

## Implementation phasing — closed beta

~5.25 days of focused work. Order matters because most items depend on prior ones landing.

| # | Item | Effort |
|---|---|---|
| 1 | SQL migration (rename + new table + columns + function) | 0.5 d |
| 2 | Edge function `provision-retail-user` | 0.5 d |
| 3 | Wire Supabase Auth post-signup hook → edge function | 0.25 d |
| 4 | Wizard frame: `/onboarding` route, state machine, hybrid persistence, route guard | 1 d |
| 5 | Step 2 (disclosure) + Step 7 (nominee) + Step 8 (summary) screens | 0.5 d |
| 6 | Step 3 (10–12-Q Wealthfront quiz) | 1 d |
| 7 | Step 4 (goals + priority) | 0.5 d |
| 8 | Step 5 (tier sliders) + Step 6 (starter template confirm) | 0.5 d |
| 9 | First-Home coach-marked tour overlay | 0.5 d |
| 10 | E2E manual test on Android + desktop; fix friction points | 0.5 d |

Replaces `scripts/provision-sthira-friend.mjs` once live (script remains as fallback).

## Deferred to public-launch

- Phone OTP + SMS gateway pick (4b → 4c migration)
- SEBI RIA-template quiz overlay on top of the Wealthfront base (11c → 11d)
- 1:N broker → portfolio split UX (m:n schema already in place — task #37; just needs UI)
- Nominee mandatory + verification
- Email verification enforced on first login
- Goal-aware adaptive SIPs

## Not in scope

- Broker OAuth (lives at `/dashboard/markets/settings/brokers`; Home post-tour nudges via a CTA but does not force)
- Paper-trading execution engine (mock fills against LTP, mock P&L update) — separate design
- KYC / DigiLocker integration — relies on broker passthrough per Option A
- Marketing landing page / pre-signup conversion

## Soft questions for the implementation review

1. **"Skip to Home" escape hatch?** Robinhood has one; Wealthfront doesn't. Recommendation: no escape hatch for closed beta — the wizard *is* the value pitch. Add for public launch only if abandonment data justifies it.
2. **NIFTY ETF seed LTP timing?** Current LTP (P&L grows organically) or month-ago LTP (lands on Home with realistic P&L showing). Recommendation: current LTP for honesty.

## Competitor benchmarks (used to shape design)

| Platform | Style | What we borrowed |
|---|---|---|
| Smallcase | Aggregator, broker required | Broker-deferred-but-prompted pattern (we relax to fully deferred) |
| INDmoney | Aggregator, browse-first | Summary screen at end of wizard, multi-goal with priority |
| Kuvera | Aggregator, light KYC | Mobile-first responsive single design |
| ET Money | Aggregator | Phone-OTP-only signup (deferred to public launch) |
| Wealthfront (US) | Robo-advisor | 10–12-Q risk quiz depth; multi-goal + priority weighting |
| Robinhood (US) | Broker | Quick-celebration + auto-redirect (rejected — felt too thin for this audience) |
| Stash / Acorns | Layman-fintech | Coach-marked first-Home tour |
| Zerodha Kite | Broker | Rejected — we are not a broker |

## Memory + cross-references

- `project_audience_and_automation_scope.md` — Option A locked: layman retail, no LLM trade discretion
- `feedback_manifest_permission_parity.md` — manifest gates must match App.tsx; relevant when wiring the new `/onboarding` route
- `project_supabase_migration_drift.md` — every MCP `apply_migration` must commit a matching local `.sql` at the same timestamp
- `project_phase1_remaining_tasks.md` — T19 / T20 LLM summary layer still compliance-gated; signal generator is fine to fire on the paper portfolio
- Task #35 in the live queue closes when this design ships
