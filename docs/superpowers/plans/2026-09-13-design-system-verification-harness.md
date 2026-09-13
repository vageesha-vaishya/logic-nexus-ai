# Design System Verification Harness — Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-09-13-design-system-verification-and-usability-design.md` §3

**Goal:** A re-runnable Playwright suite that, for 10 CRM-core pages, verifies layout integrity, WCAG 2.1 AA (axe), keyboard focus, and ARIA structure across chromium/firefox/webkit/msedge × 360/768/1280/1920 × light/dark, and emits a committed `docs/design-system/verification/REPORT.md` with screenshots.

**Architecture:** A dedicated Playwright config (`tests/design-system/playwright.design-system.config.ts`) with one `setup` project that logs in once and saves `storageState`, and four engine projects. Specs loop viewports × modes internally. Every check writes a small JSON "cell result" to `test-results/design-system/data/`; a pure Node script turns those into `REPORT.md`. Screenshots and ARIA snapshots are written straight into `docs/design-system/verification/` so they are the committed evidence.

**Tech Stack:** `@playwright/test` 1.57, `axe-core` 4.11 (injected from `node_modules`, no `@axe-core/playwright`), `dotenv` 17, Node ESM for the report script, vitest for pure-function unit tests.

## Global Constraints

- Engines: `chromium`, `firefox`, `webkit` (Safari proxy — say so in every report), `msedge` (channel `msedge`).
- Viewports: `360×800`, `768×1024`, `1280×800`, `1920×1080`.
- Modes: `light`, `dark`. Light = `soslogicpro.darkMode=false` + `soslogicpro.activeThemeName=Default Simple`; dark = `true` + `Default Dark` (presets hard-declare `dark`, so both keys are required).
- axe tags: `wcag2a, wcag2aa, wcag21a, wcag21aa`. Gate on `serious` + `critical` only.
- Keyboard walk: 1280 light, chromium + firefox + webkit (msedge omitted — same engine as chromium). Max 40 Tab presses.
- ARIA gate: exactly one `heading level=1`; ≥1 `main`; no `button`/`link`/`textbox` with empty name.
- Credentials: `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`, read from the gitignored repo-root `env` file (or `.env`). Never hardcode them.
- Server: Vite on `http://localhost:4173`; `PLAYWRIGHT_REUSE_EXISTING_SERVER=true` attaches to a running one.
- Output paths: screenshots `docs/design-system/verification/screenshots/<page>/<engine>-<w>-<mode>.png`; ARIA `docs/design-system/verification/aria/<page>-<engine>.yaml`; cell JSON `test-results/design-system/data/*.json`; report `docs/design-system/verification/REPORT.md`.
- The root `playwright.config.ts` and its `testMatch` are not modified.
- Deviation from spec §3.2 (deliberate): one `storageState` file produced by a chromium `setup` project is shared by all four engines — the Supabase session lives in localStorage JSON and is engine-agnostic, so a per-engine login adds three logins and nothing else.
- Commit messages end with the attribution lines from the session's system reminder.

---

## File structure

| Path | Responsibility |
|---|---|
| `tests/design-system/playwright.design-system.config.ts` | Projects (setup + 4 engines), webServer, reporters, env loading |
| `tests/design-system/pages.ts` | The 10-page set, viewports, modes, naming helpers, `resolveRoute()` |
| `tests/design-system/auth.setup.ts` | Logs in once → `tests/design-system/.auth/user.json` |
| `tests/design-system/helpers/theme.ts` | `applyModeInitScript(page, mode)`, `expectMode(page, mode)` |
| `tests/design-system/helpers/results.ts` | `CellResult` types + `writeCellResult()` |
| `tests/design-system/helpers/layout.ts` | `checkLayout(page)` → offenders |
| `tests/design-system/helpers/axe.ts` | `runAxe(page, disabledRules)` → summarized violations |
| `tests/design-system/helpers/focus.ts` | `walkTabOrder(page, max)` → stops + failures |
| `tests/design-system/helpers/aria.ts` | `checkAriaSnapshot(yaml)` → failures |
| `tests/design-system/matrix.spec.ts` | Screenshot + layout + axe for every cell |
| `tests/design-system/keyboard.spec.ts` | Tab walk at 1280 light |
| `tests/design-system/aria.spec.ts` | ARIA snapshot + gate at 1280 light |
| `tests/design-system/pages.unit.test.ts` | vitest: page set invariants |
| `tests/design-system/aria-gate.unit.test.ts` | vitest: `checkAriaSnapshot` on fixtures |
| `docs/design-system/verification/generate-report.mjs` | `buildReport(results, meta)` + CLI main |
| `docs/design-system/verification/report.unit.test.mjs` | vitest: report markdown from fixture cells |
| `docs/design-system/verification/REPORT.md` | Generated, committed |
| `.gitignore`, `package.json`, `vitest.config.ts`, `docs/design-system/README.md` | Wiring + doc updates |

---

### Task 1: Scaffold config, page set, scripts

**Files:**
- Create: `tests/design-system/playwright.design-system.config.ts`
- Create: `tests/design-system/pages.ts`
- Create: `tests/design-system/pages.unit.test.ts`
- Modify: `.gitignore`
- Modify: `package.json` (scripts)
- Modify: `vitest.config.ts:18`

**Interfaces:**
- Produces: `PAGES: PageDef[]`, `VIEWPORTS`, `MODES`, `Mode`, `Engine`, `screenshotRelPath()`, `ariaRelPath()`, `VERIFICATION_DIR`, `DATA_DIR` — used by every later task.

- [ ] **Step 1: Write the failing unit test**

`tests/design-system/pages.unit.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { PAGES, VIEWPORTS, MODES, screenshotRelPath, ariaRelPath } from './pages';

describe('design-system page set', () => {
  it('has 10 pages with unique keys', () => {
    expect(PAGES).toHaveLength(10);
    expect(new Set(PAGES.map(p => p.key)).size).toBe(10);
  });

  it('marks only /auth as unauthenticated', () => {
    expect(PAGES.filter(p => !p.authenticated).map(p => p.key)).toEqual(['auth']);
  });

  it('defines the four spec viewports and two modes', () => {
    expect(VIEWPORTS.map(v => v.width)).toEqual([360, 768, 1280, 1920]);
    expect(MODES).toEqual(['light', 'dark']);
  });

  it('builds stable, path-safe artifact names', () => {
    expect(screenshotRelPath('leads-list', 'webkit', 360, 'dark'))
      .toBe('screenshots/leads-list/webkit-360-dark.png');
    expect(ariaRelPath('lead-detail', 'firefox')).toBe('aria/lead-detail-firefox.yaml');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/design-system/pages.unit.test.ts`
Expected: FAIL — cannot resolve `./pages`.

- [ ] **Step 3: Create `tests/design-system/pages.ts`**

