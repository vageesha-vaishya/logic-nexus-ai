import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { MODES, PAGES, VIEWPORTS, VERIFICATION_DIR, screenshotRelPath } from './pages';
import { applyModeInitScript, expectMode } from './helpers/theme';
import { checkLayout } from './helpers/layout';
import { runAxe } from './helpers/axe';
import { writeCellResult, type CellResult } from './helpers/results';
import { routeFor } from './helpers/route';

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

              result.axe = await runAxe(page, def.disabledAxeRules ?? []);
            } catch (e) {
              result.error = e instanceof Error ? e.message : String(e);
              throw e;
            } finally {
              writeCellResult('matrix', result);
            }

            expect.soft(result.layout?.passed, `layout offenders:\n${result.layout?.offenders.join('\n')}`).toBe(true);

            const gated = result.axe?.violations.filter(v => v.impact === 'serious' || v.impact === 'critical') ?? [];
            expect.soft(
              gated,
              `axe serious/critical:\n${gated.map(v => `${v.id} (${v.impact}, ${v.nodes} nodes): ${v.help}`).join('\n')}`,
            ).toEqual([]);
          });
        });
      }
    }
  });
}
