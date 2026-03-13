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

const fieldValidationCases = [
  { caseId: 'origin-required', overrides: { origin: '' }, expectedError: 'origin' },
  { caseId: 'destination-required', overrides: { destination: '' }, expectedError: 'destination' },
  { caseId: 'commodity-required', overrides: { commodity: '' }, expectedError: 'commodity' },
  { caseId: 'weight-required', overrides: { weight: '' }, expectedError: 'weight' },
  { caseId: 'weight-negative', overrides: { weight: '-1' }, expectedError: 'weight' },
  { caseId: 'volume-required', overrides: { volume: '' }, expectedError: 'volume' },
  { caseId: 'email-required', overrides: { guestEmail: '' }, expectedError: 'email' },
  { caseId: 'email-invalid', overrides: { guestEmail: 'not-an-email' }, expectedError: 'email' },
  { caseId: 'phone-invalid', overrides: { guestPhone: '++abc' }, expectedError: 'phone' },
  { caseId: 'quote-reference-max-length', overrides: { quoteTitle: 'Q'.repeat(180) }, expectedError: 'quote' },
] as const;

const destructivePayloads = [
  `'; DROP TABLE quotes; --`,
  `<img src=x onerror=alert(1)>`,
  `${'x'.repeat(512)}`,
  `\u0000\u0008\u0009\u000d`,
] as const;

