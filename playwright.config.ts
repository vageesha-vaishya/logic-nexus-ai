import { defineConfig, devices } from '@playwright/test';

const firefoxNoSandbox = process.env.PW_FIREFOX_NO_SANDBOX === '1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:4173';
const enableDevServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER !== 'true';

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/e2e/**/*.spec.ts', 'dataentry/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? '50%' : undefined,
  outputDir: 'test-results/playwright',
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report/html' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['junit', { outputFile: 'playwright-report/results.xml' }],
  ],
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.1,
    },
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chrome-latest',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'msedge-latest',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'msedge-beta',
      use: { ...devices['Desktop Edge'], channel: 'msedge-beta' },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        ...(firefoxNoSandbox
          ? {
              launchOptions: {
                env: {
                  MOZ_DISABLE_CONTENT_SANDBOX: '1',
                  MOZ_DISABLE_GMP_SANDBOX: '1',
                  MOZ_DISABLE_RDD_SANDBOX: '1',
                  MOZ_DISABLE_SOCKET_PROCESS_SANDBOX: '1',
                },
                firefoxUserPrefs: {
                  'security.sandbox.content.level': 0,
                },
              },
            }
          : {}),
      },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'ios-mobile',
      use: { ...devices['iPhone 14 Pro'] },
    },
    {
      name: 'android-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: enableDevServer
    ? {
        command: 'npm run dev -- --host 0.0.0.0 --port 4173',
        url: baseURL,
        reuseExistingServer: true,
      }
    : undefined,
});
