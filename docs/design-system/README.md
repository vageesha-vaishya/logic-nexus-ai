# SOS Logistics Pro — Design System

**Status:** Living document. Last full revision: 2026-09-13.
**Scope:** The main platform UI shell (CRM, Sales, and every module rendered inside `DashboardLayout`). The Sthira mobile brand and the Smart Quote module keep their own scoped identities on top of this base (see [Sub-brands](#sub-brands)).

This is the single reference for *why* the UI looks the way it does. Every token, component convention, and accessibility rule below is backed by either a computed measurement, a cited external source, or a documented trade-off. If you change a token, re-run the audit in [Appendix A](#appendix-a--re-running-the-audits) and update the numbers here.

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
| `--muted-foreground` | `215 16% 42%` | `215 20% 70%` | Secondary text. 5.65:1 / 8.45:1 on background. Light was `215 16% 47%` (4.72:1) — retuned in Plan 2 because it measured only 4.30:1 on `--muted` / `--secondary` (inactive tabs, funnel counters); now 5.15:1 there. |
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

**Status tones — light / dark**

Six semantic tones for *record state* (status, priority, stage, severity). Each is a
triple: a tinted `surface`, a `foreground` ink, and a `border`. Consumed as
`<Badge tone="…">` or `bg-status-* text-status-*-foreground border-status-*-border`
— never as raw palette classes (§4.5). Ratios are measured by the Appendix A audit;
the foreground target is ≥7:1 (well past the 4.5 gate) and the border is a non-text
boundary gated at ≥3:1 against `--card`.

| Tone | Light surface / foreground / border | Dark surface / foreground / border | Light fg ÷ border | Dark fg ÷ border |
|---|---|---|---|---|
| `success` | `142 60% 93%` / `142 72% 20%` / `142 45% 44%` | `142 45% 15%` / `142 60% 78%` / `142 40% 34%` | **7.73** / 3.18 | **9.29** / 3.15 |
| `warning` | `38 92% 92%` / `28 90% 24%` / `38 80% 42%` | `38 70% 15%` / `40 90% 74%` / `38 60% 34%` | **7.93** / 3.25 | **8.94** / 3.11 |
| `danger` | `0 85% 94%` / `0 72% 30%` / `0 70% 66%` | `0 55% 17%` / `0 85% 82%` / `0 50% 50%` | **8.22** / 3.15 | **8.42** / 3.16 |
| `info` | `217 90% 94%` / `217 80% 30%` / `217 70% 64%` | `217 60% 17%` / `217 90% 82%` / `217 50% 48%` | **8.51** / 3.05 | **8.89** / 3.17 |
| `neutral` | `215 20% 93%` / `215 22% 28%` / `215 18% 60%` | `215 18% 19%` / `215 20% 82%` / `215 16% 44%` | **8.28** / 3.01 | **8.65** / 3.14 |
| `special` | `270 80% 94%` / `270 60% 32%` / `270 60% 68%` | `270 45% 19%` / `270 80% 84%` / `270 40% 52%` | **9.05** / 3.11 | **8.65** / 3.08 |

The surfaces and foregrounds are as designed; every **border** lightness was tuned
down (light) or up (dark) from its first draft, which sat 1.5–2.6:1 against `--card` —
a tinted hairline that reads as "soft" is almost always invisible. Hue and saturation
were not touched.

**Up / Down — financial delta semantics (light / dark)**

`--up` / `--down` carry market and financial deltas, used both as solid pills
(`bg-up` + `text-up-foreground`) and as tinted pills (`bg-up-soft` + `text-up`).

| Token | Light | Dark | Ratios (light / dark) |
|---|---|---|---|
| `--up` | `142 60% 30%` | `142 58% 50%` | on `--up-soft` **4.94** / **6.24**; on background **5.34** / **8.65** |
| `--up-foreground` | `0 0% 100%` white | `222 47% 11%` ink | on `--up` **5.34** / **8.32** |
| `--up-soft` | `142 60% 95%` | `142 50% 14%` | tinted pill surface |
| `--down` | `0 70% 48%` | `0 70% 62%` | on `--down-soft` **4.67** / **4.69**; on background **5.29** / **5.18** |
| `--down-foreground` | `0 0% 100%` white | `222 47% 11%` ink | on `--down` **5.29** / **4.99** |
| `--down-soft` | `0 70% 96%` | `0 50% 14%` | tinted pill surface |

Light `--up` was `38%` (3.30:1 on `--up-soft`) and `--down` was `50%` (4.37:1); both
were darkened until the tinted pill cleared 4.5:1. In **dark** mode the foregrounds had
to stop being white, and no amount of tuning could have saved them: against the dark
`--background` (`222 47% 9%`, luminance 0.0065) a solid needs luminance ≥ 0.2041 to clear
4.5:1, while white-on-solid at 4.5:1 requires ≤ 0.1833. The ranges do not overlap — hold
`up on background` at exactly 4.5 and white-on-solid tops out at **~4.13:1** (~4.31:1 if
the two are balanced against each other). Dark ink is the only pairing that works, the
same conflict `--success-foreground` and `--warning-foreground` resolve the same way.

The brand blue (`217 91% 53%`) is *only* for actions, links, selection, and focus. Record state uses the `--status-*` tones above (via `<Badge tone>`), the `--menu-strip-*` module hues, and the `--up`/`--down`/`--neutral` financial semantics, never `--primary`.

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
- Record state uses `<Badge tone>` / `bg-status-*` — raw palette pairs are lint-banned (`STATUS_PALETTE_BANS`).
  The rule is a `no-restricted-syntax` selector in `eslint.config.js`, scoped to `src/**`, and matches a
  `bg-<hue>-<n> text-<hue>-<n>` pair in a single string literal. Tone choice is semantic, not chromatic:
  pick `danger` because the state is bad, not because the old class was red. `scripts/codemod-status-tones.mjs`
  performs the mechanical rewrite; it is not a substitute for reading the call site.
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

Unchanged pairs already passing: foreground/background 17.9 & 17.8, secondary 16.3 & 13.0, sidebar 10.0 & 16.0, destructive (dark) 5.29. (`muted-foreground` on background was 4.72 & 8.45 here; Plan 2 retuned the light value — now 5.65 & 8.45, see §3.2.)

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
Runtime verification now lives in [`verification/REPORT.md`](verification/REPORT.md), regenerated by `npm run audit:design-system` (see [Appendix A](#appendix-a--re-running-the-audits)). It covers axe-core WCAG 2.1 A/AA and ARIA structure snapshots across chromium, firefox, webkit and msedge, and a keyboard tab-walk (visible focus, no traps, recorded order) across chromium, firefox and webkit — msedge is excluded from the walk because it is the same engine as chromium. WebKit's Tab skips links by default, so link focus visibility is not gated there.

Still **not** verified, and stated in the report itself:
- **No screen-reader runtime testing.** ARIA snapshots prove structure (names, landmarks, one `h1`), not announcement order or live regions. NVDA/JAWS/VoiceOver remain an open item.
- **No user testing of any kind** — Plan 3 of the 2026-09-13 spec adds the instrument; nothing here is based on user feedback yet.

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
Screenshot evidence at 360 / 768 / 1280 / 1920, light and dark, for four engines is committed under [`verification/screenshots/`](verification/screenshots/) and indexed in [`verification/REPORT.md`](verification/REPORT.md). The layout gate fails a cell on page-level horizontal scroll or any element overflowing the viewport outside a horizontally scrolling container.

Still **not** verified:
- **Real Safari.** WebKit on Windows is the engine proxy; Safari's shell, font stack and iOS behaviour are not covered.
- **Real devices.** Viewports are emulated.

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

### 8.1 Plan 2 — status tokens and baseline findings (2026-09-14)

Plan 2 of the 2026-09-13 spec: a semantic status-tone system, a sweep of the raw
palette classes it replaces, and a fix for every finding raised by the Plan 1 baseline
verification run. One row per task.

| # | Area | Change | Files |
|---|---|---|---|
| 2 | Tokens | 18 light + 18 dark `--status-*` tokens (surface/foreground/border × 6 tones), wired into Tailwind as the `status` color group; all 12 border lightnesses tuned to clear 3:1 vs `--card`; light `--muted-foreground` retuned `47%`→`42%` for F14 | `index.css`, `tailwind.config.ts`, `contrast-audit.mjs` |
| 3 | Components | `Badge` gains a `tone` axis (typed so `tone` + solid `variant` is a compile error); `statusConfig` emits tones instead of raw classes | `ui/badge.tsx`, `config/statusConfig.ts`, `Quotes.tsx` |
| 4 | Tooling | `scripts/codemod-status-tones.mjs` rewrites raw `bg-<hue>-<n> text-<hue>-<n>` pairs to tones; ESLint `STATUS_PALETTE_BANS` (`no-restricted-syntax`, scoped to `src/**`) makes new ones an error | `eslint.config.js`, `scripts/codemod-status-tones.mjs` (+ tests) |
| 5 | Sweep | ~509 hardcoded badge pairs rewritten to semantic tones across the app; then a hand pass reverting the ones that were *category/tier* labels rather than state (a plan tier is not an alert) to primary chips | 129 files under `src/`, then `PlanCard.tsx`, `MfScreener.tsx`, `InteractionTimeline.tsx`, `SubscriptionManagement.tsx`, `EnterpriseToolingEditor.tsx` |
| 6 | A11y — app shell | Domain select named; collapsed-nav toggles dropped from the tab order; progress bars labelled; onboarding tour promoted to a real `dialog` | `EnterpriseDashboardShell.tsx`, `CommandCenterNav.tsx`, `DomainSwitcher.tsx`, `OnboardingTour.tsx` |
| 7 | A11y — leads list | Filter selects named; lead card un-nested (was an interactive element inside an interactive element); single `h1`; toolbar wraps at 360 | `LeadCard.tsx`, `LeadsFilterToolbar.tsx`, `Leads.tsx` |
| 8 | A11y — kanban | Buttons named; drag handle moved out of the actions group and onto dnd-kit's `setActivatorNodeRef`; scroll viewport made focusable; tabs given real panels | `KanbanCard.tsx`, `KanbanColumn.tsx`, `TaskScheduler.tsx`, `ui/scroll-area.tsx` |
| 9 | A11y — Themes page | Colour inputs labelled; selects and switches named; preview header made contrast-safe; preview row wraps | `ui/hsl-picker.tsx`, `ThemeManagement.tsx`, `hooks/useTheme.tsx` |
| 10 | A11y — auth page | `main` landmark added; duplicate `h1` collapsed to one; new `--link` token (7.10:1 light / 7.25:1 dark) because `--primary` could not clear 4.5:1 as inline text on the tinted gradient | `Auth.tsx`, `index.css`, `tailwind.config.ts`, `contrast-audit.mjs` |
| 11 | Layout | Opportunity form fits 768px (`FormItem` gains `relative min-w-0` so grid children may shrink); Accounts list renders in pages of 100 instead of one unbounded list | `forms/FormLayout.tsx`, `Accounts.tsx` |
| 12 | Docs + evidence | This section, §3.2's status-tone and Up/Down tables, §4.5's lint rule, Appendix B refresh, spec §4.4's single-engine disposition rule; `--up`/`--down` retuned and gated by six new audit pairs; full four-engine harness re-run regenerating `verification/**` | `README.md`, spec §4.4, `index.css`, `contrast-audit.mjs`, `verification/**` |

---

## 9. Usability testing

A flag-gated in-app widget (`src/components/feedback/UxFeedbackWidget.tsx`,
behind `ux_feedback_widget`, default off) collects task-completion/ease/
comment feedback into `public.ux_feedback`. Full protocol, the round-1 task
list, and the iteration loop: [`usability/PROTOCOL.md`](usability/PROTOCOL.md).

**Status: no rounds have run.** No `round-N.md` files exist yet — none will
be fabricated. The widget and export script are built and tested; the
`ux_feedback` table's migration is written and reviewed but **not yet
applied** to any database — see
[`usability/PROTOCOL.md`](usability/PROTOCOL.md#prerequisites-one-time) for
what applying it requires. Real sessions are the next step, on the team's
schedule.

To run a round: [`usability/PROTOCOL.md`](usability/PROTOCOL.md#iteration-loop).
Per-round write-ups, once they exist, will be listed here.

---

## Appendix A — Re-running the audits

```bash
npm run audit:contrast
```

The script parses the live token values straight out of `src/index.css`'s `:root` and `.dark` blocks — there is no hand-maintained copy to drift out of sync. It also runs automatically as a **pre-commit hook** (via `lint-staged`) whenever `src/index.css` is staged, and blocks the commit on any failure. Thresholds: 4.5:1 normal text, 3:1 large text and UI component boundaries.

To add a new pair to check, append to the `PAIRS` table in the script. A missing token is reported as a failure, so renaming a token without updating the audit is caught too.

```bash
npm run audit:design-system          # full matrix, all engines (tens of minutes)
npm run audit:design-system:quick    # chromium only
```
Requires `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` in the gitignored repo-root `env` file. Start the backend services first (`npm run services:start`) or CRM pages render with degraded data; the report's run metadata records which services were up. Writes `verification/REPORT.md`, `verification/screenshots/`, `verification/aria/`; commit them with the change they verify. The suite lives in `tests/design-system/` with its own Playwright config.

## Appendix B — Not done / open items

- Real usability testing rounds (requires human participants).
- Screen-reader runtime pass (structure is now snapshot-verified; announcement behaviour is not).
- Real Safari and real devices (WebKit engine and emulated viewports are verified — see `verification/REPORT.md`).
- **WebKit link tabbing.** WebKit's Tab skips links unless the OS "full keyboard access" setting is on, so link focus visibility is not gated on that engine. A link-only focus regression would be caught by chromium and firefox but not webkit.
- **`lead-detail` is still unmeasured.** Every `lead-detail` cell is refused by the content-readiness gate (`#main-content` renders 14 characters — "Lead not found"), in the Plan 1 run *and* in the Plan 2 re-run with `crm-api` up. The cause is in the harness, not the page: `resolveFirstLead` (`tests/design-system/pages.ts`) picks the newest lead visible to the E2E admin's raw REST token, while `LeadDetail` reads through `ScopedDataAccess`, which adds `.eq('tenant_id', …)` (and a franchise filter). When the newest lead belongs to another tenant the two disagree and the page legitimately renders "not found". Fixing this means resolving the route through the same scoped context the app uses — until then the page's axe/ARIA/layout results are absent, not green.
- `LeadDetail` / `QuoteDetail` keep their own richer navigation; not migrated to the sticky-bar pattern (business-critical workspace pages, deliberately left alone).
- Lead/Activity/Opportunity/Quote "New" pages keep their own shells; `EntityCreatePageShell` is coupled to `UnifiedPartnerForm` and would need generalising first.
- **Server-side pagination for Accounts.** Plan 2 shipped client-side paging ("Load more", 100 rows a page) so the list no longer renders every row at once, but the full result set is still fetched. The real fix is a ranged query.
- **~74 gated axe/ARIA/layout cells still fail** after Plan 2 (down from 717 rule×cell instances; gated rules 8 → 2). See [`verification/REPORT.md`](verification/REPORT.md) for the authoritative list — the summary here names only the clusters.
  - **Largest cluster by far: the Themes page (~60 cells), all in `src/pages/dashboard/ThemeManagement.tsx`.** `label` (critical, 32 cells): the Theme Name input and the Gradient Angle range/number inputs have no `htmlFor`-associated label — their adjacent text is not programmatically attached, and a placeholder is not a label. `color-contrast` (serious, 16 cells, dark only): the two bare `<select>`s at `:546` and `:564` carry no colour tokens, so dark mode inherits an unreadable pairing. Layout (8 cells): a button at `:386` overflows 360px viewports (`right=388 > 360`). Plus 4 ARIA cells for the same unnamed Theme Name input.
  - **Palette classes that escaped the Plan 2 sweep (~17 cells).** `leads-kanban` dark: `LeadsPipelineComponents.tsx` uses `bg-sky-500/10 text-sky-700`-style pills. Dashboard widgets: `RevenueYTD.tsx` and `SalesForecast.tsx` use standalone `text-green-600` / `text-cyan-600`.
  - **The lint ban has two blind spots that let those through**, so it reads as stronger than it is. `STATUS_PALETTE_BANS` matches `bg-<hue>-<n>` and `text-<hue>-<n>` only when *whitespace-adjacent*, so an **opacity modifier** (`bg-sky-500/10 text-sky-700`) slips past; and it only matches **pairs**, so a text-only class with no `bg-` partner was never in scope. `sky` is also missing from `STATUS_PALETTE_HUES`. Widening the selector on both axes would catch these at lint time rather than at harness time.
  - **These are pre-existing findings, not regressions introduced by Plan 2.** They survived because the per-task briefs were written from `REPORT.md`'s **truncated 3-item "Sample targets" line**, which cannot reveal every violating node: on this same page `select-name` went 32 → 0 (all its nodes fit the sample) while `label` stayed 32 → 32 (its did not). Brief a follow-up from the full node list, not the sample.

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
