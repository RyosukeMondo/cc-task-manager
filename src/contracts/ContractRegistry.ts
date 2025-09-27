import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Contract metadata schema for contract versioning and compatibility tracking
 */
export const ContractMetadataSchema = z.object({
  name: z.string().min(1, 'Contract name is required'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning (e.g., 1.0.0)'),
  description: z.string().optional(),
  deprecated: z.boolean().default(false),
  deprecationDate: z.date().optional(),
  compatibleVersions: z.array(z.string()).default([]),
  created: z.date().default(() => new Date()),
  lastModified: z.date().default(() => new Date()),
});

/**
 * Contract registration schema for storing contracts with their schemas and metadata
 */
export const ContractRegistrationSchema = z.object({
  metadata: ContractMetadataSchema,
  schema: z.any(), // Zod schema - using any to allow flexible schema types
  hash: z.string().min(1, 'Schema hash is required for integrity'),
});

/**
 * Contract compatibility result for version checking operations
 */
export const ContractCompatibilitySchema = z.object({
  compatible: z.boolean(),
  sourceVersion: z.string(),
  targetVersion: z.string(),
  issues: z.array(z.string()).default([]),
  breakingChanges: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

/**
 * Contract search filters for registry queries
 */
export const ContractSearchFiltersSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  deprecated: z.boolean().optional(),
  compatibleWith: z.string().optional(),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type ContractMetadata = z.infer<typeof ContractMetadataSchema>;
export type ContractRegistration = z.infer<typeof ContractRegistrationSchema>;
export type ContractCompatibility = z.infer<typeof ContractCompatibilitySchema>;
export type ContractSearchFilters = z.infer<typeof ContractSearchFiltersSchema>;

/**
 * Contract Registry Service
 * 
 * Provides centralized contract management with versioning, compatibility checking,
 * and schema storage. Follows established TypeScript patterns from worker.config.ts
 * and implements dependency injection for NestJS integration.
 * 
 * Key Features:
 * - Centralized schema storage and retrieval
 * - Semantic versioning with compatibility tracking
 * - Schema integrity validation through hashing
 * - Deprecation management with timeline support
 * - Comprehensive contract metadata management
 */
@Injectable()
export class ContractRegistry {
  private readonly logger = new Logger(ContractRegistry.name);
  private readonly contracts = new Map<string, Map<string, ContractRegistration>>();
  private readonly schemaHashes = new Map<string, string>();

  /**
   * Register a new contract with schema and metadata
   * 
   * @param name Contract name (unique identifier)
   * @param version Semantic version string
   * @param schema Zod schema for validation
   * @param metadata Optional additional metadata
   * @returns Promise resolving to registration success
   */
  async registerContract(
    name: string,
    version: string,
    schema: z.ZodSchema,
    metadata: Partial<ContractMetadata> = {}
  ): Promise<boolean> {
    try {
      // Generate schema hash for integrity checking
      const schemaHash = this.generateSchemaHash(schema);
      
      // Build complete metadata with defaults
      const contractMetadata: ContractMetadata = ContractMetadataSchema.parse({
        name,
        version,
        ...metadata,
        lastModified: new Date(),
      });

      // Create contract registration
      const registration: ContractRegistration = {
        metadata: contractMetadata,
        schema,
        hash: schemaHash,
      };

      // Validate registration
      ContractRegistrationSchema.parse(registration);

      // Store contract by name and version
      if (!this.contracts.has(name)) {
        this.contracts.set(name, new Map());
      }
      
      const contractVersions = this.contracts.get(name)!;
      contractVersions.set(version, registration);
      
      // Store schema hash for duplicate detection
      this.schemaHashes.set(`${name}:${version}`, schemaHash);

      this.logger.log(`Contract registered: ${name}@${version}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to register contract ${name}@${version}:`, error);
      return false;
    }
  }

  /**
   * Retrieve a specific contract by name and version
   * 
   * @param name Contract name
   * @param version Contract version
   * @returns Contract registration or undefined if not found
   */
  getContract(name: string, version: string): ContractRegistration | undefined {
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

  /**
   * Retrieve the latest version of a contract
   * 
   * @param name Contract name
   * @returns Latest contract registration or undefined if not found
   */
  getLatestContract(name: string): ContractRegistration | undefined {
    const contractVersions = this.contracts.get(name);
    if (!contractVersions || contractVersions.size === 0) {
      this.logger.warn(`Contract not found: ${name}`);
      return undefined;
    }

    // Sort versions by semantic versioning and get the latest
    const versions = Array.from(contractVersions.keys());
    const latestVersion = this.getLatestSemanticVersion(versions);
    
    return contractVersions.get(latestVersion);
  }

  /**
   * Get all versions of a specific contract
   * 
   * @param name Contract name
   * @returns Array of all contract registrations for the name
   */
  getContractVersions(name: string): ContractRegistration[] {
    const contractVersions = this.contracts.get(name);
    if (!contractVersions) {
      return [];
    }

    return Array.from(contractVersions.values());
  }

  /**
   * Search contracts by filters
   * 
   * @param filters Search criteria
   * @returns Array of matching contract registrations
   */
  searchContracts(filters: ContractSearchFilters): ContractRegistration[] {
    const validatedFilters = ContractSearchFiltersSchema.parse(filters);
    const results: ContractRegistration[] = [];

    for (const [contractName, versions] of this.contracts.entries()) {
      // Apply name filter
      if (validatedFilters.name && contractName !== validatedFilters.name) {
        continue;
      }

      for (const [version, registration] of versions.entries()) {
        // Apply version filter
        if (validatedFilters.version && version !== validatedFilters.version) {
          continue;
        }

        // Apply deprecated filter
        if (validatedFilters.deprecated !== undefined && 
            registration.metadata.deprecated !== validatedFilters.deprecated) {
          continue;
        }

        // Apply compatibility filter
        if (validatedFilters.compatibleWith && 
            !this.isCompatible(contractName, version, validatedFilters.compatibleWith)) {
          continue;
        }

        results.push(registration);
      }
    }

    return results;
  }

  /**
   * Check compatibility between two contract versions
   * 
   * @param name Contract name
   * @param sourceVersion Source version
   * @param targetVersion Target version
   * @returns Compatibility analysis result
   */
  checkCompatibility(
    name: string,
    sourceVersion: string,
    targetVersion: string
  ): ContractCompatibility {
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

    // Check if versions are explicitly marked as compatible
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

    // Perform semantic version compatibility check
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

  /**
   * Mark a contract version as deprecated
   * 
   * @param name Contract name
   * @param version Contract version
   * @param deprecationDate Optional deprecation date (defaults to now)
   * @returns Success status
   */
  markDeprecated(name: string, version: string, deprecationDate?: Date): boolean {
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

  /**
   * Get all registered contract names
   * 
   * @returns Array of contract names
   */
  getContractNames(): string[] {
    return Array.from(this.contracts.keys());
  }

  /**
   * Validate a data object against a registered contract
   * 
   * @param name Contract name
   * @param version Contract version
   * @param data Data to validate
   * @returns Validation result
   */
  validateAgainstContract(name: string, version: string, data: unknown): { success: boolean; error?: string; data?: any } {
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Generate a hash for schema integrity checking
   * 
   * @private
   * @param schema Zod schema
   * @returns Hash string
   */
  private generateSchemaHash(schema: z.ZodSchema): string {
    // Simple hash generation based on schema structure
    // In production, consider using a more robust hashing algorithm
    const schemaString = JSON.stringify(schema._def);
    let hash = 0;
    for (let i = 0; i < schemaString.length; i++) {
      const char = schemaString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Check if a contract version is compatible with another version
   * 
   * @private
   * @param name Contract name
   * @param version1 First version
   * @param version2 Second version
   * @returns Compatibility status
   */
  private isCompatible(name: string, version1: string, version2: string): boolean {
    const compatibility = this.checkCompatibility(name, version1, version2);
    return compatibility.compatible;
  }

  /**
   * Get the latest semantic version from an array of versions
   * 
   * @private
   * @param versions Array of version strings
   * @returns Latest version string
   */
  private getLatestSemanticVersion(versions: string[]): string {
    return versions.sort((a, b) => {
      const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
      const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
      
      if (aMajor !== bMajor) return bMajor - aMajor;
      if (aMinor !== bMinor) return bMinor - aMinor;
      return bPatch - aPatch;
    })[0];
  }

  /**
   * Check semantic version compatibility
   * 
   * @private
   * @param sourceVersion Source version
   * @param targetVersion Target version
   * @returns Compatibility analysis
   */
  private checkSemanticCompatibility(sourceVersion: string, targetVersion: string): {
    compatible: boolean;
    issues: string[];
    breakingChanges: string[];
    warnings: string[];
  } {
    const [sourceMajor, sourceMinor, sourcePatch] = sourceVersion.split('.').map(Number);
    const [targetMajor, targetMinor, targetPatch] = targetVersion.split('.').map(Number);

    const issues: string[] = [];
    const breakingChanges: string[] = [];
    const warnings: string[] = [];

    // Major version changes are breaking
    if (sourceMajor !== targetMajor) {
      breakingChanges.push(`Major version change: ${sourceMajor} → ${targetMajor}`);
      return {
        compatible: false,
        issues: ['Major version incompatibility'],
        breakingChanges,
        warnings,
      };
    }

    // Minor version increases should be backward compatible
    if (targetMinor > sourceMinor) {
      warnings.push(`Minor version upgrade: ${sourceMinor} → ${targetMinor}`);
    } else if (targetMinor < sourceMinor) {
      warnings.push(`Minor version downgrade: ${sourceMinor} → ${targetMinor} (may lose features)`);
    }

    // Patch version changes should always be compatible
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
}

/**
 * Validation helper functions for runtime type checking
 * Following patterns from worker.config.ts
 */
export const validateContractMetadata = (data: unknown): ContractMetadata => {
  return ContractMetadataSchema.parse(data);
};

export const validateContractRegistration = (data: unknown): ContractRegistration => {
  return ContractRegistrationSchema.parse(data);
};

export const validateContractCompatibility = (data: unknown): ContractCompatibility => {
  return ContractCompatibilitySchema.parse(data);
};

export const validateContractSearchFilters = (data: unknown): ContractSearchFilters => {
  return ContractSearchFiltersSchema.parse(data);
};