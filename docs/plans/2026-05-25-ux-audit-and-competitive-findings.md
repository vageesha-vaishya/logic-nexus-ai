# UX Audit & Competitive Findings — Logic Nexus AI / Sthira

**Date:** 2026-05-25
**Scope:** Scoped UX audit of 3 high-traffic surfaces + competitive teardown of 12 category leaders (CRM, Aviation MRO, Indian retail investing)
**Method:** Code-level inspection of the audited surfaces; web research for competitors (some MRO/CRM vendors paywall their actual UI — caveats noted in-line)

---

## TL;DR — What to do next

If you do nothing else, do these **eight P0/P1 items in the next sprint** — they're all <1 day each and they remove the worst friction across every surface:

1. Add `aria-label` to every icon-only button (Dashboard widget controls, AMRO action menus, Hero icons) — accessibility debt is consistent and trivial to fix.
2. Add visible `focus-visible:ring-2` on all interactive elements (keyboard users currently have no idea where focus is).
3. Add `sm:grid-cols-2` to `FeaturesSection.tsx:69` — 8 cards stack 1-per-row on mobile, killing scroll depth.
4. Auto-focus the email input on `SignupForm.tsx` mount.
5. Add `role="alert"` to all form error messages.
6. Verify `AmroKpiGrid` has responsive breakpoints; 4 KPIs in one row likely overflows below 1024px.
7. Add a step counter ("Step 1 of 3") to the multi-page signup flow.
8. Show widget controls on `:focus-within` not just `:hover` (`DraggableWidget.tsx:66`).

Then do the **four medium-effort wins** that have the biggest UX leverage (each 1–3 days):

9. **Pipedrive-style activity-urgency color dot** on every list/kanban card (CRM deals, quotations, AMRO work orders). Single 8px swatch, four states. Reusable everywhere.
10. **Veryon-style forecasting due-list** as AMRO's default landing instead of a backward-looking "open WO count." Forward-looking compliance risk is the right hero for an FAA/EASA/CAAC/SACAA platform.
11. **HubSpot-style slide-over preview** for associated records (click a Part / Contact / Aircraft → 6-property preview slides in, no navigation).
12. **Salesforce-style Path component** (chevron stage tracker) — unifies quotation pipeline, CRM lead lifecycle, AMRO work-order progression behind one reusable component with stage-specific guidance.

Sthira-specific (separate roadmap, see §3):
13. **"Start with ₹100" SIP anchor** as the primary CTA on every fund card.
14. **Single risk pill** (Low/Med/High) with methodology one tap away — both an activation lever AND a SEBI 500-sample defensible artifact.
15. **Approval-moment card** for every Tier-2 drift rebalance — the trust contract that separates "advisory" from "discretionary."

---

## 1. Surface Audit Findings

### 1.1 Dashboard Landing (`src/pages/dashboard/Dashboards.tsx`)

**What works:** Consistent 4-col responsive grid; edit-mode toggle is clear; debounced DB saves; deduplication logic on widget add.

**Top issues:**

| Severity | Issue | File | Fix |
|---|---|---|---|
| P1 | Icon-only Settings/Remove buttons have no `aria-label` | `DraggableWidget.tsx:71-76` | Add `aria-label="Widget settings"`, `aria-label="Remove widget"` |
| P1 | Widget controls invisible to keyboard users (hover-only) | `DraggableWidget.tsx:66` | Add `focus-visible:opacity-100` + show on `focus-within` |
| P1 | Skeleton always renders 3 placeholders regardless of widget size | `WidgetSkeleton.tsx:14-17` | Accept `rowCount` prop |
| P1 | Team-member avatar fallback may overflow at `sm:` | `Dashboards.tsx:290-296` | `min-w-0 truncate` on container |
| P2 | Add Widget dialog doesn't preview the size choices | `Dashboards.tsx:337-339` | Add small/medium/large thumbnail |

### 1.2 AMRO Work-Orders Grid (`src/features/module-amro/components/work-orders/`)

**What works:** Multi-column sort with correct `aria-sort`; density controls (36/48/60px); empty state has secondary helper text; 8 well-chosen columns.

**Top issues:**

