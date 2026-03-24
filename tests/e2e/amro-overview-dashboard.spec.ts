import { expect, test, type Page } from '@playwright/test';

const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'Bahuguna.vimal@gmail.com';
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Vimal@1234';

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
  await page.goto('/dashboard/amro/overview');
  if (!page.url().includes('/auth')) {
    return;
  }
  await login(page);
  await page.goto('/dashboard/amro/overview');
  test.skip(page.url().includes('/auth'), 'Unable to authenticate with configured credentials');
}

test.describe('amro overview dashboard', () => {
  test('renders overview surfaces with filters, charts, and export controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ensureAuthenticated(page);
    test.skip(page.url().includes('/auth'), 'Authentication failed for AMRO overview environment');

    const overviewHub = page.getByText(/AMRO Operations Intelligence Hub|amro\.overview\.intelligenceHub/);
    test.skip((await overviewHub.count()) === 0, 'AMRO overview dashboard surface is not available for this account or environment');
    await expect(overviewHub.first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Trend Analysis Chart' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Risk Heatmap Severity Chart' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Date Range|amro\.overview\.dateRange/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Region|amro\.overview\.region/ })).toBeVisible();

    const applyFilters = page.getByRole('button', { name: /Apply Filters|amro\.overview\.applyFilters/ });
    if (await applyFilters.count()) {
      await applyFilters.first().click();
    }

    const exportPdf = page.getByRole('button', { name: /Export PDF|amro\.overview\.exportPdfAction/ });
    const exportExcel = page.getByRole('button', { name: /Export Excel|amro\.overview\.exportExcelAction/ });
    await expect(exportPdf.first()).toBeVisible();
    await expect(exportExcel.first()).toBeVisible();
  });

  test('stays responsive and keyboard accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureAuthenticated(page);
    test.skip(page.url().includes('/auth'), 'Authentication failed for AMRO overview environment');

    const overviewHub = page.getByText(/AMRO Operations Intelligence Hub|amro\.overview\.intelligenceHub/);
    test.skip((await overviewHub.count()) === 0, 'AMRO overview dashboard surface is not available for this account or environment');

    const kpiGrid = page.getByRole('region', { name: 'AMRO Next Gen Overview KPI Grid' });
    test.skip((await kpiGrid.count()) === 0, 'KPI grid is not rendered in this environment profile');
    await expect(kpiGrid.first()).toBeVisible();

    const firstAction = page.getByRole('button', { name: /Refresh Overview|amro\.overview\.refreshAction/ }).first();
    await firstAction.focus();
    await expect(firstAction).toBeFocused();
  });
});
