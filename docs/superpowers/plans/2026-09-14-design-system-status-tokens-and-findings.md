# Design System — Status Tokens & Baseline Findings Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-09-13-design-system-verification-and-usability-design.md` §4
**Baseline it fixes:** `docs/design-system/verification/REPORT.md` at commit `9883d634` (Plan 1)

**Goal:** Replace ~500 hardcoded badge colour pairs with six semantic status tones, and fix every gated finding the Plan 1 baseline produced (axe serious/critical, layout overflow at 360/768, keyboard, ARIA structure), then re-run the harness so REPORT.md is the "after".

**Architecture:** Tokens first (`index.css` → Tailwind → contrast audit), then a `Badge tone` axis and a codemod sweep, then one task per finding cluster (shell, leads list, kanban, themes page, auth, forms/lists), each with an RTL unit test that fails before the fix. The last task re-runs `npm run audit:design-system` and commits the new evidence in one commit.

**Tech Stack:** Tailwind 3 + CSS custom properties (HSL triples), class-variance-authority, Radix UI, React Testing Library + vitest (jsdom, jest-dom), ESLint flat config (`no-restricted-syntax`), Node ESM scripts, the Plan 1 Playwright harness.

## Global Constraints

- Tones: `success | warning | danger | info | neutral | special`. Tokens per tone: `--status-<tone>`, `--status-<tone>-foreground`, `--status-<tone>-border`, defined in BOTH `:root` and `.dark` blocks of `src/index.css` as HSL triples (no `hsl()` wrapper).
- Contrast targets: foreground on surface **≥ 7:1 target, 4.5:1 gate**; border on `--card` **≥ 3:1**. The gate is `docs/design-system/contrast-audit.mjs` (runs pre-commit on `src/index.css`); every new pair is appended to `PAIRS` there.
- Hue → tone map for the sweep: `green|emerald|teal → success`; `yellow|amber|orange → warning`; `red|rose → danger`; `blue|cyan|indigo → info`; `gray|slate → neutral`; `purple|violet → special`.
- Sweep scope: **all of `src/`**, excluding files whose content contains `--sq-` or `--sthira-` (sub-brand scopes) — the codemod rewrites only exact same-hue `bg-X-N text-X-M` pairs and their adjacent `dark:bg-X-N`/`dark:text-X-M`/`hover:bg-X-N` siblings; anything else is listed for manual review.
- Runtime presets (`applyTheme()` in `src/hooks/useTheme.tsx`) must not set any `--status-*` variable.
- Disposition rules (spec §4.4) plus one added by the Plan 1 final review: **a keyboard or ARIA finding that appears in one engine only is a harness suspect first** — check `REPORT.md` "Engine-specific divergences" before changing app code.
- No axe rule is disabled; no gate in `tests/design-system/` is weakened. Harness changes in this plan only *add* information.
- Every commit ends with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01B1d8LV2PVC9cYTu9t9gYzt`
- Unit tests: RTL + vitest under the file's own directory (`*.test.tsx`), following `src/components/navigation/CommandCenterNav.test.tsx` conventions (`vi.mock` for providers, `screen.getByRole`).
- Do not commit `test-results/`; the only evidence commit is Task 12's.
- Deviation from spec §4.2 (deliberate): `tone` and `variant` are not made mutually exclusive at the type level; `Badge` drops `variant` to `outline` at runtime whenever `tone` is set (Task 3), which keeps every existing `<Badge variant>` call site compiling.

---

## Baseline findings this plan fixes (from REPORT.md @ 9883d634)

| # | Rule / gate | Where (source) | Cells | Task |
|---|---|---|---|---|
| F1 | axe `button-name` critical | `src/components/navigation/DomainSwitcher.tsx:36` Select trigger — every authenticated page | 288 | 6 |
| F2 | axe `color-contrast` serious (2.71:1) | `DomainSwitcher.tsx:48` description span `opacity-70` rendered inside the trigger | 208 | 6 |
| F3 | axe `color-contrast` (3.76:1) | `src/components/dashboard/EnterpriseDashboardShell.tsx:60,95` `text-emerald-600` KPI text | dashboard | 5 (sweep) |
| F4 | axe `aria-progressbar-name` | `EnterpriseDashboardShell.tsx:81` `<Progress>` without name | dashboard | 6 |
| F5 | keyboard: 8 focusable-but-invisible buttons | `src/components/navigation/CommandCenterNav.tsx:523` group toggles when sidebar collapsed (`SidebarGroupLabel` → `opacity-0`) | every page | 6 |
| F6 | axe `button-name` ×5 | `src/features/module-sales/components/LeadsFilterToolbar.tsx:121,138,150,196` Select triggers | leads-list | 7 |
| F7 | axe `nested-interactive` | `src/features/module-sales/components/LeadCard.tsx:66` `<Card role="button" tabIndex=0>` containing buttons | leads-list | 7 |
| F8 | ARIA: 2 × `h1` | `src/pages/dashboard/Leads.tsx:1597` (FirstScreenTemplate `<H1>`) + `:1645` own `<h1>` | leads-list | 7 |
| F9 | layout 360: toolbar row does not wrap (`div.flex.items-center.gap-2 right=474`) | leads-list — locate with Task 1 attribution | 8 cells | 7 |
| F10 | axe `button-name` (82 unnamed) | `src/components/kanban/KanbanColumn.tsx:220,225`, `KanbanCard.tsx:169,185` icon buttons; column buttons also `opacity-0 group-hover:opacity-100` | leads-kanban | 8 |
| F11 | axe `nested-interactive` | `KanbanCard.tsx:110` draggable `div role="button"` containing buttons; `:199` swimlane | leads-kanban | 8 |
| F12 | axe `scrollable-region-focusable` | `src/components/ui/scroll-area.tsx:11` Viewport | leads-kanban | 8 |
| F13 | axe `aria-valid-attr-value` | `src/components/crm/TaskScheduler.tsx:126` Tabs with no `TabsContent` → dangling `aria-controls` | leads-kanban | 8 |
| F14 | axe `color-contrast` (4.28:1) | `--muted-foreground` on `--muted` (`TaskScheduler.tsx:136` inactive tab, `KanbanFunnel.tsx:78`) | leads-kanban | 2 (token) |
| F15 | axe `label` ×6, `select-name` ×2, `button-name` ×2 | `src/components/ui/hsl-picker.tsx:74-90`; `src/pages/dashboard/ThemeManagement.tsx:535,553` selects, `:453,566` switches | themes | 9 |
| F16 | axe `color-contrast` (2.65:1) | `ThemeManagement.tsx:488-490` preview `<th>` white on accent | themes | 9 |
| F17 | layout 360 | `ThemeManagement.tsx:571-576` preview row (`flex` no wrap, `h-16` strip) | themes | 9 |
| F18 | ARIA: no `main`, no `h1` | `src/pages/Auth.tsx:455-468` (`<H2>` title, no landmark) | auth | 10 |
| F19 | axe `color-contrast` | `Auth.tsx:368-374` `text-primary` links on `to-primary/5` gradient | auth | 10 |
| F20 | layout 768: `document scrollWidth 862` | opportunity-new — locate with Task 1 attribution | 2 cells | 11 |
| F21 | page height 33 048 px (unbounded list) | `src/pages/dashboard/Accounts.tsx:66` `pageSize: 2000` | accounts-list | 11 |
| F22 | keyboard: onboarding tour = 2-stop focus trap | `src/components/system/OnboardingTour.tsx` | dashboard-onboarding | 6 |
| F23 | ~509 `bg-X-N text-X-M` pairs, 137 `dark:` overrides | all `src/` | — | 4, 5 |

Not fixed here (stays in README Appendix B): `lead-detail` (unmeasured — CRM API down); WebKit link tabbing; `LeadDetail`/`QuoteDetail` navigation; "New" page shells.

---

## File structure

| Path | Responsibility |
|---|---|
| `tests/design-system/helpers/layout.ts`, `helpers/axe.ts` | (Task 1) add source attribution (`data-component-path:line`) to offender strings |
| `src/index.css` | (Task 2) 36 status tokens (+ `--muted-foreground` retune) |
| `tailwind.config.ts` | (Task 2) `status.<tone>.{DEFAULT,foreground,border}` |
| `docs/design-system/contrast-audit.mjs` | (Task 2) new PAIRS |
| `src/components/ui/badge.tsx` | (Task 3) `tone` variant axis |
| `src/config/statusConfig.ts` | (Task 3) `tone` instead of class strings; `StatusTone` type |
| `scripts/codemod-status-tones.mjs` + `scripts/codemod-status-tones.test.mjs` | (Task 4) pure `rewriteClassString()` + CLI |
| `eslint.config.js` | (Task 4) `no-restricted-syntax` selector banning raw palette pairs in `src/` |
| Finding-cluster files listed in the table above | Tasks 6–11 |
| `docs/design-system/README.md`, spec §4.4 | Task 12 |
| `docs/design-system/verification/**` | Task 12 (after-run evidence) |

---

### Task 1: Harness source attribution (so later tasks can find offenders)

**Files:**
- Modify: `tests/design-system/helpers/layout.ts` (the `describe()` inner function)
- Modify: `tests/design-system/helpers/axe.ts` (`sampleTargets`)
- Test: `tests/design-system/aria-gate.unit.test.ts` (no change) — verification is a chromium slice

**Interfaces:**
- Produces: offender strings of the form `src/pages/X.tsx:123 div.rounded-lg.p-3 right=462 > 360` and axe `sampleTargets` entries prefixed the same way, whenever the element (or its nearest ancestor within 5 levels) carries `data-component-path`/`data-component-line` (added by `lovable-tagger` in dev).

- [ ] **Step 1: Add an attribution helper to `helpers/layout.ts`**

Inside the `page.evaluate` callback, before `describe`, add:
```ts
    const source = (el: Element): string => {
      let cur: Element | null = el;
      for (let depth = 0; cur && depth < 5; depth++, cur = cur.parentElement) {
        const p = cur.getAttribute('data-component-path');
        const l = cur.getAttribute('data-component-line');
        if (p) return `${p.replace(/\\/g, '/')}:${l ?? '?'} `;
      }
      return '';
    };
```
and change the offender push to:
```ts
        offenders.push(`${source(el)}${describe(el)} right=${Math.round(r.right)} > ${vw}`);
```

- [ ] **Step 2: Attribute axe sample targets in `helpers/axe.ts`**

In the `page.evaluate` that runs axe, map nodes to `{ target, source }`:
```ts
      return res.violations.map((v: RawViolation) => ({
        ...v,
        nodes: v.nodes.map(n => {
          const path = /data-component-path="([^"]+)"/.exec(n.html)?.[1]?.replace(/\\/g, '/');
          const line = /data-component-line="(\d+)"/.exec(n.html)?.[1];
          return { target: n.target, source: path ? `${path}:${line ?? '?'} ` : '' };
        }),
      }));
```
Update `RawViolation.nodes` type to `{ target: string[]; source: string }[]` and build `sampleTargets` as `v.nodes.slice(0, 3).map(n => `${n.source}${n.target.join(' ')}`)`.

- [ ] **Step 3: Verify on one chromium slice**

Start Vite (`DS_HARNESS=1 npx vite --port 4173 --strictPort`, in the background) and run
`PLAYWRIGHT_REUSE_EXISTING_SERVER=true npx playwright test -c tests/design-system/playwright.design-system.config.ts --project=setup --project=chromium matrix.spec.ts -g "themes|opportunity-new"`
Then: `node -e "const j=require('./test-results/design-system/data/matrix-themes-chromium-360-light.json');console.log(j.layout.offenders)"`
Expected: offenders now start with `src/pages/dashboard/ThemeManagement.tsx:5xx ` (the preview row), and `matrix-opportunity-new-chromium-768-light.json` names the file/line of the 862 px-wide element — **record that path in your report; Task 11 needs it.**

- [ ] **Step 4: Unit tests + lint still pass**

Run: `npx vitest run tests/design-system && npx eslint tests/design-system`
Expected: 26 passed; eslint clean.

- [ ] **Step 5: Commit**

```bash
git add tests/design-system/helpers/layout.ts tests/design-system/helpers/axe.ts
git commit -m "test(design-system): attribute layout offenders and axe targets to source file:line"
```

---

### Task 2: Status tone tokens + muted-foreground retune

**Files:**
- Modify: `src/index.css` (`:root` block ends near line 293; `.dark` block starts line 294)
- Modify: `tailwind.config.ts` (colors, next to `success:` at line 41)
- Modify: `docs/design-system/contrast-audit.mjs` (`PAIRS`, line 45)

**Interfaces:**
- Produces: CSS vars `--status-{success,warning,danger,info,neutral,special}`, `-foreground`, `-border` (light + dark); Tailwind utilities `bg-status-<tone>`, `text-status-<tone>-foreground`, `border-status-<tone>-border`; audit pairs.

- [ ] **Step 1: Add the audit pairs first (RED)**

Append to `PAIRS` in `docs/design-system/contrast-audit.mjs`:
```js
  // Status tones (Plan 2). Foreground target ≥7:1; gate 4.5. Border vs card ≥3:1.
  ...['success', 'warning', 'danger', 'info', 'neutral', 'special'].flatMap(t => [
    [`status-${t}-foreground on status-${t}`, `status-${t}-foreground`, `status-${t}`, 4.5],
    [`status-${t}-border on card`, `status-${t}-border`, 'card', 3],
  ]),
  // F14: muted text on muted surfaces (inactive tabs, funnel counters) measured 4.28:1.
  ['muted-foreground on muted', 'muted-foreground', 'muted', 4.5],
  ['muted-foreground on secondary', 'muted-foreground', 'secondary', 4.5],
```

- [ ] **Step 2: Run the audit to see it fail**

Run: `npm run audit:contrast`
Expected: `MISSING TOKEN (status-success-foreground)` … for all 12 status pairs, and `muted-foreground on muted` **FAIL** at ~4.28 (light). Exit code non-zero.

- [ ] **Step 3: Add tokens to `src/index.css`**

In `:root` (light), after `--input`:
```css
    /* Status tones — record state, never brand. Tinted surface + deep ink of the same hue (Plan 2). */
    --status-success: 142 60% 93%;
    --status-success-foreground: 142 72% 20%;
    --status-success-border: 142 45% 78%;
    --status-warning: 38 92% 92%;
    --status-warning-foreground: 28 90% 24%;
    --status-warning-border: 38 80% 72%;
    --status-danger: 0 85% 94%;
    --status-danger-foreground: 0 72% 30%;
    --status-danger-border: 0 70% 80%;
    --status-info: 217 90% 94%;
    --status-info-foreground: 217 80% 30%;
    --status-info-border: 217 70% 80%;
    --status-neutral: 215 20% 93%;
    --status-neutral-foreground: 215 22% 28%;
    --status-neutral-border: 215 18% 78%;
    --status-special: 270 80% 94%;
    --status-special-foreground: 270 60% 32%;
    --status-special-border: 270 60% 80%;