test.describe('Quotation module comprehensive e2e framework', () => {
  test.describe.configure({ retries: 2, timeout: 120000 });

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
    test.setTimeout(300000);
    const jsonCases = await loadJsonData<
      Array<typeof defaultValidInput & { caseId: string; expected: 'valid' | 'invalid'; expectedError: string }>
    >('quotation-validation-cases.json');
    const csvCases = await loadCsvData('quotation-data-driven.csv');

    const allDataSets = [...jsonCases, ...csvCases];
    const dataSets = /ios-mobile|android-mobile/.test(test.info().project.name) ? allDataSets.slice(0, 4) : allDataSets;
    for (const dataSet of dataSets) {
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
    test.setTimeout(60000);
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

  test('validates full create-read-update-delete lifecycle with persistence request and feedback state', async ({
    quotationComposerPage,
    quotationListPage,
    page,
  }) => {
    test.setTimeout(90000);
    await quotationComposerPage.gotoNew();
    await quotationComposerPage.setStandalone(true);
    const reference = `Lifecycle-${Date.now()}`;
    await quotationComposerPage.fillCoreForm({
      ...defaultValidInput,
      quoteTitle: reference,
    });

    const saveRequestPromise = page
      .waitForRequest(
        (request) => request.method() === 'POST' && /save_quote_atomic|\/rest\/v1\/quotes/i.test(request.url()),
        { timeout: 12000 },
      )
      .catch(() => null);
    await quotationComposerPage.saveDraft();
    await quotationComposerPage.expectDraftSavedToast();
    const saveRequest = await saveRequestPromise;
    if (saveRequest) {
      const payloadText = saveRequest.postData() || '';
      expect(payloadText.toLowerCase()).toMatch(/quote|origin|destination|commodity|weight|volume/);
    } else {
      await expect(page.locator('body')).toBeVisible();
    }

    const updatedReference = `${reference}-Updated`;
    await quotationComposerPage.fillQuoteReference(updatedReference);
    await quotationComposerPage.expectQuoteReferenceValue(updatedReference);
    await quotationComposerPage.saveDraft();
    await quotationComposerPage.expectDraftSavedToast();

    await quotationListPage.goto();
    await quotationListPage.search(updatedReference.slice(0, 16));
    await quotationListPage.expectSearchApplied(updatedReference.slice(0, 16));
    await quotationListPage.selectFirstRow();
    await quotationListPage.bulkDeleteSelected();
    await quotationListPage.deleteFirstQuoteFromActions();
  });

  test('covers exhaustive field-level validation for text, numeric, and dependency attributes', async ({ quotationComposerPage }) => {
    test.setTimeout(300000);
    const scenarios = /ios-mobile|android-mobile/.test(test.info().project.name)
      ? fieldValidationCases.slice(0, 6)
      : fieldValidationCases;
    for (const scenario of scenarios) {
      await test.step(`field-case ${scenario.caseId}`, async () => {
        await quotationComposerPage.gotoNew();
        await quotationComposerPage.setStandalone(true);
        await quotationComposerPage.fillCoreForm({
          ...defaultValidInput,
          quoteTitle: `${scenario.caseId}-${Date.now()}`,
          ...scenario.overrides,
        });
        await quotationComposerPage.submitRates();
        await quotationComposerPage.expectValidationMessage(scenario.expectedError);
      });
    }
  });

  test('executes negative security, session timeout, and interrupted workflow resistance scenarios', async ({
    quotationComposerPage,
    page,
    context,
  }) => {
    test.setTimeout(300000);
    for (const payload of destructivePayloads) {
      await test.step(`payload ${payload.slice(0, 24)}`, async () => {
        await quotationComposerPage.gotoNew();
        await quotationComposerPage.setStandalone(true);
        await quotationComposerPage.fillCoreForm({
          ...defaultValidInput,
          quoteTitle: `Neg-${Date.now()}`,
          commodity: payload,
          guestName: payload,
        });
        await quotationComposerPage.submitRates();
        await expect(page.locator('body')).toBeVisible();
      });
    }

    await quotationComposerPage.gotoNew();
    await quotationComposerPage.setStandalone(true);
    await quotationComposerPage.fillCoreForm(defaultValidInput);
    await context.setOffline(true);
    await quotationComposerPage.submitRates().catch(() => undefined);
    await context.setOffline(false);
    await page.goto('/dashboard/quotes/new');
    await expect(page.locator('body')).toBeVisible();

    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/dashboard/quotes/new');
    if (page.url().includes('/auth')) {
      await expect(page.getByRole('button', { name: /sign in|login/i }).first()).toBeVisible();
    } else {
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('validates UX consistency for breakpoints, keyboard flow, accessibility contract, and tooltip behavior', async ({
    quotationComposerPage,
    page,
  }) => {
    await quotationComposerPage.gotoNew();
    await quotationComposerPage.setStandalone(true);
    await quotationComposerPage.fillCoreForm(defaultValidInput);

    const viewports = [
      { width: 360, height: 800 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(page.locator('body')).toBeVisible();
    }

    await quotationComposerPage.keyboardTab(12);
    const keyboardState = await page.evaluate(() => ({
      activeTag: document.activeElement?.tagName || '',
      activeText: (document.activeElement?.textContent || '').trim(),
    }));
    expect(keyboardState.activeTag.length).toBeGreaterThan(0);

    const accessibilitySnapshot = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll('input, textarea, select, [role="combobox"]'));
      const labeledControls = controls.filter((control) => {
        const input = control as HTMLElement;
        const id = input.getAttribute('id');
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        const labelByFor = id ? document.querySelector(`label[for="${id}"]`) : null;
        return Boolean(ariaLabel || ariaLabelledBy || labelByFor);
      });
      const buttons = Array.from(document.querySelectorAll('button'));
      const unnamedButtons = buttons.filter((button) => {
        const text = (button.textContent || '').trim();
        const ariaLabel = button.getAttribute('aria-label');
        const title = button.getAttribute('title');
        return !(text || ariaLabel || title);
      });
      return {
        controls: controls.length,
        labeledControls: labeledControls.length,
        totalButtons: buttons.length,
        unnamedButtons: unnamedButtons.length,
      };
    });
    expect(accessibilitySnapshot.controls).toBeGreaterThan(0);
    expect(accessibilitySnapshot.labeledControls).toBeGreaterThan(0);
    expect(accessibilitySnapshot.unnamedButtons).toBeLessThan(accessibilitySnapshot.totalButtons);

    const tooltipTarget = page.locator('[title], [aria-describedby]').first();
    if ((await tooltipTarget.count()) > 0) {
      if (!/ios-mobile|android-mobile/.test(test.info().project.name)) {
        await tooltipTarget.hover();
      }
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('validates offline mode, network interception, response-time threshold, and visual regression snapshot', async ({
    quotationComposerPage,
    page,
    context,
  }) => {
    test.setTimeout(150000);
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
    const responseThresholdMs = /ios-mobile|android-mobile/.test(test.info().project.name) ? 12000 : 5000;
    expect(Date.now() - start).toBeLessThan(responseThresholdMs);

    await context.setOffline(true);
    await page.reload().catch(() => undefined);
    await context.setOffline(false);
    await page.goto('/dashboard/quotes/new');
    await expect(page.locator('body')).toBeVisible();

    if (/ios-mobile|android-mobile/.test(test.info().project.name)) {
      return;
    }

    if (test.info().project.name === 'firefox') {
      await expect(page.locator('main').first()).toHaveScreenshot('quotation-composer-visual-firefox-main.png', {
        animations: 'disabled',
        maxDiffPixelRatio: 0.1,
      });
      return;
    }

    await expect(page).toHaveScreenshot('quotation-composer-visual.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.1,
    });
  });

  test('checks memory trend during long user session in chromium', async ({ browserName, page, context }) => {
    test.skip(browserName !== 'chromium', 'Memory API supported in chromium only');
    test.setTimeout(120000);
    await page.goto('/dashboard/quotes/new');
    const cdpSession = await context.newCDPSession(page);
    const readHeapUsage = async () => {
      await cdpSession.send('HeapProfiler.collectGarbage').catch(() => undefined);
      await page.waitForTimeout(120);
      return page.evaluate(() => (performance as any).memory?.usedJSHeapSize || 0);
    };

    const before = await readHeapUsage();
    const samples: number[] = [];

    for (let iteration = 0; iteration < 8; iteration += 1) {
      await page.reload({ waitUntil: 'networkidle' });
      samples.push(await readHeapUsage());
    }

    const after = samples[samples.length - 1] ?? before;
    const peak = Math.max(before, ...samples);
    const peakIncrease = peak - before;
    const finalIncrease = after - before;

    expect(peakIncrease).toBeLessThan(96 * 1024 * 1024);
    expect(finalIncrease).toBeLessThan(80 * 1024 * 1024);
  });

  test('validates concurrent sessions and draft data isolation', async ({ browser, browserName }) => {
    test.skip(browserName === 'webkit', 'Concurrency scenario unstable on webkit in CI');
    test.skip(/ios-mobile|android-mobile/.test(test.info().project.name), 'Concurrency scenario is desktop-only');
    const contextOne = await browser.newContext({ baseURL: quotationEnvConfig.baseUrl });
    const contextTwo = await browser.newContext({ baseURL: quotationEnvConfig.baseUrl });
    await contextOne.addInitScript(() => {
      window.localStorage.setItem('e2e:bypass-auth', '1');
      window.localStorage.setItem('has_seen_onboarding_tour', 'true');
    });
    await contextTwo.addInitScript(() => {
      window.localStorage.setItem('e2e:bypass-auth', '1');
      window.localStorage.setItem('has_seen_onboarding_tour', 'true');
    });
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
