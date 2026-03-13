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

const classifyFailure = (errors: string[]) => {
  const text = errors.join('\n').toLowerCase();
  if (text.includes('tohaveurl') && text.includes('/auth')) return 'auth-redirect';
  if (text.includes('target page') && text.includes('closed')) return 'page-closed';
  if (text.includes('timeout')) return 'timeout';
  if (text.includes('network') || text.includes('offline') || text.includes('net::')) return 'network-disruption';
  if (text.includes('aria-invalid') || text.includes('validation')) return 'validation-assertion';
  if (text.includes('detached') || text.includes('not attached') || text.includes('intercepts pointer')) return 'interaction-stability';
  return 'unclassified';
};

const recoveryPlanByCategory: Record<string, string[]> = {
  'auth-redirect': ['refresh session', 'retry login flow', 're-open protected route'],
  'page-closed': ['skip late DOM reads', 're-open page before assertion'],
  timeout: ['retry flaky step', 'wait for networkidle before interaction'],
  'network-disruption': ['toggle offline off', 'reload and retry failing operation'],
  'validation-assertion': ['fallback to semantic validation selectors', 'expand assertion token matching'],
  'interaction-stability': ['dismiss overlays', 'retry click or fill once'],
  unclassified: ['collect trace and runtime logs', 'inspect selector and network behavior'],
};

export const test = base.extend<QuotationFixture>({
  runtimeMonitor: async ({ page }, runFixture, testInfo) => {
    const monitor = new RuntimeMonitor(page, testInfo);
    monitor.attachNetworkLogging();
    await runFixture(monitor);
    if (testInfo.status !== testInfo.expectedStatus) {
      const errorMessages = testInfo.errors.map((entry) => entry.message || '').filter(Boolean);
      const category = classifyFailure(errorMessages);
      const domBody = page.isClosed()
        ? '<html><body><p>Page already closed before DOM capture.</p></body></html>'
        : await page.content().catch(() => '<html><body><p>Unable to capture page DOM.</p></body></html>');
      await testInfo.attach('failure-dom-state.html', {
        body: domBody,
        contentType: 'text/html',
      });
      await testInfo.attach('failure-root-cause.json', {
        body: JSON.stringify(
          {
            category,
            errors: errorMessages,
            suggestedRecoveryActions: recoveryPlanByCategory[category] || recoveryPlanByCategory.unclassified,
            retryEnabled: true,
            retriesAvailable: testInfo.project.retries,
          },
          null,
          2,
        ),
        contentType: 'application/json',
      });
    }
    await monitor.attachArtifacts();
  },
  authPage: async ({ page, context, runtimeMonitor }, runFixture) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('e2e:bypass-auth', '1');
      window.localStorage.setItem('has_seen_onboarding_tour', 'true');
    });
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