```
In `.dark`, after `--input`:
```css
    --status-success: 142 45% 15%;
    --status-success-foreground: 142 60% 78%;
    --status-success-border: 142 40% 28%;
    --status-warning: 38 70% 15%;
    --status-warning-foreground: 40 90% 74%;
    --status-warning-border: 38 60% 30%;
    --status-danger: 0 55% 17%;
    --status-danger-foreground: 0 85% 82%;
    --status-danger-border: 0 50% 32%;
    --status-info: 217 60% 17%;
    --status-info-foreground: 217 90% 82%;
    --status-info-border: 217 50% 32%;
    --status-neutral: 215 18% 19%;
    --status-neutral-foreground: 215 20% 82%;
    --status-neutral-border: 215 16% 34%;
    --status-special: 270 45% 19%;
    --status-special-foreground: 270 80% 84%;
    --status-special-border: 270 40% 34%;
```
F14 retune — light `--muted-foreground` from `215 16% 47%` to `215 16% 42%` (dark value unchanged). Update the README §3.2 row later in Task 12.

- [ ] **Step 4: Run the audit; tune lightness only until green**

Run: `npm run audit:contrast`
Expected: all pairs PASS. If a status foreground reports < 7:1, lower its lightness by 2 points (light mode) or raise it by 2 (dark) and re-run — change lightness only, never hue/saturation, and never touch the surface. Record the final ratios in your report.

- [ ] **Step 5: Wire Tailwind**

In `tailwind.config.ts` `theme.extend.colors`, next to `success`:
```ts
        status: {
          success: { DEFAULT: "hsl(var(--status-success))", foreground: "hsl(var(--status-success-foreground))", border: "hsl(var(--status-success-border))" },
          warning: { DEFAULT: "hsl(var(--status-warning))", foreground: "hsl(var(--status-warning-foreground))", border: "hsl(var(--status-warning-border))" },
          danger:  { DEFAULT: "hsl(var(--status-danger))",  foreground: "hsl(var(--status-danger-foreground))",  border: "hsl(var(--status-danger-border))" },
          info:    { DEFAULT: "hsl(var(--status-info))",    foreground: "hsl(var(--status-info-foreground))",    border: "hsl(var(--status-info-border))" },
          neutral: { DEFAULT: "hsl(var(--status-neutral))", foreground: "hsl(var(--status-neutral-foreground))", border: "hsl(var(--status-neutral-border))" },
          special: { DEFAULT: "hsl(var(--status-special))", foreground: "hsl(var(--status-special-foreground))", border: "hsl(var(--status-special-border))" },
        },
