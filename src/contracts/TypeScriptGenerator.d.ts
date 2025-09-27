import { ContractRegistry } from './ContractRegistry';
export interface TypeScriptGenerationOptions {
    exportType?: 'named' | 'default';
    includeComments?: boolean;
    includeImports?: boolean;
    moduleName?: string;
    outputFormat?: 'module' | 'namespace' | 'interface';
    clientApiGeneration?: boolean;
    baseUrl?: string;
}
export interface GeneratedTypeScript {
    types: string;
    imports: string[];
    exports: string[];
    clientCode?: string;
    metadata: {
        contractName: string;
        contractVersion: string;
        generatedAt: Date;
        dependsOn: string[];
    };
}
export interface ClientApiMethod {
    name: string;
    httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    requestType?: string;
    responseType?: string;
    description?: string;
}
export declare class TypeScriptGenerator {
    private readonly contractRegistry;
    private readonly logger;
    private readonly typeCache;
    private readonly dependencyTracker;
    constructor(contractRegistry: ContractRegistry);
    generateContractTypes(contractName: string, contractVersion: string, options?: TypeScriptGenerationOptions): GeneratedTypeScript | null;
    generateAllContractTypes(options?: TypeScriptGenerationOptions): Map<string, GeneratedTypeScript>;
    generateTypeScriptModule(contractName: string, contractVersion: string, options?: TypeScriptGenerationOptions): string | null;
    generateClientApi(contractName: string, methods: ClientApiMethod[], options?: TypeScriptGenerationOptions): string;
    clearCache(): void;
    private zodToTypeScript;
    private convertZodToTypeScript;
    private handleStringType;
    private handleObjectType;
    private isObjectSchema;
    private trackDependencies;
    private generateImports;
    private generateExports;
    private generateClientCode;
    private generateModuleHeader;
    private sanitizeTypeName;
    private camelCase;
}
export declare const generateTypesFromContract: (contractRegistry: ContractRegistry, contractName: string, contractVersion: string, options?: TypeScriptGenerationOptions) => GeneratedTypeScript | null;
export declare const generateAllTypes: (contractRegistry: ContractRegistry, options?: TypeScriptGenerationOptions) => Map<string, GeneratedTypeScript>;
