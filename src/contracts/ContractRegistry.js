"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ContractRegistry_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateContractSearchFilters = exports.validateContractCompatibility = exports.validateContractRegistration = exports.validateContractMetadata = exports.ContractRegistry = exports.ContractSearchFiltersSchema = exports.ContractCompatibilitySchema = exports.ContractRegistrationSchema = exports.ContractMetadataSchema = void 0;
const zod_1 = require("zod");
const common_1 = require("@nestjs/common");
exports.ContractMetadataSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Contract name is required'),
    version: zod_1.z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning (e.g., 1.0.0)'),
    description: zod_1.z.string().optional(),
    deprecated: zod_1.z.boolean().default(false),
    deprecationDate: zod_1.z.date().optional(),
    compatibleVersions: zod_1.z.array(zod_1.z.string()).default([]),
    created: zod_1.z.date().default(() => new Date()),
    lastModified: zod_1.z.date().default(() => new Date()),
});
exports.ContractRegistrationSchema = zod_1.z.object({
    metadata: exports.ContractMetadataSchema,
    schema: zod_1.z.any(),
    hash: zod_1.z.string().min(1, 'Schema hash is required for integrity'),
});
exports.ContractCompatibilitySchema = zod_1.z.object({
    compatible: zod_1.z.boolean(),
    sourceVersion: zod_1.z.string(),
    targetVersion: zod_1.z.string(),
    issues: zod_1.z.array(zod_1.z.string()).default([]),
    breakingChanges: zod_1.z.array(zod_1.z.string()).default([]),
    warnings: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.ContractSearchFiltersSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    version: zod_1.z.string().optional(),
    deprecated: zod_1.z.boolean().optional(),
    compatibleWith: zod_1.z.string().optional(),
});
let ContractRegistry = ContractRegistry_1 = class ContractRegistry {
    constructor() {
        this.logger = new common_1.Logger(ContractRegistry_1.name);
        this.contracts = new Map();
        this.schemaHashes = new Map();
    }
    async registerContract(name, version, schema, metadata = {}) {
        try {
            const schemaHash = this.generateSchemaHash(schema);
            const contractMetadata = exports.ContractMetadataSchema.parse({
                name,
                version,
                ...metadata,
                lastModified: new Date(),
            });
            const registration = {
                metadata: contractMetadata,
                schema,
                hash: schemaHash,
            };
            exports.ContractRegistrationSchema.parse(registration);
            if (!this.contracts.has(name)) {
                this.contracts.set(name, new Map());
            }
            const contractVersions = this.contracts.get(name);
            contractVersions.set(version, registration);
            this.schemaHashes.set(`${name}:${version}`, schemaHash);
            this.logger.log(`Contract registered: ${name}@${version}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to register contract ${name}@${version}:`, error);
            return false;
        }
    }
    getContract(name, version) {
        const contractVersions = this.contracts.get(name);
        if (!contractVersions) {
            this.logger.warn(`Contract not found: ${name}`);
            return undefined;
        }
        const contract = contractVersions.get(version);
        if (!contract) {
            this.logger.warn(`Contract version not found: ${name}@${version}`);
            return undefined;
        }
        return contract;
    }
    getLatestContract(name) {
        const contractVersions = this.contracts.get(name);
        if (!contractVersions || contractVersions.size === 0) {
            this.logger.warn(`Contract not found: ${name}`);
            return undefined;
        }
        const versions = Array.from(contractVersions.keys());
        const latestVersion = this.getLatestSemanticVersion(versions);
        return contractVersions.get(latestVersion);
    }
    getContractVersions(name) {
        const contractVersions = this.contracts.get(name);
        if (!contractVersions) {
            return [];
        }
        return Array.from(contractVersions.values());
    }
    searchContracts(filters) {
        const validatedFilters = exports.ContractSearchFiltersSchema.parse(filters);
        const results = [];
        for (const [contractName, versions] of this.contracts.entries()) {
            if (validatedFilters.name && contractName !== validatedFilters.name) {
                continue;
            }
            for (const [version, registration] of versions.entries()) {
                if (validatedFilters.version && version !== validatedFilters.version) {
                    continue;
                }
                if (validatedFilters.deprecated !== undefined &&
                    registration.metadata.deprecated !== validatedFilters.deprecated) {
                    continue;
                }
                if (validatedFilters.compatibleWith &&
                    !this.isCompatible(contractName, version, validatedFilters.compatibleWith)) {
                    continue;
                }
                results.push(registration);
            }
        }
        return results;
    }
    checkCompatibility(name, sourceVersion, targetVersion) {
        const sourceContract = this.getContract(name, sourceVersion);
        const targetContract = this.getContract(name, targetVersion);
        if (!sourceContract || !targetContract) {
            return {
                compatible: false,
                sourceVersion,
                targetVersion,
                issues: ['One or both contract versions not found'],
                breakingChanges: [],
                warnings: [],
            };
        }
        const explicitlyCompatible = sourceContract.metadata.compatibleVersions.includes(targetVersion) ||
            targetContract.metadata.compatibleVersions.includes(sourceVersion);
        if (explicitlyCompatible) {
            return {
                compatible: true,
                sourceVersion,
                targetVersion,
                issues: [],
                breakingChanges: [],
                warnings: [],
            };
        }
        const semanticCompatibility = this.checkSemanticCompatibility(sourceVersion, targetVersion);
        return {
            compatible: semanticCompatibility.compatible,
            sourceVersion,
            targetVersion,
            issues: semanticCompatibility.issues,
            breakingChanges: semanticCompatibility.breakingChanges,
            warnings: semanticCompatibility.warnings,
        };
    }
    markDeprecated(name, version, deprecationDate) {
        const contract = this.getContract(name, version);
        if (!contract) {
            this.logger.error(`Cannot deprecate non-existent contract: ${name}@${version}`);
            return false;
        }
        contract.metadata.deprecated = true;
        contract.metadata.deprecationDate = deprecationDate || new Date();
        contract.metadata.lastModified = new Date();
        this.logger.log(`Contract deprecated: ${name}@${version}`);
        return true;
    }
    getContractNames() {
        return Array.from(this.contracts.keys());
    }
    validateAgainstContract(name, version, data) {
        const contract = this.getContract(name, version);
        if (!contract) {
            return {
                success: false,
                error: `Contract not found: ${name}@${version}`,
            };
        }
        try {
            const validatedData = contract.schema.parse(data);
            return {
                success: true,
                data: validatedData,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Validation failed',
            };
        }
    }
    generateSchemaHash(schema) {
        const schemaString = JSON.stringify(schema._def);
        let hash = 0;
        for (let i = 0; i < schemaString.length; i++) {
            const char = schemaString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
    isCompatible(name, version1, version2) {
        const compatibility = this.checkCompatibility(name, version1, version2);
        return compatibility.compatible;
    }
    getLatestSemanticVersion(versions) {
        return versions.sort((a, b) => {
            const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
            const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
            if (aMajor !== bMajor)
                return bMajor - aMajor;
            if (aMinor !== bMinor)
                return bMinor - aMinor;
            return bPatch - aPatch;
        })[0];
    }
    checkSemanticCompatibility(sourceVersion, targetVersion) {
        const [sourceMajor, sourceMinor, sourcePatch] = sourceVersion.split('.').map(Number);
        const [targetMajor, targetMinor, targetPatch] = targetVersion.split('.').map(Number);
        const issues = [];
        const breakingChanges = [];
        const warnings = [];
        if (sourceMajor !== targetMajor) {
            breakingChanges.push(`Major version change: ${sourceMajor} → ${targetMajor}`);
            return {
                compatible: false,
                issues: ['Major version incompatibility'],
                breakingChanges,
                warnings,
            };
        }
        if (targetMinor > sourceMinor) {
            warnings.push(`Minor version upgrade: ${sourceMinor} → ${targetMinor}`);
        }
        else if (targetMinor < sourceMinor) {
            warnings.push(`Minor version downgrade: ${sourceMinor} → ${targetMinor} (may lose features)`);
        }
        if (targetPatch !== sourcePatch) {
            warnings.push(`Patch version change: ${sourcePatch} → ${targetPatch}`);
        }
        return {
            compatible: true,
            issues,
            breakingChanges,
            warnings,
        };
    }
};
exports.ContractRegistry = ContractRegistry;
exports.ContractRegistry = ContractRegistry = ContractRegistry_1 = __decorate([
    (0, common_1.Injectable)()
], ContractRegistry);
const validateContractMetadata = (data) => {
    return exports.ContractMetadataSchema.parse(data);
};
exports.validateContractMetadata = validateContractMetadata;
const validateContractRegistration = (data) => {
    return exports.ContractRegistrationSchema.parse(data);
};
exports.validateContractRegistration = validateContractRegistration;
const validateContractCompatibility = (data) => {
    return exports.ContractCompatibilitySchema.parse(data);
};
exports.validateContractCompatibility = validateContractCompatibility;
const validateContractSearchFilters = (data) => {
    return exports.ContractSearchFiltersSchema.parse(data);
};
exports.validateContractSearchFilters = validateContractSearchFilters;
//# sourceMappingURL=ContractRegistry.js.map