import { test, expect, type Page } from '@playwright/test';
import { DESKTOP, PAGES, type PageDef } from './pages';
import { applyModeInitScript, expectMode } from './helpers/theme';
import { expectPageBooted } from './helpers/ready';
import { walkTabOrder } from './helpers/focus';
import { writeCellResult, type CellResult } from './helpers/results';
import { routeFor } from './helpers/route';

test.use({ viewport: DESKTOP });

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { /* SPAs poll; proceed */ });
  await page.waitForTimeout(500);
}

/** One keyboard cell. `cellPage` is the report row label; `firstRun` leaves the onboarding tour on. */
async function keyboardCell(page: Page, engine: string, def: PageDef, cellPage: string, firstRun: boolean) {
  const result: CellResult = {
    page: cellPage, route: typeof def.route === 'string' ? def.route : def.key, engine,
    width: DESKTOP.width, height: DESKTOP.height, mode: 'light',
  };
  try {
    const route = routeFor(def);
    result.route = route;
    await applyModeInitScript(page, 'light', { firstRun });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await expectPageBooted(page, def.authenticated);
    await expectMode(page, 'light');
    await expectMode(page, 'light'); // re-assert right before the walk (late theme flip = error cell)
    result.keyboard = await walkTabOrder(page, 40);
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    writeCellResult('keyboard', result);
  }
  expect.soft(result.keyboard?.passed, result.keyboard?.failures.join('\n')).toBe(true);
}

for (const def of PAGES) {
  test.describe(def.key, () => {
    if (!def.authenticated) test.use({ storageState: { cookies: [], origins: [] } });

    test('keyboard: visible focus, no traps', async ({ page }, testInfo) => {
      await keyboardCell(page, testInfo.project.name, def, def.key, false);
    });
  });
}

// The Joyride onboarding tour (src/components/system/OnboardingTour.tsx) is a
// real finding — a 2-stop focus trap on first run — but it would otherwise mask
// every authenticated page's own tab order, so it gets exactly one row of its own.
test.describe('dashboard-onboarding', () => {
  const dashboard = PAGES.find(p => p.key === 'dashboard')!;
  test('keyboard: onboarding tour as a first-run user', async ({ page }, testInfo) => {
    await keyboardCell(page, testInfo.project.name, dashboard, 'dashboard-onboarding', true);
  });
});
