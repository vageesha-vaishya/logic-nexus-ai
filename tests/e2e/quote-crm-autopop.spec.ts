import { test, expect } from '@playwright/test';

const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'Bahuguna.vimal@gmail.com';
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Vimal@1234';

test.describe('CRM Mode Opportunity Auto-Population', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('has_seen_onboarding_tour', 'true');
    });

    // Mock CRM tables
    await page.route('**/rest/v1/opportunities*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'opp-a', name: 'Opp A', account_id: 'acc-1' },
            { id: 'opp-b', name: 'Opp B', account_id: 'acc-2' },
          ])
        });
        return;
      }
      await route.continue();
    });

    await page.route('**/rest/v1/accounts*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'acc-1', name: 'Acme Corp', type: 'customer' },
            { id: 'acc-2', name: 'Globex', type: 'customer' },
          ])
        });
        return;
      }
      await route.continue();
    });

    await page.route('**/rest/v1/contacts*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'con-1', first_name: 'Jane', last_name: 'Doe', account_id: 'acc-1' },
            { id: 'con-2', first_name: 'John', last_name: 'Smith', account_id: 'acc-1' },
            { id: 'con-3', first_name: 'Maria', last_name: 'Lopez', account_id: 'acc-2' },
          ])
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/auth');
    await page.getByTestId('email-input').fill(E2E_ADMIN_EMAIL);
    await page.getByTestId('password-input').fill(E2E_ADMIN_PASSWORD);
    await page.getByTestId('login-btn').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
  });

  test('selecting opportunity auto-populates account and contact', async ({ page }) => {
    await page.goto('/dashboard/quotes/new');

    // Ensure CRM mode is active
    const standaloneSwitch = page.locator('#standalone-mode');
    if (await standaloneSwitch.isVisible()) {
      if (await standaloneSwitch.isChecked()) {
        await standaloneSwitch.click();
      }
    }

    // Open Opportunity select and choose 'Opp A'
    const oppTrigger = page.getByText('Select Opportunity').first();
    await expect(oppTrigger).toBeVisible({ timeout: 10000 });
    await oppTrigger.click();
    await page.getByRole('option', { name: 'Opp A' }).click();

    // Verify Account is auto-populated to 'Acme Corp'
    const accountCombo = page.getByRole('combobox', { name: 'Account' });
    await expect(accountCombo).toContainText('Acme Corp');

    // Verify Contact is auto-populated (first contact for acc-1) => 'Jane Doe'
    const contactCombo = page.getByRole('combobox', { name: 'Contact' });
    await expect(contactCombo).toContainText('Jane Doe');

    // Change Account to 'Globex' and see contact reset/changed accordingly
    const accountTrigger = page.getByRole('combobox', { name: 'Account' });
    await accountTrigger.click();
    await page.getByRole('option', { name: 'Globex' }).click();

    // After switching account, contact will either reset or reflect available contacts for acc-2 ('Maria Lopez')
    await expect(contactCombo).toHaveText(/(Select Contact|Maria Lopez)/);
  });
});
