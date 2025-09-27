// Jest setup file
global.setImmediate = global.setImmediate || ((fn, ...args) => global.setTimeout(fn, 0, ...args));

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

// Mock chokidar
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    add: jest.fn(),
    unwatch: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
  })),
}));

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

// Mock os module for tmpdir functionality
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  tmpdir: jest.fn(() => '/tmp'),
}));

