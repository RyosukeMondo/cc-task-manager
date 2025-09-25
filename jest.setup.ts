// Jest setup file
import { jest } from '@jest/globals';

// Mock crypto module to fix NestJS testing issue
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
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