import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { PactV3, MessageConsumerPact, MatchersV3, SpecificationVersion } from '@pact-foundation/pact';

/**
 * PactTestRunner
 *
 * Purpose
 * - Provide a small, Jest-friendly wrapper around Pact V3 (HTTP) and Message Pacts
 * - Enforce safe defaults that avoid using production data or networked providers
 * - Standardize error messages to make upgrade/breakage root causes obvious
 *
 * Requirements
 * - 4.1 Contract verification: supports running consumer tests with a local mock provider
 * - 4.2 Upgrade compatibility: stable setup API and explicit Spec version to detect breaking changes
 * - 4.3 Clear error messages: normalized failure formatting and redaction of sensitive values
 *
 * Usage (example):
 *
 *  import { PactTestRunner, Matchers } from '@/contracts/tests/PactTestRunner';
 *
 *  describe('Claude Code SDK consumer', () => {
 *    const pact = new PactTestRunner({
 *      consumer: 'cc-task-manager',
 *      provider: 'claude-code-sdk',
 *    });
 *
 *    beforeAll(async () => {
 *      await pact.setup();
 *    });
 *
 *    afterAll(async () => {
 *      await pact.teardown();
 *    });
 *
 *    it('verifies prompt request/response contract', async () => {
 *      // Define interaction
 *      pact.addHttpInteraction({
 *        uponReceiving: 'a prompt request',
 *        withRequest: {
 *          method: 'POST',
 *          path: '/v1/prompt',
 *          headers: { 'content-type': 'application/json' },
 *          body: Matchers.like({
 *            action: 'prompt',
 *            prompt: Matchers.string('echo "hello"'),
 *            options: Matchers.like({ timeout: 30 }),
 *          }),
 *        },
 *        willRespondWith: {
 *          status: 200,
 *          headers: { 'content-type': 'application/json' },
 *          body: Matchers.like({
 *            event: 'run_completed',
 *            run_id: Matchers.string('run-123'),
 *            outcome: Matchers.regex(/completed|failed|timeout/, 'completed'),
 *            status: Matchers.regex(/completed|failed|timeout/, 'completed'),
 *          }),
 *        },
 *      });
 *
 *      await pact.executeHttpTest('prompt roundtrip', async (mockBaseUrl) => {
 *        // Call your HTTP client against mockBaseUrl (e.g., axios.post(`${mockBaseUrl}/v1/prompt`, ...))
 *        // In this repo, the Claude Code client is process-based, so HTTP tests would wrap
 *        // any future HTTP boundary or adapter used to communicate with the SDK.
 *      });
 *    });
 *  });
 */

export type HttpInteraction = Parameters<PactV3['addInteraction']>[0];

export interface PactRunnerOptions {
  consumer: string;
  provider: string;
  port?: number; // default: random ephemeral
  dir?: string; // pact output dir (defaults to tmp)
  logDir?: string; // log dir (defaults to tmp)
  spec?: SpecificationVersion; // default: SpecificationVersion.SPECIFICATION_VERSION_V3
}

export const Matchers = MatchersV3;

export class PactTestRunner {
  private readonly config: Required<Omit<PactRunnerOptions, 'port' | 'dir' | 'logDir' | 'spec'>> & {
    port: number;
    dir: string;
    logDir: string;
    spec: SpecificationVersion;
  };

  private httpPact?: PactV3;
  private messagePact?: MessageConsumerPact;
  private mockBaseUrl?: string;

  constructor(options: PactRunnerOptions) {
    const tmp = os.tmpdir();

    this.config = {
      consumer: options.consumer,
      provider: options.provider,
      port: options.port ?? this.pickEphemeralPort(),
      dir: options.dir ?? path.join(tmp, 'pacts'),
      logDir: options.logDir ?? path.join(tmp, 'pact-logs'),
      spec: options.spec ?? SpecificationVersion.SPECIFICATION_VERSION_V3,
    };
  }

