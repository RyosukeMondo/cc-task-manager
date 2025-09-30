"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PactTestRunner = exports.Matchers = void 0;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = require("crypto");
const pact_1 = require("@pact-foundation/pact");
exports.Matchers = pact_1.MatchersV3;
class PactTestRunner {
    constructor(options) {
        let tmp;
        try {
            tmp = process.env.TMPDIR || os_1.default.tmpdir() || '/tmp';
        }
        catch {
            tmp = '/tmp';
        }
        const safePath = (base, ...parts) => {
            try {
                return path_1.default.join(base, ...parts);
            }
            catch {
                return `${base}/${parts.join('/')}`;
            }
        };
        this.config = {
            consumer: options.consumer,
            provider: options.provider,
            port: options.port ?? this.pickEphemeralPort(),
            dir: options.dir ?? safePath(tmp, 'pacts'),
            logDir: options.logDir ?? safePath(tmp, 'pact-logs'),
            spec: options.spec ?? pact_1.SpecificationVersion.SPECIFICATION_VERSION_V3,
        };
    }
    async setup() {
        this.httpPact = new pact_1.PactV3({
            consumer: this.config.consumer,
            provider: this.config.provider,
            port: this.config.port,
            dir: this.config.dir,
            spec: this.config.spec,
        });
        this.messagePact = new pact_1.MessageConsumerPact({
            consumer: this.config.consumer,
            provider: this.config.provider,
            dir: this.config.dir,
            logLevel: 'warn',
        });
        this.mockBaseUrl = `http://127.0.0.1:${this.config.port}`;
    }
    async teardown() {
    }
    addHttpInteraction(interaction) {
        if (!this.httpPact)
            throw new Error(this.errPrefix('HTTP Pact is not initialized. Did you call setup()?'));
        this.httpPact.addInteraction(interaction);
        return this;
    }
    async executeHttpTest(name, testFn) {
        if (!this.httpPact || !this.mockBaseUrl) {
            throw new Error(this.errPrefix('HTTP Pact is not initialized. Call setup() first.'));
        }
        try {
            return await this.httpPact.executeTest(async () => {
                return await testFn(this.mockBaseUrl);
            });
        }
        catch (err) {
            const formatted = this.formatPactError(err, name);
            throw new Error(formatted);
        }
    }
    async verifyMessage(description, handler) {
        if (!this.messagePact)
            throw new Error(this.errPrefix('Message Pact is not initialized. Did you call setup()?'));
        try {
            await this.messagePact
                .given('default state')
                .expectsToReceive(description)
                .withContent(await handler())
                .verify(handler);
        }
        catch (err) {
            const formatted = this.formatPactError(err, description);
            throw new Error(formatted);
        }
    }
    pickEphemeralPort() {
        const base = 9200;
        const span = 200;
        return base + Math.floor(Math.random() * span);
    }
    errPrefix(msg) {
        return `[PactTestRunner] ${msg}`;
    }
    formatPactError(err, context) {
        const id = (0, crypto_1.randomUUID)();
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
    safeEnvSnapshot() {
        const redactKeys = new Set([
            'API_KEY', 'TOKEN', 'AUTH', 'PASSWORD', 'SECRET', 'REDIS_PASSWORD',
            'CLAUDE_API_KEY', 'OPENAI_API_KEY'
        ]);
        const result = {};
        for (const [k, v] of Object.entries(process.env)) {
            if (!v)
                continue;
            if (redactKeys.has(k)) {
                result[k] = '***redacted***';
            }
            else if (k.includes('KEY') || k.includes('TOKEN') || k.includes('SECRET') || k.includes('PASSWORD')) {
                result[k] = '***redacted***';
            }
            else {
                result[k] = String(v).slice(0, 64);
            }
        }
        return result;
    }
}
exports.PactTestRunner = PactTestRunner;
exports.default = PactTestRunner;
//# sourceMappingURL=PactTestRunner.js.map