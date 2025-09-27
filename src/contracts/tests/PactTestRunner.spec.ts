import http from 'http';
import { PactTestRunner, Matchers } from './PactTestRunner';

// Lightweight smoke test to ensure PactTestRunner operates with Jest.
// Does not connect to any external/provider systems.

describe('PactTestRunner (smoke)', () => {
  const pact = new PactTestRunner({
    consumer: 'cc-task-manager',
    provider: 'claude-code-sdk',
  });

  beforeAll(async () => {
    await pact.setup();
  });

  afterAll(async () => {
    await pact.teardown();
  });

  it('verifies a simple HTTP interaction', async () => {
    // Define a trivial interaction and exercise it using Node http
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

    await pact.executeHttpTest('health check', async (baseUrl) => {
      await new Promise<void>((resolve, reject) => {
        const req = http.request(`${baseUrl}/health`, { method: 'GET' }, (res) => {
          // Consume data to end response
          res.on('data', () => {});
          res.on('end', () => resolve());
        });
        req.on('error', reject);
        req.end();
      });
    });
  });
});
