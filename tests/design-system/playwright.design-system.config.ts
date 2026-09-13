import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';
import { AUTH_STATE } from './pages';

// Secrets live in the gitignored repo-root `env` file; `.env` carries the Vite
// public vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Load both.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
loadEnv({ path: path.join(repoRoot, '.env') });
loadEnv({ path: path.join(repoRoot, 'env') });

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173';
const reuseServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true';

// Mirrors the root config's Firefox sandbox handling.
const firefoxNoSandbox =
  process.env.PW_FIREFOX_NO_SANDBOX === '1' ||
  (process.env.PW_FIREFOX_NO_SANDBOX !== '0' && process.platform === 'darwin');

export default defineConfig({
  testDir: __dirname,
  testMatch: ['**/*.spec.ts'],
  outputDir: path.join(repoRoot, 'test-results', 'design-system', 'artifacts'),
  fullyParallel: false,
  workers: 2,
  retries: 0,
  timeout: 120_000,
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(repoRoot, 'playwright-report', 'design-system.json') }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_STATE },
    },
    {
      name: 'firefox',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Firefox'],
        storageState: AUTH_STATE,
        ...(firefoxNoSandbox
          ? {
              launchOptions: {
                env: {
                  MOZ_DISABLE_CONTENT_SANDBOX: '1',
                  MOZ_DISABLE_GMP_SANDBOX: '1',
                  MOZ_DISABLE_RDD_SANDBOX: '1',
                  MOZ_DISABLE_SOCKET_PROCESS_SANDBOX: '1',
                },
                firefoxUserPrefs: { 'security.sandbox.content.level': 0 },
              },
            }
          : {}),
      },
    },
    {
      name: 'webkit',
      dependencies: ['setup'],
      use: { ...devices['Desktop Safari'], storageState: AUTH_STATE },
    },
    {
      name: 'msedge',
      dependencies: ['setup'],
      // Same engine as chromium — the keyboard walk learns nothing new here (spec §3.4).
      testIgnore: /keyboard\.spec\.ts/,
      use: { ...devices['Desktop Edge'], channel: 'msedge', storageState: AUTH_STATE },
    },
  ],
  webServer: reuseServer
    ? undefined
    : {
        command: 'npm run dev:vite -- --host 0.0.0.0 --port 4173 --strictPort',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
        // Drops the dev CSP's `upgrade-insecure-requests` (vite.config.ts) — WebKit
        // otherwise upgrades the module script to https and never boots the app.
        env: { DS_HARNESS: '1' },
      },
});