```ts
import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';

export type Mode = 'light' | 'dark';
export type Engine = 'chromium' | 'firefox' | 'webkit' | 'msedge';

export interface Viewport { width: number; height: number }
export const VIEWPORTS: Viewport[] = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
];
export const MODES: Mode[] = ['light', 'dark'];

/** Viewport used by the 1280-only specs (keyboard, aria). */
export const DESKTOP: Viewport = VIEWPORTS[2];

export interface PageDef {
  key: string;
  /** Route, or a function that resolves a dynamic route (e.g. first lead id). */
  route: string | ((ctx: ResolveContext) => Promise<string>);
  authenticated: boolean;
  why: string;
  /** axe rule ids disabled for this page, each with a reason (listed in the report). */
  disabledAxeRules?: { id: string; reason: string }[];
}

export interface ResolveContext {
  request: APIRequestContext;
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
}

export const PAGES: PageDef[] = [
  { key: 'auth', route: '/auth', authenticated: false, why: 'Unauthenticated entry; form' },
  { key: 'dashboard', route: '/dashboard', authenticated: true, why: 'KPI grids, widgets' },
  { key: 'leads-list', route: '/dashboard/leads', authenticated: true, why: 'Dense table + title strip' },
  { key: 'lead-detail', route: resolveFirstLead, authenticated: true, why: 'Sticky action bar, tabs' },
  { key: 'leads-kanban', route: '/dashboard/leads/pipeline', authenticated: true, why: 'Horizontal scroll, drag targets' },
  { key: 'contacts-list', route: '/dashboard/contacts', authenticated: true, why: 'Table variant' },
  { key: 'accounts-list', route: '/dashboard/accounts', authenticated: true, why: 'Table variant' },
  { key: 'opportunities-list', route: '/dashboard/opportunities', authenticated: true, why: 'Table with stage badges' },
  { key: 'opportunity-new', route: '/dashboard/opportunities/new', authenticated: true, why: 'Long form, validation' },
  { key: 'themes', route: '/dashboard/themes', authenticated: true, why: 'Runtime preset switching' },
];

/**
 * The leads list navigates on double-click with `openEdit` state, which is not
 * the plain detail view — so the id is resolved through the REST API instead.
 */
async function resolveFirstLead(ctx: ResolveContext): Promise<string> {
  const res = await ctx.request.get(
    `${ctx.supabaseUrl}/rest/v1/leads?select=id&order=created_at.desc&limit=1`,
    { headers: { apikey: ctx.anonKey, Authorization: `Bearer ${ctx.accessToken}` } },
  );
  if (!res.ok()) throw new Error(`leads lookup failed: HTTP ${res.status()} ${await res.text()}`);
  const rows = (await res.json()) as { id: string }[];
  if (!rows.length) throw new Error('No leads visible to the E2E admin; seed one before running lead-detail.');
  return `/dashboard/leads/${rows[0].id}`;
}

export async function resolveRoute(def: PageDef, ctx: ResolveContext): Promise<string> {
  return typeof def.route === 'string' ? def.route : def.route(ctx);
}

/** Absolute dirs. Everything committed lives under VERIFICATION_DIR. */
export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const VERIFICATION_DIR = path.join(REPO_ROOT, 'docs', 'design-system', 'verification');
export const DATA_DIR = path.join(REPO_ROOT, 'test-results', 'design-system', 'data');
export const AUTH_STATE = path.join(REPO_ROOT, 'tests', 'design-system', '.auth', 'user.json');

export function screenshotRelPath(pageKey: string, engine: string, width: number, mode: Mode): string {
  return `screenshots/${pageKey}/${engine}-${width}-${mode}.png`;
}
export function ariaRelPath(pageKey: string, engine: string): string {
  return `aria/${pageKey}-${engine}.yaml`;
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npx vitest run tests/design-system/pages.unit.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Create the Playwright config**

`tests/design-system/playwright.design-system.config.ts`:
```ts
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

// Secrets live in the gitignored repo-root `env` file; `.env` carries the Vite
// public vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Load both.
const repoRoot = path.resolve(__dirname, '..', '..');
loadEnv({ path: path.join(repoRoot, '.env') });
loadEnv({ path: path.join(repoRoot, 'env') });

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173';
const reuseServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true';
const authState = path.join(__dirname, '.auth', 'user.json');

// Mirrors the root config's Firefox sandbox handling.
const firefoxNoSandbox =
  process.env.PW_FIREFOX_NO_SANDBOX === '1' ||
  (process.env.PW_FIREFOX_NO_SANDBOX !== '0' && process.platform === 'darwin');

export default defineConfig({
  testDir: __dirname,
  testMatch: ['**/*.spec.ts', '**/*.setup.ts'],
  outputDir: path.join(repoRoot, 'test-results', 'design-system', 'artifacts'),
  fullyParallel: false,
  workers: 2,
  retries: 0,
  timeout: 120_000,
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(repoRoot, 'playwright-report', 'design-system.json') }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: authState },
    },
    {
      name: 'firefox',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Firefox'],
        storageState: authState,
        ...(firefoxNoSandbox
          ? {
              launchOptions: {
                env: {
                  MOZ_DISABLE_CONTENT_SANDBOX: '1',
                  MOZ_DISABLE_GMP_SANDBOX: '1',
                  MOZ_DISABLE_RDD_SANDBOX: '1',
                  MOZ_DISABLE_SOCKET_PROCESS_SANDBOX: '1',
                },
                firefoxUserPrefs: { 'security.sandbox.content.level': 0 },
              },
            }
          : {}),
      },
    },
    {
      name: 'webkit',
      dependencies: ['setup'],
      use: { ...devices['Desktop Safari'], storageState: authState },
    },
    {
      name: 'msedge',
      dependencies: ['setup'],
      use: { ...devices['Desktop Edge'], channel: 'msedge', storageState: authState },
    },
  ],
  webServer: reuseServer
    ? undefined
    : {
        command: 'npm run dev:vite -- --host 0.0.0.0 --port 4173 --strictPort',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
```

- [ ] **Step 6: Wire scripts, ignores, and vitest exclusion**

`package.json` — add to `"scripts"` (next to `"audit:contrast"`):
```json
"audit:design-system": "playwright test -c tests/design-system/playwright.design-system.config.ts && node docs/design-system/verification/generate-report.mjs",
"audit:design-system:quick": "playwright test -c tests/design-system/playwright.design-system.config.ts --project=setup --project=chromium && node docs/design-system/verification/generate-report.mjs",
```

`.gitignore` — append:
```
# Playwright design-system harness (evidence is committed under docs/design-system/verification/)
test-results/
tests/design-system/.auth/
playwright-report/design-system.json
```

`vitest.config.ts:18` — vitest's default include would pick up `*.spec.ts`; exclude the Playwright files but keep the `*.unit.test.*` files:
```ts
exclude: [...configDefaults.exclude, 'tests/e2e/**', 'scripts/tests/**', 'tests/design-system/**/*.spec.ts', 'tests/design-system/**/*.setup.ts'],
```

- [ ] **Step 7: Verify the config parses and lists zero tests without error**

Run: `npx playwright test -c tests/design-system/playwright.design-system.config.ts --list`
Expected: either `Total: 0 tests in 0 files` or `Error: No tests found` — both mean the config itself parsed. A TypeScript or import error in the config is the failure to look for.

Run: `npx vitest run tests/design-system`
Expected: 4 passed (only the unit test).

- [ ] **Step 8: Commit**

```bash
git add tests/design-system/playwright.design-system.config.ts tests/design-system/pages.ts tests/design-system/pages.unit.test.ts .gitignore package.json vitest.config.ts
git commit -m "test(design-system): scaffold verification harness config and page set"
```

---

### Task 2: Auth setup → storageState

**Files:**
- Create: `tests/design-system/auth.setup.ts`
- Create: `tests/design-system/helpers/env.ts`

**Interfaces:**
- Consumes: `AUTH_STATE` from `pages.ts`.
- Produces: `tests/design-system/.auth/user.json`; `requireEnv(name)`, `supabaseEnv()`, `readAccessToken(storageStatePath)` in `helpers/env.ts` — used by Task 3's `resolveRoute` context.

- [ ] **Step 1: Add `E2E_ADMIN_*` to the gitignored `env` file**

Append to repo-root `env` (create if absent; it is gitignored):
```
E2E_ADMIN_EMAIL=<admin login email>
E2E_ADMIN_PASSWORD=<admin password>
```
Use the same account the existing `tests/e2e/*.spec.ts` files log in with.

- [ ] **Step 2: Create `tests/design-system/helpers/env.ts`**

```ts
import fs from 'node:fs';

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set. Put it in the gitignored repo-root \`env\` file (see docs/design-system/verification/REPORT.md → "Running").`,
    );
  }
  return v;
}

export function supabaseEnv(): { supabaseUrl: string; anonKey: string } {
  return {
    supabaseUrl: requireEnv('VITE_SUPABASE_URL').replace(/\/$/, ''),
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
  };
}

interface StorageState {
  origins: { origin: string; localStorage: { name: string; value: string }[] }[];
}

/** supabase-js stores the session under `sb-<ref>-auth-token`; pull the access token out of the saved state. */
export function readAccessToken(storageStatePath: string): string {
  const state = JSON.parse(fs.readFileSync(storageStatePath, 'utf8')) as StorageState;
  for (const origin of state.origins) {
    const entry = origin.localStorage.find(e => /^sb-.*-auth-token$/.test(e.name));
    if (entry) {
      const parsed = JSON.parse(entry.value) as { access_token?: string };
      if (parsed.access_token) return parsed.access_token;
    }
  }
  throw new Error(`No supabase auth token in ${storageStatePath}; did auth.setup.ts run?`);
}
```

- [ ] **Step 3: Create `tests/design-system/auth.setup.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';
import { AUTH_STATE } from './pages';
import { requireEnv } from './helpers/env';

setup('authenticate as E2E admin', async ({ page }) => {
  const email = requireEnv('E2E_ADMIN_EMAIL');
  const password = requireEnv('E2E_ADMIN_PASSWORD');

  await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('login-btn').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
  // Wait until the session has actually been persisted, not just the redirect.
  await expect
    .poll(() => page.evaluate(() => Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k))), { timeout: 15_000 })
    .toBe(true);

  fs.mkdirSync(path.dirname(AUTH_STATE), { recursive: true });
  await page.context().storageState({ path: AUTH_STATE });
});
```

- [ ] **Step 4: Run the setup project alone**

Run (with the dev server started by the config): `npx playwright test -c tests/design-system/playwright.design-system.config.ts --project=setup`
Expected: `1 passed`; `tests/design-system/.auth/user.json` exists and contains an `sb-…-auth-token` entry:

`node -e "const s=require('./tests/design-system/.auth/user.json');console.log(s.origins.flatMap(o=>o.localStorage.map(e=>e.name)).filter(n=>/auth-token/.test(n)))"`
Expected: one key printed.

- [ ] **Step 5: Commit**

```bash
git add tests/design-system/auth.setup.ts tests/design-system/helpers/env.ts
git commit -m "test(design-system): one-shot admin login saved as storageState"
```

---

### Task 3: Theme mode + cell results + layout gate; matrix spec (screenshot + layout)

**Files:**
- Create: `tests/design-system/helpers/theme.ts`
- Create: `tests/design-system/helpers/results.ts`
- Create: `tests/design-system/helpers/layout.ts`
- Create: `tests/design-system/matrix.spec.ts`

**Interfaces:**
- Consumes: `PAGES, VIEWPORTS, MODES, resolveRoute, screenshotRelPath, VERIFICATION_DIR, DATA_DIR, AUTH_STATE` (Task 1); `supabaseEnv, readAccessToken` (Task 2).
- Produces:
  - `applyModeInitScript(page, mode)`, `expectMode(page, mode)`
  - `CellResult`, `writeCellResult(kind: 'matrix'|'keyboard'|'aria', r: CellResult)`
  - `checkLayout(page): Promise<{ passed: boolean; offenders: string[] }>`
  - `matrix.spec.ts` with a `runAxe` hook point for Task 4.

- [ ] **Step 1: Create `helpers/theme.ts`**

```ts
import { expect, type Page } from '@playwright/test';
import type { Mode } from '../pages';

