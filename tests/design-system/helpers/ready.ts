import { expect, type Page } from '@playwright/test';

/**
 * "Page rendered" gate. A blank document (app never booted) or the login page
 * (session expired, redirected after domcontentloaded) must be a harness
 * failure, never a design pass — every cell calls this before any check.
 */
export async function expectPageBooted(page: Page, authenticated: boolean): Promise<void> {
  // The React root must have children — a blank document is a harness failure, never a design pass.
  await expect(page.locator('#root > *').first()).toBeAttached({ timeout: 30_000 });
  if (authenticated) {
    // DashboardLayout renders <main id="main-content">; the login page does not.
    await expect(page).not.toHaveURL(/\/auth(\?|$)/, { timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
  } else {
    await expect(page.getByTestId('email-input')).toBeVisible({ timeout: 30_000 });
  }
}
