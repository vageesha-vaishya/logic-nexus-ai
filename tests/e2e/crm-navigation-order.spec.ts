import { expect, test } from '@playwright/test';

const modules = [
  '/dashboard/leads',
  '/dashboard/leads/pipeline',
  '/dashboard/opportunities',
  '/dashboard/accounts',
  '/dashboard/contacts',
  '/dashboard/activities',
  '/dashboard/quotes',
];

test.describe('crm navigation header order', () => {
  for (const modulePath of modules) {
    test(`keeps unified control sequence on ${modulePath}`, async ({ page }) => {
      await page.goto(modulePath);

      if (page.url().includes('/auth')) {
        test.skip();
      }

      const nav = page.getByRole('navigation').filter({ hasText: 'Pipeline' }).first();
      await expect(nav).toBeVisible();

      const text = (await nav.textContent()) ?? '';
      const createLabel = modulePath.startsWith('/dashboard/leads') ? 'New Lead' : 'New';
      const labels = ['Pipeline', 'Card', 'Grid', 'List', createLabel, 'Refresh', 'Import/Export', 'Azure Sky'];
      let cursor = -1;
      for (const label of labels) {
        const next = text.indexOf(label, cursor + 1);
        expect(next).toBeGreaterThan(cursor);
        cursor = next;
      }
    });
  }
});