| Severity | Issue | File | Fix |
|---|---|---|---|
| **P0** | KPI grid above the WO table likely overflows <1024px (4 cards in a single row) | `AmroWorkOrdersListPage.tsx:311-318` (`AmroKpiGrid`) | Verify/add `md:grid-cols-2 lg:grid-cols-4` |
| P1 | Sortable headers lack visual "clickable" affordance | `AmroAdvancedDataGrid.tsx:227-240` | Add `hover:underline cursor-pointer`; consistent `title` tooltip |
| P1 | Right-side form panel has no visible Close button | `viewMode="grid-with-right-form"` | Add explicit X with `aria-label="Close details panel"` |
| P1 | Action menu (`MoreHorizontal`) has no `aria-label` | `AmroAdvancedDataGrid.tsx:349` | `aria-label="Actions for ${record.id}"` |
| P2 | Field key `work_order_number` but UI says "Work Package #" — terminology drift | `AmroWorkOrdersListPage.tsx:327` | Rename key or document the alias |
| P2 | Status badge colors have no legend | `AmroWorkOrdersListPage.tsx:35-45` | Add legend popover in header |

### 1.3 Marketing → Signup Funnel (`src/pages/Landing.tsx`, `src/pages/signup/`)

**What works:** Hero copy answers "what is this?" fast; domain-aware placeholders; clean confirmation page; client-side Zod validation.

**Top issues:**

| Severity | Issue | File | Fix |
|---|---|---|---|
| P1 | No focus ring on Hero buttons | `HeroSection.tsx:26-79` | `focus-visible:ring-2 focus-visible:ring-offset-2` |
| P1 | 8 feature cards become 1-per-row below 768px | `FeaturesSection.tsx:69` | Add `grid-cols-1 sm:grid-cols-2` |
| P1 | Email input doesn't auto-focus | `SignupForm.tsx:154-272` | `autoFocus` on email field |
| P1 | Form errors lack `role="alert"` | `SignupForm.tsx:196,211,…` | Wrap in `<span role="alert">` |
| P1 | No step counter across signup flow (Picker → Form → Confirmation) | `SignupDomainPicker.tsx`, `SignupForm.tsx` | "Step X of 3" header |
| P1 | Confirmation page may fail in dark mode (no explicit contrast) | `SignupForm.tsx:130-151` | Test + explicit text/bg tokens |
| P2 | "Already have an account?" link buried at form bottom | `SignupForm.tsx:265-270` | Move to top |
| P2 | Submit button has no disabled state during submission | `SignupForm.tsx:241-249` | Add `disabled` + wait cursor |
| **Finding** | `marketing-inquiry` Edge Function exists but has NO frontend form posting to it from this repo — orphaned endpoint | `supabase/functions/marketing-inquiry/index.ts` | Confirm: lives on separate marketing site? Or missing here? |

### 1.4 Cross-cutting patterns

1. **Icon-only buttons across the platform consistently miss `aria-label`.** Standardize via a wrapper.
2. **Keyboard focus indicators are either missing or hidden on hover.** Add `focus-visible:ring-2` to all interactive shadcn primitives.
3. **Responsive grid breakpoints are inconsistent.** Dashboard and Features both use `md/lg`, but `sm:` is rarely defined → things break at 640px.
4. **Empty/loading states lack contextual next-step CTAs.** "No work orders" should suggest "Create your first work package."
5. **Color-coded semantics (status, priority) have no visible legend anywhere.**

---

## 2. Competitive Patterns to Adopt — CRM + AMRO

### 2.1 Top 5 Patterns to Steal

| # | Pattern | Source | Why it fits | Effort | Applies to |
|---|---|---|---|---|---|
| 1 | **Forecasting Due-List as default dashboard** (sorted by "time remaining until non-compliance") | Veryon Tracking | Forward-looking compliance posture aligned with FAA/EASA/CAAC/SACAA audits | M | AMRO |
| 2 | **Path component** (chevron stage tracker w/ key-fields-per-stage) | Salesforce | Unifies quotation pipeline, CRM lead lifecycle, AMRO WO progression | M | CRM, Quotation, AMRO |
| 3 | **Activity-urgency color dot** (red/yellow/green/grey) | Pipedrive | Single 8px swatch collapses "what needs attention" everywhere | S | All list/kanban cards |
| 4 | **Slide-over preview panel** for associated records | HubSpot | Click a Part on a WO → 6-property preview slides in, no nav | M | AMRO, CRM, Quotation |
| 5 | **Role-based "Hub" landing pages** with per-role navigation manifest | Ramco + AMOS hybrid | Planner / Mechanic / Sales / Inspector hubs — cuts the AMRO onboarding cliff | M | AMRO especially; whole platform eventually |

> ⚠ Per [[feedback_manifest_permission_parity]]: any per-role manifest changes must keep `requiredPermissions` parity with `App.tsx` ProtectedRoute, or users get silently locked out.

