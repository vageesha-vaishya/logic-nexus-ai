# SOS Logistics Pro — Design System

**Status:** Living document. Last full revision: 2026-09-13.
**Scope:** The main platform UI shell (CRM, Sales, and every module rendered inside `DashboardLayout`). The Sthira mobile brand and the Smart Quote module keep their own scoped identities on top of this base (see [Sub-brands](#sub-brands)).

This is the single reference for *why* the UI looks the way it does. Every token, component convention, and accessibility rule below is backed by either a computed measurement, a cited external source, or a documented trade-off. If you change a token, re-run the audit in [Appendix A](#appendix-a--re-running-the-contrast-audit) and update the numbers here.

---

## 1. Design principles

Derived from the competitive research in [§2](#2-competitive-research) and this codebase's own constraints (dense operational data, all-day use, self-hosted multi-tenant):

1. **Restraint over variety.** One base typeface, weights capped at 400–700, one brand action color, one narrow set of semantic colors. Professional/enterprise readability comes from fewer competing signals, not more (monday.com's Vibe system caps at 300–600; HubSpot uses a single accent for all primary CTAs).
2. **Dark mode is first-class, not a toggle afterthought.** Every token is defined for both modes; every component must render correctly in both. Pipedrive's own team reported *higher* retention among dark-mode users — for an all-day tool this is not cosmetic.
3. **Tokens, never raw values.** All color goes through `hsl(var(--token))`. Hardcoded Tailwind palette classes (`bg-white`, `text-gray-900`, `bg-slate-50`) are defects — they are invisible or wrong in dark mode. This single rule caused the majority of the dark-mode bugs fixed in this revision.
4. **Contrast is computed, not eyeballed, and re-checked after every token change.** Pipedrive shipped a contrast regression during a color overhaul. We keep the audit script in-repo (Appendix A).
5. **Brand color ≠ status color.** The brand blue is for actions and selection. Record lifecycle state (stage, status, priority) uses its own semantic palette so one blue never has to mean two things (Zendesk Garden's explicit primary-vs-secondary split).
6. **Familiarity over novelty.** A redesign must let existing users navigate on muscle memory (Copper's entire value proposition). Structural changes in this revision were consolidations of duplicated patterns, not new metaphors.

---

## 2. Competitive research

Desk research from **public sources only** — marketing pages, published design-system documentation, and third-party UX write-ups. No authenticated product access, no user interviews, no first-party usability testing. Confidence is noted per platform. Full source list in [Appendix C](#appendix-c--research-sources).

| Platform | Public design-system docs? | Confidence | Key takeaway we adopted |
|---|---|---|---|
| **Salesforce** (Lightning Design System) | Yes — best in class | High | Explicit, audited WCAG 2.1 AA conformance claim; moving toward system/Inter-style font stacks; CSS custom properties over hand-rolled tokens. |
| **monday.com** (Vibe) | Yes — versioned, open | High | Weight range deliberately capped (300–600); 10-step type scale; heavy corner rounding as brand identity. |
| **Freshworks** (Crayons) | Yes — versioned web components | High | Base font swappable through one CSS variable; accessibility + i18n as documented system requirements. |
| **Zendesk** (Garden) | Yes — rigorous | High | Base-4 spacing; 12-shade ramps with *consistent contrast at every step*; brand color kept separate from status/tag color. |
| **HubSpot** | Partial (brand-site breakdowns) | Medium | Dual typeface (serif display + sans body); one saturated accent for all CTAs; 16.48:1 body-text contrast. |
| **Pipedrive** | Partial (UX-team blog) | Medium | Popularized the kanban pipeline as *the* CRM metaphor; semantic tokens; dark mode retention data; contrast-regression cautionary tale. |
| **Zoho CRM** | Partial (product pages) | Medium | Field-value-driven semantic coloring (stage badges auto-colored by outcome) — validates our stage color-coding. |
| **Attio** | No | Medium | Notion-like table-first views; AI output treated as first-class UI. |
| **Close** | No | Lower | Keyboard-first; "focus/zen mode" that strips chrome for single-queue work. |
| **Copper** | No | Medium | Mimics Google Workspace deliberately — wins on zero learning curve, not visual novelty. |

**Cross-cutting patterns (majority of the 10):**
- Semantic/named design tokens over raw values (universal among platforms with real systems) — validates our existing `hsl(var(--token))` architecture; the gap was rigor of application, not the architecture.
- Base-4 / base-8 spacing grids — matches the 8px grid already defined in `index.css`.
- Color-coded lifecycle badges driven by field value — the single most consistent CRM-specific pattern surveyed.
- Restrained font weights and narrow accent usage.
- Dark mode expected for all-day tools.
- Tables favored over chart-heavy dashboards for operational data (2025–26 trend coverage).
- Only Salesforce and Zendesk publish a specific WCAG conformance claim — accessibility rigor is a genuine differentiator among CRMs.

---

## 3. Design tokens

All tokens live in `src/index.css` (`:root` for light, `.dark` for dark) and are consumed via Tailwind (`tailwind.config.ts`) as `hsl(var(--token))`. The `ThemeProvider` (`src/hooks/useTheme.tsx`) may override a subset at runtime via inline styles on `<html>` when a saved theme preset is active — see [§3.6](#36-runtime-theme-presets).

### 3.1 Typography

| Token | Value | Notes |
|---|---|---|
| Base typeface | **Inter** (400/500/600/700) | Set on `body` in `index.css` and as Tailwind's default `sans`. Purpose-built for UI legibility at small sizes. Loaded via `@fontsource/inter` in `main.tsx` — already fetched for the Sthira brand, so zero added network cost. |
| Fallback stack | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | |
| Font features | `'cv11', 'ss01'` | Inter stylistic alternates for cleaner UI glyphs. |
| Smoothing | `-webkit-font-smoothing: antialiased` | |
| Scale | Major Third (1.25×): `--text-xs` 12px → `--text-6xl` 60px | Mirrors Tailwind's own `text-*` steps; pages use Tailwind utilities directly. |
| Page title | `text-3xl font-bold` (30px / 700) | Verified near-universal across ~80 dashboard pages. Exactly one `<h1>` per page. |
| Section title | `text-2xl` / `text-xl` `font-semibold` | |
| Body | `text-sm` (14px) | Tables, forms, labels. |
| Micro-copy | `text-[10px]`–`text-xs` | Badges, tags, timestamps only. Never for body copy. |
| Weight ceiling | 700 | No `font-extrabold`/`font-black` in the platform shell. |

**Why this mattered:** before this revision the platform declared *no* font-family anywhere, so every page fell back to the OS default (Segoe UI / San Francisco / Roboto) — inconsistent across machines and the main reason the UI read as generic. Two sub-brands had deliberate typefaces while the shell had none.

### 3.2 Color

HSL triples (no `hsl()` wrapper) so they compose with Tailwind's `/opacity` modifiers.

**Surfaces & text — light / dark**

| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | `0 0% 100%` | `222 47% 9%` | Page |
| `--card` | `0 0% 100%` | `222 35% 14%` | Panels. Dark: one clear step above background. |
| `--popover` | `0 0% 100%` | `222 33% 17%` | Dropdowns/menus. Dark: one step above card so stacked layers stay legible. |
| `--secondary` / `--muted` | `210 40% 96%` | `222 25% 20%` / `222 22% 18%` | Subtle fills, hover states. |
| `--foreground` | `222 47% 11%` | `210 40% 98%` | Primary text. 17.9:1 / 17.8:1 on background. |
| `--muted-foreground` | `215 16% 47%` | `215 20% 70%` | Secondary text. 4.72:1 / 8.45:1. |
| `--border` | `214 32% 91%` | `217 22% 28%` | Decorative dividers (cards, tables). *Deliberately* subtle — see §5.2. |
| `--input` | `214 20% 58%` | `217 20% 46%` | Form-field boundaries. Split from `--border` in this revision to clear WCAG 1.4.11's 3:1. |
| `--sidebar-*` | neutral light | `222`-hue navy family | Dark sidebar unified onto the page's hue (was a mismatched neutral gray). |

**Action & semantic — light / dark**

| Token | Surface | Text | Ratio | Notes |
|---|---|---|---|---|
| `--primary` | `217 91% 53%` | white | **4.59:1** | Was 60% lightness → 3.63:1 (fail). Trimmed 7 points; brand identity preserved, white-text convention kept. |
| `--accent` | `197 71% 52%` | `222 47% 11%` ink | **6.74:1** | Was white text → 2.65:1 (fail). Surface kept vivid; switched to dark ink. |
| `--success` | `142 71% 45%` | ink | **7.79:1** | Was white → 2.30:1 (fail). |
| `--warning` | `38 92% 50%` | ink | **8.37:1** | Was white → 2.14:1 (fail). Amber's luminance stays high at any usable lightness — dark ink is the only correct pairing. |
| `--destructive` (light) | `0 84% 50%` | white | **4.53:1** | Was 60% → 3.78:1 (fail). |
| `--destructive` (dark) | `0 70% 48%` | white | **5.29:1** | Already compliant. |
| `--title-strip` | = accent | `--title-strip-foreground` (computed) | ≥4.5:1 | Colored table-header band on CRM list pages. **New token**; text color computed at runtime (§3.6). |

The brand blue (`217 91% 53%`) is *only* for actions, links, selection, and focus. Record state uses the `--menu-strip-*` module hues and the `--up`/`--down`/`--neutral` financial semantics, never `--primary`.

### 3.3 Spacing

8px grid, defined as `--space-*` in `index.css` and matching Tailwind's default spacing scale. Component conventions:

| Token | Value |
|---|---|
| `--section-gap` | 24px |
| `--field-gap` | 16px |
| `--button-gap` | 8px |
| `--card-padding` / `--form-padding` | 24px |
| `--max-content-width` | 1440px |

Data-density stance: **compact-comfortable**. Table rows ~44px (`h-11`), list toolbars icon-only (44px targets) — denser than HubSpot, looser than Attio. Chosen for an operational tool whose users scan long lists all day.

### 3.4 Radius

| Token | Value | Use |
|---|---|---|
| `--radius` | `0.5rem` (8px) | Base. Tailwind `rounded-lg`. |
| `rounded-md` | `calc(var(--radius) - 2px)` | Inputs, buttons, menus. |
| `rounded-sm` | `calc(var(--radius) - 4px)` | Dense chips, sheet corners. |
| `rounded-full` | pill | Badges, avatars. |

Restrained relative to monday.com's 8px→1600px range: this is an operational tool, not a consumer product.

### 3.5 Elevation

**New in this revision.** Previously only `--shadow-lg` existed. Now a 5-step scale, tinted toward the palette's navy ink rather than pure black so shadows read as part of the surface family. Tailwind's `shadow-xs/sm/md/lg/xl` map onto these, so every existing usage upgraded in one place.

| Step | Light | Dark | Used by |
|---|---|---|---|
| `xs` | `0 1px 2px 0 hsl(222 47% 11% / .05)` | `0 1px 2px 0 hsl(0 0% 0% / .3)` | Subtle lift |
| `sm` | two-layer, ≤ .08 alpha | ≤ .4 | **Card** |
| `md` | two-layer, ≤ .08 | ≤ .4 | **Popover** |
| `lg` | two-layer, ≤ .10 | ≤ .5 | **Dropdown, Dialog** |
| `xl` | two-layer, ≤ .12 | ≤ .55 | Overlays |

Dark mode relies primarily on the surface-lightness steps (background < card < popover) for layer separation; shadows are a secondary cue there, hence the deeper black.

### 3.6 Runtime theme presets

`src/theme/themes.ts` defines 29 presets. Two are the dedicated defaults the header's sun/moon toggle switches between (**Default Simple** / **Default Dark**); the rest are decorative gradient accents selectable in Theme Management (platform-admin only — the per-page picker was removed from CRM toolbars in this revision).

When a preset is applied, `applyTheme()` sets `--primary`, `--accent`, `--ring`, `--sidebar-*`, gradient, and table tokens as inline styles on `<html>`. Because presets only ever set the *surface* color, this revision added **`contrastSafeForeground()`** — it computes the WCAG relative luminance of the applied surface and sets the matching `*-foreground` token to white if that clears 4.5:1, otherwise to dark ink. This applies to `--primary-foreground`, `--accent-foreground`, `--sidebar-*-foreground`, `--title-strip-foreground`, and `--table-header-text`. It also validates values *persisted in saved themes* — a real saved "High Contrast Blue" row shipped white text on a gold header, which this now corrects at load.

Consequence: any of the 29 presets, and any future user-saved theme, stays compliant for button/badge/header text without hand-tuning 32 different primary colors.

---

## 4. Component conventions

Built on shadcn/ui + Radix. Rules that were established or enforced in this revision:

### 4.1 Navigation
- **App header** (`DashboardLayout.tsx`): breadcrumb → *spacer* → domain/admin scope switchers → global search → help → notifications → dark-mode toggle → avatar. Scope switchers sit nearest the breadcrumb because they define what the page's data belongs to; the appearance toggle sits beside the account menu (GitHub/Linear/Vercel convention).
- **Module toolbar** (`CRMModuleHeaderNavigation`): one shared component, one shared control sequence (`pipeline, card, grid, list, create, refresh, importExport`), **icon-only** on every page. The per-page theme picker and a dead `layout` prop were removed.
- **Sidebar**: collapses to a drawer below `md` (`useSidebar().isMobile`).

### 4.2 Detail pages
- Exactly one action mechanism: the **sticky bottom bar** (`useStickyActions` → `StickyActionsBar`), registering *Cancel* while editing and *New X / Edit / Delete* otherwise. Account, Contact, Opportunity, and Activity Detail all follow this; the duplicated top-of-page action row was removed.
- `DetailScreenTemplate` renders the page's single `<h1>`. The record name inside the sheet is an `<h2>`.

### 4.3 Tables
- Wrap in the shadcn `Table` (already has an `overflow-auto` scroll container).
- `TableHead` renders `<th scope="col">` by default (WCAG 1.3.1 / H63).
- Colored header bands use `bg-[hsl(var(--title-strip))]` + `text-[hsl(var(--title-strip-foreground))]` — never a hardcoded `text-white`.

### 4.4 Forms
- Inputs/Selects/Textareas use `border-input` (the strengthened token) and `focus-visible:ring-2 ring-ring ring-offset-2`.
- Every input has an accessible name: a `<label htmlFor>`, `aria-label`, or `aria-labelledby`. A placeholder alone is *not* sufficient (it vanishes on input and is ambiguous across repeated Min/Max pairs).
- Multi-step forms (e.g. `ActivityForm`) use `justify-between` (Cancel/Back left, Next/Submit right); single-step forms use `justify-end` (Cancel + Submit right). This difference is intentional.

### 4.5 Color usage rules
- **Never** `bg-white`, `bg-gray-*`, `bg-slate-*`, `text-gray-*`, `text-slate-*`, `border-gray-*`, or literal hex in `className`. Use `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`.
- Semantic Tailwind palette classes (`text-red-600`, `bg-amber-50`) are acceptable *only* for status/priority badges that are the same in both modes, and should be reviewed for dark-mode legibility.
- Any component that hardcodes a foreground on a themed surface must use the corresponding `*-foreground` token so runtime presets stay compliant.

---

## 5. Accessibility (WCAG 2.1 AA)

### 5.1 Color contrast — computed audit

Measured with the script in Appendix A (WCAG relative-luminance formula). **Before → after** for every pair that changed:

| Pair | Before | After | Threshold | Result |
|---|---|---|---|---|
| Primary button text (light+dark) | 3.63 | **4.59** | 4.5 (normal text) | PASS |
| Accent surface text | 2.65 | **6.74** | 4.5 | PASS |
| Success surface text | 2.30 | **7.79** | 4.5 | PASS |
| Warning surface text | 2.14 | **8.37** | 4.5 | PASS |
| Destructive text (light) | 3.78 | **4.53** | 4.5 | PASS |
| Input border vs background (light) | 1.24 | **3.22** | 3.0 (non-text, 1.4.11) | PASS |
| Input border vs card (dark) | 1.67 | **3.27** | 3.0 | PASS |
| Table title-strip text on gold accent | 1.84 (white) | **8.37** (ink) | 4.5 | PASS |

Unchanged pairs already passing: foreground/background 17.9 & 17.8, muted-foreground 4.72 & 8.45, secondary 16.3 & 13.0, sidebar 10.0 & 16.0, destructive (dark) 5.29.

**Buttons are "normal text."** WCAG's large-text exemption (3:1) starts at 18.66px bold / 24px regular; button and badge labels here are 12–14px, so 4.5:1 applies even when bold.

### 5.2 Documented trade-off: decorative borders
`--border` (card outlines, table row dividers, section rules) measures 1.24:1 light / 1.67:1 dark — **below** 1.4.11's 3:1. This is deliberate and shared with most production enterprise SaaS: 1.4.11 applies to visual information *required to identify components and states*; a purely structural divider between cards that are also separated by spacing and elevation is not required to identify anything. Forcing every hairline to 3:1 makes the entire UI read as heavily boxed. Interactive boundaries (`--input`, focus rings, toggles) *do* meet 3:1. Revisit if an accessibility review disagrees.

### 5.3 Keyboard & focus
- All interactive primitives (`Button`, `Input`, `Select`, `Textarea`, dark-mode toggle) carry `focus-visible:ring-2 ring-ring ring-offset-2`. `--ring` = primary (4.59:1 light, 4.05:1 dark) — clears 3:1 for a focus indicator.
- "Skip to main content" link present; `<main id="main-content" role="main" tabIndex={-1}>` is a valid focus target.
- No positive `tabindex` anywhere audited (no tab-order hijacking).

### 5.4 Semantics & screen-reader structure (static audit)
Programmatic scan of Dashboard, Opportunities list, and Account Detail after fixes:

| Check | Dashboard | Opportunities | Account Detail |
|---|---|---|---|
| Interactive elements audited | 38 | 62 | 52 |
| Missing accessible name | 0 | 0 *(was 2 — date inputs)* | 0 *(was 2 — radios)* |
| `<h1>` per page | 1 | 1 | 1 *(was 2)* |
| Heading order | valid | valid | H1 > H2 > H3 *(was H1 > H1 > H3)* |
| `main` / `nav` / `header` landmarks | 1 / 1 / 1 | 1 / 2 (both labelled) / 1 | 1 / — / — |
| Images without `alt` | 0 | — | — |
| `<th scope>` | — | now default | — |

### 5.5 What was **not** verified — read this
- **No screen-reader runtime testing.** NVDA/JAWS/VoiceOver were not run. Semantic structure and ARIA were audited programmatically only. A real screen-reader pass is still required for a conformance claim.
- **No real keyboard walk-through.** The browser-automation tooling available cannot drive native sequential focus navigation; keyboard support was verified from the component source (focus-visible rules) and static structure, not by tabbing through live pages.
- **No user testing of any kind.** No usability rounds, no interviews. Nothing in this document is based on user feedback.

---

## 6. Responsive design

Target viewports: 360 (mobile), 768 (tablet), 1280 (desktop), 1920 (large desktop).

### 6.1 Mechanisms (code-audited, all present)
- Sidebar → mobile drawer below `md`; hamburger toggle `md:hidden`; scrim overlay `lg:hidden`.
- Module toolbar `flex-wrap` — wraps rather than clips.
- Tables inside `overflow-auto` containers — horizontal scroll, no layout break.
- Stat/KPI grids: `grid-cols-1 md:grid-cols-2 xl:grid-cols-4`.
- Kanban columns: `w-[85vw]` on mobile with `snap-center` scrolling, `md:min-w-[300px] md:max-w-[400px]` on desktop. (The `400px` values a naive grep flags are `max-width`s at `md+`, not overflow risks.)
- No fixed pixel widths ≥400px found on CRM/Sales pages outside the responsive kanban rules above.
- `--max-content-width: 1440px` centers content on 1920-class displays.

### 6.2 What was **not** verified — read this
- **Visual rendering at 360px and 768px was not screenshot-verified.** The available browser automation could not produce a narrow viewport in this environment: the window is maximized (programmatic resize is ignored), popup windows are outside the tool's reach, and the app correctly blocks iframe embedding (`frame-ancestors` — good clickjacking protection, but it rules out the iframe technique). **Verify in Chrome DevTools device mode or on real devices before relying on this.**
- **1920px** was not separately screenshot-verified; ~1600px desktop was verified live throughout this revision and is the basis for the desktop claims.
- **Only Chrome/Chromium was exercised.** Firefox, Safari, and Edge were **not** opened. Known engine-specific risks to check: `color-mix()` (used in Smart Quote, Safari ≥16.2), `:has()` in `TableHead` (`[&:has([role=checkbox])]`, Firefox ≥121), `backdrop-filter` on the sticky action bar (needs `-webkit-` in older Safari; Tailwind emits it).

---

## 7. Sub-brands

Two surfaces intentionally sit *on top of* this system with their own identity:
- **Sthira** (mobile/markets): Source Serif Pro + Inter, Calm Wealth palette (`--sthira-*`), user-pickable variants via `data-sthira-theme`.
- **Smart Quote**: IBM Plex Sans body, Big Shoulders Display headings, a maritime palette (`--sq-*`) scoped under `.smart-quote-identity`.

Both override `font-family` and color within their own scope and are unaffected by the platform base font. They are the reference this revision drew on: the platform shell now has the same *deliberateness* they always had.

---

## 8. Change log for this revision

| Area | Change | Files |
|---|---|---|
| Typography | Inter as platform base font; 700 weight added | `index.css`, `tailwind.config.ts`, `main.tsx`, `entrypoints/markets.tsx` |
| Contrast | primary/destructive lightness trimmed; accent/success/warning → ink text; `--input` split from `--border` | `index.css`, `theme/themes.ts` |
| Contrast (runtime) | `contrastSafeForeground()`; `--title-strip-foreground`; table-header-text validation | `hooks/useTheme.tsx`, `index.css`, `Activities/Contacts/Opportunities.tsx` |
| Elevation | 5-step navy-tinted shadow scale, light+dark, wired to Tailwind | `index.css`, `tailwind.config.ts` |
| A11y semantics | `<th scope="col">` default; `aria-label`s on unlabeled inputs/radios; duplicate `<h1>` → `<h2>` | `ui/table.tsx`, `Opportunities.tsx`, `Account/Contact/OpportunityDetail.tsx` |
| Dark mode | Hardcoded light-only colors replaced with tokens across shared enterprise components and Detail pages | `EnterpriseComponents.tsx`, `EnterpriseCard.tsx`, `EnterpriseFormLayout.tsx`, `TaskScheduler.tsx`, `LeadActivitiesTimeline.tsx`, Detail pages |
| Navigation | Unified toolbar (icon-only, shared sequence, theme picker removed); Detail pages consolidated onto sticky action bar | `CRMModuleHeaderNavigation.tsx`, Detail pages |

Earlier in the same day (separate commits): dark/light theme unification, header reorganisation, reactive per-page accent theming, Kanban dark-mode fix.

---

## Appendix A — Re-running the contrast audit

Run after **any** token change:

```bash
node docs/design-system/contrast-audit.mjs
```

Edit the token table at the top of the script when values change. Thresholds: 4.5:1 normal text, 3:1 large text and UI component boundaries.

## Appendix B — Not done / open items

- Real usability testing rounds (requires human participants).
- Screen-reader runtime pass.
- Cross-browser verification on Firefox, Safari, Edge.
- Screenshot-verified rendering at 360 / 768 / 1920.
- `LeadDetail` / `QuoteDetail` keep their own richer navigation; not migrated to the sticky-bar pattern (business-critical workspace pages, deliberately left alone).
- Lead/Activity/Opportunity/Quote "New" pages keep their own shells; `EntityCreatePageShell` is coupled to `UnifiedPartnerForm` and would need generalising first.
- `EnterpriseButton/Form/Header/Modal/ActivityFeed` still contain hardcoded light colors but are not imported by any live page (dead code or Storybook-only).
- Status/priority badge palettes (`bg-red-50 text-red-600` etc.) are legible but not tuned per mode.

## Appendix C — Research sources

Salesforce: [SLDS 2 Typography](https://www.lightningdesignsystem.com/2e1ef8501/p/93288f-typography), [Base Components Accessibility](https://developer.salesforce.com/docs/platform/lwc/guide/base-components-accessibility.html), [Default typeface release note](https://help.salesforce.com/s/articleView?id=release-notes.rn_slds_default_typeface.htm), [designsystems.one breakdown](https://www.designsystems.one/design-systems/lightning-design).
HubSpot: [DesignMD tokens](https://designmd.cc/benchmarks/hubspot), [shadcn.io HubSpot](https://www.shadcn.io/design/hubspot), [RonDesignLab case](https://rondesignlab.com/cases/hubspot-crm-saas-ux-ui-design).
Pipedrive: [Semantic design system (Priit Karu)](https://priitkaru.com/semantic-design-system), [DesignSystemHunt](https://www.designsystemhunt.com/ds/Pipedrive-Convention-UI).
Zoho: [Canvas](https://www.zoho.com/canvas/), [Canvas best practices](https://www.bizappln.com/blog/zoho-crm-canvas-best-practices-for-customization/).
monday.com: [Vibe](https://vibe.monday.com/), [developer docs](https://developer.monday.com/apps/docs/vibe-design-system), [shadcn.io monday](https://www.shadcn.io/design/monday).
Freshworks: [Crayons](https://crayons.freshworks.com/introduction/), [Launch post](https://medium.com/freshworks-developer-blog/launching-crayons-our-new-web-component-library-e2857b6effe).
Zendesk: [Garden overview](https://zendeskgarden-website.mintlify.app/design/introduction), [Garden color](https://garden.zendesk.com/design/color/), [Garden typography](https://garden.zendesk.com/components/typography/), [Nutshell vs Sell](https://www.nutshell.com/nutshell-vs-zendesk-sell).
Attio: [Medium review](https://medium.com/@salepier/reviewing-attio-a-notion-like-crm-a0e594407a98), [softwareco.com](https://www.softwareco.com/attio-reframe-crm-through-ux-and-language/).
Close: [SaaSUI](https://www.saasui.design/application/close-crm).
Copper: [Google Workspace CRM](https://www.copper.com/resources/crm-for-google-worskpace), [cllimber review](https://cllimber.com/ai_tools/copper-crm-review/).
Trends: [designstudiouiux CRM UX](https://www.designstudiouiux.com/blog/crm-ux-design-best-practices/), [Fuselab dashboard trends](https://fuselabcreative.com/top-dashboard-design-trends-2025/), [SaaSFrame 2026](https://www.saasframe.io/blog/the-anatomy-of-high-performance-saas-dashboard-design-2026-trends-patterns).
