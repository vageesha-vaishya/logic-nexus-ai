import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { DESKTOP, PAGES, VERIFICATION_DIR, ariaRelPath } from './pages';
import { applyModeInitScript, expectMode } from './helpers/theme';
import { expectPageBooted, settle } from './helpers/ready';
import { checkAriaSnapshot } from './helpers/aria';
import { runCell } from './helpers/results';

test.use({ viewport: DESKTOP });

for (const def of PAGES) {
  test.describe(def.key, () => {
    if (!def.authenticated) test.use({ storageState: { cookies: [], origins: [] } });

    test('aria: one h1, main landmark, named controls', async ({ page }, testInfo) => {
      const engine = testInfo.project.name;
      const result = await runCell(
        'aria',
        def,
        { page: def.key, engine, width: DESKTOP.width, height: DESKTOP.height, mode: 'light' },
        async (cell, route) => {
          await applyModeInitScript(page, 'light');
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          await settle(page);
          cell.mainTextLength = await expectPageBooted(page, def.authenticated);
          await expectMode(page, 'light');

          const snapshot = await page.locator('body').ariaSnapshot();
          await expectMode(page, 'light'); // re-assert: a theme flip during the snapshot must be an error cell, not a pass
          const rel = ariaRelPath(def.key, engine);
          const abs = path.join(VERIFICATION_DIR, rel);
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, snapshot);

          const gate = checkAriaSnapshot(snapshot);
          cell.aria = { ...gate, snapshot: rel };
        },
      );
      expect.soft(result.aria?.passed, result.aria?.failures.join('\n')).toBe(true);
    });
  });
}
