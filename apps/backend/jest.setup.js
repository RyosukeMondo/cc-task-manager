/**
 * Jest Setup Configuration
 *
 * Purpose: Configure test environment and global test utilities
 * This setup extends the existing contract testing infrastructure
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Global test timeout
jest.setTimeout(30000);

// Mock external services for isolated testing
jest.mock('pino', () => ({
  default: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    })),
  }),
}));

// Setup global matchers and utilities
global.testUtils = {
  createMockUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  createMockTask: () => ({
    id: 'test-task-id',
    title: 'Test Task',
    description: 'Test Description',
    status: 'pending',
    assigneeId: 'test-user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  createMockJwt: () => 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2MTYyMzkwMjJ9.test',
};

// Clean up after tests
afterEach(() => {
  jest.clearAllMocks();
});