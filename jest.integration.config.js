module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['**/tests/integration/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/main.ts',
  ],
  coverageDirectory: './coverage-integration',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(lodash-es)/)'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.integration.setup.ts'],
  testTimeout: 60000, // 60 second timeout for integration tests
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  // Allow tests to run in parallel but limit concurrency for resource-intensive integration tests
  maxWorkers: 2,
  // Verbose output for integration tests
  verbose: true,
  // Force exit to clean up any hanging processes
  forceExit: true,
  // Detect open handles to identify resource leaks
  detectOpenHandles: true
};