import { test, expect } from '@playwright/test';

test('CRM audit flow', async ({ page }) => {
  // Login
  await page.goto('/');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'password');
  await page.click('button:has-text("Sign In")');

  // Create a lead
  await page.goto('/crm/leads/new');
  await page.fill('[name=name]', 'Test Lead');
  await page.fill('[name=email]', 'lead@example.com');
  await page.click('button:has-text("Create")');

  // Navigate to lead detail
  await page.goto('/crm/leads/lead-123');

  // Verify history panel shows creation
  await expect(page.locator('text=Activity History')).toBeVisible();
  await expect(page.locator('text=Created')).toBeVisible();

  // Navigate to audit dashboard
  await page.goto('/crm/audit-dashboard');

  // Verify lead appears in dashboard
  await expect(page.locator('text=lead@example.com')).toBeVisible();

  // Filter by action
  await page.selectOption('[name=action]', 'create');
  await expect(page.locator('text=lead@example.com')).toBeVisible();

  // Export
  await page.click('button:has-text("Export CSV")');
});
