
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.ts', 'tests/e2e/**/*.test.tsx'],
    environment: 'node',
    maxWorkers: 1,
    vmMemoryLimit: '1024MB',
    testTimeout: 60000,
    hookTimeout: 60000,
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