```

- [ ] **Step 6: Guard against runtime presets touching status tokens**

Run: `grep -n "setProperty('--status" src/hooks/useTheme.tsx src/theme/themes.ts src/lib/theme-utils.ts`
Expected: no output. (If any exists, remove it — brand presets must not recolour record state.)

- [ ] **Step 7: Typecheck + build the CSS once**

Run: `npm run typecheck && npx tailwindcss -c tailwind.config.ts -i src/index.css -o /dev/null 2>&1 | tail -2`
Expected: no errors (Tailwind may warn about unused; fine).

- [ ] **Step 8: Commit (the pre-commit hook re-runs the audit)**

```bash
git add src/index.css tailwind.config.ts docs/design-system/contrast-audit.mjs
git commit -m "feat(design-system): semantic status tone tokens, light+dark, contrast-gated; retune muted-foreground"
```

---

### Task 3: `Badge tone` axis and `statusConfig` tones

**Files:**
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/config/statusConfig.ts`
- Create: `src/components/ui/badge.test.tsx`
- Create: `src/config/statusConfig.test.ts`
- Modify: the 10 `statusConfig` consumers listed by `grep -rln statusConfig src --include=*.tsx | grep -v test`

**Interfaces:**
- Produces: `type StatusTone = 'success'|'warning'|'danger'|'info'|'neutral'|'special'` (exported from `statusConfig.ts`); `<Badge tone="success">`; `statusConfig[key].tone`.

- [ ] **Step 1: Failing tests**

`src/components/ui/badge.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

describe('Badge tone', () => {
  it('renders tone surface/foreground/border classes', () => {
    render(<Badge tone="success">Won</Badge>);
    const el = screen.getByText('Won');
    expect(el.className).toContain('bg-status-success');
    expect(el.className).toContain('text-status-success-foreground');
    expect(el.className).toContain('border-status-success-border');
  });

  it('keeps the action variants when no tone is given', () => {
    render(<Badge variant="destructive">Delete</Badge>);
    expect(screen.getByText('Delete').className).toContain('bg-destructive');
  });

  it('tone wins over variant surface when both are given', () => {
    render(<Badge variant="outline" tone="warning">Pending</Badge>);
    const el = screen.getByText('Pending');
    expect(el.className).toContain('bg-status-warning');
    expect(el.className).not.toContain('bg-primary');
  });
});
```
`src/config/statusConfig.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { statusConfig, STATUS_TONES } from './statusConfig';

describe('statusConfig', () => {
  it('uses a valid tone for every status and no raw palette classes', () => {
    for (const [key, cfg] of Object.entries(statusConfig)) {
      expect(STATUS_TONES, key).toContain(cfg.tone);
      expect(JSON.stringify(cfg)).not.toMatch(/bg-(red|green|yellow|blue|gray)-\d/);
    }
  });
});
```

- [ ] **Step 2: Run them (RED)**

Run: `npx vitest run src/components/ui/badge.test.tsx src/config/statusConfig.test.ts`
Expected: FAIL — `tone` unknown prop / `STATUS_TONES` not exported.

- [ ] **Step 3: Implement**

