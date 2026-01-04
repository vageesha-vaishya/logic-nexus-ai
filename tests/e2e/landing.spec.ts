import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/SOS Logistic Pro/i);
});

test('shows login button and navigates to auth', async ({ page }) => {
  await page.goto('/');
  
  // Check if we are redirected to auth or if there is a login button/form
  const loginLink = page.locator('a[href="/auth"]');
  await expect(loginLink).toBeVisible();

  await loginLink.click();
  await expect(page).toHaveURL(/.*auth/);
});
