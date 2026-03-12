import { test as base, expect } from '@playwright/test';
import { AuthPage } from '../pom/AuthPage';
import { QuotationComposerPage } from '../pom/QuotationComposerPage';
import { QuotationListPage } from '../pom/QuotationListPage';
import { RuntimeMonitor } from '../utils/runtimeMonitor';
import { setupQuotationApiMocks } from '../utils/mockQuotationApi';
import { quotationEnvConfig } from '../config/environments';

type QuotationFixture = {
  authPage: AuthPage;
  quotationComposerPage: QuotationComposerPage;
  quotationListPage: QuotationListPage;
  runtimeMonitor: RuntimeMonitor;
};

export const test = base.extend<QuotationFixture>({
  runtimeMonitor: async ({ page }, runFixture, testInfo) => {
    const monitor = new RuntimeMonitor(page, testInfo);
    monitor.attachNetworkLogging();
    await runFixture(monitor);
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('failure-dom-state.html', {
        body: await page.content(),
        contentType: 'text/html',
      });
    }
    await monitor.attachArtifacts();
  },
  authPage: async ({ page, context, runtimeMonitor }, runFixture) => {
    if (quotationEnvConfig.useMockApi) {
      await setupQuotationApiMocks(context);
    }
    await runFixture(new AuthPage(page, runtimeMonitor));
  },
  quotationComposerPage: async ({ page, runtimeMonitor }, runFixture) => {
    await runFixture(new QuotationComposerPage(page, runtimeMonitor));
  },
  quotationListPage: async ({ page, runtimeMonitor }, runFixture) => {
    await runFixture(new QuotationListPage(page, runtimeMonitor));
  },
});

export { expect };
