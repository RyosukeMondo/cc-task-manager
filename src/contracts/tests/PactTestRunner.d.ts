import { PactV3, MatchersV3, SpecificationVersion } from '@pact-foundation/pact';
export type HttpInteraction = Parameters<PactV3['addInteraction']>[0];
export interface PactRunnerOptions {
    consumer: string;
    provider: string;
    port?: number;
    dir?: string;
    logDir?: string;
    spec?: SpecificationVersion;
}
export declare const Matchers: typeof MatchersV3;
export declare class PactTestRunner {
    private readonly config;
    private httpPact?;
    private messagePact?;
    private mockBaseUrl?;
    constructor(options: PactRunnerOptions);
    setup(): Promise<void>;
    teardown(): Promise<void>;
    addHttpInteraction(interaction: HttpInteraction): this;
    executeHttpTest<T>(name: string, testFn: (mockBaseUrl: string) => Promise<T>): Promise<T>;
    verifyMessage(description: string, handler: () => any | Promise<any>): Promise<void>;
    private pickEphemeralPort;
    private errPrefix;
    private formatPactError;
    private safeEnvSnapshot;
}
export default PactTestRunner;
