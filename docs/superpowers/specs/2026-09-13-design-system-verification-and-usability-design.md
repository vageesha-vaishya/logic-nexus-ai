# Design System — Verification, Status Tokens & Usability Apparatus

**Date:** 2026-09-13
**Status:** Approved design, awaiting implementation plans
**Baseline:** commit `7acbc2d2` (design-system tokens, WCAG contrast, elevation, a11y semantics, `docs/design-system/README.md`)

## 1. Context and goal

The brief: evaluate the top 10 CRM platforms' visual design systems, synthesize
best practices into a platform-optimized design system, implement it, and run
mandatory compliance workflows (3+ usability rounds, cross-browser, responsive at
360/768/1280/1920, WCAG 2.1 AA), documenting everything centrally.

Commit `7acbc2d2` already delivered the research (Salesforce, HubSpot,
Pipedrive, Zoho, monday, Freshsales, Zendesk, Close, Attio, Copper; 30 cited
sources), the token revision, and the centralized doc. Its Appendix B is honest
about what was **not** verified, and that list is exactly the compliance work
still owed:

| Requirement | State at baseline |
|---|---|
| Responsive validation 360/768/1280/1920 | Code-audited only; no screenshots |
| Cross-browser Chrome/Firefox/Safari/Edge | Chrome only |
| WCAG 2.1 AA — contrast | Computed, audited, pre-commit-gated |
| WCAG 2.1 AA — keyboard, screen reader | Static source review only |
| 3+ usability rounds with user feedback | None; no instrument to collect it |
| Open items: ~509 hardcoded badge color pairs, dead `Enterprise*` components | Open |

**Decision (user, 2026-09-13):** build on `7acbc2d2`, do not redo the research.
Spend the effort on verification, the known open items, and a real feedback
instrument. Visual identity evolves rather than restarts (README principle 6,
"familiarity over novelty"). "Outperforms competitors" is argued with measured
evidence — conformance, consistency, responsive integrity — not a bolder look.

## 2. Scope

**In:** three sequential plans under this spec.

1. **Verification harness** — re-runnable Playwright matrix + report.
2. **Fixes + semantic status tokens** — what the harness finds, plus the badge
   color system across all of `src/`, plus Appendix B housekeeping.
3. **Usability apparatus** — in-app feedback capture into Supabase, protocol
   docs, per-round analysis, iteration loop.

**Out (explicitly):**
- Re-running or deepening the competitor research.
- New visual direction / rebrand.
- A formal primitive component library or Storybook a11y migration.
- `LeadDetail` / `QuoteDetail` navigation, and the Lead/Activity/Opportunity/
  Quote "New" page shells (remain in Appendix B).
- Admin UI for viewing feedback (an export script is sufficient).
- Real Safari, real screen readers, real devices — not available on this
  machine; every report states what stood in for them.

**Page set** (all three plans use this list; defined once in
`tests/design-system/pages.ts`):

| Key | Route | Why |
|---|---|---|
| `auth` | `/auth` | Unauthenticated entry; form |
| `dashboard` | `/dashboard` | KPI grids, widgets |
| `leads-list` | `/dashboard/leads` | Dense table + title strip |
| `lead-detail` | `/dashboard/leads/:id` (first row of list) | Sticky action bar, tabs |
| `leads-kanban` | `/dashboard/leads/pipeline` | Horizontal scroll, drag targets |
| `contacts-list` | `/dashboard/contacts` | Table variant |
| `accounts-list` | `/dashboard/accounts` | Table variant |
| `opportunities-list` | `/dashboard/opportunities` | Table with stage badges |
| `opportunity-new` | `/dashboard/opportunities/new` | Long form, validation |
| `themes` | `/dashboard/themes` | Runtime preset switching |

## 3. Plan 1 — Verification harness

### 3.1 Layout
```
tests/design-system/
  playwright.design-system.config.ts   # own config; does not touch the root one
  pages.ts                              # page set above + resolve() for :id
  auth.setup.ts                         # login once per engine → storageState
  matrix.spec.ts                        # screenshot + layout + axe, every cell
  keyboard.spec.ts                      # tab-walk, 1280 only
  aria.spec.ts                          # ariaSnapshot, 1280 only
  helpers/{axe,layout,focus,report}.ts
docs/design-system/verification/
  REPORT.md                             # generated; committed
  generate-report.mjs                   # json → REPORT.md
  screenshots/<page>/<engine>-<w>-<mode>.png   # committed
  aria/<page>-<engine>.yaml             # committed
```

### 3.2 Matrix
- **Engines (4):** `chromium`, `firefox`, `webkit` (Safari proxy), `msedge`
  (channel). Reuses the root config's Firefox sandbox env handling.
