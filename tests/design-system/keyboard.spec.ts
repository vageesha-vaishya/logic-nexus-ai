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
