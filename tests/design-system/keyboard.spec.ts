import { test, expect } from '@playwright/test';
import { DESKTOP, PAGES } from './pages';
import { applyModeInitScript, expectMode } from './helpers/theme';
import { walkTabOrder } from './helpers/focus';
import { writeCellResult, type CellResult } from './helpers/results';
import { routeFor } from './helpers/route';

test.use({ viewport: DESKTOP });

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
