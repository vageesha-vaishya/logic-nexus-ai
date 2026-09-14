import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { MODES, PAGES, VIEWPORTS, VERIFICATION_DIR, screenshotRelPath } from './pages';
import { applyModeInitScript, expectMode } from './helpers/theme';
import { expectPageBooted, settle } from './helpers/ready';
import { checkLayout } from './helpers/layout';
import { runAxe } from './helpers/axe';
import { runCell, type CellResult } from './helpers/results';

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
            const result = await runCell(
              'matrix',
              def,
              { page: def.key, engine, width: vp.width, height: vp.height, mode },
              async (cell, route) => {
                await applyModeInitScript(page, mode);
                await page.goto(route, { waitUntil: 'domcontentloaded' });
                await settle(page);
                cell.mainTextLength = await expectPageBooted(page, def.authenticated);
                await expectMode(page, mode);

                const rel = screenshotRelPath(def.key, engine, vp.width, mode);
                const abs = path.join(VERIFICATION_DIR, rel);
                fs.mkdirSync(path.dirname(abs), { recursive: true });
                cell.scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
                await expectMode(page, mode); // re-assert: a late theme flip must not be captured as a pass
                cell.screenshotMode = await screenshot(page, abs);
                cell.screenshot = rel;

                cell.layout = await checkLayout(page);

                cell.axe = await runAxe(page, def.disabledAxeRules ?? []);
              },
            );

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
