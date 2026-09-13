import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { DESKTOP, PAGES, VERIFICATION_DIR, ariaRelPath } from './pages';
import { applyModeInitScript, expectMode } from './helpers/theme';
import { expectPageBooted } from './helpers/ready';
import { checkAriaSnapshot } from './helpers/aria';
import { routeFor } from './helpers/route';
import { writeCellResult, type CellResult } from './helpers/results';

test.use({ viewport: DESKTOP });

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { /* SPAs poll; proceed */ });
  await page.waitForTimeout(500);
}

for (const def of PAGES) {
  test.describe(def.key, () => {
    if (!def.authenticated) test.use({ storageState: { cookies: [], origins: [] } });

    test('aria: one h1, main landmark, named controls', async ({ page }, testInfo) => {
      const engine = testInfo.project.name;
      const result: CellResult = {
        page: def.key, route: typeof def.route === 'string' ? def.route : def.key, engine,
        width: DESKTOP.width, height: DESKTOP.height, mode: 'light',
      };
      try {
        const route = routeFor(def);
        result.route = route;
        await applyModeInitScript(page, 'light');
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await settle(page);
        await expectPageBooted(page, def.authenticated);
        await expectMode(page, 'light');

        await expectMode(page, 'light'); // re-assert right before the snapshot (late theme flip = error cell)
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