- **Viewports (4):** 360×800, 768×1024, 1280×800, 1920×1080.
- **Modes (2):** light, dark — toggled by setting the `.dark` class / theme
  storage key before navigation (uses `src/lib/theme-storage-keys.ts`).
- **Auth:** `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` env (existing convention);
  `auth.setup.ts` project produces `storageState` per engine so login runs once.
- **Server:** Vite on `:4173` via the root config's `webServer` pattern;
  `PLAYWRIGHT_REUSE_EXISTING_SERVER=true` to attach to a running dev server.

### 3.3 Checks per cell (page × engine × viewport × mode)
1. **Screenshot** — full page, animations disabled, written to the committed
   path. Not a pixel-diff gate (too brittle across engines); a visual record.
2. **Layout integrity** (gate):
   - `document.documentElement.scrollWidth <= window.innerWidth` (no page-level
     horizontal scroll).
   - No element whose bounding box exceeds the viewport width unless it has an
     ancestor with `overflow-x` of `auto`/`scroll` (tables and kanban are
     allowed to scroll inside their container).
3. **axe-core** (gate on `serious` + `critical`; `moderate`/`minor` reported):
   tags `wcag2a, wcag2aa, wcag21a, wcag21aa`. Rules known to be noisy on SPAs
   (`region`, `landmark-*` on third-party embeds) may be disabled per page with
   a comment saying why; the report lists disabled rules.

### 3.4 Keyboard walk (1280, chromium + firefox + webkit, light; msedge omitted — same engine as chromium)
- Press `Tab` up to 40 times from `<body>`. For each stop record
  `tagName`, accessible name, role.
- Assert: every stop is visible; focused element's computed `outline-style` ≠
  `none` **or** its `box-shadow` differs from the unfocused value (visible focus,
  WCAG 2.4.7); no element receives focus twice within 40 presses before the
  sequence wraps (no trap); focus never lands in `aria-hidden="true"` subtrees.
- Order is recorded to the report for human review; not gated (structural
  reorder is a Plan 2 judgment call).

### 3.5 ARIA snapshot (1280, all engines, light)
`page.locator('body').ariaSnapshot()` → `aria/<page>-<engine>.yaml`. Gate:
exactly one `heading level=1`; at least one `main` landmark; no
`button`/`link`/`textbox` with empty name. This is screen-reader **structure**
evidence; REPORT.md states it is not a runtime NVDA/VoiceOver session.

### 3.6 Report
`generate-report.mjs` reads the JSON reporter output and writes `REPORT.md`:
- Run metadata: date, commit, engine versions, what stood in for Safari/devices.
- Matrix table: rows = pages, columns = engine×viewport, cell = ✅/❌ + link to
  screenshot; separate tables per mode.
- axe: violations grouped by rule → affected pages/engines, with impact.
- Layout failures with offending selector.
- Keyboard: per page, stop count, first failing stop, order dump.
- ARIA gate results.
- Engine-specific divergences (a check that passes in one engine and fails in
  another is highlighted — that is the cross-browser finding).

### 3.7 Scripts
```
"audit:design-system":        "playwright test -c tests/design-system/playwright.design-system.config.ts && node docs/design-system/verification/generate-report.mjs"
"audit:design-system:quick":  "... --project=chromium"   # fast loop
```
`audit:design-system` is **not** added to lint-staged (minutes-long); it is the
acceptance gate for Plan 2 and every usability round.

### 3.8 Acceptance
- Suite runs end-to-end on this machine for all 4 engines.
- `REPORT.md` and screenshots committed for the baseline (before Plan 2 fixes) —
  this is the "before".
- README §5.5 and §6.2 ("not verified") rewritten to point at REPORT.md.

## 4. Plan 2 — Fixes and semantic status tokens

### 4.1 Status token system
Added to `src/index.css` `:root` and `.dark`, consumed through
`tailwind.config.ts` as `hsl(var(--token))`:

| Tone | Replaces | Semantics |
|---|---|---|
| `success` | `green-*`, `emerald-*`, `teal-*` | approved, accepted, won, active, healthy |
| `warning` | `yellow-*`, `amber-*`, `orange-*` | in review, pending, at-risk, expiring |
| `danger` | `red-*`, `rose-*` | rejected, lost, overdue, failed |
| `info` | `blue-*`, `cyan-*`, `indigo-*` | sent, in progress, new, informational |
| `neutral` | `gray-*`, `slate-*` | draft, expired, cancelled, archived |
| `special` | `purple-*`, `violet-*` | VIP / AI-generated / reserved — one tone so purple stops meaning many things |

Each tone has `--status-<tone>`, `--status-<tone>-foreground`,
`--status-<tone>-border`.

- **Light:** tinted surface (~92–94% lightness) + deep ink of the same hue.
  Target ≥ 7:1 foreground/surface (tinted badges have headroom; the solid
  action colors did not).
