import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { MODES, PAGES, VIEWPORTS, VERIFICATION_DIR, screenshotRelPath } from './pages';
import { applyModeInitScript, expectMode } from './helpers/theme';
import { expectPageBooted } from './helpers/ready';
import { checkLayout } from './helpers/layout';
import { runAxe } from './helpers/axe';
import { writeCellResult, type CellResult } from './helpers/results';
import { routeFor } from './helpers/route';

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { /* SPAs poll; proceed */ });
  await page.waitForTimeout(500);
}

/** Full-page capture; Firefox refuses anything taller than 32767px, so fall back to the viewport. */
async function screenshot(page: Page, abs: string): Promise<NonNullable<CellResult['screenshotMode']>> {
  try {
    await page.screenshot({ path: abs, fullPage: true, animations: 'disabled' });
    return 'full';
  } catch (e) {
    if (!/larger than 32767/i.test(e instanceof Error ? e.message : String(e))) throw e;
    await page.screenshot({ path: abs, fullPage: false, animations: 'disabled' });
    return 'viewport';
  }
}

for (const def of PAGES) {
  test.describe(def.key, () => {
    if (!def.authenticated) test.use({ storageState: { cookies: [], origins: [] } });

    for (const vp of VIEWPORTS) {
      for (const mode of MODES) {
        test.describe(`${vp.width}px ${mode}`, () => {
          test.use({ viewport: vp });

          test(`renders without layout break`, async ({ page }, testInfo) => {
            test.setTimeout(240_000); // Firefox axe runs on the dense tables need the headroom
            const engine = testInfo.project.name;
            const result: CellResult = {
              page: def.key,
              route: typeof def.route === 'string' ? def.route : def.key,
              engine, width: vp.width, height: vp.height, mode,
            };

            try {
              const route = routeFor(def);
              result.route = route;
              await applyModeInitScript(page, mode);
              await page.goto(route, { waitUntil: 'domcontentloaded' });
              await settle(page);
              await expectPageBooted(page, def.authenticated);
              await expectMode(page, mode);

              const rel = screenshotRelPath(def.key, engine, vp.width, mode);
              const abs = path.join(VERIFICATION_DIR, rel);
              fs.mkdirSync(path.dirname(abs), { recursive: true });
              result.scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
              result.screenshotMode = await screenshot(page, abs);
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
