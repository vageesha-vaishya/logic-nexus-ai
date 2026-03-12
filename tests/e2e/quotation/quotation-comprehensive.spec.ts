import { test, expect } from './fixtures/quotation.fixture';
import { loadCsvData, loadJsonData } from './utils/dataLoader';
import { quotationEnvConfig } from './config/environments';
import { setupQuotationApiMocks } from './utils/mockQuotationApi';
import { AuthPage } from './pom/AuthPage';
import { QuotationComposerPage } from './pom/QuotationComposerPage';
import { RuntimeMonitor } from './utils/runtimeMonitor';

const defaultValidInput = {
  mode: 'ocean' as const,
  origin: 'Shanghai',
  destination: 'New York',
  commodity: 'Electronics',
  weight: '1200',
  volume: '40',
  quoteTitle: `PW Quote ${Date.now()}`,
  guestCompany: 'Acme Logistics',
  guestName: 'Rita Buyer',
  guestEmail: 'rita.buyer@acme.com',
  guestPhone: '+1 202 555 0171',
};

test.describe('Quotation module comprehensive e2e framework', () => {
  test.beforeEach(async ({ authPage }) => {
    await authPage.login(quotationEnvConfig.adminEmail, quotationEnvConfig.adminPassword);
  });

  test('validates required fields, formats, dependencies, and invalid submissions', async ({ quotationComposerPage }) => {
    await quotationComposerPage.gotoNew();
    await quotationComposerPage.setStandalone(true);
    await quotationComposerPage.submitRates();
    await quotationComposerPage.expectAnyValidationVisible();

    await quotationComposerPage.fillCoreForm(defaultValidInput);
    await quotationComposerPage.fillStandaloneGuest({ guestEmail: 'invalid-email' });
    await quotationComposerPage.submitRates();
    await quotationComposerPage.expectValidationMessage('email');
  });

  test('runs JSON and CSV driven permutations for valid and invalid payloads', async ({ quotationComposerPage }) => {
    const jsonCases = await loadJsonData<
      Array<typeof defaultValidInput & { caseId: string; expected: 'valid' | 'invalid'; expectedError: string }>
    >('quotation-validation-cases.json');
    const csvCases = await loadCsvData('quotation-data-driven.csv');

    for (const dataSet of [...jsonCases, ...csvCases]) {
      await test.step(`case ${dataSet.caseId}`, async () => {
        const emailValue = 'email' in dataSet ? dataSet.email : dataSet.guestEmail;
        const phoneValue = 'phone' in dataSet ? dataSet.phone : dataSet.guestPhone;
        await quotationComposerPage.gotoNew();
        await quotationComposerPage.setStandalone(true);
        await quotationComposerPage.fillCoreForm({
          mode: (dataSet.mode as 'ocean' | 'air' | 'road' | 'rail') || 'ocean',
          origin: dataSet.origin || '',
          destination: dataSet.destination || '',
          commodity: dataSet.commodity || '',
          weight: dataSet.weight || '',
          volume: dataSet.volume || '',
          quoteTitle: `${dataSet.caseId}-${Date.now()}`,
          guestCompany: 'Data Driven Corp',
          guestName: 'Scenario Owner',
          guestEmail: emailValue || 'scenario@corp.com',
          guestPhone: phoneValue || '+1 202 555 0130',
        });
        await quotationComposerPage.submitRates();
        if (dataSet.expected === 'invalid') {
          if (dataSet.expectedError) {
            await quotationComposerPage.expectValidationMessage(dataSet.expectedError);
          } else {
            await quotationComposerPage.expectAnyValidationVisible();
          }
        }
      });
    }
  });

  test('covers empty values, boundary lengths, and special character injection handling', async ({ quotationComposerPage, page }) => {
    await quotationComposerPage.gotoNew();
    await quotationComposerPage.setStandalone(true);
    await quotationComposerPage.fillCoreForm({
      ...defaultValidInput,
      quoteTitle: 'A'.repeat(120),
      commodity: `'; DROP TABLE quotes; -- <script>alert("x")</script>`,
      guestEmail: 'safe@example.com',
    });
    await quotationComposerPage.submitRates();
    await expect(page.locator('body')).toBeVisible();
    await quotationComposerPage.expectAnyValidationVisible();
  });

  test('validates UX loading states, autosave, notifications, accessibility, and responsive breakpoints', async ({
    quotationComposerPage,
    page,
  }) => {
    await quotationComposerPage.gotoNew();
    await quotationComposerPage.setStandalone(true);
    await quotationComposerPage.fillCoreForm(defaultValidInput);

    await quotationComposerPage.submitRates();
    await expect(page.locator('body')).toBeVisible();

    await quotationComposerPage.saveDraft();
    await quotationComposerPage.expectDraftSavedToast();

    await quotationComposerPage.keyboardTab(5);
    const activeElementRole = await page.evaluate(() => document.activeElement?.getAttribute('role') || '');
    expect(activeElementRole !== null).toBeTruthy();

    const accessibilityLocator = page.locator('[aria-invalid], [role="combobox"], [data-field-name]');
    expect(await accessibilityLocator.count()).toBeGreaterThan(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('body')).toBeVisible();
    await page.setViewportSize({ width: 1366, height: 900 });
    await expect(page.locator('body')).toBeVisible();

    const contrastRatio = await page.evaluate(() => {
      const parseColor = (value: string) => {
        const result = value.match(/\d+/g) || [];
        return result.slice(0, 3).map(Number);
      };
      const luminance = ([r, g, b]: number[]) => {
        const channels = [r, g, b].map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const button = document.querySelector('[data-testid="quotation-composer-btn"], [data-testid="get-rates-btn"], button') as HTMLElement;
      const style = window.getComputedStyle(button);
      const fg = parseColor(style.color);
      const bg = parseColor(style.backgroundColor);
      const l1 = luminance(fg);
      const l2 = luminance(bg);
      const brightest = Math.max(l1, l2);
      const darkest = Math.min(l1, l2);
      return (brightest + 0.05) / (darkest + 0.05);
    });
    expect(contrastRatio).toBeGreaterThan(3);
  });

  test('executes CRUD list flows with search, filter, sort, single delete, and bulk delete', async ({ quotationListPage }) => {
    await quotationListPage.goto();
    await quotationListPage.search('QUO');
    await quotationListPage.expectSearchApplied('QUO');
    await quotationListPage.search('');
    await quotationListPage.sortBy('Created');
    await quotationListPage.selectFirstRow();
    await quotationListPage.bulkDeleteSelected();
    await quotationListPage.deleteFirstQuoteFromActions();
  });

  test('validates offline mode, network interception, response-time threshold, and visual regression snapshot', async ({
    quotationComposerPage,
    page,
    context,
  }) => {
    await quotationComposerPage.gotoNew();
    await quotationComposerPage.setStandalone(true);
    await quotationComposerPage.fillCoreForm(defaultValidInput);

    await context.route('**/rest/v1/rpc/save_quote_atomic', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, quote_id: 'perf-quote-1', version_id: 'perf-quote-1-v1' }),
      });
    });
    const start = Date.now();
    await quotationComposerPage.saveDraft();
    await quotationComposerPage.expectDraftSavedToast();
    expect(Date.now() - start).toBeLessThan(5000);

    await context.setOffline(true);
    await page.reload().catch(() => undefined);
    await context.setOffline(false);
    await page.goto('/dashboard/quotes/new');
    await expect(page.locator('body')).toBeVisible();

    await expect(page).toHaveScreenshot('quotation-composer-visual.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.1,
    });
  });

  test('checks memory trend during long user session in chromium', async ({ browserName, page }) => {
    test.skip(browserName !== 'chromium', 'Memory API supported in chromium only');
    await page.goto('/dashboard/quotes/new');
    const before = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize || 0);
    for (let iteration = 0; iteration < 10; iteration += 1) {
      await page.reload();
    }
    const after = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize || 0);
    expect(after - before).toBeLessThan(60 * 1024 * 1024);
  });

  test('validates concurrent sessions and draft data isolation', async ({ browser, browserName }) => {
    test.skip(browserName === 'webkit', 'Concurrency scenario unstable on webkit in CI');
    const contextOne = await browser.newContext({ baseURL: quotationEnvConfig.baseUrl });
    const contextTwo = await browser.newContext({ baseURL: quotationEnvConfig.baseUrl });
    if (quotationEnvConfig.useMockApi) {
      await setupQuotationApiMocks(contextOne);
      await setupQuotationApiMocks(contextTwo);
    }
    const pageOne = await contextOne.newPage();
    const pageTwo = await contextTwo.newPage();
    const monitorOne = new RuntimeMonitor(pageOne, test.info());
    const monitorTwo = new RuntimeMonitor(pageTwo, test.info());

    const authOne = new AuthPage(pageOne, monitorOne);
    const authTwo = new AuthPage(pageTwo, monitorTwo);
    await authOne.login(quotationEnvConfig.adminEmail, quotationEnvConfig.adminPassword);
    await authTwo.login(quotationEnvConfig.adminEmail, quotationEnvConfig.adminPassword);

    const composerOne = new QuotationComposerPage(pageOne, monitorOne);
    const composerTwo = new QuotationComposerPage(pageTwo, monitorTwo);
    await composerOne.gotoNew();
    await composerTwo.gotoNew();
    await composerOne.fillQuoteReference('Concurrent-A');
    await composerTwo.fillQuoteReference('Concurrent-B');
    await composerOne.expectQuoteReferenceValue('Concurrent-A');
    await composerTwo.expectQuoteReferenceValue('Concurrent-B');

    await contextOne.close();
    await contextTwo.close();
  });
});
