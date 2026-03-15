import { expect, test, type Page } from '@playwright/test';

const STAGE_KEYS = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'converted'] as const;
const STAGE_LABELS: Record<(typeof STAGE_KEYS)[number], string> = {
  new: 'New Lead',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal Sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
  converted: 'Converted',
};

const BREAKPOINTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

async function login(page: Page) {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  test.skip(!email || !password, 'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required');

  await page.goto('/auth');
  await page.locator('[data-testid="email-input"], input[type="email"]').first().fill(email!);
  await page.locator('[data-testid="password-input"], input[type="password"]').first().fill(password!);
  await page.locator('[data-testid="login-btn"], button:has-text("Sign in"), button:has-text("Login")').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });
}

test.describe('leads pipeline single-line rail', () => {
  test('renders one-line stage rail with connectors and tooltip across breakpoints', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/leads/pipeline');
    await expect(page).not.toHaveURL(/\/auth/);

    const rail = page.getByTestId('kanban-funnel-rail');
    await expect(rail).toBeVisible();

    for (const stage of STAGE_KEYS) {
      await expect(page.getByTestId(`kanban-funnel-stage-${stage}`)).toBeVisible();
    }

    const connectors = rail.getByTestId('kanban-funnel-connector');
    await expect(connectors).toHaveCount(STAGE_KEYS.length - 1);

    for (const breakpoint of BREAKPOINTS) {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await expect(rail).toBeVisible();
      const buttons = rail.locator('[data-testid^="kanban-funnel-stage-"]');
      await expect(buttons).toHaveCount(STAGE_KEYS.length);
      const tops = await buttons.evaluateAll((elements) =>
        elements.map((element) => Math.round(element.getBoundingClientRect().top))
      );
      const spread = Math.max(...tops) - Math.min(...tops);
      expect(spread, `rail wraps to multiple lines at ${breakpoint.name}`).toBeLessThanOrEqual(4);
    }

    await page.getByTestId('kanban-funnel-stage-new').hover();
    await expect(page.getByText(/of total pipeline/i).first()).toBeVisible();
    await expect(page.getByText(/leads/i).first()).toBeVisible();

    await page.getByTestId('kanban-funnel-stage-new').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('status')).toContain('new');
    await page.getByRole('button', { name: /clear filter/i }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBeNull();
    await expect(page.getByTestId('kanban-board')).toBeVisible();
  });

  test('renders only selected status columns when status filter is active', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/leads/pipeline?view=board&status=won,qualified');
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.getByTestId('kanban-board')).toBeVisible();

    const columns = page.locator('[data-testid^="kanban-column-"]');
    await expect(columns).toHaveCount(2);

    const columnIds = await columns.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-column-id'))
    );
    expect(columnIds).toEqual(['qualified', 'won']);
    await expect(page.getByTestId('kanban-column-title-qualified')).toHaveText(STAGE_LABELS.qualified);
    await expect(page.getByTestId('kanban-column-title-won')).toHaveText(STAGE_LABELS.won);
  });

  test('resets search and status filters from the board reset action', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/leads/pipeline?view=board&q=abc&status=won,qualified');
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.getByTestId('kanban-board')).toBeVisible();

    const resetButton = page.getByRole('button', { name: /^Reset$/i });
    await expect(resetButton).toBeVisible();
    await resetButton.click();

    await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBeNull();
  });

  test('resets multi-criteria filters including source, date range, and custom fields', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/leads/pipeline?view=board&q=abc&status=won,qualified&source=Referral&from=2026-01-01&to=2026-02-01&custom=industry%253A%253ATech');
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.getByTestId('kanban-board')).toBeVisible();

    const resetButton = page.getByRole('button', { name: /^Reset$/i });
    await expect(resetButton).toBeVisible();
    await resetButton.click();

    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get('source')).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get('from')).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get('to')).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get('custom')).toBeNull();
  });

  test('preserves board horizontal scroll position across view switches', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/leads/pipeline?view=board');
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.getByTestId('kanban-board')).toBeVisible();

    const scroller = page.getByTestId('kanban-horizontal-scroll');
    const topScroller = page.getByTestId('kanban-top-horizontal-scroll');
    await expect(scroller).toBeVisible();
    await expect(topScroller).toBeVisible();
    await expect(page.getByTestId('kanban-scroll-right-indicator')).toBeVisible();

    await topScroller.evaluate((element) => {
      element.scrollLeft = 360;
      element.dispatchEvent(new Event('scroll'));
    });

    await expect.poll(async () => {
      return await scroller.evaluate((element) => Math.round(element.scrollLeft));
    }).toBeGreaterThan(300);

    await expect(page.getByTestId('kanban-scroll-left-indicator')).toBeVisible();

    await page.getByRole('tab', { name: /analytics/i }).click();
    await page.getByRole('tab', { name: /board/i }).click();

    await expect.poll(async () => {
      return await scroller.evaluate((element) => Math.round(element.scrollLeft));
    }).toBeGreaterThan(100);
  });
});