const DARK_KEY = 'soslogicpro.darkMode';           // src/lib/theme-storage-keys.ts
const ACTIVE_KEY = 'soslogicpro.activeThemeName';  // src/hooks/useTheme.tsx
const PRESET: Record<Mode, string> = { light: 'Default Simple', dark: 'Default Dark' };

/**
 * Presets hard-declare `dark`, and ThemeProvider derives the mode from the
 * active preset before falling back to the stored toggle — so both keys must
 * agree or the toggle is ignored. Must be registered before navigation.
 */
export async function applyModeInitScript(page: Page, mode: Mode): Promise<void> {
  await page.addInitScript(
    ([darkKey, activeKey, isDark, preset]) => {
      localStorage.setItem(darkKey, isDark);
      localStorage.setItem(activeKey, preset);
    },
    [DARK_KEY, ACTIVE_KEY, String(mode === 'dark'), PRESET[mode]] as const,
  );
}

/** Fails loudly if the app rendered the other mode (e.g. a server-side theme override). */
export async function expectMode(page: Page, mode: Mode): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')), { timeout: 10_000 })
    .toBe(mode === 'dark');
}
```

- [ ] **Step 2: Create `helpers/results.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, type Mode } from '../pages';

export interface AxeViolationSummary {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  help: string;
  helpUrl: string;
  nodes: number;
  sampleTargets: string[];
}

export interface FocusStop {
  index: number;
  tag: string;
  role: string | null;
  name: string;
  visibleFocus: boolean;
  visible: boolean;
  inAriaHidden: boolean;
}

export interface CellResult {
  page: string;
  route: string;
  engine: string;
  width: number;
  height: number;
  mode: Mode;
  /** Relative to docs/design-system/verification/ */
  screenshot?: string;
  layout?: { passed: boolean; offenders: string[] };
  axe?: { passed: boolean; violations: AxeViolationSummary[]; disabledRules: { id: string; reason: string }[] };
  keyboard?: { passed: boolean; stops: FocusStop[]; failures: string[] };
  aria?: { passed: boolean; failures: string[]; snapshot: string };
  error?: string;
}

export type CellKind = 'matrix' | 'keyboard' | 'aria';

export function writeCellResult(kind: CellKind, r: CellResult): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, `${kind}-${r.page}-${r.engine}-${r.width}-${r.mode}.json`);
  fs.writeFileSync(file, JSON.stringify(r, null, 2));
}
```

- [ ] **Step 3: Create `helpers/layout.ts`**

```ts
import type { Page } from '@playwright/test';

/**
 * Spec §3.3.2: no page-level horizontal scroll, and no element wider than the
 * viewport unless an ancestor scrolls horizontally (tables/kanban may).
 * Runs in the browser; returns CSS-ish descriptions of offenders.
 */