### 2.2 Top 3 Anti-Patterns to Avoid

1. **Ramco-style field-dense mega-screens.** Reviewers explicitly call out "fighting the UI." Default to wizard/stepper for any flow with >12 fields or >2 logical sections. **Risk surface today: quotation builder, AMRO WO creation.**
2. **AMOS-style deep nested menus + MDI windowing.** Top complaint is "getting lost." Cap nav depth at 3 levels; use breadcrumbs + global search.
3. **Forced workflow pop-ups (Pipedrive's "next activity" nag).** Any "you must schedule the next step" must be dismissible per pipeline/user from day one.

### 2.3 Caveats on evidence

Salesforce, HubSpot, Pipedrive, Monday — public docs + free tiers gave sharp pattern extraction. **Ramco, ePlaneAI, Veryon, AMOS are paywalled** — recommendations are based on documented design intent + Capterra/G2 verified reviews, not screenshots. Treat MRO bucket recommendations as hypotheses to validate via demo requests or trade-show floor walks.

---

## 3. Competitive Patterns to Adopt — Sthira (Retail Investing)

### 3.1 Top 5 Patterns to Steal

| # | Pattern | Source | Why it fits Sthira | Effort |
|---|---|---|---|---|
| 1 | **"Start with ₹100" anchor** as primary CTA on every fund card | Groww | Removes activation anxiety for first-time SEBI-regulated users | S |
| 2 | **Single risk pill (Low / Med / High)** with methodology one tap away | Groww + Smallcase | Laymen can't price volatility; can read a traffic light. One-tap methodology = SEBI defense | M |
| 3 | **Approval-moment card** for every Tier-2 drift rebalance ("approve now / auto-approve in 48h") | Smallcase | The trust contract that separates "advisory" from "discretionary" trading | M |
| 4 | **Portfolio-scoped LLM storytelling** (default), not market firehose | INDmoney's INDstories | Reframes the LLM from speculator to explainer — aligned with [[project_audience_and_automation_scope]] Option A | M |
| 5 | **Pause-without-AMC-mandate for SIPs** (scheduler-level skip, not mandate cancel) | Zerodha Coin | Reversibility is the single biggest first-SIP fear-killer | S–M |

### 3.2 SEBI / Compliance UX (directly relevant to the 500-sample compliance gate from [[project_phase1_remaining_tasks]])

1. **Plain-language regulatory framing.** Groww-style: "We need your Aadhaar to verify your identity — required by SEBI for all investment accounts." NOT a wall-of-text legal page.
2. **Show the math, don't hide it.** Smallcase publishes its volatility methodology vs. Nifty 100 on a linked page. Every advisory number on Sthira must pair with a "How is this calculated?" link to a reviewable methodology page.
3. **Past-performance copy sits AT the number, not in the footer.** "3Y returns: 14.2% • Past performance does not guarantee future returns" inline, same component. Single most-cited SEBI ad-code violation pattern.
4. **5-second disclaimer timing.** SEBI mandates 5-second visible duration for the standard "mutual funds are subject to market risks…" line in audio-visual content. Bake into video/animation components as a non-negotiable `minDurationMs={5000}` prop, not designer discretion.

### 3.3 Top 3 Anti-Patterns to Avoid

1. **Super-app feature sprawl** (INDmoney). Credit cards + loans + US stocks + insurance on the home screen reads as "we monetize you every way we can." For Sthira's layman-only, advisory-only positioning, **restraint IS the trust signal.**
2. **Gamification of trade surfaces** (INDmoney's "flashy, video-game" perception). Streaks/confetti are fine in education (Varsity-style). SEBI ad-code increasingly treats them as misleading inducement on trade screens.
3. **Defaulting laymen to a watchlist of tickers** (Zerodha Kite). Opening on raw market data tells a non-expert "you don't belong here." Sthira's logged-in home must lead with portfolio state + next safe action.

---

## 4. Prioritized 30-Day Roadmap

### Week 1 — Accessibility & responsive sweep (low risk, high coverage)
- [ ] Standardize `aria-label` on all icon-only buttons across `DraggableWidget`, AMRO grid, Hero — likely a codebase-wide grep pass
- [ ] Add `focus-visible:ring-2 focus-visible:ring-offset-2` to base shadcn Button variants (one edit, platform-wide effect)
- [ ] Fix `FeaturesSection.tsx:69` mobile grid; verify `AmroKpiGrid` responsive classes
- [ ] Signup ergonomics: `autoFocus`, `role="alert"`, step counter, submit-disabled-during-submission

### Week 2 — Reusable component wins
- [ ] Build **PathTracker** component (chevron stage tracker, key-fields-per-stage). Ship it on Quotation pipeline first; AMRO + CRM later.
- [ ] Build **UrgencyDot** component (4-state colored swatch). Drop into existing CRM deal cards + AMRO WO list rows.
- [ ] Build **PreviewSlideOver** primitive. First consumer: Part-preview from AMRO WO row.

### Week 3 — AMRO landing redesign
- [ ] **ForecastDueList** widget on AMRO module landing (replaces or augments backward-looking KPI grid)
- [ ] Status & priority legend popover (resolves cross-cutting #5)
- [ ] Wire `PreviewSlideOver` for Parts, Aircraft, MPD references

### Week 4 — Sthira-specific (parallel track)
- [ ] "₹100 minimum SIP" CTA on fund cards
- [ ] **RiskPill** component + methodology page route (`/methodology/volatility`)
- [ ] **RebalanceApprovalCard** flow + audit-log table (depends on Tier-2 backend being ready — coordinate with retail-investment platform sequencing in `docs/plans/2026-05-18-retail-investment-platform-design.md`)
- [ ] SEBI disclaimer component with `minDurationMs={5000}` enforcement for any animated/video surface

---

## 5. Open Questions

1. **Orphaned marketing-inquiry endpoint.** Where does the form that posts to `supabase/functions/marketing-inquiry/index.ts` live? Coolify-deployed marketing site, or missing from this repo? (Per [[project_marketing_site]] there are 5 live sites — likely lives there.) Confirm before proposing changes to the funnel.
2. **AMRO Hub split.** Do we have enough role telemetry to know which 4–6 widgets each role (Planner / Mechanic / Inspector / CAMO / Stores) actually uses, or should Week 3 start with a 30-min user interview round?
3. **Sthira RiskPill methodology.** Use Smallcase's published methodology (vs. Nifty 100) as the template, or compute against a Sthira-specific benchmark? The 500-sample compliance review will need this decided.

---

## Sources

**Surface audit:** Direct code inspection — file:line references inline.

**CRM + AMRO competitive:**
- Salesforce Ben — [25+ UI features](https://www.salesforceben.com/salesforce-ui-features-to-implement-in-every-org/), [Cosmos / SLDS 2](https://www.salesforce.com/blog/salesforce-cosmos-slds-2/)
- HubSpot — [Customize records](https://knowledge.hubspot.com/object-settings/customize-records), [Record previews](https://knowledge.hubspot.com/object-settings/customize-record-previews), [Cards](https://knowledge.hubspot.com/object-settings/create-cards-on-records)
- Pipedrive — [Pipeline view](https://support.pipedrive.com/en/article/pipeline-view), [Disable follow-up pop-up](https://support.pipedrive.com/en/article/how-can-i-disable-the-follow-up-activity-pop-up)
- Monday — [Board views](https://support.monday.com/hc/en-us/articles/360001267945-The-board-views), [Column types](https://support.monday.com/hc/en-us/articles/115005310285-Available-column-types-on-monday-com)
- Ramco — [Aviation MRO](https://www.ramco.com/products/aviation-software/mro-industry/), [Capterra reviews](https://www.capterra.com/p/190513/Ramco-Aviation-Solution/reviews/)
- ePlaneAI — [Homepage](https://www.eplaneai.com/), [MRO Americas 2025](https://www.eplaneai.com/blogs/how-the-future-of-aviation-ai-took-flight-at-mro-americas-2025)
- Veryon — [Flightdocs](https://veryon.com/flightdocs-maintenance), [Tracking](https://veryon.com/aviation-maintenance-tracking-platform)
- AMOS — [Swiss-AS](https://www.swiss-as.com/), [Capterra reviews](https://www.capterra.com/p/87390/AMOS/reviews/)

**Sthira / retail investing:**
- Product teardowns: productgrowth.in/insights/fintech/groww-vs-zerodha-onboarding, medium UX case studies on Zerodha & Smallcase, uxhack.co Groww onboarding case study
- Vendor docs: support.zerodha.com (Coin SIP), groww.in/help (MF SIPs), smallcase.com/blog (rebalancing), smallcase.com/meta/volatility-calculation
- Reviews: manikarthik.com (INDmoney), tradingcritique.com (Groww), Quora India fintech threads
- Regulatory: [SEBI ad code on 5-second disclaimer](https://www.sebi.gov.in/sebi_data/commondocs/imdcir1208_h.html)
