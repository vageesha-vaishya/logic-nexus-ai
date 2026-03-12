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
    },
  },
});