export async function checkLayout(page: Page): Promise<{ passed: boolean; offenders: string[] }> {
  return page.evaluate(() => {
    const offenders: string[] = [];
    const vw = window.innerWidth;
    const doc = document.documentElement;
    if (doc.scrollWidth > vw) {
      offenders.push(`document scrollWidth ${doc.scrollWidth} > innerWidth ${vw}`);
    }

    const scrollsX = (el: Element): boolean => {
      const o = getComputedStyle(el).overflowX;
      return o === 'auto' || o === 'scroll';
    };
    const hasScrollingAncestor = (el: Element): boolean => {
      let cur = el.parentElement;
      while (cur && cur !== document.body) {
        if (scrollsX(cur)) return true;
        cur = cur.parentElement;
      }
      return false;
    };
    const describe = (el: Element): string => {
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
        : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };

    const all = document.body.querySelectorAll<HTMLElement>('*');
    let reported = 0;
    for (const el of all) {
      if (reported >= 10) break;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // +1 tolerates sub-pixel rounding.
      if (r.right > vw + 1 && !hasScrollingAncestor(el) && getComputedStyle(el).position !== 'fixed') {
        offenders.push(`${describe(el)} right=${Math.round(r.right)} > ${vw}`);
        reported++;
      }
    }
    return { passed: offenders.length === 0, offenders };
  });
}
```

- [ ] **Step 4: Create `matrix.spec.ts` (screenshot + layout; axe slot left for Task 4)**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { test, expect, request as pwRequest } from '@playwright/test';
import {
  AUTH_STATE, MODES, PAGES, VIEWPORTS, VERIFICATION_DIR,
  resolveRoute, screenshotRelPath, type Mode, type PageDef, type ResolveContext,
} from './pages';
import { applyModeInitScript, expectMode } from './helpers/theme';
import { checkLayout } from './helpers/layout';
import { writeCellResult, type CellResult } from './helpers/results';
import { readAccessToken, supabaseEnv } from './helpers/env';

// Resolved once per worker; dynamic routes need the admin's access token.
let resolved: Map<string, string> | undefined;
async function routeFor(def: PageDef): Promise<string> {
  if (!resolved) resolved = new Map();
  const hit = resolved.get(def.key);
  if (hit) return hit;
  const ctx: ResolveContext = {
    request: await pwRequest.newContext(),
    ...supabaseEnv(),
    accessToken: readAccessToken(AUTH_STATE),
  };
  const route = await resolveRoute(def, ctx);
  await ctx.request.dispose();
  resolved.set(def.key, route);
  return route;
}

async function settle(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => { /* SPAs poll; proceed */ });
  await page.waitForTimeout(500);
}

for (const def of PAGES) {
  test.describe(def.key, () => {
    if (!def.authenticated) test.use({ storageState: { cookies: [], origins: [] } });

    for (const vp of VIEWPORTS) {
      for (const mode of MODES) {
        test.describe(`${vp.width}px ${mode}`, () => {
          test.use({ viewport: vp });

          test(`renders without layout break`, async ({ page }, testInfo) => {
            const engine = testInfo.project.name;
            const route = await routeFor(def);
            const result: CellResult = {
              page: def.key, route, engine, width: vp.width, height: vp.height, mode,
            };

            try {
              await applyModeInitScript(page, mode);
              await page.goto(route, { waitUntil: 'domcontentloaded' });
              if (def.authenticated) await expect(page).not.toHaveURL(/\/auth(\?|$)/, { timeout: 30_000 });
              await expectMode(page, mode);
              await settle(page);

              const rel = screenshotRelPath(def.key, engine, vp.width, mode);
              const abs = path.join(VERIFICATION_DIR, rel);
              fs.mkdirSync(path.dirname(abs), { recursive: true });
              await page.screenshot({ path: abs, fullPage: true, animations: 'disabled' });
              result.screenshot = rel;

              result.layout = await checkLayout(page);

              // Task 4 adds: result.axe = await runAxe(page, def.disabledAxeRules ?? []);
            } catch (e) {
              result.error = e instanceof Error ? e.message : String(e);
              throw e;
            } finally {
              writeCellResult('matrix', result);
            }

            expect.soft(result.layout?.passed, `layout offenders:\n${result.layout?.offenders.join('\n')}`).toBe(true);
          });
        });
      }
    }
  });
}
```

- [ ] **Step 5: Run a fast slice on chromium**

Run: `npx playwright test -c tests/design-system/playwright.design-system.config.ts --project=setup --project=chromium -g "leads-list|auth"`
Expected: 16 tests run (2 pages × 4 viewports × 2 modes) plus setup. Some layout assertions may fail — that is a *finding*, not a harness bug; the test still writes its cell JSON and screenshot. Check:

`ls docs/design-system/verification/screenshots/leads-list/` → 8 PNGs (`chromium-360-light.png` … `chromium-1920-dark.png`).
`ls test-results/design-system/data/` → 16 `matrix-*.json`.

Open `docs/design-system/verification/screenshots/leads-list/chromium-360-dark.png` and confirm it is actually dark and actually 360 wide (`node -e "const b=require('fs').readFileSync('docs/design-system/verification/screenshots/leads-list/chromium-360-dark.png');console.log(b.readUInt32BE(16))"` → `360`).

If `expectMode` fails on an authenticated page, the app is applying a server-side theme for this user; fix by clearing the saved theme for the E2E admin at `/dashboard/themes` (reset to default) rather than weakening the check.

- [ ] **Step 6: Commit**

```bash
git add tests/design-system/helpers/theme.ts tests/design-system/helpers/results.ts tests/design-system/helpers/layout.ts tests/design-system/matrix.spec.ts
git commit -m "test(design-system): matrix spec with screenshots and layout-integrity gate"
```
(Do **not** commit screenshots yet — Task 8 commits the full baseline in one go.)

---

### Task 4: axe-core WCAG gate

**Files:**
- Create: `tests/design-system/helpers/axe.ts`
- Modify: `tests/design-system/matrix.spec.ts` (fill the Task 4 slot)

**Interfaces:**
- Consumes: `AxeViolationSummary` (Task 3).
- Produces: `runAxe(page, disabledRules): Promise<CellResult['axe']>`.

- [ ] **Step 1: Create `helpers/axe.ts`**

```ts
import path from 'node:path';
import type { Page } from '@playwright/test';
import { REPO_ROOT } from '../pages';
import type { AxeViolationSummary, CellResult } from './results';

const AXE_PATH = path.join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js');
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const GATED: AxeViolationSummary['impact'][] = ['serious', 'critical'];

interface RawViolation {
  id: string;
  impact: AxeViolationSummary['impact'] | null;
  help: string;
  helpUrl: string;
  nodes: { target: string[] }[];
}

export async function runAxe(
  page: Page,
  disabledRules: { id: string; reason: string }[],
): Promise<NonNullable<CellResult['axe']>> {
  await page.addScriptTag({ path: AXE_PATH });
  const raw = await page.evaluate(
    async ([tags, disabled]) => {
      const rules: Record<string, { enabled: boolean }> = {};
      for (const id of disabled) rules[id] = { enabled: false };
      // @ts-expect-error axe is injected globally by addScriptTag
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, rules });
      return res.violations as RawViolation[];
    },
    [AXE_TAGS, disabledRules.map(r => r.id)] as const,
  );

  const violations: AxeViolationSummary[] = raw.map(v => ({
    id: v.id,
    impact: v.impact ?? 'minor',
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
    sampleTargets: v.nodes.slice(0, 3).map(n => n.target.join(' ')),
  }));

  return {
    passed: !violations.some(v => GATED.includes(v.impact)),
    violations,
    disabledRules,
  };
}
```

- [ ] **Step 2: Wire it into `matrix.spec.ts`**

Add the import:
```ts
import { runAxe } from './helpers/axe';
```
Replace the comment line `// Task 4 adds: …` with:
```ts
              result.axe = await runAxe(page, def.disabledAxeRules ?? []);
```
Add after the layout `expect.soft`:
```ts
            const gated = result.axe?.violations.filter(v => v.impact === 'serious' || v.impact === 'critical') ?? [];
            expect.soft(
              gated,
              `axe serious/critical:\n${gated.map(v => `${v.id} (${v.impact}, ${v.nodes} nodes): ${v.help}`).join('\n')}`,
            ).toEqual([]);
```

- [ ] **Step 3: Run the same chromium slice**

Run: `npx playwright test -c tests/design-system/playwright.design-system.config.ts --project=setup --project=chromium -g "leads-list|auth"`
Expected: runs; each `matrix-*.json` now has an `axe` block with a `violations` array (possibly non-empty — findings). Verify:

`node -e "const r=require('./test-results/design-system/data/matrix-leads-list-chromium-1280-light.json');console.log(r.axe.passed, r.axe.violations.map(v=>v.id+':'+v.impact))"`

- [ ] **Step 4: Commit**

```bash
git add tests/design-system/helpers/axe.ts tests/design-system/matrix.spec.ts
git commit -m "test(design-system): axe-core WCAG 2.1 AA gate on serious/critical violations"
```

---

### Task 5: Keyboard walk

**Files:**
- Create: `tests/design-system/helpers/focus.ts`
- Create: `tests/design-system/keyboard.spec.ts`

**Interfaces:**
- Consumes: `FocusStop`, `writeCellResult` (Task 3); `DESKTOP`, `PAGES` (Task 1); `routeFor` pattern from Task 3 (duplicated locally — specs must not import each other).
- Produces: `walkTabOrder(page, max): Promise<{ stops: FocusStop[]; failures: string[]; passed: boolean }>`.

- [ ] **Step 1: Create `helpers/focus.ts`**

