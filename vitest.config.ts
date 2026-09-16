/// <reference types="vitest" />
import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'npm-specifier-resolver',
      resolveId(id) {
        // Resolve the AWS SES SDK import used in edge function tests.
        // Any test that imports npm:@aws-sdk/client-ses must supply its own
        // matching vi.mock('npm:@aws-sdk/client-ses', ...) or it will fail
        // with a less obvious "external module resolution" error instead of
        // Vite's initial "cannot resolve import" message.
        if (id === 'npm:@aws-sdk/client-ses') {
          return { id: '__npm_mock__@aws-sdk/client-ses', external: true };
        }
      },
    },
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setup.ts',
    pool: 'forks',
    maxWorkers: 1,
    vmMemoryLimit: '4096MB',
    forks: {
      singleFork: true,
      execArgv: ['--max-old-space-size=4096'],
    },
    exclude: [...configDefaults.exclude, 'tests/e2e/**', 'scripts/tests/**', 'tests/design-system/**/*.spec.ts', 'tests/design-system/**/*.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@platform/event-contracts': path.resolve(__dirname, './packages/event-contracts/src'),
      '@platform/llm-client': path.resolve(__dirname, './packages/llm-client/src'),
      '@platform/llm-prompts': path.resolve(__dirname, './packages/llm-prompts/src'),
      '@platform/llm-improver': path.resolve(__dirname, './packages/llm-improver/src'),
      '@platform/db-types-core': path.resolve(__dirname, './packages/db-types-core/src'),
    },
  },
});
