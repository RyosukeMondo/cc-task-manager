/**
 * Jest test setup for ClaudeCodeSpecs test suite
 * Configures test environment and global utilities
 */

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to hide console output during tests
  // log: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Mock timers for time-sensitive tests
beforeEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Global test utilities
global.testUtils = {
  // Helper to create mock Claude Code events
  createMockEvent: (type: string, payload: any = {}) => ({
    event: type,
    timestamp: new Date().toISOString(),
    payload: payload,
    ...payload
  }),

  // Helper to create mock captured events
  createMockCapturedEvent: (eventType: string, sessionId?: string) => ({
    event_id: `test-${Date.now()}`,
    timestamp: new Date(),
    event_type: eventType,
    session_id: sessionId || 'test-session',
    run_id: 'test-run',
    payload: { event: eventType },
    processing_stage: 'captured',
  }),

  // Helper to wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to create temporary test directories
  createTempDir: () => {
    const fs = require('fs');
    const path = require('path');
    const tempDir = path.join(__dirname, 'temp', `test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
  },

  // Helper to cleanup test files
  cleanupTempDir: (dir: string) => {
    const fs = require('fs');
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },

  // Helper to mock Python process execution
  mockPythonProcess: (exitCode: number = 0, stdout: string = '', stderr: string = '') => {
    const mockSpawn = jest.fn().mockReturnValue({
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(exitCode), 10);
        }
      }),
      kill: jest.fn(),
      pid: 12345
    });

    require('child_process').spawn = mockSpawn;
    return mockSpawn;
  }
};

// Type declarations for global utilities
declare global {
  namespace jest {
    interface It {
      todo(name: string): void;
    }
  }

  var testUtils: {
    createMockEvent: (type: string, payload?: any) => any;
    createMockCapturedEvent: (eventType: string, sessionId?: string) => any;
    waitFor: (ms: number) => Promise<void>;
    createTempDir: () => string;
    cleanupTempDir: (dir: string) => void;
    mockPythonProcess: (exitCode?: number, stdout?: string, stderr?: string) => jest.Mock;
  };
}

// Setup environment variables for testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock Python availability for cross-platform testing
const mockPython = {
  version: '3.10.0',
  executable: 'python3',
  available: true
};

// Export for use in tests
export { mockPython };