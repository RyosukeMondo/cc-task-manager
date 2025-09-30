import { z } from 'zod';
export declare const ContractMetadataSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    deprecated: z.ZodDefault<z.ZodBoolean>;
    deprecationDate: z.ZodOptional<z.ZodDate>;
    compatibleVersions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    created: z.ZodDefault<z.ZodDate>;
    lastModified: z.ZodDefault<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    version?: string;
    description?: string;
    deprecated?: boolean;
    deprecationDate?: Date;
    compatibleVersions?: string[];
    created?: Date;
    lastModified?: Date;
}, {
    name?: string;
    version?: string;
    description?: string;
    deprecated?: boolean;
    deprecationDate?: Date;
    compatibleVersions?: string[];
    created?: Date;
    lastModified?: Date;
}>;
export declare const ContractRegistrationSchema: z.ZodObject<{
    metadata: z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        deprecated: z.ZodDefault<z.ZodBoolean>;
        deprecationDate: z.ZodOptional<z.ZodDate>;
        compatibleVersions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        created: z.ZodDefault<z.ZodDate>;
        lastModified: z.ZodDefault<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        version?: string;
        description?: string;
        deprecated?: boolean;
        deprecationDate?: Date;
        compatibleVersions?: string[];
        created?: Date;
        lastModified?: Date;
    }, {
        name?: string;
        version?: string;
        description?: string;
        deprecated?: boolean;
        deprecationDate?: Date;
        compatibleVersions?: string[];
        created?: Date;
        lastModified?: Date;
    }>;
    schema: z.ZodAny;
    hash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    metadata?: {
        name?: string;
        version?: string;
        description?: string;
        deprecated?: boolean;
        deprecationDate?: Date;
        compatibleVersions?: string[];
        created?: Date;
        lastModified?: Date;
    };
    schema?: any;
    hash?: string;
}, {
    metadata?: {
        name?: string;
        version?: string;
        description?: string;
        deprecated?: boolean;
        deprecationDate?: Date;
        compatibleVersions?: string[];
        created?: Date;
        lastModified?: Date;
    };
    schema?: any;
    hash?: string;
}>;
export declare const ContractCompatibilitySchema: z.ZodObject<{
    compatible: z.ZodBoolean;
    sourceVersion: z.ZodString;
    targetVersion: z.ZodString;
    issues: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    breakingChanges: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    warnings: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    issues?: string[];
    compatible?: boolean;
    sourceVersion?: string;
    targetVersion?: string;
    breakingChanges?: string[];
    warnings?: string[];
}, {
    issues?: string[];
    compatible?: boolean;
    sourceVersion?: string;
    targetVersion?: string;
    breakingChanges?: string[];
    warnings?: string[];
}>;
export declare const ContractSearchFiltersSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    deprecated: z.ZodOptional<z.ZodBoolean>;
    compatibleWith: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    version?: string;
    deprecated?: boolean;
    compatibleWith?: string;
}, {
    name?: string;
    version?: string;
    deprecated?: boolean;
    compatibleWith?: string;
}>;
export type ContractMetadata = z.infer<typeof ContractMetadataSchema>;
export type ContractRegistration = z.infer<typeof ContractRegistrationSchema>;
export type ContractCompatibility = z.infer<typeof ContractCompatibilitySchema>;
export type ContractSearchFilters = z.infer<typeof ContractSearchFiltersSchema>;
export declare class ContractRegistry {
    private readonly logger;
    private readonly contracts;
    private readonly schemaHashes;
    registerContract(name: string, version: string, schema: z.ZodSchema, metadata?: Partial<ContractMetadata>): Promise<boolean>;
    getContract(name: string, version: string): ContractRegistration | undefined;
    getLatestContract(name: string): ContractRegistration | undefined;
    getContractVersions(name: string): ContractRegistration[];
    searchContracts(filters: ContractSearchFilters): ContractRegistration[];
    checkCompatibility(name: string, sourceVersion: string, targetVersion: string): ContractCompatibility;
    markDeprecated(name: string, version: string, deprecationDate?: Date): boolean;
    getContractNames(): string[];
    validateAgainstContract(name: string, version: string, data: unknown): {
        success: boolean;
        error?: string;
        data?: any;
    };
    private generateSchemaHash;
    private isCompatible;
    private getLatestSemanticVersion;
    private checkSemanticCompatibility;
}
export declare const validateContractMetadata: (data: unknown) => ContractMetadata;
export declare const validateContractRegistration: (data: unknown) => ContractRegistration;
export declare const validateContractCompatibility: (data: unknown) => ContractCompatibility;
export declare const validateContractSearchFilters: (data: unknown) => ContractSearchFilters;