`src/config/statusConfig.ts`:
```ts
export const STATUS_TONES = ['success', 'warning', 'danger', 'info', 'neutral', 'special'] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

export interface StatusConfigEntry { label: string; tone: StatusTone }

export const statusConfig: Record<string, StatusConfigEntry> = {
  draft: { label: 'Draft', tone: 'neutral' },
  internal_review: { label: 'In Review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  sent: { label: 'Sent', tone: 'info' },
  rejected: { label: 'Rejected', tone: 'danger' },
  accepted: { label: 'Accepted', tone: 'success' },
  expired: { label: 'Expired', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};
```
`src/components/ui/badge.tsx` — add a `tone` axis to the cva and make `tone` override the surface:
```tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: { /* unchanged */ },
      tone: {
        success: "border-status-success-border bg-status-success text-status-success-foreground",
        warning: "border-status-warning-border bg-status-warning text-status-warning-foreground",
        danger:  "border-status-danger-border bg-status-danger text-status-danger-foreground",
        info:    "border-status-info-border bg-status-info text-status-info-foreground",
        neutral: "border-status-neutral-border bg-status-neutral text-status-neutral-foreground",
        special: "border-status-special-border bg-status-special text-status-special-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, tone, ...props }, ref) => (
  // A tone describes record state; when present it owns the surface, so the action variant is dropped to "outline".
  <div ref={ref} className={cn(badgeVariants({ variant: tone ? "outline" : variant, tone }), className)} {...props} />
));
```
(`cn` uses tailwind-merge, so `text-foreground` from `outline` is replaced by the tone's text class.)

Consumers: replace every `statusConfig[x].color` / `{ color: 'bg-gray-100 text-gray-800' }` fallback with `tone`. Example from `src/components/quotation/QuotesList.tsx:108-110`:
```tsx
<Badge tone={(statusConfig[quote.status as keyof typeof statusConfig] ?? { tone: 'neutral' as const }).tone}>
  {(statusConfig[quote.status as keyof typeof statusConfig] || { label: quote.status }).label}
</Badge>
```
Do the same in the other nine files; where a consumer builds its own `className` from `.color`, switch it to `<Badge tone>`.

- [ ] **Step 4: GREEN + typecheck**

Run: `npx vitest run src/components/ui/badge.test.tsx src/config/statusConfig.test.ts && npm run typecheck`
Expected: 4 passed; typecheck clean (it will list every consumer still reading `.color` — fix each).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/badge.tsx src/components/ui/badge.test.tsx src/config/statusConfig.ts src/config/statusConfig.test.ts $(git diff --name-only src | grep -v test)
git commit -m "feat(design-system): Badge tone axis; statusConfig uses semantic tones"
```

---

### Task 4: Codemod + lint rule

**Files:**
- Create: `scripts/codemod-status-tones.mjs`
- Create: `scripts/codemod-status-tones.test.mjs`
- Modify: `eslint.config.js:117` (`no-restricted-syntax` array)
- Modify: `vitest.config.ts` only if `scripts/**/*.test.mjs` is not discovered (see Step 2)

**Interfaces:**
- Produces: `rewriteClassString(input: string): { output: string; manual: string[] }` (exported, pure) and a CLI `node scripts/codemod-status-tones.mjs [--write] [paths…]` that prints a per-file summary and the manual-review list.

- [ ] **Step 1: Failing unit test**

`scripts/codemod-status-tones.test.mjs`:
```js
import { describe, expect, it } from 'vitest';
import { rewriteClassString } from './codemod-status-tones.mjs';

describe('rewriteClassString', () => {
  it('rewrites a same-hue surface/text pair and drops its dark: siblings', () => {
    const r = rewriteClassString('rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2');
    expect(r.output).toBe('rounded bg-status-success text-status-success-foreground px-2');
    expect(r.manual).toEqual([]);
  });

  it('maps every hue family', () => {
    expect(rewriteClassString('bg-amber-100 text-amber-700').output).toBe('bg-status-warning text-status-warning-foreground');
    expect(rewriteClassString('bg-rose-50 text-rose-600').output).toBe('bg-status-danger text-status-danger-foreground');
    expect(rewriteClassString('bg-indigo-100 text-indigo-800').output).toBe('bg-status-info text-status-info-foreground');
    expect(rewriteClassString('bg-slate-100 text-slate-700').output).toBe('bg-status-neutral text-status-neutral-foreground');
    expect(rewriteClassString('bg-violet-100 text-violet-800').output).toBe('bg-status-special text-status-special-foreground');
  });

  it('rewrites hover: surface siblings to the tone surface', () => {
    expect(rewriteClassString('bg-red-100 text-red-800 hover:bg-red-200').output).toBe('bg-status-danger text-status-danger-foreground hover:bg-status-danger/80');
  });

  it('leaves mixed-hue pairs and lone colours alone but reports them', () => {
    const r = rewriteClassString('bg-blue-100 text-gray-800');
    expect(r.output).toBe('bg-blue-100 text-gray-800');
    expect(r.manual).toEqual(['bg-blue-100 text-gray-800']);
    expect(rewriteClassString('text-emerald-600').output).toBe('text-emerald-600');
  });

  it('is idempotent', () => {
    const once = rewriteClassString('bg-green-100 text-green-800').output;
    expect(rewriteClassString(once).output).toBe(once);
  });
});
```

- [ ] **Step 2: Run it (RED)**

Run: `npx vitest run scripts/codemod-status-tones.test.mjs`
Expected: FAIL — cannot resolve module. If instead "No test files found", add `'scripts/**/*.test.mjs'` to a vitest `include` (`include: [...configDefaults.include, 'docs/design-system/verification/**/*.unit.test.mjs', 'scripts/**/*.test.mjs']`) — note `configDefaults.exclude` already lists `scripts/tests/**`, which does not cover `scripts/*.test.mjs`.

- [ ] **Step 3: Implement the codemod**

`scripts/codemod-status-tones.mjs`:
```js
#!/usr/bin/env node
// Rewrites hardcoded Tailwind palette badge pairs (bg-X-N text-X-M) to semantic status tones.
// Pure `rewriteClassString` + a CLI. Only exact same-hue pairs are rewritten; everything else is
// reported for manual review so meaning ("selected" vs "info") is judged by a human.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HUE_TO_TONE = {
  green: 'success', emerald: 'success', teal: 'success',
  yellow: 'warning', amber: 'warning', orange: 'warning',
  red: 'danger', rose: 'danger',
  blue: 'info', cyan: 'info', indigo: 'info',
  gray: 'neutral', slate: 'neutral',
  purple: 'special', violet: 'special',
};
const HUES = Object.keys(HUE_TO_TONE).join('|');
const PAIR = new RegExp(`\\bbg-(${HUES})-(\\d{2,3})(?:\\/\\d+)?\\s+text-(${HUES})-(\\d{2,3})\\b`, 'g');

export function rewriteClassString(input) {
  const manual = [];
  let output = input.replace(PAIR, (m, bgHue, _bgN, fgHue) => {
    if (bgHue !== fgHue) { manual.push(m); return m; }
    const tone = HUE_TO_TONE[bgHue];
    return `bg-status-${tone} text-status-${tone}-foreground`;
  });
  // Siblings of a rewritten pair: dark: overrides are dropped (tones carry dark mode); hover: surface → tone/80.
  for (const tone of new Set(Object.values(HUE_TO_TONE))) {
    if (!output.includes(`bg-status-${tone}`)) continue;
    const hues = Object.entries(HUE_TO_TONE).filter(([, t]) => t === tone).map(([h]) => h).join('|');
    output = output
      .replace(new RegExp(`\\s*dark:(?:bg|text|border)-(?:${hues})-\\d{2,3}(?:\\/\\d+)?`, 'g'), '')
      .replace(new RegExp(`\\bhover:bg-(?:${hues})-\\d{2,3}\\b`, 'g'), `hover:bg-status-${tone}/80`);
  }
  return { output: output.replace(/\s{2,}/g, ' '), manual };
}

const SUB_BRAND = /--sq-|--sthira-/;

export function rewriteFile(file, write) {
  const src = fs.readFileSync(file, 'utf8');
  if (SUB_BRAND.test(src)) return { file, skipped: 'sub-brand', changed: false, manual: [] };
  const manual = [];
  let changed = false;
  // Only touch string/template literals that look like class lists.
  const out = src.replace(/(["'`])([^"'`\n]*\b(?:bg|text)-(?:[a-z]+)-\d{2,3}\b[^"'`\n]*)\1/g, (m, q, body) => {
    const r = rewriteClassString(body);
    manual.push(...r.manual);
    if (r.output !== body) changed = true;
    return `${q}${r.output}${q}`;
  });
  if (changed && write) fs.writeFileSync(file, out);
  return { file, changed, manual, skipped: null };
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|__snapshots__/.test(e.name)) walk(p, acc); }
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !/\.test\./.test(e.name)) acc.push(p);
  }
  return acc;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const roots = args.filter(a => !a.startsWith('--'));
  const files = (roots.length ? roots : ['src']).flatMap(r => fs.statSync(r).isDirectory() ? walk(r) : [r]);
  let changedCount = 0; const manualAll = [];
  for (const f of files) {
    const r = rewriteFile(f, write);
    if (r.changed) { changedCount++; console.log(`${write ? 'rewrote' : 'would rewrite'} ${f}`); }
    for (const m of r.manual) manualAll.push(`${f}: ${m}`);
  }
  console.log(`\n${changedCount} file(s) ${write ? 'rewritten' : 'to rewrite'}; ${manualAll.length} manual-review pair(s):`);
  for (const m of manualAll) console.log('  ' + m);
}
```

- [ ] **Step 4: GREEN**

Run: `npx vitest run scripts/codemod-status-tones.test.mjs`
Expected: 5 passed.

- [ ] **Step 5: Lint rule that keeps new raw pairs out**

In `eslint.config.js`, add to the `no-restricted-syntax` array at line 117 (define the constant next to `PARTIES_BANS`):
```js
const STATUS_PALETTE_BANS = [
  {
    selector: "Literal[value=/\\bbg-(green|emerald|teal|yellow|amber|orange|red|rose|blue|cyan|indigo|gray|slate|purple|violet)-\\d{2,3}\\s+text-\\1-\\d{2,3}\\b/]",
    message: "Raw palette badge pairs are banned in the platform shell — use <Badge tone> or bg-status-*/text-status-*-foreground (docs/design-system/README.md §4.5).",
  },
  {
    selector: "TemplateElement[value.raw=/\\bbg-(green|emerald|teal|yellow|amber|orange|red|rose|blue|cyan|indigo|gray|slate|purple|violet)-\\d{2,3}\\s+text-\\1-\\d{2,3}\\b/]",
    message: "Raw palette badge pairs are banned in the platform shell — use <Badge tone> or bg-status-*/text-status-*-foreground (docs/design-system/README.md §4.5).",
  },
];
```
and `"no-restricted-syntax": ["error", ...PARTIES_BANS, ...COMMS_PROVIDER_SDK_BANS, ...COMPLIANCE_SCHEMA_BANS, ...STATUS_PALETTE_BANS],`. (esquery regex literals do support back-references; if your ESLint build rejects `\1`, expand to an alternation of the 15 same-hue pairs instead.)

- [ ] **Step 6: Confirm the rule fires before the sweep**

Run: `npx eslint src/config/statusConfig.ts src/components/quotation/QuotesList.tsx 2>&1 | grep -c "Raw palette"`
Expected: `0` (these were converted in Task 3). Then: `npx eslint src/pages/dashboard 2>&1 | grep -c "Raw palette"`
Expected: a positive number (the rule sees the not-yet-swept pairs) — record it.

- [ ] **Step 7: Commit**

```bash
git add scripts/codemod-status-tones.mjs scripts/codemod-status-tones.test.mjs eslint.config.js vitest.config.ts
git commit -m "feat(design-system): status-tone codemod and lint ban on raw palette badge pairs"
```

---

### Task 5: The sweep

**Files:**
- Modify: every file the codemod rewrites under `src/` (expect ~100 files)

- [ ] **Step 1: Dry run and record**

Run: `node scripts/codemod-status-tones.mjs > /tmp/sweep-dry.txt; tail -40 /tmp/sweep-dry.txt`
Expected: "N file(s) to rewrite; M manual-review pair(s)" with the manual list. Save the list in your report.

- [ ] **Step 2: Write**

Run: `node scripts/codemod-status-tones.mjs --write && git diff --stat | tail -1`

- [ ] **Step 3: Manual review of every rewritten file (meaning drift)**

For each file in `git diff --name-only`, open the hunk and answer: does this pair mean *record state* (keep the tone) or something else? Known non-state cases to fix by hand:
- "selected/active" highlights (`bg-blue-100 text-blue-800` on a chosen row/tab) → `bg-primary/10 text-primary`.
- "delta up/down" financial text (`text-green-600`/`text-red-600` alone) → `text-up`/`text-down` if those utilities exist in `tailwind.config.ts` (`--up`/`--down` tokens per README §3.2), else leave and list in the report.
- KPI text in `src/components/dashboard/EnterpriseDashboardShell.tsx:60,95` (`kpi.tone` = `text-emerald-600`, `text-red-600`): change the tone strings at their source to `text-status-success-foreground` / `text-status-danger-foreground` (F3).
Also handle each **manual-review pair** from Step 1 the same way.

- [ ] **Step 4: Lint, typecheck, unit tests**

Run: `npx eslint src 2>&1 | grep -c "Raw palette"; npm run typecheck; npx vitest run src/components/ui src/config src/components/dashboard src/pages/dashboard 2>&1 | tail -4`
Expected: `0` raw-pair hits; typecheck clean; tests pass (fix any test that asserted a palette class by asserting the tone class instead).

- [ ] **Step 5: Visual spot-check in both modes**

Start Vite (`DS_HARNESS=1 npx vite --port 4173`), open `/dashboard/leads`, `/dashboard/opportunities` and `/dashboard/quotes` in light and dark; every status badge must read as a tinted pill with dark ink (light) / bright text on a deep tint (dark). Screenshot one of each into your report.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "refactor(design-system): sweep raw palette badge pairs to semantic status tones"
```