- **Dark:** low-lightness tinted surface (~18–24%) + bright foreground of the
  hue (~75–85%). Target ≥ 7:1. Border one step lighter than surface so badges
  keep an edge on `--card`.
- All 12 surface/foreground pairs plus 6 border/card pairs (3:1, 1.4.11) are
  appended to `PAIRS` in `docs/design-system/contrast-audit.mjs`; the existing
  pre-commit hook on `src/index.css` now guards them.
- Runtime presets (`applyTheme()`) do not override status tokens — brand color
  changes must not recolor record state (README principle 5).

### 4.2 Consumption
- `Badge` gains a second cva axis `tone: success|warning|danger|info|neutral|special`
  producing `bg-status-<tone> text-status-<tone>-foreground border-status-<tone>-border`.
  `variant` remains for action badges. `tone` and non-outline `variant` are
  mutually exclusive by type (`tone` requires `variant` undefined or `"outline"`).
- `src/config/statusConfig.ts` entries change from `color: 'bg-… text-…'` to
  `tone: StatusTone`; consumers pass `tone={statusConfig[s].tone}`.
- Tailwind utilities `bg-status-*`, `text-status-*-foreground`,
  `border-status-*-border` are available for non-Badge usages (table cells,
  dots, progress bars).

### 4.3 Sweep
- Scope: **all of `src/`**, ~509 `bg-<hue>-<n> text-<hue>-<n>` pairs and ~137
  paired `dark:bg-<hue>-<n>` overrides (removed — tones carry dark mode).
- Mechanism: `scripts/codemod-status-tones.mjs` with the hue→tone table above.
  It rewrites only exact `bg-X-N text-X-N` (same hue) pairs and their adjacent
  `dark:` / `hover:` siblings; mixed-hue or lone-color usages are listed to
  stdout for manual review, not rewritten.
- Sub-brands: Smart Quote (`.smart-quote-identity`, `--sq-*`) and Sthira
  (`--sthira-*`) already use their own tokens, so the regex does not match them;
  AMRO gets the platform tones (39 occurrences, 10 files) — its module hue is
  the menu strip, not badge colors, so no identity conflict.
- Review: the diff is inspected file-by-file for meaning drift (e.g. a
  `blue-100` that meant "selected" rather than "info" becomes `bg-primary/10`,
  not `info`).

### 4.4 Harness findings — disposition rules
| Finding class | Disposition |
|---|---|
| Layout break at 360/768 | Fix in owning component; add assertion to `matrix.spec.ts` if pattern-level |
| axe `serious`/`critical` | Fix (gate) |
| axe `moderate`/`minor` | Count into README Appendix B; not fixed here |
| Engine-specific CSS (`:has()`, `color-mix()`, `backdrop-filter`, scrollbar styling) | Progressive-enhancement fallback; never a Chromium-only path |
| Missing visible focus / focus trap | Fix (gate) |
| Illogical tab order | Fix if local to a component; log if it needs page restructuring |
| ARIA gate (h1 count, landmarks, unnamed controls) | Fix (gate) |
| Keyboard/ARIA finding present in ONE engine only | Harness suspect first: check REPORT.md "Engine-specific divergences" and the engine caveats before changing app code (Plan 1 final review: three such cases, all tooling) |

### 4.5 Housekeeping
- `EnterpriseButton/Form/Header/Modal/ActivityFeed`: grep for imports including
  `*.stories.tsx`. Zero imports → delete. Any import → tokenize instead.
