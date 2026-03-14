module.exports = {
  rootDir: '.',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/jest.design-system.setup.ts'],
  testMatch: ['<rootDir>/src/design-system/*.test.ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.app.json' }]
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/design-system/index.ts',
    'src/design-system/federation-entry.ts',
    'src/design-system/rolloutPlan.ts',
    'src/design-system/tokens/index.ts',
    'src/design-system/components/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      lines: 100,
      statements: 100
    }
  }
};
