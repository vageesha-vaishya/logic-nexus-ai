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
  await page.goto('/dashboard/leads');
  if (!page.url().includes('/auth')) {
    const breadcrumb = page.locator('header nav[aria-label="breadcrumb"]').first();
    try {
      await expect(breadcrumb).toBeVisible({ timeout: 5000 });
    } catch {
      await login(page);
      await page.goto('/dashboard/leads');
    }
  }
  if (page.url().includes('/auth')) {
    await login(page);
    await page.goto('/dashboard/leads');
  }
  test.skip(page.url().includes('/auth'), 'Unable to authenticate with configured credentials');
  await expect(page).not.toHaveURL(/\/auth/);
}

async function assertBreadcrumbVisible(page: Page) {
  const breadcrumb = page.locator('header nav[aria-label="breadcrumb"]').first();
  await expect(breadcrumb).toBeVisible();
  await expect(breadcrumb).toContainText('Dashboard');
}

async function resolveLeadDetailPath(page: Page) {
  return await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    const candidates = anchors
      .map((anchor) => anchor.getAttribute('href') || '')
      .filter((href) => href.startsWith('/dashboard/leads/'))
      .filter((href) => !href.includes('/new'))
      .filter((href) => !href.includes('/pipeline'))
      .filter((href) => !href.includes('/import-export'));
    return candidates[0] ?? null;
  });
}

test.describe('lead workspace regressions', () => {
  test('keeps breadcrumbs visible on lead main, create, view, and edit flows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ensureAuthenticated(page);

    await page.goto('/dashboard/leads');
    await assertBreadcrumbVisible(page);
    await expect(page.locator('header nav[aria-label="breadcrumb"]').first()).toContainText('Leads');

    await page.goto('/dashboard/leads/new');
    await assertBreadcrumbVisible(page);
    await expect(page.locator('header nav[aria-label="breadcrumb"]').first()).toContainText('Leads');

    await page.goto('/dashboard/leads');
    const detailPath = await resolveLeadDetailPath(page);
    test.skip(!detailPath, 'No lead record is available for view/edit breadcrumb assertions');

    await page.goto(detailPath!);
    await assertBreadcrumbVisible(page);
    await expect(page.locator('header nav[aria-label="breadcrumb"]').first()).toContainText('Leads');

    const editButton = page.getByRole('button', { name: /^Edit$/i }).first();
    test.skip((await editButton.count()) === 0, 'Edit action is not available for current user/data');
    await editButton.click();
    await expect(page.getByText('Editable Mode').first()).toBeVisible();
    await assertBreadcrumbVisible(page);
  });

  test('keeps main and bottom sections visible with independent split-scroll behavior', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ensureAuthenticated(page);
    await page.goto('/dashboard/leads/new');

    const mainSection = page.locator('[aria-label="Main lead section"]').first();
    const bottomSection = page.locator('[aria-label="Lead details section"]').first();

    test.skip((await mainSection.count()) === 0 || (await bottomSection.count()) === 0, 'Three-section lead workspace is not enabled in this environment');

    await expect(mainSection).toBeVisible();
    await expect(bottomSection).toBeVisible();

    const mainMetrics = await mainSection.evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));
    const bottomMetrics = await bottomSection.evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));

    expect(mainMetrics.clientHeight).toBeGreaterThan(0);
    expect(bottomMetrics.clientHeight).toBeGreaterThan(0);
    expect(['auto', 'scroll']).toContain(mainMetrics.overflowY);
    expect(['auto', 'scroll']).toContain(bottomMetrics.overflowY);

    const bottomYBefore = (await bottomSection.boundingBox())?.y ?? 0;
    await mainSection.evaluate((el) => {
      el.scrollTop = Math.max(120, Math.floor(el.scrollHeight * 0.5));
      el.dispatchEvent(new Event('scroll'));
    });
    const bottomYAfter = (await bottomSection.boundingBox())?.y ?? 0;
    expect(Math.abs(bottomYAfter - bottomYBefore)).toBeLessThanOrEqual(2);
  });

  test('keeps communication options top-left aligned with accessible hit targets', async ({ page }) => {
    await ensureAuthenticated(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/leads/new');

    const communicationSection = page.locator('[aria-label="Communication section"]').first();
    const tabsList = communicationSection.locator('[role="tablist"]').first();
    const sendMessageTab = communicationSection.getByRole('tab', { name: 'Send Message' });
    const notesTab = communicationSection.getByRole('tab', { name: 'Notes' });
    const activitiesTab = communicationSection.getByRole('tab', { name: 'Lead Activities' });

    test.skip((await communicationSection.count()) === 0, 'Communication section is not available in this environment');

    await expect(communicationSection).toBeVisible();
    await expect(sendMessageTab).toBeVisible();
    await expect(notesTab).toBeVisible();
    await expect(activitiesTab).toBeVisible();

    const desktopMetrics = await page.evaluate(() => {
      const section = document.querySelector('[aria-label="Communication section"]') as HTMLElement | null;
      const tabs = section?.querySelector('[data-orientation="vertical"]') as HTMLElement | null;
      const list = section?.querySelector('[role="tablist"]') as HTMLElement | null;
      return {
        tabsAlignItems: tabs ? getComputedStyle(tabs).alignItems : null,
        tabsJustifyContent: tabs ? getComputedStyle(tabs).justifyContent : null,
        listTopOffset: list ? list.getBoundingClientRect().top - section!.getBoundingClientRect().top : null,
        listLeftOffset: list ? list.getBoundingClientRect().left - section!.getBoundingClientRect().left : null,
      };
    });

    expect(desktopMetrics.tabsAlignItems).toBe('flex-start');
    expect(desktopMetrics.tabsJustifyContent).toBe('flex-start');
    expect(desktopMetrics.listTopOffset ?? 999).toBeLessThanOrEqual(32);
    expect(desktopMetrics.listLeftOffset ?? 999).toBeLessThanOrEqual(32);

    for (const tab of [sendMessageTab, notesTab, activitiesTab]) {
      const box = await tab.boundingBox();
      expect(box).not.toBeNull();
      expect((box?.height ?? 0) >= 44).toBeTruthy();
      expect((box?.width ?? 0) >= 44).toBeTruthy();
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard/leads/new');
    await expect(tabsList).toBeVisible();

    const mobileMetrics = await page.evaluate(() => {
      const section = document.querySelector('[aria-label="Communication section"]') as HTMLElement | null;
      const list = section?.querySelector('[role="tablist"]') as HTMLElement | null;
      if (!section || !list) {
        return null;
      }
      const style = getComputedStyle(list);
      const firstTab = list.querySelector('[role="tab"]') as HTMLElement | null;
      return {
        flexWrap: style.flexWrap,
        listLeftOffset: list.getBoundingClientRect().left - section.getBoundingClientRect().left,
        firstTabLeftOffset: firstTab ? firstTab.getBoundingClientRect().left - list.getBoundingClientRect().left : null,
      };
    });

    expect(mobileMetrics).not.toBeNull();
    expect(mobileMetrics?.flexWrap).toBe('wrap');
    expect(mobileMetrics?.listLeftOffset ?? 999).toBeLessThanOrEqual(24);
    expect(mobileMetrics?.firstTabLeftOffset ?? 999).toBeGreaterThanOrEqual(0);
  });
});
