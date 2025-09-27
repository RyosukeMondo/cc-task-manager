module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  // Point to the in-package integration tests for the worker
  testMatch: ['<rootDir>/tests/integration/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    // Collect coverage from worker sources only
    '<rootDir>/src/**/*.(t|j)s',
    '!<rootDir>/src/**/*.spec.ts',
    '!<rootDir>/src/**/*.interface.ts',
    '!<rootDir>/src/main.ts',
  ],
  coverageDirectory: './coverage-integration',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(lodash-es)/)'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.integration.setup.ts'],
  testTimeout: 60000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  maxWorkers: 2,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true
};