  /** Setup pact instances with safe defaults */
  async setup(): Promise<void> {
    // HTTP Pact (consumer <-> provider via mock server)
    this.httpPact = new PactV3({
      consumer: this.config.consumer,
      provider: this.config.provider,
      port: this.config.port,
      dir: this.config.dir,
      spec: this.config.spec,
    });

    // Message Pact
    this.messagePact = new MessageConsumerPact({
      consumer: this.config.consumer,
      provider: this.config.provider,
      dir: this.config.dir,
      logLevel: 'warn',
    });

    this.mockBaseUrl = `http://127.0.0.1:${this.config.port}`;
  }

  /**
   * Teardown is intentionally a no-op: pact-js v11+ handles lifecycle within executeTest.
   * We keep this for symmetry and future resource cleanup.
   */
  async teardown(): Promise<void> {
    // no-op
  }

  /** Add an HTTP interaction */
  addHttpInteraction(interaction: HttpInteraction): this {
    if (!this.httpPact) throw new Error(this.errPrefix('HTTP Pact is not initialized. Did you call setup()?'));
    this.httpPact.addInteraction(interaction);
    return this;
  }

  /** Execute the HTTP pact test and verify */
  async executeHttpTest<T>(name: string, testFn: (mockBaseUrl: string) => Promise<T>): Promise<T> {
    if (!this.httpPact || !this.mockBaseUrl) {
      throw new Error(this.errPrefix('HTTP Pact is not initialized. Call setup() first.'));
    }

    try {
      return await this.httpPact.executeTest(async () => {
        return await testFn(this.mockBaseUrl!);
      });
    } catch (err: any) {
      // Normalize and rethrow with clear guidance
      const formatted = this.formatPactError(err, name);
      throw new Error(formatted);
    }
  }

  /**
   * Add and verify a Message Pact (for non-HTTP interactions)
   * The handler should return the message your consumer would receive.
   */
  async verifyMessage(description: string, handler: () => any | Promise<any>): Promise<void> {
    if (!this.messagePact) throw new Error(this.errPrefix('Message Pact is not initialized. Did you call setup()?'));

    try {
      await this.messagePact
        .given('default state')
        .expectsToReceive(description)
        .withContent(await handler())
        .verify(handler);
    } catch (err: any) {
      const formatted = this.formatPactError(err, description);
      throw new Error(formatted);
    }
  }

  /** Helper to derive a local ephemeral port (best-effort, Jest-friendly) */
  private pickEphemeralPort(): number {
    // Use a stable range to reduce flakiness in CI
    const base = 9200;
    const span = 200;
    return base + Math.floor(Math.random() * span);
  }

  /** Prefix for all error messages to make failures easy to grep */
  private errPrefix(msg: string): string {
    return `[PactTestRunner] ${msg}`;
  }

  /**
   * Create an actionable, concise error message for failed verifications.
   * - Redacts common sensitive envs
   * - Surfaces pact logs and output directories for debugging
   */
  private formatPactError(err: unknown, context: string): string {
    const id = randomUUID();
    const safeEnv = this.safeEnvSnapshot();

    const root = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    const stack = err instanceof Error && err.stack ? `\nStack:\n${err.stack}` : '';
    const dirs = `\nPact dirs: pactDir=${this.config.dir}, logDir=${this.config.logDir}`;

    return [
      this.errPrefix(`Verification failed in "${context}" (errorId=${id})`),
      root,
      dirs,
      `\nEnvironment (redacted): ${JSON.stringify(safeEnv)}`,
      stack,
      '\nHints: Ensure you are not pointing at production services. If this broke after upgrading pact, review the changelog and spec version.',
    ].join('\n');
  }

  /** Minimal snapshot of environment that excludes sensitive values */
  private safeEnvSnapshot(): Record<string, string> {
    const redactKeys = new Set([
      'API_KEY', 'TOKEN', 'AUTH', 'PASSWORD', 'SECRET', 'REDIS_PASSWORD',
      'CLAUDE_API_KEY', 'OPENAI_API_KEY'
    ]);

    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (!v) continue;
      if (redactKeys.has(k)) {
        result[k] = '***redacted***';
      } else if (k.includes('KEY') || k.includes('TOKEN') || k.includes('SECRET') || k.includes('PASSWORD')) {
        result[k] = '***redacted***';
      } else {
        // keep only short values to avoid noise
        result[k] = String(v).slice(0, 64);
      }
    }
    return result;
  }
}

export default PactTestRunner;
