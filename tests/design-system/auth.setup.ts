import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';
import { AUTH_STATE, PAGES, ROUTES_FILE, resolveRoute, type ResolveContext } from './pages';
import { readAccessToken, requireEnv, supabaseEnv } from './helpers/env';

setup('authenticate as E2E admin', async ({ page, request }) => {
  const email = requireEnv('E2E_ADMIN_EMAIL');
  const password = requireEnv('E2E_ADMIN_PASSWORD');

  await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('login-btn').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
  // Wait until the session has actually been persisted, not just the redirect.
  await expect
    .poll(() => page.evaluate(() => Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k))), { timeout: 15_000 })
    .toBe(true);

  fs.mkdirSync(path.dirname(AUTH_STATE), { recursive: true });
  await page.context().storageState({ path: AUTH_STATE });

  // Resolve dynamic routes now, while the token is fresh; specs read ROUTES_FILE
  // instead of calling the API (a late engine would otherwise hit an expired JWT).
  const ctx: ResolveContext = { request, ...supabaseEnv(), accessToken: readAccessToken(AUTH_STATE) };
  const routes: Record<string, string> = {};
  for (const def of PAGES) {
    if (typeof def.route !== 'string') routes[def.key] = await resolveRoute(def, ctx);
  }
  fs.writeFileSync(ROUTES_FILE, JSON.stringify(routes, null, 2));
});