---

### Task 6: Shell findings — DomainSwitcher, nav toggles, dashboard progress, onboarding trap

**Files:**
- Modify: `src/components/navigation/DomainSwitcher.tsx:36-50`
- Modify: `src/components/navigation/CommandCenterNav.tsx:523-540`
- Modify: `src/components/dashboard/EnterpriseDashboardShell.tsx:81`
- Modify: `src/components/system/OnboardingTour.tsx`
- Test: `src/components/navigation/DomainSwitcher.test.tsx` (create), `src/components/navigation/CommandCenterNav.test.tsx` (extend), `src/components/dashboard/EnterpriseDashboardShell.test.tsx` (create)

- [ ] **Step 1: Failing tests**

`src/components/navigation/DomainSwitcher.test.tsx` (mock `@/contexts/DomainContext` the same way `CommandCenterNav.test.tsx` does, returning `{ currentDomain: undefined, availableDomains: [{ id: '1', code: 'crm', name: 'CRM', description: 'Sales' }], setDomain: vi.fn() }`):
```tsx
it('names the domain select for screen readers even before a value is chosen', () => {
  render(<DomainSwitcher />);
  expect(screen.getByRole('combobox', { name: /domain/i })).toBeInTheDocument();
});
```
Extend `CommandCenterNav.test.tsx`:
```tsx
it('removes collapsed group toggles from the tab order', () => {
  mockUseSidebar.mockReturnValue({ state: 'collapsed' });
  render(<MemoryRouter><CommandCenterNav /></MemoryRouter>);
  const toggle = screen.getByRole('button', { name: 'Toggle CRM menu', hidden: true });
  expect(toggle).toHaveAttribute('tabindex', '-1');
  expect(toggle).toHaveAttribute('aria-hidden', 'true');
});
```
`src/components/dashboard/EnterpriseDashboardShell.test.tsx` (render with the minimal props the component needs; mock data hooks as its existing story does):
```tsx
it('names every progress bar after its lane', () => {
  render(<EnterpriseDashboardShell /* props */ />);
  for (const bar of screen.getAllByRole('progressbar')) expect(bar).toHaveAccessibleName();
});
```

