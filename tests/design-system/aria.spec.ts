import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { DESKTOP, PAGES, VERIFICATION_DIR, ariaRelPath } from './pages';
import { applyModeInitScript, expectMode } from './helpers/theme';
import { checkAriaSnapshot } from './helpers/aria';
import { routeFor } from './helpers/route';
import { writeCellResult, type CellResult } from './helpers/results';

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
