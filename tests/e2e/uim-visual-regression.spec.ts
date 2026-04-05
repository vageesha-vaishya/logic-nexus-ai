import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'Bahuguna.vimal@gmail.com';
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Vimal@1234';
const ARTIFACT_DIR = 'artifacts/mro/analysis/uim-visual-regression';
const ENABLE_STRICT_VISUAL_ASSERT = process.env.PW_VISUAL_ASSERT === '1';

const ROUTES = [
  '/dashboard/uim',
  '/dashboard/uim/item-master',
  '/dashboard/uim/stock-ledger',
  '/dashboard/uim/reservations',
  '/dashboard/uim/issue-consume',
  '/dashboard/uim/restock',
  '/dashboard/uim/locations',
  '/dashboard/uim/analytics',
] as const;

async function login(page: Page) {
  await page.goto('/auth');
  const emailInput = page.getByTestId('email-input').or(page.locator('input[type="email"]'));
  const passwordInput = page.getByTestId('password-input').or(page.locator('input[type="password"]'));
  const loginButton = page.getByTestId('login-btn').or(page.getByRole('button', { name: /sign in|login/i }));
  await emailInput.first().fill(E2E_ADMIN_EMAIL);
  await passwordInput.first().fill(E2E_ADMIN_PASSWORD);
  await loginButton.first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });
}

async function ensureAuthenticated(page: Page) {
  await page.goto('/dashboard/uim');
  await page.waitForTimeout(500);
  if (!page.url().includes('/auth')) return;
  await login(page);
  await page.goto('/dashboard/uim');
  test.skip(page.url().includes('/auth'), 'Unable to authenticate with configured credentials');
}

async function ensureRouteAccessible(page: Page, routePath: string) {
  await page.goto(routePath);
  await page.waitForTimeout(500);
  if (page.url().includes('/auth')) {
    await login(page);
    await page.goto(routePath);
    await page.waitForTimeout(500);
  }
  test.skip(page.url().includes('/auth'), `Authentication failed for route ${routePath}`);
  const accessDeniedHeading = page.getByRole('heading', { name: /access denied/i }).first();
  const accessDeniedVisible = await accessDeniedHeading.isVisible({ timeout: 3000 }).catch(() => false);
  if (accessDeniedVisible) {
    test.skip(true, `Access denied for route ${routePath}`);
  }
}

async function mockUimApis(page: Page) {
  await page.route('**/api/v2/uim/forms/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();
    const now = new Date().toISOString();

    if (method === 'GET' && /^\/api\/v2\/uim\/forms\/[^/]+$/.test(path)) {
      const node = path.split('/').pop() || 'overview';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: 'v2',
          output: {
            node_key: node,
            count: 2,
            limit: 25,
            offset: 0,
            records: [
              {
                id: `${node}-rec-1`,
                updated_at: now,
                payload: { name: `${node} alpha`, status: 'active' },
              },
              {
                id: `${node}-rec-2`,
                updated_at: now,
                payload: { name: `${node} beta`, status: 'fulfilled' },
              },
            ],
          },
        }),
      });
    }

    if (method === 'GET' && /^\/api\/v2\/uim\/forms\/[^/]+\/[^/]+$/.test(path)) {
      const [node, id] = path.split('/').slice(-2);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: 'v2',
          output: { id, node_key: node, payload: { name: `${node} detail`, status: 'active' } },
        }),
      });
    }

    if (method === 'POST' && /^\/api\/v2\/uim\/forms\/[^/]+$/.test(path)) {
      const node = path.split('/').pop() || 'overview';
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: `${node}-created-1`, message: 'created' }),
      });
    }

    if (method === 'PATCH' && /^\/api\/v2\/uim\/forms\/[^/]+\/[^/]+$/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: path.split('/').pop(), message: 'updated' }),
      });
    }

    if (method === 'DELETE' && /^\/api\/v2\/uim\/forms\/[^/]+\/[^/]+$/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: path.split('/').pop(), message: 'deleted' }),
      });
    }

    return route.continue();
  });
}

test.describe('uim visual regression', () => {
  test.beforeEach(async ({ page }) => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    await mockUimApis(page);
    await ensureAuthenticated(page);
  });

  for (const routePath of ROUTES) {
    const slug = routePath.replace('/dashboard/uim', 'uim').replace(/\//g, '-').replace(/^-/, '');
    test(`captures regression baseline for ${routePath}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await ensureRouteAccessible(page, routePath);
      await page.waitForLoadState('domcontentloaded');

      const desktopWorkspace = page.getByTestId(/^uim-node-form-/).first();
      await expect(desktopWorkspace).toBeVisible({ timeout: 20000 });
      await expect(page.getByText(/UIM Placeholder Routes/i)).toHaveCount(0);

      await page.screenshot({
        path: `${ARTIFACT_DIR}/${slug}-desktop.png`,
        fullPage: true,
      });

      await page.setViewportSize({ width: 390, height: 844 });
      await ensureRouteAccessible(page, routePath);
      await page.waitForLoadState('domcontentloaded');
      const mobileWorkspace = page.getByTestId(/^uim-node-form-/).first();
      await expect(mobileWorkspace).toBeVisible({ timeout: 20000 });
      await page.screenshot({
        path: `${ARTIFACT_DIR}/${slug}-mobile.png`,
        fullPage: true,
      });

      if (ENABLE_STRICT_VISUAL_ASSERT) {
        await expect(mobileWorkspace).toHaveScreenshot(`${slug}-workspace.png`, {
          maxDiffPixelRatio: 0.1,
        });
      }
    });
  }
});
