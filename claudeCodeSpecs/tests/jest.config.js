module.exports = {
  displayName: 'ClaudeCodeSpecs Tests',
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '<rootDir>/**/*.test.{js,ts}',
    '<rootDir>/**/*.spec.{js,ts}'
  ],

  // TypeScript support
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Path mapping for imports
  moduleNameMapping: {
    '^@claudeCodeSpecs/(.*)$': '<rootDir>/../$1',
    '^@tests/(.*)$': '<rootDir>/$1',
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/setup.ts'
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    '<rootDir>/../**/*.{ts,js,py}',
    '!<rootDir>/../**/*.test.{ts,js}',
    '!<rootDir>/../**/*.spec.{ts,js}',
    '!<rootDir>/../**/__tests__/**',
    '!<rootDir>/../**/node_modules/**',
    '!<rootDir>/../**/__pycache__/**',
    '!<rootDir>/../**/dist/**',
    '!<rootDir>/../**/coverage/**',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Test timeout
  testTimeout: 30000,

  // Parallel execution
  maxWorkers: '50%',

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output for debugging
  verbose: true,

  // Test categorization using projects
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/unit/**/*.{test,spec}.{js,ts}'],
      setupFilesAfterEnv: ['<rootDir>/setup.ts']
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/integration/**/*.{test,spec}.{js,ts}'],
      setupFilesAfterEnv: ['<rootDir>/setup.ts'],
      testTimeout: 60000
    },
    {
      displayName: 'E2E Tests',
      testMatch: ['<rootDir>/e2e/**/*.{test,spec}.{js,ts}'],
      setupFilesAfterEnv: ['<rootDir>/setup.ts'],
      testTimeout: 120000
    }
  ]
};