- [ ] **Step 2: RED**

Run: `npx vitest run src/components/navigation src/components/dashboard/EnterpriseDashboardShell.test.tsx`
Expected: the three new tests fail.

- [ ] **Step 3: Fix**

`DomainSwitcher.tsx` — F1/F2:
```tsx
        <SelectTrigger aria-label="Domain" className="w-[200px] h-9 bg-background border-input">
```
and remove `opacity-70` from the description span (line 48) — `text-muted-foreground` is already ≥4.5:1; the opacity pushed it to 2.71. Keep `line-clamp-1`.

`CommandCenterNav.tsx` — F5: on the collapsible trigger `<button>`, add
```tsx
                      tabIndex={collapsed ? -1 : 0}
                      aria-hidden={collapsed ? true : undefined}
```
(when collapsed the shadcn `SidebarGroupLabel` hides it with `opacity-0`; hidden controls must leave the tab order — WCAG 2.4.3/2.4.7).

`EnterpriseDashboardShell.tsx:81` — F4: `<Progress value={lane.progress} className="h-2" aria-label={`${lane.name} progress`} />` (use whatever the lane's display-name field is called).

`OnboardingTour.tsx` — F22: the tour overlay traps Tab between "Skip" and "Next". Two changes: (a) make the overlay a proper dialog — `role="dialog" aria-modal="true" aria-label="Product tour"` on the tooltip container — so a trap *inside a modal* is the expected behaviour, and (b) ensure `Escape` closes it (calls the same handler as Skip). If the tour is `react-joyride`, pass `disableCloseOnEsc={false}` and `floaterProps={{ disableFlip: true }}`; the dialog role comes from `styles`/`tooltipComponent`. Verify by hand: Tab cycles Skip/Next only while the dialog is open; Escape closes; Tab then reaches the page.

- [ ] **Step 4: GREEN**

Run: `npx vitest run src/components/navigation src/components/dashboard/EnterpriseDashboardShell.test.tsx`
Expected: all pass, including the existing CommandCenterNav tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/navigation src/components/dashboard/EnterpriseDashboardShell.tsx src/components/dashboard/EnterpriseDashboardShell.test.tsx src/components/system/OnboardingTour.tsx
git commit -m "fix(a11y): name the domain select, drop collapsed nav toggles from tab order, label progress bars, make the tour a dialog"
```

---

### Task 7: Leads list — filter selects, card nesting, duplicate h1, 360 toolbar

**Files:**
- Modify: `src/features/module-sales/components/LeadsFilterToolbar.tsx:121,138,150,196`
- Modify: `src/features/module-sales/components/LeadCard.tsx:66-80` (+ wherever the card's `onClick`/`onKeyDown` open the lead)
- Modify: `src/pages/dashboard/Leads.tsx:1643-1648`
- Modify: the toolbar file Task 1 attributed for F9
- Test: `src/features/module-sales/components/LeadCard.test.tsx` (create), `src/features/module-sales/components/LeadsFilterToolbar.test.tsx` (create)

- [ ] **Step 1: Failing tests**

`LeadsFilterToolbar.test.tsx` (mock its data hooks minimally):
```tsx
it('gives every filter select an accessible name', () => {
  render(<LeadsFilterToolbar /* minimal props */ />);
  for (const box of screen.getAllByRole('combobox')) expect(box).toHaveAccessibleName();
});
```
`LeadCard.test.tsx`:
```tsx
it('is not itself interactive but exposes one named open control', () => {
  render(<LeadCard lead={sampleLead} onOpen={vi.fn()} /* other required props */ />);
  expect(screen.queryByRole('button', { name: /Jane Doe, New, score/ })).toBeNull();   // the old card-as-button
  expect(screen.getByRole('button', { name: /open jane doe/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: RED** — `npx vitest run src/features/module-sales/components`

- [ ] **Step 3: Fix**

F6 — each `<SelectTrigger>` at lines 121/138/150/196 gets `aria-label` matching its purpose (`"Filter by status"`, `"Filter by source"`, `"Filter by owner"`, `"Sort leads"` — read the surrounding code for the real names).

F7 — `LeadCard.tsx:66-72`: remove `tabIndex={0}`, `role="button"` and `aria-label` from `<Card>`; keep `data-lead-id`; move the open action to a real control inside the header:
```tsx
<button type="button" onClick={handleOpen} className="text-left font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        aria-label={`Open ${fullName}`}>
  {fullName}
</button>
```
Keep the card's `onClick` for mouse users only if it does not also set `role`/`tabIndex`; keyboard users now have the button. The card's `selected` ring styling stays.

F8 — `Leads.tsx:1645`: the page already renders `FirstScreenTemplate title=…` which emits `<H1>`; change the inner `<h1 className="text-2xl font-semibold">` to `<h2 …>` (or delete the duplicate block if it only repeats the title).

F9 — open the file Task 1 attributed for the 360 px offender (`div.flex.items-center.gap-2 right=474` containing buttons): add `flex-wrap` to that row and `min-w-0`/`shrink` to its children so buttons wrap under 400 px. If it is a `CRMModuleHeaderNavigation` toolbar, the icon buttons must wrap to a second row, not clip.

- [ ] **Step 4: GREEN + typecheck** — `npx vitest run src/features/module-sales/components src/pages/dashboard/Leads* && npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add src/features/module-sales src/pages/dashboard/Leads.tsx <toolbar file>
git commit -m "fix(a11y): leads list — named filter selects, non-nested lead card, single h1, wrapping toolbar at 360"
```

---

### Task 8: Kanban — button names, nesting, scroll area, tabs

**Files:**
- Modify: `src/components/kanban/KanbanColumn.tsx:216-228`, `src/components/kanban/KanbanCard.tsx:105-130,165-190,195-202`
- Modify: `src/components/ui/scroll-area.tsx:11`
- Modify: `src/components/crm/TaskScheduler.tsx:124-142`
- Test: `src/components/kanban/KanbanColumn.test.tsx`, `src/components/kanban/KanbanCard.test.tsx` (create or extend), `src/components/crm/TaskScheduler.test.tsx` (create), `src/components/ui/scroll-area.test.tsx` (create)

- [ ] **Step 1: Failing tests**

```tsx
// KanbanColumn.test.tsx
it('names the add and menu buttons and keeps them reachable by keyboard', () => {
  render(<KanbanColumn column={sampleColumn} /* required props */ />);
  expect(screen.getByRole('button', { name: /add card to new/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /column options for new/i })).toBeInTheDocument();
});
// KanbanCard.test.tsx
it('separates the drag handle from the action buttons', () => {
  render(<KanbanCard item={sampleItem} onView={vi.fn()} onDelete={vi.fn()} /* required */ />);
  const handle = screen.getByRole('button', { name: /drag .* to another column/i });
  expect(handle.querySelector('button')).toBeNull();
  expect(screen.getByRole('button', { name: /view .*/i })).toBeInTheDocument();
});
// TaskScheduler.test.tsx
it('every tab controls a rendered panel', () => {
  render(<TaskScheduler /* required */ />);
  for (const tab of screen.getAllByRole('tab')) {
    const id = tab.getAttribute('aria-controls');
    expect(id && document.getElementById(id), tab.textContent).toBeTruthy();
  }
});
// scroll-area.test.tsx
it('viewport is focusable so keyboard users can scroll it', () => {
  render(<ScrollArea><div style={{ height: 2000 }}>tall</div></ScrollArea>);
  expect(document.querySelector('[data-radix-scroll-area-viewport]')).toHaveAttribute('tabindex', '0');
});
```

- [ ] **Step 2: RED** — `npx vitest run src/components/kanban src/components/crm/TaskScheduler.test.tsx src/components/ui/scroll-area.test.tsx`

- [ ] **Step 3: Fix**

F10 — `KanbanColumn.tsx:220,225`: `aria-label={`Add card to ${column.title}`}` and `aria-label={`Column options for ${column.title}`}`; change the wrapper `opacity-0 group-hover:opacity-100` to `opacity-0 group-hover:opacity-100 focus-within:opacity-100` so keyboard focus reveals them. `KanbanCard.tsx:169,185`: `aria-label={`View ${item.title}`}` and `aria-label={`Actions for ${item.title}`}`.

F11 — `KanbanCard.tsx:110`: the outer draggable `div` carries `role="button" tabIndex=0 aria-roledescription` from dnd-kit's `attributes`/`listeners`. Move `{...attributes} {...listeners}` off the outer container onto a dedicated handle element rendered first inside the card:
```tsx
<button type="button" {...attributes} {...listeners} aria-label={`Drag ${item.title} to another column`}
        className="absolute left-1 top-1 h-5 w-5 cursor-grab text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring rounded">
  <GripVertical className="h-4 w-4" />
</button>
```
(the outer `div` keeps `ref={setNodeRef}` and `style`). Do the same for the swimlane at `:199` if it also spreads dnd-kit attributes onto a container with buttons inside. dnd-kit's `KeyboardSensor` keeps working from the handle.

F12 — `scroll-area.tsx:11`: `<ScrollAreaPrimitive.Viewport tabIndex={0} className="h-full w-full rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">`.

F13 — `TaskScheduler.tsx`: wrap the list rendering in `TabsContent` for each value so `aria-controls` resolves:
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
  <TabsList …>…</TabsList>
  {(['upcoming', 'overdue', 'completed'] as const).map(v => (
    <TabsContent key={v} value={v}>{v === activeTab ? renderTaskList() : null}</TabsContent>
  ))}
</Tabs>
```
(move the existing list JSX into `renderTaskList()`).

- [ ] **Step 4: GREEN + typecheck**

- [ ] **Step 5: Commit** — `git commit -m "fix(a11y): kanban — named buttons, drag handle outside actions, focusable scroll viewport, tabs with panels"`

---

### Task 9: Themes page — labels, selects, switches, preview contrast, 360 overflow

**Files:**
- Modify: `src/components/ui/hsl-picker.tsx:71-91`
- Modify: `src/pages/dashboard/ThemeManagement.tsx:453,488-490,535,553,566,571-576`
- Test: `src/components/ui/hsl-picker.test.tsx` (create), `src/pages/dashboard/ThemeManagement.test.tsx` (create or extend)

- [ ] **Step 1: Failing tests**

```tsx
// hsl-picker.test.tsx
it('associates every input with its label', () => {
  render(<HslPicker label="Primary" value="217 91% 53%" onChange={vi.fn()} />);
  for (const name of ['Pick', 'Hue', 'Sat', 'Light']) expect(screen.getAllByLabelText(new RegExp(name)).length).toBeGreaterThan(0);
});
// ThemeManagement.test.tsx
it('names the radius selects and the switches', () => {
  render(/* ThemeManagement inside its providers, mocked like other page tests */);
  expect(screen.getByRole('combobox', { name: /radius/i })).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: /header banner/i })).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: /dark mode/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: RED**

- [ ] **Step 3: Fix**

F15 — `hsl-picker.tsx`: give each `<input>` an `id` (`useId()` + suffix) and each `<Label htmlFor=…>`; the number inputs at 81/86/91 get `aria-label={`${label} hue (number)`}` etc. `ThemeManagement.tsx:535,553`: `aria-label="Card radius"` / `aria-label="Kanban card radius"`. `:453` `<Switch aria-label="Show header banner" …>`, `:566` `<Switch aria-label="Dark mode" …>` (or `id` + the adjacent `<Label htmlFor>`).

F16 — `ThemeManagement.tsx:488-490`: the preview table header uses `--table-header-text` under the *previewed* palette; compute it with the same helper `useTheme.tsx` uses for saved presets: `contrastSafeForeground(previewAccentHsl)` and set `--table-header-text` in the preview's inline style from that value (find `contrastSafeForeground` in `src/hooks/useTheme.tsx` and export it if it isn't).

F17 — `ThemeManagement.tsx:571`: `<div className="mt-6 flex flex-wrap items-center gap-3">` and the strip `className="flex-1 min-w-[16rem] h-16 …"` so it drops below the buttons at 360.

- [ ] **Step 4: GREEN + typecheck**

- [ ] **Step 5: Commit** — `git commit -m "fix(a11y): themes page — labelled colour inputs, named selects/switches, contrast-safe preview header, wrapping preview row"`

---

### Task 10: Auth page — landmark, h1, link contrast

**Files:**
- Modify: `src/pages/Auth.tsx:455-479` (standard branch) and `:484-510` (Sthira branch) — the `H2` import and wrappers
- Test: `src/pages/Auth.test.tsx` (create or extend)

- [ ] **Step 1: Failing test**

```tsx
it('exposes a main landmark and exactly one h1', () => {
  render(<MemoryRouter><Auth /></MemoryRouter>);   // with the auth/domain mocks the other page tests use
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});
```

- [ ] **Step 2: RED**

- [ ] **Step 3: Fix**

F18 — standard branch: change the outer `<div className="min-h-screen …">` to `<main className="min-h-screen …">` and `<H2>{title}</H2>` to `<H1>{title}</H1>` (`import { H1 } from '@/components/ui/Heading'`, next to the existing `H2` import at line 9). Sthira branch already has an `<h1>`; wrap it in `<main>` the same way.

F19 — the links at 368-374 are `text-primary` on a `to-primary/5` gradient: measured < 4.5:1 by axe. Use the deeper link ink: add `--link: 217 91% 40%` (light) / `217 91% 70%` (dark) to `index.css`, `link: "hsl(var(--link))"` in Tailwind, an audit pair `['link on background', 'link', 'background', 4.5]`, and change the three links to `text-link underline`. (Do not lighten the gradient — the tint is a brand choice; the ink is the variable.)

- [ ] **Step 4: GREEN + audit** — `npx vitest run src/pages/Auth.test.tsx && npm run audit:contrast`

- [ ] **Step 5: Commit** — `git commit -m "fix(a11y): auth page — main landmark, single h1, contrast-safe link ink"`

---

### Task 11: Opportunity form 768 overflow; accounts list page size

**Files:**
- Modify: the file Task 1 attributed for F20 (under `src/components/crm/OpportunityForm.tsx` or `EntityNewPageHeader.tsx`)
- Modify: `src/pages/dashboard/Accounts.tsx:60-70` and its table render
- Test: `src/pages/dashboard/Accounts.test.tsx` (extend)

- [ ] **Step 1: Failing test (accounts)**

```tsx
it('renders at most 100 rows and offers Load more', async () => {
  mockListAccounts.mockResolvedValue({ data: Array.from({ length: 250 }, (_, i) => makeAccount(i)), fallbackReason: null });
  render(/* Accounts with providers */);
  expect(await screen.findAllByRole('row')).toHaveLength(101); // header + 100
  expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: RED**

- [ ] **Step 3: Fix**

F21 — `Accounts.tsx`: the fetch (`pageSize: 2000`) stays as is for now — the 33 000 px page comes from rendering every row. Add `const [visible, setVisible] = useState(100)`; render `accounts.slice(0, visible)`; below the table `{visible < accounts.length && <Button variant="outline" onClick={() => setVisible(v => v + 100)}>Load more ({accounts.length - visible} remaining)</Button>}`. Document in the report that true server pagination is a follow-up.

F20 — open the attributed file for the 862 px element at 768: it is a fixed `w-[…]`/`min-w-[…]` or a non-wrapping grid; replace with `w-full max-w-full` / `grid-cols-1 md:grid-cols-2` so the form fits 768.

- [ ] **Step 4: GREEN + typecheck**

- [ ] **Step 5: Commit** — `git commit -m "fix(layout): opportunity form fits 768px; accounts list renders in pages of 100"`

---

### Task 12: Docs, disposition rule, after-run evidence

**Files:**
- Modify: `docs/design-system/README.md` (§3.2 tokens table, §4.5 rules, §8 change log, Appendix B)
- Modify: `docs/superpowers/specs/2026-09-13-design-system-verification-and-usability-design.md` §4.4
- Regenerate: `docs/design-system/verification/**`

- [ ] **Step 1: Spec §4.4 — add the rule**

Append a row to the disposition table:
```
| Keyboard/ARIA finding present in ONE engine only | Harness suspect first: check REPORT.md "Engine-specific divergences" and the engine caveats before changing app code (Plan 1 final review: three such cases, all tooling) |
```

- [ ] **Step 2: README**

- §3.2: add a **Status tones** table (6 rows × light/dark surface, foreground, border, measured ratio from Task 2's audit output) and update the `--muted-foreground` light value to `215 16% 42%` with its new ratios.
- §4.5: add "Record state uses `<Badge tone>` / `bg-status-*` — raw palette pairs are lint-banned (`STATUS_PALETTE_BANS`)."
- §8 change log: one row per Task 2–11 (area, change, files).
- Appendix B: remove the stale `EnterpriseButton/Form/Header/Modal/ActivityFeed` line (those components do not exist; the live `enterprise/` files are `EnterpriseCard/Components/FormLayout/Table/Tabs`, all imported), remove "Status/priority badge palettes … not tuned per mode", keep `LeadDetail/QuoteDetail`, "New" shells, real Safari/devices/screen reader, `lead-detail` unmeasured, WebKit link tabbing, and add "server-side pagination for Accounts (client-side Load more shipped)".

- [ ] **Step 3: Re-run the harness (services up if possible)**

```bash
(cd services/crm-api && npm install) ; (cd services/uim-api && npm install) ; (cd services/amro-api && npm install)   # once; lets services:start work
npm run services:start &     # leave running
npm run audit:design-system  # ~1.5 h; run in the background and poll test-results/design-system/data (target 393)
```
If services still fail to start, proceed Vite-only and say so in the report (REPORT.md records it automatically).

- [ ] **Step 4: Compare before/after**

```bash
git show 9883d634:docs/design-system/verification/REPORT.md | grep -c "❌" ; grep -c "❌" docs/design-system/verification/REPORT.md
```
Expected: the after count is a small fraction of the before (356). For every remaining ❌, write one line in your report: finding → fixed later / harness suspect / accepted (with reason). Zero `serious`/`critical` axe rules should remain on the 10 pages except `lead-detail` if the CRM API is still down.

- [ ] **Step 5: Verify, commit docs + evidence**

Run: `npx vitest run tests/design-system docs/design-system/verification scripts && npx eslint src tests/design-system scripts && npm run audit:contrast`
Then two commits:
```bash
git add docs/design-system/README.md docs/superpowers/specs/2026-09-13-design-system-verification-and-usability-design.md
git commit -m "docs(design-system): status tones, lint rule, single-engine disposition rule, Appendix B refresh"
git add docs/design-system/verification
git commit -m "docs(design-system): after-fix verification evidence (Plan 2)"
```
