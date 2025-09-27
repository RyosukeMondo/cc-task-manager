"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var VersionManager_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateVersionComplianceStatus = exports.validateVersionUpgradePlan = exports.validateVersionPolicy = exports.validateVersionMigrationStrategy = exports.VersionManager = exports.VersionComplianceStatusSchema = exports.VersionUpgradePlanSchema = exports.VersionPolicySchema = exports.VersionMigrationStrategySchema = void 0;
const zod_1 = require("zod");
const common_1 = require("@nestjs/common");
const ContractRegistry_1 = require("./ContractRegistry");
exports.VersionMigrationStrategySchema = zod_1.z.object({
    fromVersion: zod_1.z.string(),
    toVersion: zod_1.z.string(),
    strategy: zod_1.z.enum(['manual', 'automatic', 'deprecated']),
    migrationScript: zod_1.z.string().optional(),
    description: zod_1.z.string(),
    estimatedDuration: zod_1.z.string().optional(),
    breakingChanges: zod_1.z.array(zod_1.z.string()).default([]),
    migrationSteps: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.VersionPolicySchema = zod_1.z.object({
    contractName: zod_1.z.string(),
    majorVersionLifetime: zod_1.z.number().min(1),
    minorVersionSupport: zod_1.z.number().min(1),
    deprecationNoticePeriod: zod_1.z.number().min(1),
    forcedUpgradeAllowed: zod_1.z.boolean().default(false),
    compatibilityGuarantees: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.VersionUpgradePlanSchema = zod_1.z.object({
    contractName: zod_1.z.string(),
    currentVersion: zod_1.z.string(),
    targetVersion: zod_1.z.string(),
    phases: zod_1.z.array(zod_1.z.object({
        phase: zod_1.z.string(),
        description: zod_1.z.string(),
        duration: zod_1.z.string(),
        actions: zod_1.z.array(zod_1.z.string()),
        rollbackPlan: zod_1.z.string(),
    })),
    timeline: zod_1.z.object({
        startDate: zod_1.z.date(),
        endDate: zod_1.z.date(),
        milestones: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            date: zod_1.z.date(),
            deliverables: zod_1.z.array(zod_1.z.string()),
        })),
    }),
    riskAssessment: zod_1.z.object({
        breakingChanges: zod_1.z.array(zod_1.z.string()),
        mitigationStrategies: zod_1.z.array(zod_1.z.string()),
        rollbackTriggers: zod_1.z.array(zod_1.z.string()),
    }),
});
exports.VersionComplianceStatusSchema = zod_1.z.object({
    contractName: zod_1.z.string(),
    version: zod_1.z.string(),
    compliant: zod_1.z.boolean(),
    violations: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['deprecation', 'compatibility', 'lifecycle', 'policy']),
        description: zod_1.z.string(),
        severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
        remediation: zod_1.z.string(),
        deadline: zod_1.z.date().optional(),
    })),
    lastChecked: zod_1.z.date(),
    nextCheckDue: zod_1.z.date(),
});
let VersionManager = VersionManager_1 = class VersionManager {
    constructor(contractRegistry) {
        this.contractRegistry = contractRegistry;
        this.logger = new common_1.Logger(VersionManager_1.name);
        this.migrationStrategies = new Map();
        this.versionPolicies = new Map();
        this.upgradePlans = new Map();
        this.complianceStatus = new Map();
    }
    async registerVersionPolicy(policy) {
        try {
            const validatedPolicy = exports.VersionPolicySchema.parse(policy);
            this.versionPolicies.set(validatedPolicy.contractName, validatedPolicy);
            this.logger.log(`Version policy registered for contract: ${validatedPolicy.contractName}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to register version policy:`, error);
            return false;
        }
    }
    async addMigrationStrategy(strategy) {
        try {
            const validatedStrategy = exports.VersionMigrationStrategySchema.parse(strategy);
            const contractName = this.extractContractNameFromMigration(validatedStrategy);
            if (!this.migrationStrategies.has(contractName)) {
                this.migrationStrategies.set(contractName, []);
            }
            const strategies = this.migrationStrategies.get(contractName);
            strategies.push(validatedStrategy);
            this.logger.log(`Migration strategy added: ${validatedStrategy.fromVersion} → ${validatedStrategy.toVersion}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to add migration strategy:`, error);
            return false;
        }
    }
    isUpgradeCompatible(contractName, fromVersion, toVersion) {
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
    validateVersionCompliance(contractName, version) {
        const policy = this.versionPolicies.get(contractName);
        const contract = this.contractRegistry.getContract(contractName, version);
        const now = new Date();
        const violations = [];
        if (!contract) {
            violations.push({
                type: 'policy',
                description: `Contract version not found: ${contractName}@${version}`,
                severity: 'critical',
                remediation: 'Register the contract version or verify the version number',
            });
        }
        if (policy && contract) {
            if (contract.metadata.deprecated && contract.metadata.deprecationDate) {
                const daysSinceDeprecation = Math.floor((now.getTime() - contract.metadata.deprecationDate.getTime()) / (1000 * 60 * 60 * 24));
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
            const allVersions = this.contractRegistry.getContractVersions(contractName);
            const supportedVersions = this.getSupportedVersionsWithPolicy(allVersions, policy);
            if (!supportedVersions.includes(version)) {
                violations.push({
                    type: 'lifecycle',
                    description: `Version ${version} is outside the supported version lifecycle`,
                    severity: 'medium',
                    remediation: `Upgrade to one of the supported versions: ${supportedVersions.join(', ')}`,
                });
            }
        }
        const status = {
            contractName,
            version,
            compliant: violations.length === 0,
            violations,
            lastChecked: now,
            nextCheckDue: new Date(now.getTime() + (24 * 60 * 60 * 1000)),
        };
        this.complianceStatus.set(`${contractName}:${version}`, status);
        return status;
    }
    createUpgradePlan(contractName, fromVersion, toVersion, timeline) {
        const compatibility = this.isUpgradeCompatible(contractName, fromVersion, toVersion);
        const migrationStrategy = compatibility.migrationStrategy;
        if (!compatibility.compatible && !migrationStrategy) {
            this.logger.warn(`Cannot create upgrade plan: incompatible versions ${fromVersion} → ${toVersion}`);
            return null;
        }
        const now = new Date();
        const defaultTimeline = {
            startDate: timeline?.startDate || now,
            endDate: timeline?.endDate || new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)),
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
        const upgradePlan = {
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
    deprecateVersion(contractName, version, deprecationDate, reason) {
        const success = this.contractRegistry.markDeprecated(contractName, version, deprecationDate);
        if (success) {
            const policy = this.versionPolicies.get(contractName);
            const endOfLifeDate = policy
                ? new Date(deprecationDate.getTime() + (policy.deprecationNoticePeriod * 24 * 60 * 60 * 1000))
                : new Date(deprecationDate.getTime() + (90 * 24 * 60 * 60 * 1000));
            this.logger.log(`Version deprecated: ${contractName}@${version}`);
            this.logger.log(`End of life: ${endOfLifeDate.toISOString()}`);
            this.logger.log(`Reason: ${reason}`);
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
    getSupportedVersions(contractName) {
        const allVersions = this.contractRegistry.getContractVersions(contractName);
        const policy = this.versionPolicies.get(contractName);
        if (!policy) {
            return allVersions
                .filter(contract => !contract.metadata.deprecated)
                .map(contract => contract.metadata.version);
        }
        return this.getSupportedVersionsWithPolicy(allVersions, policy);
    }
    getMigrationGuidance(contractName, fromVersion, toVersion) {
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
    getAllComplianceViolations() {
        const violations = [];
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
    extractContractNameFromMigration(strategy) {
        return 'default';
    }
    findMigrationStrategy(contractName, fromVersion, toVersion) {
        const strategies = this.migrationStrategies.get(contractName);
        if (!strategies) {
            return undefined;
        }
        return strategies.find(strategy => strategy.fromVersion === fromVersion && strategy.toVersion === toVersion);
    }
    analyzeSemanticVersioning(fromVersion, toVersion) {
        const [fromMajor, fromMinor, fromPatch] = fromVersion.split('.').map(Number);
        const [toMajor, toMinor, toPatch] = toVersion.split('.').map(Number);
        const breakingChanges = [];
        const warnings = [];
        if (toMajor > fromMajor) {
            breakingChanges.push(`Major version increase: ${fromMajor} → ${toMajor} (breaking changes expected)`);
        }
        else if (toMajor < fromMajor) {
            breakingChanges.push(`Major version decrease: ${fromMajor} → ${toMajor} (downgrade may lose functionality)`);
        }
        if (toMinor < fromMinor && toMajor === fromMajor) {
            warnings.push(`Minor version downgrade: ${fromMinor} → ${toMinor} (may lose features)`);
        }
        if (toPatch < fromPatch && toMinor === fromMinor && toMajor === fromMajor) {
            warnings.push(`Patch version downgrade: ${fromPatch} → ${toPatch} (bug fixes may be lost)`);
        }
        return {
            compliant: breakingChanges.length === 0,
            breakingChanges,
            warnings,
        };
    }
    getSupportedVersionsWithPolicy(allVersions, policy) {
        const now = new Date();
        const supportedVersions = [];
        const versionGroups = new Map();
        for (const contract of allVersions) {
            const [major] = contract.metadata.version.split('.').map(Number);
            if (!versionGroups.has(major)) {
                versionGroups.set(major, []);
            }
            versionGroups.get(major).push(contract);
        }
        for (const [major, versions] of versionGroups.entries()) {
            const latestInMajor = versions.sort((a, b) => {
                const [, aMinor, aPatch] = a.metadata.version.split('.').map(Number);
                const [, bMinor, bPatch] = b.metadata.version.split('.').map(Number);
                if (aMinor !== bMinor)
                    return bMinor - aMinor;
                return bPatch - aPatch;
            })[0];
            const monthsSinceCreation = Math.floor((now.getTime() - latestInMajor.metadata.created.getTime()) / (1000 * 60 * 60 * 24 * 30));
            if (monthsSinceCreation <= policy.majorVersionLifetime) {
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
};
exports.VersionManager = VersionManager;
exports.VersionManager = VersionManager = VersionManager_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ContractRegistry_1.ContractRegistry])
], VersionManager);
const validateVersionMigrationStrategy = (data) => {
    return exports.VersionMigrationStrategySchema.parse(data);
};
exports.validateVersionMigrationStrategy = validateVersionMigrationStrategy;
const validateVersionPolicy = (data) => {
    return exports.VersionPolicySchema.parse(data);
};
exports.validateVersionPolicy = validateVersionPolicy;
const validateVersionUpgradePlan = (data) => {
    return exports.VersionUpgradePlanSchema.parse(data);
};
exports.validateVersionUpgradePlan = validateVersionUpgradePlan;
const validateVersionComplianceStatus = (data) => {
    return exports.VersionComplianceStatusSchema.parse(data);
};
exports.validateVersionComplianceStatus = validateVersionComplianceStatus;
//# sourceMappingURL=VersionManager.js.map