```ts
import type { Page } from '@playwright/test';
import type { FocusStop } from './results';

/**
 * Spec §3.4. Presses Tab up to `max` times from <body>. Each stop must be
 * visible, show a visible focus indicator (outline, or a box-shadow that
 * differs from its unfocused value), and not sit inside aria-hidden. A repeat
 * visit to a non-first element before the sequence wraps is a focus trap.
 */
export async function walkTabOrder(
  page: Page,
  max = 40,
): Promise<{ stops: FocusStop[]; failures: string[]; passed: boolean }> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    document.querySelectorAll('[data-ds-walk]').forEach(el => el.removeAttribute('data-ds-walk'));
  });

  const stops: FocusStop[] = [];
  const failures: string[] = [];

  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate((index) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return { wrapped: true as const };
      const seen = el.getAttribute('data-ds-walk');
      if (seen !== null) return { repeat: Number(seen) as number };
      el.setAttribute('data-ds-walk', String(index));

      const focused = getComputedStyle(el);
      const focusedOutline = focused.outlineStyle !== 'none' && parseFloat(focused.outlineWidth) > 0;
      const focusedShadow = focused.boxShadow;
      // Blur/refocus the same element to read its unfocused box-shadow without moving the sequence.
      el.blur();
      const unfocusedShadow = getComputedStyle(el).boxShadow;
      el.focus({ preventScroll: true });
      const visibleFocus = focusedOutline || (focusedShadow !== 'none' && focusedShadow !== unfocusedShadow);

      const r = el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && focused.visibility !== 'hidden' && focused.opacity !== '0';
      const inAriaHidden = !!el.closest('[aria-hidden="true"]');
      const name =
        el.getAttribute('aria-label') ||
        (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent) ||
        (el as HTMLInputElement).labels?.[0]?.textContent ||
        el.textContent ||
        (el as HTMLInputElement).placeholder ||
        '';
      return {
        stop: {
          index,
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          name: name.trim().replace(/\s+/g, ' ').slice(0, 60),
          visibleFocus,
          visible,
          inAriaHidden,
        } as FocusStop,
      };
    }, i);

    if ('wrapped' in stop) break;
    if ('repeat' in stop) {
      if (stop.repeat === 0) break; // wrapped back to the first stop — sequence complete
      failures.push(`focus trap: returned to stop #${stop.repeat} at press ${i + 1}`);
      break;
    }
    stops.push(stop.stop);
    const s = stop.stop;
    if (!s.visible) failures.push(`stop #${s.index} <${s.tag}> "${s.name}" is not visible`);
    if (!s.visibleFocus) failures.push(`stop #${s.index} <${s.tag}> "${s.name}" has no visible focus indicator`);
    if (s.inAriaHidden) failures.push(`stop #${s.index} <${s.tag}> "${s.name}" is inside aria-hidden`);
  }

  if (stops.length === 0) failures.push('no element received focus');
  return { stops, failures, passed: failures.length === 0 };
}
```

- [ ] **Step 2: Create `keyboard.spec.ts`**

```ts
import { test, expect, request as pwRequest } from '@playwright/test';
import { AUTH_STATE, DESKTOP, PAGES, resolveRoute, type PageDef, type ResolveContext } from './pages';
import { applyModeInitScript, expectMode } from './helpers/theme';
import { walkTabOrder } from './helpers/focus';
import { writeCellResult, type CellResult } from './helpers/results';
import { readAccessToken, supabaseEnv } from './helpers/env';

let resolved: Map<string, string> | undefined;
async function routeFor(def: PageDef): Promise<string> {
  if (!resolved) resolved = new Map();
  const hit = resolved.get(def.key);
  if (hit) return hit;
  const ctx: ResolveContext = {
    request: await pwRequest.newContext(),
    ...supabaseEnv(),
    accessToken: readAccessToken(AUTH_STATE),
  };
  const route = await resolveRoute(def, ctx);
  await ctx.request.dispose();
  resolved.set(def.key, route);
  return route;
}

test.use({ viewport: DESKTOP });
// Same engine as chromium; nothing new to learn (spec §3.4).
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name === 'msedge', 'msedge shares chromium engine');
});

for (const def of PAGES) {
  test.describe(def.key, () => {
    if (!def.authenticated) test.use({ storageState: { cookies: [], origins: [] } });

    test('keyboard: visible focus, no traps', async ({ page }, testInfo) => {
      const route = await routeFor(def);
      const result: CellResult = {
        page: def.key, route, engine: testInfo.project.name,
        width: DESKTOP.width, height: DESKTOP.height, mode: 'light',
      };
      try {
        await applyModeInitScript(page, 'light');
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        if (def.authenticated) await expect(page).not.toHaveURL(/\/auth(\?|$)/, { timeout: 30_000 });
        await expectMode(page, 'light');
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
        await page.waitForTimeout(500);
        result.keyboard = await walkTabOrder(page, 40);
      } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        writeCellResult('keyboard', result);
      }
      expect.soft(result.keyboard?.passed, result.keyboard?.failures.join('\n')).toBe(true);
    });
  });
}
```

- [ ] **Step 3: Run on chromium for two pages**

Run: `npx playwright test -c tests/design-system/playwright.design-system.config.ts --project=setup --project=chromium keyboard.spec.ts -g "auth|dashboard"`
Expected: 2 tests run; `test-results/design-system/data/keyboard-auth-chromium-1280-light.json` has a `keyboard.stops` array with ≥3 entries each carrying `tag`, `name`, `visibleFocus`. Failures listed are findings for Plan 2.

Sanity check the trap detector does not false-positive: on `auth`, `stops.length` should be less than 40 and `failures` should not contain "focus trap" (the login page has a short sequence that wraps).

- [ ] **Step 4: Commit**

```bash
git add tests/design-system/helpers/focus.ts tests/design-system/keyboard.spec.ts
git commit -m "test(design-system): keyboard tab-walk with visible-focus and trap detection"
```

---

### Task 6: ARIA snapshot gate

**Files:**
- Create: `tests/design-system/helpers/aria.ts`
- Create: `tests/design-system/aria-gate.unit.test.ts`
- Create: `tests/design-system/aria.spec.ts`

**Interfaces:**
- Consumes: `ariaRelPath, VERIFICATION_DIR, DESKTOP, PAGES` (Task 1); `writeCellResult` (Task 3).
- Produces: `checkAriaSnapshot(yaml: string): { passed: boolean; failures: string[] }` (pure, unit-tested).

- [ ] **Step 1: Write the failing unit test**

`tests/design-system/aria-gate.unit.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { checkAriaSnapshot } from './helpers/aria';

const GOOD = `
- banner:
  - link "Home"
- main:
  - heading "Leads" [level=1]
  - button "New lead"
  - textbox "Search leads"
`;

