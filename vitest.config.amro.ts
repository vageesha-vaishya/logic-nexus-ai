/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    vmMemoryLimit: '4096MB',
    forks: {
      singleFork: true,
      execArgv: ['--max-old-space-size=4096'],
    },
    testMatch: ['**/tests/integration/amro*.test.ts'],
    include: ['**/tests/integration/amro*.test.ts'],
    exclude: ['**/node_modules/**', '**/.dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/amro',
      reportOnFailure: true,
      include: ['src/modules/amro/**/*.ts', 'services/amro-api/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/index.ts',
        '**/*.type.ts',
        '**/*.types.ts',
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
