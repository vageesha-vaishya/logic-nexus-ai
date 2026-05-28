/// <reference types="vitest" />
import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  plugins: [],
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
    exclude: [...configDefaults.exclude, 'tests/e2e/**', 'scripts/tests/**'],
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
