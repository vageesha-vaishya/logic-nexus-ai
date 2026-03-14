module.exports = {
  rootDir: '.',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/jest.diagonal-strip.setup.ts'],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.app.json', useESM: true }]
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/diagonal-strip.esm.js',
    'src/contrast/apca.js'
  ],
  coverageThreshold: {
    './src/contrast/apca.js': {
      branches: 94,
      functions: 100,
      lines: 100,
      statements: 100
    }
  }
};
