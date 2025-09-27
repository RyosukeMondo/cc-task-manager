import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';
import { ContractRegistry, ContractRegistration, ContractMetadata } from './ContractRegistry';

/**
 * Version migration strategy schema for handling contract evolution
 */
export const VersionMigrationStrategySchema = z.object({
  fromVersion: z.string(),
  toVersion: z.string(),
  strategy: z.enum(['manual', 'automatic', 'deprecated']),
  migrationScript: z.string().optional(),
  description: z.string(),
  estimatedDuration: z.string().optional(),
  breakingChanges: z.array(z.string()).default([]),
  migrationSteps: z.array(z.string()).default([]),
});

/**
 * Version policy schema for contract versioning rules
 */
export const VersionPolicySchema = z.object({
  contractName: z.string(),
  majorVersionLifetime: z.number().min(1), // months
  minorVersionSupport: z.number().min(1), // concurrent versions
  deprecationNoticePeriod: z.number().min(1), // days
  forcedUpgradeAllowed: z.boolean().default(false),
  compatibilityGuarantees: z.array(z.string()).default([]),
});

/**
 * Version upgrade plan schema for coordinated version transitions
 */
export const VersionUpgradePlanSchema = z.object({
  contractName: z.string(),
  currentVersion: z.string(),
  targetVersion: z.string(),
  phases: z.array(z.object({
    phase: z.string(),
    description: z.string(),
    duration: z.string(),
    actions: z.array(z.string()),
    rollbackPlan: z.string(),
  })),
  timeline: z.object({
    startDate: z.date(),
    endDate: z.date(),
    milestones: z.array(z.object({
      name: z.string(),
      date: z.date(),
      deliverables: z.array(z.string()),
    })),
  }),
  riskAssessment: z.object({
    breakingChanges: z.array(z.string()),
    mitigationStrategies: z.array(z.string()),
    rollbackTriggers: z.array(z.string()),
  }),
});

/**
 * Version compliance status schema for tracking contract adherence
 */
