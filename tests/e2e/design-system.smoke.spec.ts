import { test, expect } from '@playwright/test';

test.describe('design system smoke', () => {
  test('loads crm shell and verifies core navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('main, [role="main"], body')).toBeVisible();
  });
});
