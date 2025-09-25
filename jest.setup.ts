// Jest setup file

// Mock crypto module to fix NestJS testing issue
const actualCrypto = jest.requireActual('crypto');
jest.mock('crypto', () => ({
  ...actualCrypto,
  randomUUID: jest.fn(() => 'test-correlation-id'),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked-hash')
  }))
}));

// Mock lodash-es
jest.mock('lodash-es', () => ({
  debounce: jest.fn((fn) => fn),
  throttle: jest.fn((fn) => fn),
}));