export const VersionComplianceStatusSchema = z.object({
  contractName: z.string(),
  version: z.string(),
  compliant: z.boolean(),
  violations: z.array(z.object({
    type: z.enum(['deprecation', 'compatibility', 'lifecycle', 'policy']),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    remediation: z.string(),
    deadline: z.date().optional(),
  })),
  lastChecked: z.date(),
  nextCheckDue: z.date(),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type VersionMigrationStrategy = z.infer<typeof VersionMigrationStrategySchema>;
export type VersionPolicy = z.infer<typeof VersionPolicySchema>;
export type VersionUpgradePlan = z.infer<typeof VersionUpgradePlanSchema>;
export type VersionComplianceStatus = z.infer<typeof VersionComplianceStatusSchema>;

/**
 * Version Manager Service
 * 
 * Provides comprehensive contract version management with compatibility guarantees,
 * deprecation handling, and migration support. Implements semantic versioning best
 * practices and provides migration guidance for safe contract evolution.
 * 
 * Key Features:
 * - Semantic versioning with backward compatibility enforcement
 * - Deprecation lifecycle management with clear timelines
 * - Migration strategy planning and execution guidance
 * - Version policy enforcement and compliance tracking
 * - Automatic compatibility analysis and breach detection
 */
@Injectable()
export class VersionManager {
  private readonly logger = new Logger(VersionManager.name);
  private readonly migrationStrategies = new Map<string, VersionMigrationStrategy[]>();
  private readonly versionPolicies = new Map<string, VersionPolicy>();
  private readonly upgradePlans = new Map<string, VersionUpgradePlan>();
  private readonly complianceStatus = new Map<string, VersionComplianceStatus>();

  constructor(private readonly contractRegistry: ContractRegistry) {}

  /**
   * Register a version policy for a contract
   * 
   * @param policy Version policy configuration
   * @returns Success status
   */
  async registerVersionPolicy(policy: VersionPolicy): Promise<boolean> {
    try {
      const validatedPolicy = VersionPolicySchema.parse(policy);
      this.versionPolicies.set(validatedPolicy.contractName, validatedPolicy);
      
      this.logger.log(`Version policy registered for contract: ${validatedPolicy.contractName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to register version policy:`, error);
      return false;
    }
  }

  /**
   * Add a migration strategy for version transitions
   * 
   * @param strategy Migration strategy configuration
   * @returns Success status
   */
  async addMigrationStrategy(strategy: VersionMigrationStrategy): Promise<boolean> {
    try {
      const validatedStrategy = VersionMigrationStrategySchema.parse(strategy);
      const contractName = this.extractContractNameFromMigration(validatedStrategy);
      
      if (!this.migrationStrategies.has(contractName)) {
        this.migrationStrategies.set(contractName, []);
      }
      
      const strategies = this.migrationStrategies.get(contractName)!;
      strategies.push(validatedStrategy);
      
      this.logger.log(`Migration strategy added: ${validatedStrategy.fromVersion} → ${validatedStrategy.toVersion}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to add migration strategy:`, error);
      return false;
    }
  }

  /**
   * Check if a version upgrade is compatible according to semantic versioning rules
   * 
   * @param contractName Contract name
   * @param fromVersion Source version
   * @param toVersion Target version
   * @returns Compatibility analysis with detailed feedback
   */
  isUpgradeCompatible(contractName: string, fromVersion: string, toVersion: string): {
    compatible: boolean;
    semverCompliant: boolean;
    breakingChanges: string[];
    warnings: string[];
    migrationRequired: boolean;
    migrationStrategy?: VersionMigrationStrategy;
  } {
    const compatibility = this.contractRegistry.checkCompatibility(contractName, fromVersion, toVersion);
    const semverAnalysis = this.analyzeSemanticVersioning(fromVersion, toVersion);
    const migrationStrategy = this.findMigrationStrategy(contractName, fromVersion, toVersion);

    return {
      compatible: compatibility.compatible && semverAnalysis.compliant,
      semverCompliant: semverAnalysis.compliant,
      breakingChanges: [...compatibility.breakingChanges, ...semverAnalysis.breakingChanges],
      warnings: [...compatibility.warnings, ...semverAnalysis.warnings],
      migrationRequired: migrationStrategy !== undefined,
      migrationStrategy,
    };
  }

  /**
   * Validate version compliance against established policies
   * 
   * @param contractName Contract name
   * @param version Contract version
   * @returns Compliance status with violation details
   */
  validateVersionCompliance(contractName: string, version: string): VersionComplianceStatus {
    const policy = this.versionPolicies.get(contractName);
    const contract = this.contractRegistry.getContract(contractName, version);
    const now = new Date();

    const violations: VersionComplianceStatus['violations'] = [];

    if (!contract) {
      violations.push({
        type: 'policy',
        description: `Contract version not found: ${contractName}@${version}`,
        severity: 'critical',
        remediation: 'Register the contract version or verify the version number',
      });
    }

    if (policy && contract) {
      // Check deprecation policy compliance
      if (contract.metadata.deprecated && contract.metadata.deprecationDate) {
        const daysSinceDeprecation = Math.floor(
          (now.getTime() - contract.metadata.deprecationDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceDeprecation > policy.deprecationNoticePeriod) {
          violations.push({
            type: 'deprecation',
            description: `Version has been deprecated for ${daysSinceDeprecation} days, exceeding policy limit of ${policy.deprecationNoticePeriod} days`,
            severity: 'high',
            remediation: 'Upgrade to a supported version or extend deprecation timeline',
            deadline: new Date(contract.metadata.deprecationDate.getTime() + (policy.deprecationNoticePeriod * 24 * 60 * 60 * 1000)),
          });
        }
      }

      // Check version lifecycle compliance
      const allVersions = this.contractRegistry.getContractVersions(contractName);
      const supportedVersions = this.getSupportedVersions(allVersions, policy);
      
      if (!supportedVersions.includes(version)) {
        violations.push({
          type: 'lifecycle',
          description: `Version ${version} is outside the supported version lifecycle`,
          severity: 'medium',
          remediation: `Upgrade to one of the supported versions: ${supportedVersions.join(', ')}`,
        });
      }
    }

    const status: VersionComplianceStatus = {
      contractName,
      version,
      compliant: violations.length === 0,
      violations,
      lastChecked: now,
      nextCheckDue: new Date(now.getTime() + (24 * 60 * 60 * 1000)), // Check daily
    };

    this.complianceStatus.set(`${contractName}:${version}`, status);
    return status;
  }

  /**
   * Create an upgrade plan for migrating between contract versions
   * 
   * @param contractName Contract name
   * @param fromVersion Source version
   * @param toVersion Target version
   * @param timeline Optional timeline constraints
   * @returns Detailed upgrade plan
   */
  createUpgradePlan(
    contractName: string,
    fromVersion: string,
    toVersion: string,
    timeline?: { startDate: Date; endDate: Date }
  ): VersionUpgradePlan | null {
    const compatibility = this.isUpgradeCompatible(contractName, fromVersion, toVersion);
    const migrationStrategy = compatibility.migrationStrategy;

    if (!compatibility.compatible && !migrationStrategy) {
      this.logger.warn(`Cannot create upgrade plan: incompatible versions ${fromVersion} → ${toVersion}`);
      return null;
    }

    const now = new Date();
    const defaultTimeline = {
      startDate: timeline?.startDate || now,
      endDate: timeline?.endDate || new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)), // 30 days default
      milestones: [
        {
          name: 'Pre-upgrade validation',
          date: new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)),
          deliverables: ['Contract compatibility verification', 'Migration script validation'],
        },
        {
          name: 'Staged rollout',
          date: new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)),
          deliverables: ['Development environment upgrade', 'Testing environment upgrade'],
        },
        {
          name: 'Production deployment',
          date: new Date(now.getTime() + (21 * 24 * 60 * 60 * 1000)),
          deliverables: ['Production upgrade', 'Monitoring validation'],
        },
      ],
    };

    const phases = [
      {
        phase: 'Pre-upgrade',
        description: 'Validate compatibility and prepare for migration',
        duration: '7 days',
        actions: [
          'Run compatibility checks',
          'Validate migration scripts',
          'Backup existing configurations',
          'Notify affected consumers',
        ],
        rollbackPlan: 'No changes made - cancel upgrade plan',
      },
      {
        phase: 'Staged deployment',
        description: 'Deploy to non-production environments',
        duration: '7 days',
        actions: [
          'Deploy to development environment',
          'Run integration tests',
          'Deploy to staging environment',
          'Validate consumer compatibility',
        ],
        rollbackPlan: 'Revert environment configurations, restore previous versions',
      },
      {
        phase: 'Production rollout',
        description: 'Deploy to production with monitoring',
        duration: '7 days',
        actions: [
          'Deploy during maintenance window',
          'Monitor system health',
          'Validate consumer connections',
          'Complete migration cleanup',
        ],
        rollbackPlan: 'Execute emergency rollback procedures, restore from backup',
      },
    ];

    const upgradePlan: VersionUpgradePlan = {
      contractName,
      currentVersion: fromVersion,
      targetVersion: toVersion,
      phases,
      timeline: defaultTimeline,
      riskAssessment: {
        breakingChanges: compatibility.breakingChanges,
        mitigationStrategies: [
          'Comprehensive testing in staging environment',
          'Gradual rollout with monitoring',
          'Immediate rollback capability',
          'Consumer notification and support',
        ],
        rollbackTriggers: [
          'System performance degradation > 20%',
          'Consumer compatibility failures',
          'Critical error rate increase',
          'Business stakeholder escalation',
        ],
      },
    };

    this.upgradePlans.set(`${contractName}:${fromVersion}:${toVersion}`, upgradePlan);
    this.logger.log(`Upgrade plan created: ${contractName} ${fromVersion} → ${toVersion}`);
    
    return upgradePlan;
  }

  /**
   * Mark a contract version as deprecated with deprecation timeline
   * 
   * @param contractName Contract name
   * @param version Version to deprecate
   * @param deprecationDate Deprecation effective date
   * @param reason Deprecation reason
   * @returns Success status
   */
  deprecateVersion(
    contractName: string,
    version: string,
    deprecationDate: Date,
    reason: string
  ): boolean {
    const success = this.contractRegistry.markDeprecated(contractName, version, deprecationDate);
    
    if (success) {
      const policy = this.versionPolicies.get(contractName);
      const endOfLifeDate = policy 
        ? new Date(deprecationDate.getTime() + (policy.deprecationNoticePeriod * 24 * 60 * 60 * 1000))
        : new Date(deprecationDate.getTime() + (90 * 24 * 60 * 60 * 1000)); // Default 90 days

      this.logger.log(`Version deprecated: ${contractName}@${version}`);
      this.logger.log(`End of life: ${endOfLifeDate.toISOString()}`);
      this.logger.log(`Reason: ${reason}`);

      // Create migration strategies for deprecated version
      const latestContract = this.contractRegistry.getLatestContract(contractName);
      if (latestContract && latestContract.metadata.version !== version) {
        this.addMigrationStrategy({
          fromVersion: version,
          toVersion: latestContract.metadata.version,
          strategy: 'manual',
          description: `Migration from deprecated version ${version} to latest ${latestContract.metadata.version}`,
          breakingChanges: [`Version ${version} is deprecated: ${reason}`],
          migrationSteps: [
            'Review breaking changes documentation',
            'Update client code to use new version',
            'Test compatibility with new version',
            'Deploy updated client code',
          ],
        });
      }
    }
    
    return success;
  }

  /**
   * Get all supported versions for a contract according to policy
   * 
   * @param contractName Contract name
   * @returns Array of supported version strings
   */
  getSupportedVersions(contractName: string): string[] {
    const allVersions = this.contractRegistry.getContractVersions(contractName);
    const policy = this.versionPolicies.get(contractName);
    
    if (!policy) {
      // Default policy: support latest major version and non-deprecated versions
      return allVersions
        .filter(contract => !contract.metadata.deprecated)
        .map(contract => contract.metadata.version);
    }

    return this.getSupportedVersions(allVersions, policy);
  }

  /**
   * Get migration guidance for version transitions
   * 
   * @param contractName Contract name
   * @param fromVersion Source version
   * @param toVersion Target version
   * @returns Migration guidance or null if no strategy exists
   */
  getMigrationGuidance(
    contractName: string,
    fromVersion: string,
    toVersion: string
  ): {
    strategy: VersionMigrationStrategy;
    steps: string[];
    estimatedDuration: string;
    risks: string[];
    rollbackPlan: string;
  } | null {
    const strategy = this.findMigrationStrategy(contractName, fromVersion, toVersion);
    
    if (!strategy) {
      return null;
    }

    return {
      strategy,
      steps: strategy.migrationSteps,
      estimatedDuration: strategy.estimatedDuration || 'Not specified',
      risks: strategy.breakingChanges,
      rollbackPlan: `Revert to ${fromVersion} if issues occur during migration`,
    };
  }

  /**
   * Get all compliance violations across all contracts
   * 
   * @returns Array of compliance violations requiring attention
   */
  getAllComplianceViolations(): VersionComplianceStatus[] {
    const violations: VersionComplianceStatus[] = [];
    
    for (const contractName of this.contractRegistry.getContractNames()) {
      const versions = this.contractRegistry.getContractVersions(contractName);
      
      for (const version of versions) {
        const compliance = this.validateVersionCompliance(contractName, version.metadata.version);
        if (!compliance.compliant) {
          violations.push(compliance);
        }
      }
    }

    return violations;
  }

  /**
   * Extract contract name from migration strategy paths
   * 
   * @private
   * @param strategy Migration strategy
   * @returns Contract name
   */
  private extractContractNameFromMigration(strategy: VersionMigrationStrategy): string {
    // For now, we'll need to get this from context or require it as a parameter
    // In a real implementation, this might be embedded in the strategy or derived from registry
    return 'default'; // Placeholder - this would need to be properly implemented
  }

  /**
   * Find migration strategy for version transition
   * 
   * @private
   * @param contractName Contract name
   * @param fromVersion Source version
   * @param toVersion Target version
   * @returns Migration strategy or undefined
   */
  private findMigrationStrategy(
    contractName: string,
    fromVersion: string,
    toVersion: string
  ): VersionMigrationStrategy | undefined {
    const strategies = this.migrationStrategies.get(contractName);
    
    if (!strategies) {
      return undefined;
    }

    return strategies.find(strategy => 
      strategy.fromVersion === fromVersion && strategy.toVersion === toVersion
    );
  }

  /**
   * Analyze semantic versioning compliance
   * 
   * @private
   * @param fromVersion Source version
   * @param toVersion Target version
   * @returns Semantic versioning analysis
   */
  private analyzeSemanticVersioning(fromVersion: string, toVersion: string): {
    compliant: boolean;
    breakingChanges: string[];
    warnings: string[];
  } {
    const [fromMajor, fromMinor, fromPatch] = fromVersion.split('.').map(Number);
    const [toMajor, toMinor, toPatch] = toVersion.split('.').map(Number);

    const breakingChanges: string[] = [];
    const warnings: string[] = [];

    // Major version increases indicate breaking changes
    if (toMajor > fromMajor) {
      breakingChanges.push(`Major version increase: ${fromMajor} → ${toMajor} (breaking changes expected)`);
    } else if (toMajor < fromMajor) {
      breakingChanges.push(`Major version decrease: ${fromMajor} → ${toMajor} (downgrade may lose functionality)`);
    }

    // Minor version changes should be backward compatible
    if (toMinor < fromMinor && toMajor === fromMajor) {
      warnings.push(`Minor version downgrade: ${fromMinor} → ${toMinor} (may lose features)`);
    }

    // Patch version changes should always be compatible
    if (toPatch < fromPatch && toMinor === fromMinor && toMajor === fromMajor) {
      warnings.push(`Patch version downgrade: ${fromPatch} → ${toPatch} (bug fixes may be lost)`);
    }

    return {
      compliant: breakingChanges.length === 0,
      breakingChanges,
      warnings,
    };
  }

  /**
   * Get supported versions according to policy
   * 
   * @private
   * @param allVersions All contract versions
   * @param policy Version policy
   * @returns Array of supported version strings
   */
  private getSupportedVersions(allVersions: ContractRegistration[], policy: VersionPolicy): string[] {
    const now = new Date();
    const supportedVersions: string[] = [];

    // Group versions by major version
    const versionGroups = new Map<number, ContractRegistration[]>();
    
    for (const contract of allVersions) {
      const [major] = contract.metadata.version.split('.').map(Number);
      if (!versionGroups.has(major)) {
        versionGroups.set(major, []);
      }
      versionGroups.get(major)!.push(contract);
    }

    // Apply policy to each major version group
    for (const [major, versions] of versionGroups.entries()) {
      // Check if major version is within lifetime policy
      const latestInMajor = versions.sort((a, b) => {
        const [, aMinor, aPatch] = a.metadata.version.split('.').map(Number);
        const [, bMinor, bPatch] = b.metadata.version.split('.').map(Number);
        if (aMinor !== bMinor) return bMinor - aMinor;
        return bPatch - aPatch;
      })[0];

      const monthsSinceCreation = Math.floor(
        (now.getTime() - latestInMajor.metadata.created.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );

      if (monthsSinceCreation <= policy.majorVersionLifetime) {
        // Include supported minor versions from this major version
        const sortedVersions = versions.sort((a, b) => {
          const [, aMinor] = a.metadata.version.split('.').map(Number);
          const [, bMinor] = b.metadata.version.split('.').map(Number);
          return bMinor - aMinor;
        });

        const supportedMinorVersions = sortedVersions
          .slice(0, policy.minorVersionSupport)
          .filter(contract => !contract.metadata.deprecated)
          .map(contract => contract.metadata.version);

        supportedVersions.push(...supportedMinorVersions);
      }
    }

    return supportedVersions;
  }
}

/**
 * Validation helper functions for runtime type checking
 */
export const validateVersionMigrationStrategy = (data: unknown): VersionMigrationStrategy => {
  return VersionMigrationStrategySchema.parse(data);
};

export const validateVersionPolicy = (data: unknown): VersionPolicy => {
  return VersionPolicySchema.parse(data);
};

export const validateVersionUpgradePlan = (data: unknown): VersionUpgradePlan => {
  return VersionUpgradePlanSchema.parse(data);
};

export const validateVersionComplianceStatus = (data: unknown): VersionComplianceStatus => {
  return VersionComplianceStatusSchema.parse(data);
};