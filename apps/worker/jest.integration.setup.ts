// Integration test setup file
// Minimal setup for integration tests to avoid mocking issues

// Increase timeout for integration tests
jest.setTimeout(60000);

// Mock lodash-es for ES module compatibility
jest.mock('lodash-es', () => ({
  debounce: (fn: any) => fn,
  throttle: (fn: any) => fn,
}));

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