- README: §3.2 gains the status token table; §4.5 color rules updated ("never
  raw palette classes for state — use tones"); §8 change log extended; Appendix
  B rewritten to what remains.

### 4.6 Testing
- Vitest: `Badge` renders tone classes; `tone` + solid `variant` is a type
  error; `statusConfig` values are valid tones.
- Contrast audit passes with the new pairs.
- ESLint: a `no-restricted-syntax` rule (or existing lint config) flags new
  `bg-<hue>-<n> text-<hue>-<n>` pairs in `src/` outside sub-brand scopes.
- `npm run audit:design-system` re-run → committed `REPORT.md` after; the diff
  against the Plan 1 baseline is the evidence.

## 5. Plan 3 — Usability apparatus

### 5.1 Data
Migration `supabase/migrations/<ts>_create_ux_feedback.sql`:

```sql
create table public.ux_feedback (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  user_id      uuid not null references auth.users(id),
  round        smallint not null,
  task_id      text,
  route        text not null,
  completed    text check (completed in ('yes','partial','no')),
  ease         smallint check (ease between 1 and 5),
  comment      text,
  viewport_w   int, viewport_h int,
  theme_mode   text,
  user_agent   text,
  created_at   timestamptz not null default now()
);
-- RLS: insert — authenticated, tenant_id = caller's tenant, user_id = auth.uid();
--      select — tenant admins for own tenant, platform admin for all;
--      no update/delete from clients.
```
Indexes on `(tenant_id, round)` and `(round, task_id)`.

The migration is **written and committed by the plan; applying it to the live
self-hosted DB is a separate, explicitly confirmed step** (shared VPS — see
memory `vps_shared_infra_caution`). Local Supabase is used for development.
Types regenerated via `npm run supabase:types:gen`.

### 5.2 Widget
`src/components/feedback/UxFeedbackWidget.tsx`, mounted once in
`src/components/layout/DashboardLayout.tsx`.

- Gate: `useFeatureFlags(['ux_feedback_widget']).isEnabled('ux_feedback_widget')`
  — default **false** (the hook degrades to false on any error). Enabled per
  tenant from `/dashboard/settings/feature-flags`.
- UI: 44×44 floating button, bottom-right, `aria-label="Give feedback"`,
  `z-index` below dialogs/toasts. Opens a `Popover` (existing Radix wrapper):
  1. *What were you trying to do?* — `Select` of the active round's tasks +
     "Something else".
  2. *Did you complete it?* — `RadioGroup` yes / partially / no.
  3. *How easy was it?* — 1–5 segmented control, labelled "Very hard" → "Very easy".
  4. *Anything else?* — `Textarea`, optional, 500 chars.
  Submit inserts one row (route, viewport, theme, UA filled automatically);
  success toast; popover closes. Escape closes; focus returns to the button.
- Tokens only; passes the Plan 1 harness (it is on every page in the set).
- `src/config/uxRounds.ts`: `{ activeRound: number; rounds: { [n]: { tasks: { id, label }[] } } }`.
  Single source for the widget and the docs.

### 5.3 Docs — `docs/design-system/usability/`
- `PROTOCOL.md` — participants (5–8 per round; sales + ops roles; ≥1 on a
  360–768px device; ≥1 first-time user), moderator script (think-aloud,
  no leading, what not to help with), consent line, and the round-1 task list:
  1. Find the lead for a given company and open it.
  2. Move that lead's opportunity to the next stage on the pipeline board.
  3. Create a new contact against the same account.
  4. Switch the interface to dark mode.
  5. Show only today's activities.
- `round-template.md` — findings table (severity × frequency), decision per
  finding (fix / defer / won't), linked commits, before/after screenshot paths
  from the harness, quantitative section pasted from `export.mjs`.
- `export.mjs` — `node export.mjs --round N` queries `ux_feedback` (service
  key from the gitignored `env` file, never committed) and prints Markdown:
  completion % per task, mean/median ease per task, comment list grouped by
  route.
- `round-N.md` files exist **only** for rounds that have real data. No
  fabricated results.

### 5.4 Iteration loop
1. Bump `activeRound`, enable the flag for the pilot tenant, run sessions.
2. `export.mjs` → fill `round-N.md`; rank findings; decide.
3. Implement fixes; `npm run audit:design-system` must stay green; commit
   with `round-N` reference.
4. Repeat. Minimum three rounds before any "validated" claim in the README.
5. README gains §9 "Usability testing" linking PROTOCOL, rounds, and the
   current round status.

### 5.5 Testing
- Vitest: widget hidden when flag false; renders and submits the expected row
  shape when true (Supabase client mocked); keyboard: Escape closes and
  restores focus.
- RLS: SQL test in `supabase/tests/` (or a vitest integration test against
  local Supabase) — user A cannot select tenant B's rows; client update is
  denied.
- Harness re-run with the flag on: widget introduces zero new violations.

## 6. Documentation home
`docs/design-system/` stays the single reference:
```
README.md                 # principles, research, tokens, conventions, a11y, responsive, change log
contrast-audit.mjs        # token contrast gate (existing)
verification/             # Plan 1 report, screenshots, aria snapshots
usability/                # Plan 3 protocol, rounds, export
```
Every plan ends by updating README sections it affects; no parallel docs.

## 7. Risks and honest limits
- **WebKit ≠ Safari.** Same engine, different shell and OS font stack; report
  says so. Real Safari check is an open item for a macOS machine.
- **Structure ≠ screen reader.** ARIA snapshots catch missing names and
  landmarks, not announcement order or live-region behaviour.
- **Usability rounds depend on people.** The apparatus ships in Plan 3; round
  timing is yours. Nothing is claimed until data exists.
- **Sweep meaning drift.** 509 rewrites; the codemod is conservative and the
  diff is reviewed per file, but a mis-toned badge is plausible — the harness
  screenshots and round 1 are the safety net.
- **Live DB migration** is the only step touching shared infrastructure; it is
  gated on explicit confirmation.