describe('checkAriaSnapshot', () => {
  it('passes a well-formed page', () => {
    expect(checkAriaSnapshot(GOOD)).toEqual({ passed: true, failures: [] });
  });

  it('fails on zero or multiple h1', () => {
    expect(checkAriaSnapshot(GOOD.replace('[level=1]', '[level=2]')).failures).toContain('expected exactly one heading level=1, found 0');
    expect(checkAriaSnapshot(GOOD + '  - heading "Again" [level=1]\n').failures).toContain('expected exactly one heading level=1, found 2');
  });

  it('fails when there is no main landmark', () => {
    expect(checkAriaSnapshot(GOOD.replace('- main:', '- region:')).failures).toContain('no main landmark');
  });

  it('fails on unnamed interactive controls', () => {
    const r = checkAriaSnapshot(GOOD + '  - button\n  - link ""\n  - textbox\n');
    expect(r.failures).toContain('3 unnamed button/link/textbox controls');
    expect(r.passed).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/design-system/aria-gate.unit.test.ts`
Expected: FAIL — cannot resolve `./helpers/aria`.

- [ ] **Step 3: Create `helpers/aria.ts`**

```ts
/**
 * Spec §3.5 gate over a Playwright `ariaSnapshot()` (YAML-ish, one node per
 * line: `- role "name" [attrs]`). Pure so it can be unit-tested on fixtures.
 */
export function checkAriaSnapshot(yaml: string): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  const lines = yaml.split('\n').map(l => l.trim()).filter(l => l.startsWith('- '));

  const h1 = lines.filter(l => /^- heading\b/.test(l) && /\[level=1\]/.test(l)).length;
  if (h1 !== 1) failures.push(`expected exactly one heading level=1, found ${h1}`);

  if (!lines.some(l => /^- main\b/.test(l))) failures.push('no main landmark');

  const unnamed = lines.filter(l => {
    const m = /^- (button|link|textbox)\b(.*)$/.exec(l);
    if (!m) return false;
    const rest = m[2].trim();
    // Named nodes look like: `button "New lead"` or `button "New lead" [pressed]`.
    const name = /^"([^"]*)"/.exec(rest);
    return !name || name[1].trim() === '';
  }).length;
  if (unnamed > 0) failures.push(`${unnamed} unnamed button/link/textbox controls`);

  return { passed: failures.length === 0, failures };
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npx vitest run tests/design-system/aria-gate.unit.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Create `aria.spec.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { test, expect, request as pwRequest } from '@playwright/test';
import {
  AUTH_STATE, DESKTOP, PAGES, VERIFICATION_DIR, ariaRelPath, resolveRoute,
  type PageDef, type ResolveContext,
} from './pages';
import { applyModeInitScript, expectMode } from './helpers/theme';
import { checkAriaSnapshot } from './helpers/aria';
import { writeCellResult, type CellResult } from './helpers/results';
import { readAccessToken, supabaseEnv } from './helpers/env';

let resolved: Map<string, string> | undefined;
async function routeFor(def: PageDef): Promise<string> {
  if (!resolved) resolved = new Map();
  const hit = resolved.get(def.key);
  if (hit) return hit;
  const ctx: ResolveContext = {
    request: await pwRequest.newContext(),
    ...supabaseEnv(),
    accessToken: readAccessToken(AUTH_STATE),
  };
  const route = await resolveRoute(def, ctx);
  await ctx.request.dispose();
  resolved.set(def.key, route);
  return route;
}

test.use({ viewport: DESKTOP });

for (const def of PAGES) {
  test.describe(def.key, () => {
    if (!def.authenticated) test.use({ storageState: { cookies: [], origins: [] } });

    test('aria: one h1, main landmark, named controls', async ({ page }, testInfo) => {
      const engine = testInfo.project.name;
      const route = await routeFor(def);
      const result: CellResult = {
        page: def.key, route, engine, width: DESKTOP.width, height: DESKTOP.height, mode: 'light',
      };
      try {
        await applyModeInitScript(page, 'light');
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        if (def.authenticated) await expect(page).not.toHaveURL(/\/auth(\?|$)/, { timeout: 30_000 });
        await expectMode(page, 'light');
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
        await page.waitForTimeout(500);

        const snapshot = await page.locator('body').ariaSnapshot();
        const rel = ariaRelPath(def.key, engine);
        const abs = path.join(VERIFICATION_DIR, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, snapshot);

        const gate = checkAriaSnapshot(snapshot);
        result.aria = { ...gate, snapshot: rel };
      } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        writeCellResult('aria', result);
      }
      expect.soft(result.aria?.passed, result.aria?.failures.join('\n')).toBe(true);
    });
  });
}
```

- [ ] **Step 6: Run on chromium for two pages**

Run: `npx playwright test -c tests/design-system/playwright.design-system.config.ts --project=setup --project=chromium aria.spec.ts -g "auth|leads-list"`
Expected: 2 tests run; `docs/design-system/verification/aria/auth-chromium.yaml` and `leads-list-chromium.yaml` exist and contain `- main` and `- heading … [level=1]` lines (the README says both are present on audited pages; if a gate fails here it is a Plan 2 finding).

- [ ] **Step 7: Commit**

```bash
git add tests/design-system/helpers/aria.ts tests/design-system/aria-gate.unit.test.ts tests/design-system/aria.spec.ts
git commit -m "test(design-system): ARIA snapshot gate (h1 count, main landmark, named controls)"
```

---

### Task 7: Report generator

**Files:**
- Create: `docs/design-system/verification/generate-report.mjs`
- Create: `docs/design-system/verification/report.unit.test.mjs`

**Interfaces:**
- Consumes: the `CellResult` JSON shape from Task 3 (`test-results/design-system/data/<kind>-*.json`).
- Produces: `buildReport(cells, meta): string` (exported), CLI writing `REPORT.md`.

- [ ] **Step 1: Write the failing unit test**

`docs/design-system/verification/report.unit.test.mjs`:
```js
import { describe, it, expect } from 'vitest';
import { buildReport } from './generate-report.mjs';

const meta = { date: '2026-09-13', commit: 'abc1234', engines: { chromium: '142.0', firefox: '145.0', webkit: '26.0', msedge: '142.0' } };

const cells = [
  { kind: 'matrix', page: 'leads-list', route: '/dashboard/leads', engine: 'chromium', width: 360, height: 800, mode: 'light',
    screenshot: 'screenshots/leads-list/chromium-360-light.png',
    layout: { passed: false, offenders: ['div.toolbar right=412 > 360'] },
    axe: { passed: true, violations: [{ id: 'region', impact: 'moderate', help: 'All page content should be contained by landmarks', helpUrl: 'https://x', nodes: 2, sampleTargets: ['div.foo'] }], disabledRules: [] } },
  { kind: 'matrix', page: 'leads-list', route: '/dashboard/leads', engine: 'firefox', width: 360, height: 800, mode: 'light',
    screenshot: 'screenshots/leads-list/firefox-360-light.png',
    layout: { passed: true, offenders: [] },
    axe: { passed: false, violations: [{ id: 'color-contrast', impact: 'serious', help: 'Elements must meet minimum color contrast ratio thresholds', helpUrl: 'https://y', nodes: 1, sampleTargets: ['span.badge'] }], disabledRules: [] } },
  { kind: 'matrix', page: 'leads-list', route: '/dashboard/leads', engine: 'webkit', width: 360, height: 800, mode: 'light',
    screenshot: 'screenshots/leads-list/webkit-360-light.png',
    layout: { passed: true, offenders: [] },
    axe: { passed: true, violations: [], disabledRules: [] } },
  { kind: 'keyboard', page: 'leads-list', route: '/dashboard/leads', engine: 'chromium', width: 1280, height: 800, mode: 'light',
    keyboard: { passed: false, stops: [{ index: 0, tag: 'a', role: null, name: 'Skip to content', visibleFocus: true, visible: true, inAriaHidden: false }], failures: ['stop #3 <button> "Filter" has no visible focus indicator'] } },
  { kind: 'aria', page: 'leads-list', route: '/dashboard/leads', engine: 'chromium', width: 1280, height: 800, mode: 'light',
    aria: { passed: true, failures: [], snapshot: 'aria/leads-list-chromium.yaml' } },
];

describe('buildReport', () => {
  const md = buildReport(cells, meta);

  it('states what stood in for Safari and screen readers', () => {
    expect(md).toMatch(/WebKit.*Safari/i);
    expect(md).toMatch(/not a .*screen[- ]reader/i);
  });

  it('renders a matrix row per page with pass/fail cells linking screenshots', () => {
    expect(md).toContain('| leads-list |');
    expect(md).toContain('[❌](screenshots/leads-list/chromium-360-light.png)'); // layout gate failed
    expect(md).toContain('[❌](screenshots/leads-list/firefox-360-light.png)');  // axe serious failed
    expect(md).toContain('[✅](screenshots/leads-list/webkit-360-light.png)');
  });

  it('groups axe violations by rule with impact and affected cells', () => {
    expect(md).toMatch(/color-contrast.*serious.*leads-list.*firefox/s);
    expect(md).toMatch(/region.*moderate/s);
  });

  it('lists layout offenders, keyboard failures and aria results', () => {
    expect(md).toContain('div.toolbar right=412 > 360');
    expect(md).toContain('has no visible focus indicator');
    expect(md).toContain('aria/leads-list-chromium.yaml');
  });

  it('highlights engine divergence when a gate passes in one engine and fails in another', () => {
    expect(md).toMatch(/Engine-specific divergences[\s\S]*\*\*leads-list\*\* 360px light: passes in webkit; fails in chromium, firefox/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run docs/design-system/verification/report.unit.test.mjs`
Expected: FAIL — cannot resolve `./generate-report.mjs`.

(If vitest does not pick the file up because `docs` is not in its roots, add `'docs/design-system/verification/**/*.unit.test.mjs'` to `include` in `vitest.config.ts` alongside the default pattern: `include: [...configDefaults.include, 'docs/design-system/verification/**/*.unit.test.mjs']`.)

- [ ] **Step 3: Create `generate-report.mjs`**

```js
#!/usr/bin/env node
// Turns the harness's cell JSON (test-results/design-system/data/*.json) into
// docs/design-system/verification/REPORT.md. Pure `buildReport` + thin CLI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const DATA_DIR = path.join(REPO_ROOT, 'test-results', 'design-system', 'data');
const OUT = path.join(HERE, 'REPORT.md');

const ENGINES = ['chromium', 'firefox', 'webkit', 'msedge'];
const WIDTHS = [360, 768, 1280, 1920];
const MODES = ['light', 'dark'];

const cellPassed = c => (c.layout?.passed ?? true) && (c.axe?.passed ?? true) && !c.error;

export function buildReport(cells, meta) {
  const matrix = cells.filter(c => c.kind === 'matrix');
  const keyboard = cells.filter(c => c.kind === 'keyboard');
  const aria = cells.filter(c => c.kind === 'aria');
  const pages = [...new Set(cells.map(c => c.page))];
  const L = [];

  L.push('# Design System Verification Report');
  L.push('');
  L.push(`Generated ${meta.date} at commit \`${meta.commit}\` by \`npm run audit:design-system\`. **Do not edit by hand.**`);
  L.push('');
  L.push('## What this is — and is not');
  L.push('');
  L.push('- **Engines:** ' + ENGINES.map(e => `${e} ${meta.engines?.[e] ?? '?'}`).join(', ') + '.');
  L.push('- **WebKit stands in for Safari.** Same engine, but not Safari\'s shell, OS font stack, or iOS; a real Safari pass is still an open item.');
  L.push('- **ARIA snapshots are structure only** — this is not a screen-reader session (NVDA/JAWS/VoiceOver were not run); it catches missing names and landmarks, not announcement order or live regions.');
  L.push('- **Viewports** are emulated at 360/768/1280/1920; no real devices.');
  L.push('- Gates: layout integrity (no page-level horizontal scroll, no unscrolled overflow), axe-core WCAG 2.1 A/AA `serious`+`critical`, keyboard visible-focus/no-trap (1280 light), ARIA structure (1280 light). axe `moderate`/`minor` are reported, not gated.');
  L.push('');
  L.push('## Running');
  L.push('');
  L.push('```bash');
  L.push('# needs E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in the gitignored repo-root `env` file');
  L.push('npm run audit:design-system          # all 4 engines');
  L.push('npm run audit:design-system:quick    # chromium only');
  L.push('```');
  L.push('');

  for (const mode of MODES) {
    L.push(`## Matrix — ${mode} mode`);
    L.push('');
    L.push('Cell = layout + axe gates for that page/engine/width. Click to open the screenshot.');
    L.push('');
    L.push('| Page | ' + ENGINES.flatMap(e => WIDTHS.map(w => `${e} ${w}`)).join(' | ') + ' |');
    L.push('|---|' + ENGINES.flatMap(() => WIDTHS.map(() => '---')).join('|') + '|');
    for (const p of pages) {
      const row = ENGINES.flatMap(e => WIDTHS.map(w => {
        const c = matrix.find(x => x.page === p && x.engine === e && x.width === w && x.mode === mode);
        if (!c) return '—';
        const mark = cellPassed(c) ? '✅' : '❌';
        return c.screenshot ? `[${mark}](${c.screenshot})` : mark;
      }));
      L.push(`| ${p} | ${row.join(' | ')} |`);
    }
    L.push('');
  }

  L.push('## axe-core violations by rule');
  L.push('');
  const byRule = new Map();
  for (const c of matrix) for (const v of c.axe?.violations ?? []) {
    const k = v.id;
    if (!byRule.has(k)) byRule.set(k, { ...v, cells: [] });
    byRule.get(k).cells.push(`${c.page}/${c.engine}/${c.width}/${c.mode}`);
  }
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  const rules = [...byRule.values()].sort((a, b) => order[a.impact] - order[b.impact] || b.cells.length - a.cells.length);
  if (!rules.length) L.push('_None._');
  for (const r of rules) {
    L.push(`### \`${r.id}\` — ${r.impact}${order[r.impact] <= 1 ? ' (gated)' : ''}`);
    L.push('');
    L.push(`${r.help} ([rule](${r.helpUrl}))`);
    L.push('');
    L.push(`Affected cells (${r.cells.length}): ${r.cells.slice(0, 24).join(', ')}${r.cells.length > 24 ? ', …' : ''}`);
    if (r.sampleTargets?.length) L.push(`Sample targets: \`${r.sampleTargets.join('`, `')}\``);
    L.push('');
  }
  const disabled = [...new Set(matrix.flatMap(c => (c.axe?.disabledRules ?? []).map(d => `\`${d.id}\` on ${c.page}: ${d.reason}`)))];
  if (disabled.length) { L.push('Disabled rules:'); for (const d of disabled) L.push(`- ${d}`); L.push(''); }

  L.push('## Layout failures');
  L.push('');
  const layoutFails = matrix.filter(c => c.layout && !c.layout.passed);
  if (!layoutFails.length) L.push('_None._');
  for (const c of layoutFails) {
    L.push(`- **${c.page}** ${c.engine} ${c.width}px ${c.mode}:`);
    for (const o of c.layout.offenders) L.push(`  - \`${o}\``);
  }
  L.push('');

  L.push('## Keyboard walk (1280, light)');
  L.push('');
  L.push('| Page | Engine | Stops | Result | First failure |');
  L.push('|---|---|---|---|---|');
  for (const c of keyboard) {
    const k = c.keyboard;
    L.push(`| ${c.page} | ${c.engine} | ${k?.stops.length ?? 0} | ${k?.passed ? '✅' : '❌'} | ${k?.failures[0] ?? c.error ?? ''} |`);
  }
  L.push('');
  for (const c of keyboard) {
    if (!c.keyboard) continue;
    L.push(`<details><summary>${c.page} / ${c.engine} — tab order (${c.keyboard.stops.length} stops)</summary>`);
    L.push('');
    for (const s of c.keyboard.stops) L.push(`${s.index + 1}. \`${s.tag}${s.role ? `[role=${s.role}]` : ''}\` ${s.name || '_(unnamed)_'}${s.visibleFocus ? '' : ' — **no visible focus**'}`);
    for (const f of c.keyboard.failures) L.push(`- ❌ ${f}`);
    L.push('');
    L.push('</details>');
    L.push('');
  }

  L.push('## ARIA structure (1280, light)');
  L.push('');
  L.push('| Page | Engine | Result | Failures | Snapshot |');
  L.push('|---|---|---|---|---|');
  for (const c of aria) {
    const a = c.aria;
    L.push(`| ${c.page} | ${c.engine} | ${a?.passed ? '✅' : '❌'} | ${a?.failures.join('; ') ?? c.error ?? ''} | ${a ? `[yaml](${a.snapshot})` : ''} |`);
  }
  L.push('');

  L.push('## Engine-specific divergences');
  L.push('');
  L.push('A gate that passes in at least one engine and fails in another for the same page/width/mode — the cross-browser findings.');
  L.push('');
  const groups = new Map();
  for (const c of matrix) {
    const k = `${c.page}|${c.width}|${c.mode}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  let any = false;
  for (const [k, cs] of groups) {
    const pass = cs.filter(cellPassed).map(c => c.engine);
    const fail = cs.filter(c => !cellPassed(c)).map(c => c.engine);
    if (pass.length && fail.length) {
      any = true;
      const [page, width, mode] = k.split('|');
      L.push(`- **${page}** ${width}px ${mode}: passes in ${pass.join(', ')}; fails in ${fail.join(', ')}`);
    }
  }
  if (!any) L.push('_None — every failure reproduces in all engines._');
  L.push('');

  const errored = cells.filter(c => c.error);
  if (errored.length) {
    L.push('## Cells that did not complete');
    L.push('');
    for (const c of errored) L.push(`- ${c.kind} ${c.page}/${c.engine}/${c.width}/${c.mode}: \`${c.error.split('\n')[0]}\``);
    L.push('');
  }

  return L.join('\n');
}

