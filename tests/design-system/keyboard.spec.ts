import { test, expect, type Page } from '@playwright/test';
import { DESKTOP, PAGES, type PageDef } from './pages';
import { applyModeInitScript, expectMode } from './helpers/theme';
import { expectPageBooted, settle } from './helpers/ready';
import { walkTabOrder } from './helpers/focus';
import { runCell } from './helpers/results';

test.use({ viewport: DESKTOP });

/** One keyboard cell. `cellPage` is the report row label; `firstRun` leaves the onboarding tour on. */
async function keyboardCell(page: Page, engine: string, def: PageDef, cellPage: string, firstRun: boolean) {
  const result = await runCell(
    'keyboard',
    def,
    { page: cellPage, engine, width: DESKTOP.width, height: DESKTOP.height, mode: 'light' },
    async (cell, route) => {
      await applyModeInitScript(page, 'light', { firstRun });
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await settle(page);
      cell.mainTextLength = await expectPageBooted(page, def.authenticated);
      await expectMode(page, 'light');
      cell.keyboard = await walkTabOrder(page, 40, { engine });
      await expectMode(page, 'light'); // re-assert: a theme flip during the walk must be an error cell, not a pass
    },
  );
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
