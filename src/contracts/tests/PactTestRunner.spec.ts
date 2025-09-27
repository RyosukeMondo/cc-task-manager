import { PactTestRunner, Matchers } from './PactTestRunner';

// Mock http module for testing
const mockHttp = {
  request: jest.fn((url, options, callback) => {
    const mockRequest = {
      on: jest.fn(),
      end: jest.fn(() => {
        if (callback) {
          const mockResponse = {
            on: jest.fn((event, handler) => {
              if (event === 'end') {
                handler();
              }
            }),
          };
          callback(mockResponse);
        }
      }),
    };
    return mockRequest;
  }),
};

// Lightweight smoke test to ensure PactTestRunner operates with Jest.
// Does not connect to any external/provider systems.

describe('PactTestRunner (smoke)', () => {
  const pact = new PactTestRunner({
    consumer: 'cc-task-manager',
    provider: 'claude-code-sdk',
    dir: '/tmp/pacts-test',
    logDir: '/tmp/pact-logs-test',
  });

  beforeAll(async () => {
    await pact.setup();
  });

  afterAll(async () => {
    await pact.teardown();
  });

  it('can add HTTP interactions without crashing', () => {
    // Test that PactTestRunner can add interactions successfully
    expect(() => {
      pact.addHttpInteraction({
        uponReceiving: 'a health check',
        withRequest: {
          method: 'GET',
          path: '/health',
        },
        willRespondWith: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: Matchers.like({ ok: true }),
        },
      });
    }).not.toThrow();
  });

  it('provides Matchers for pact tests', () => {
    // Test that Matchers are available
    expect(Matchers.like).toBeDefined();
    expect(Matchers.string).toBeDefined();
    
    const matcher = Matchers.like({ test: 'value' });
    expect(matcher).toBeDefined();
  });
});
