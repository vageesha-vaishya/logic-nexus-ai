import { expect, type Page } from '@playwright/test';

/** Networkidle is best-effort (SPAs poll); the readiness gate below is what proves the page rendered. */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { /* proceed */ });
  await page.waitForTimeout(500);
}

const MIN_MAIN_TEXT = 50;

/**
 * "Page rendered" gate. A blank document (app never booted), the login page
 * (session expired, redirected after domcontentloaded) or an empty/still-loading
 * `<main>` must be a harness failure, never a design pass — every cell calls
 * this before any check. Returns the rendered text length of the content root
 * (`#main-content`, or `#root` on the login page, which has no main landmark)
 * so the cell can record what was actually measured.
 */
export async function expectPageBooted(page: Page, authenticated: boolean): Promise<number> {
  // The React root must have children — a blank document is a harness failure, never a design pass.
  await expect(page.locator('#root > *').first()).toBeAttached({ timeout: 30_000 });
  if (authenticated) {
    // DashboardLayout renders <main id="main-content">; the login page does not.
    await expect(page).not.toHaveURL(/\/auth(\?|$)/, { timeout: 30_000 });
    const main = page.locator('#main-content');
    await expect(main).toBeVisible({ timeout: 30_000 });
    // Visible is not rendered: an empty or skeleton-only <main> would pass every gate trivially.
    await expect(main).not.toBeEmpty({ timeout: 30_000 });
    await expect
      .poll(() => textLength(page, '#main-content'), { timeout: 30_000 })
      .toBeGreaterThan(MIN_MAIN_TEXT);
    await expect(page.locator('#main-content [aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });
    return textLength(page, '#main-content');
  }
  await expect(page.getByTestId('email-input')).toBeVisible({ timeout: 30_000 });
  return textLength(page, '#root');
}

function textLength(page: Page, selector: string): Promise<number> {
  return page.evaluate(sel => (document.querySelector<HTMLElement>(sel)?.innerText ?? '').trim().length, selector);
}
