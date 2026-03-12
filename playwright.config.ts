import { defineConfig, devices } from '@playwright/test';

const firefoxNoSandbox = process.env.PW_FIREFOX_NO_SANDBOX === '1';

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/e2e/**/*.spec.ts', 'dataentry/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
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
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
  },
});