function loadCells() {
  if (!fs.existsSync(DATA_DIR)) throw new Error(`${DATA_DIR} not found — run the Playwright suite first.`);
  return fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).map(f => {
    const kind = f.split('-')[0];
    return { kind, ...JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')) };
  });
}

function engineVersions() {
  const out = {};
  try {
    const pw = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'node_modules', 'playwright-core', 'browsers.json'), 'utf8'));
    for (const b of pw.browsers) if (['chromium', 'firefox', 'webkit'].includes(b.name)) out[b.name] = b.browserVersion;
  } catch { /* leave unknown */ }
  out.msedge = 'system channel';
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { execSync } = await import('node:child_process');
  const commit = execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim();
  const md = buildReport(loadCells(), { date: new Date().toISOString().slice(0, 10), commit, engines: engineVersions() });
  fs.writeFileSync(OUT, md + '\n');
  console.log(`wrote ${path.relative(REPO_ROOT, OUT)}`);
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npx vitest run docs/design-system/verification/report.unit.test.mjs`
Expected: 5 passed.

- [ ] **Step 5: Generate from the real chromium data already on disk**

Run: `node docs/design-system/verification/generate-report.mjs`
Expected: `wrote docs/design-system/verification/REPORT.md`; open it — matrix tables show ✅/❌ for the chromium cells produced in Tasks 3–6, `—` elsewhere.

- [ ] **Step 6: Commit (generator + test only)**

```bash
git add docs/design-system/verification/generate-report.mjs docs/design-system/verification/report.unit.test.mjs vitest.config.ts
git commit -m "test(design-system): REPORT.md generator from harness cell results"
```

---

### Task 8: Full baseline run, commit evidence, update README

**Files:**
- Create: `docs/design-system/verification/REPORT.md`, `screenshots/**`, `aria/**` (generated)
- Modify: `docs/design-system/README.md` §5.5, §6.2, Appendix B

**Interfaces:**
- Consumes: everything above.
- Produces: the committed "before" baseline that Plan 2 diffs against.

- [ ] **Step 1: Clear stale data and run the full matrix**

```bash
rm -rf test-results/design-system docs/design-system/verification/screenshots docs/design-system/verification/aria
npm run audit:design-system
```
Expected: (10 pages × 4 widths × 2 modes × 4 engines) matrix + (10 × 4) keyboard (10 of them skipped on msedge) + (10 × 4) aria = 400 tests, 390 producing cell JSON. Failures are expected — they are the findings. Runtime is tens of minutes; use a 600000 ms timeout or run in the background.

If Firefox or WebKit fails to *launch* (not a page failure), run `npx playwright install firefox webkit` and rerun only that project: `npx playwright test -c tests/design-system/playwright.design-system.config.ts --project=setup --project=webkit`. If `msedge` fails to launch, confirm `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"` exists; Playwright uses the system install for the `msedge` channel.

- [ ] **Step 2: Verify evidence completeness**

```bash
find docs/design-system/verification/screenshots -name "*.png" | wc -l   # expect 320 (10×4×2×4); fewer = cells that errored, listed in REPORT.md
find docs/design-system/verification/aria -name "*.yaml" | wc -l         # expect 40
ls test-results/design-system/data | wc -l                                # expect 390
grep -c "❌" docs/design-system/verification/REPORT.md                    # the finding count — record it
```
Open `REPORT.md` and spot-check: one `webkit 360` screenshot is genuinely narrow and one `firefox … dark` is genuinely dark. If every dark cell is light, `expectMode` was bypassed — stop and fix `helpers/theme.ts`, do not commit.

- [ ] **Step 3: Update README §5.5 and §6.2**

In `docs/design-system/README.md` replace the body of **§5.5 What was not verified — read this** with:
```markdown
Runtime verification now lives in [`verification/REPORT.md`](verification/REPORT.md), regenerated by `npm run audit:design-system` (see [Appendix A](#appendix-a--re-running-the-audits)). It covers axe-core WCAG 2.1 A/AA, a keyboard tab-walk (visible focus, no traps, recorded order), and ARIA structure snapshots across chromium, firefox, webkit and msedge.

Still **not** verified, and stated in the report itself:
- **No screen-reader runtime testing.** ARIA snapshots prove structure (names, landmarks, one `h1`), not announcement order or live regions. NVDA/JAWS/VoiceOver remain an open item.
- **No user testing of any kind** — Plan 3 of the 2026-09-13 spec adds the instrument; nothing here is based on user feedback yet.
```

Replace the body of **§6.2 What was not verified — read this** with:
```markdown
Screenshot evidence at 360 / 768 / 1280 / 1920, light and dark, for four engines is committed under [`verification/screenshots/`](verification/screenshots/) and indexed in [`verification/REPORT.md`](verification/REPORT.md). The layout gate fails a cell on page-level horizontal scroll or any element overflowing the viewport outside a horizontally scrolling container.

Still **not** verified:
- **Real Safari.** WebKit on Windows is the engine proxy; Safari's shell, font stack and iOS behaviour are not covered.
- **Real devices.** Viewports are emulated.
```

Rename **Appendix A — Re-running the contrast audit** to **Appendix A — Re-running the audits** and append:
```markdown
```bash
npm run audit:design-system          # full matrix, all engines (tens of minutes)
npm run audit:design-system:quick    # chromium only
```
Requires `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` in the gitignored repo-root `env` file. Writes `verification/REPORT.md`, `verification/screenshots/`, `verification/aria/`; commit them with the change they verify. The suite lives in `tests/design-system/` with its own Playwright config.
```

In **Appendix B**, replace the three lines
```
- Screen-reader runtime pass.
- Cross-browser verification on Firefox, Safari, Edge.
- Screenshot-verified rendering at 360 / 768 / 1920.
```
with
```
- Screen-reader runtime pass (structure is now snapshot-verified; announcement behaviour is not).
- Real Safari and real devices (WebKit engine and emulated viewports are verified — see `verification/REPORT.md`).
- Findings from the baseline verification run (`verification/REPORT.md` at this commit) — addressed in Plan 2 of the 2026-09-13 spec.
```

Also fix the two intra-doc links that pointed at `#appendix-a--re-running-the-contrast-audit` → `#appendix-a--re-running-the-audits`.

- [ ] **Step 4: Run the unit tests and lint once more**

Run: `npx vitest run tests/design-system docs/design-system/verification && npx eslint tests/design-system`
Expected: all unit tests pass; no lint errors (fix any `@typescript-eslint` complaints in the harness files rather than disabling rules).

- [ ] **Step 5: Commit the baseline**

```bash
git add docs/design-system/verification docs/design-system/README.md
git commit -m "docs(design-system): baseline verification report, screenshots and ARIA snapshots

Full harness run across chromium/firefox/webkit/msedge x 360/768/1280/1920 x
light/dark on the 10 CRM-core pages. Failures in REPORT.md are the findings
Plan 2 addresses; this commit is the 'before'. README 5.5/6.2/Appendix B now
point at the report and list what still stands in for Safari, devices and
screen readers."
```

- [ ] **Step 6: Report the finding count**

Tell the user: total cells, ❌ count, top 5 axe rules by affected cells, layout-failing pages at 360, keyboard pages with no-visible-focus stops, and any engine-specific divergences. That list seeds Plan 2's task list.
