"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PactTestRunner_1 = require("./PactTestRunner");
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
describe('PactTestRunner (smoke)', () => {
    const pact = new PactTestRunner_1.PactTestRunner({
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
                    body: PactTestRunner_1.Matchers.like({ ok: true }),
                },
            });
        }).not.toThrow();
    });
    it('provides Matchers for pact tests', () => {
        expect(PactTestRunner_1.Matchers.like).toBeDefined();
        expect(PactTestRunner_1.Matchers.string).toBeDefined();
        const matcher = PactTestRunner_1.Matchers.like({ test: 'value' });
        expect(matcher).toBeDefined();
    });
});
//# sourceMappingURL=PactTestRunner.spec.js.map