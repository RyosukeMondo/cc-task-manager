import { z } from 'zod';
import { ContractRegistry } from './ContractRegistry';
export declare const VersionMigrationStrategySchema: z.ZodObject<{
    fromVersion: z.ZodString;
    toVersion: z.ZodString;
    strategy: z.ZodEnum<["manual", "automatic", "deprecated"]>;
    migrationScript: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    estimatedDuration: z.ZodOptional<z.ZodString>;
    breakingChanges: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    migrationSteps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    description?: string;
    breakingChanges?: string[];
    fromVersion?: string;
    toVersion?: string;
    strategy?: "deprecated" | "manual" | "automatic";
    migrationScript?: string;
    estimatedDuration?: string;
    migrationSteps?: string[];
}, {
    description?: string;
    breakingChanges?: string[];
    fromVersion?: string;
    toVersion?: string;
    strategy?: "deprecated" | "manual" | "automatic";
    migrationScript?: string;
    estimatedDuration?: string;
    migrationSteps?: string[];
}>;
export declare const VersionPolicySchema: z.ZodObject<{
    contractName: z.ZodString;
    majorVersionLifetime: z.ZodNumber;
    minorVersionSupport: z.ZodNumber;
    deprecationNoticePeriod: z.ZodNumber;
    forcedUpgradeAllowed: z.ZodDefault<z.ZodBoolean>;
    compatibilityGuarantees: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    contractName?: string;
    majorVersionLifetime?: number;
    minorVersionSupport?: number;
    deprecationNoticePeriod?: number;
    forcedUpgradeAllowed?: boolean;
    compatibilityGuarantees?: string[];
}, {
    contractName?: string;
    majorVersionLifetime?: number;
    minorVersionSupport?: number;
    deprecationNoticePeriod?: number;
    forcedUpgradeAllowed?: boolean;
    compatibilityGuarantees?: string[];
}>;
export declare const VersionUpgradePlanSchema: z.ZodObject<{
    contractName: z.ZodString;
    currentVersion: z.ZodString;
    targetVersion: z.ZodString;
    phases: z.ZodArray<z.ZodObject<{
        phase: z.ZodString;
        description: z.ZodString;
        duration: z.ZodString;
        actions: z.ZodArray<z.ZodString, "many">;
        rollbackPlan: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        description?: string;
        phase?: string;
        duration?: string;
        actions?: string[];
        rollbackPlan?: string;
    }, {
        description?: string;
        phase?: string;
        duration?: string;
        actions?: string[];
        rollbackPlan?: string;
    }>, "many">;
    timeline: z.ZodObject<{
        startDate: z.ZodDate;
        endDate: z.ZodDate;
        milestones: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            date: z.ZodDate;
            deliverables: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            date?: Date;
            name?: string;
            deliverables?: string[];
        }, {
            date?: Date;
            name?: string;
            deliverables?: string[];
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        startDate?: Date;
        endDate?: Date;
        milestones?: {
            date?: Date;
            name?: string;
            deliverables?: string[];
        }[];
    }, {
        startDate?: Date;
        endDate?: Date;
        milestones?: {
            date?: Date;
            name?: string;
            deliverables?: string[];
        }[];
    }>;
    riskAssessment: z.ZodObject<{
        breakingChanges: z.ZodArray<z.ZodString, "many">;
        mitigationStrategies: z.ZodArray<z.ZodString, "many">;
        rollbackTriggers: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        breakingChanges?: string[];
        mitigationStrategies?: string[];
        rollbackTriggers?: string[];
    }, {
        breakingChanges?: string[];
        mitigationStrategies?: string[];
        rollbackTriggers?: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    targetVersion?: string;
    contractName?: string;
    currentVersion?: string;
    phases?: {
        description?: string;
        phase?: string;
        duration?: string;
        actions?: string[];
        rollbackPlan?: string;
    }[];
    timeline?: {
        startDate?: Date;
        endDate?: Date;
        milestones?: {
            date?: Date;
            name?: string;
            deliverables?: string[];
        }[];
    };
    riskAssessment?: {
        breakingChanges?: string[];
        mitigationStrategies?: string[];
        rollbackTriggers?: string[];
    };
}, {
    targetVersion?: string;
    contractName?: string;
    currentVersion?: string;
    phases?: {
        description?: string;
        phase?: string;
        duration?: string;
        actions?: string[];
        rollbackPlan?: string;
    }[];
    timeline?: {
        startDate?: Date;
        endDate?: Date;
        milestones?: {
            date?: Date;
            name?: string;
            deliverables?: string[];
        }[];
    };
    riskAssessment?: {
        breakingChanges?: string[];
        mitigationStrategies?: string[];
        rollbackTriggers?: string[];
    };
}>;
export declare const VersionComplianceStatusSchema: z.ZodObject<{
    contractName: z.ZodString;
    version: z.ZodString;
    compliant: z.ZodBoolean;
    violations: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["deprecation", "compatibility", "lifecycle", "policy"]>;
        description: z.ZodString;
        severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
        remediation: z.ZodString;
        deadline: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        type?: "deprecation" | "compatibility" | "lifecycle" | "policy";
        description?: string;
        severity?: "low" | "medium" | "high" | "critical";
        remediation?: string;
        deadline?: Date;
    }, {
        type?: "deprecation" | "compatibility" | "lifecycle" | "policy";
        description?: string;
        severity?: "low" | "medium" | "high" | "critical";
        remediation?: string;
        deadline?: Date;
    }>, "many">;
    lastChecked: z.ZodDate;
    nextCheckDue: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    version?: string;
    contractName?: string;
    compliant?: boolean;
    violations?: {
        type?: "deprecation" | "compatibility" | "lifecycle" | "policy";
        description?: string;
        severity?: "low" | "medium" | "high" | "critical";
        remediation?: string;
        deadline?: Date;
    }[];
    lastChecked?: Date;
    nextCheckDue?: Date;
}, {
    version?: string;
    contractName?: string;
    compliant?: boolean;
    violations?: {
        type?: "deprecation" | "compatibility" | "lifecycle" | "policy";
        description?: string;
        severity?: "low" | "medium" | "high" | "critical";
        remediation?: string;
        deadline?: Date;
    }[];
    lastChecked?: Date;
    nextCheckDue?: Date;
}>;
export type VersionMigrationStrategy = z.infer<typeof VersionMigrationStrategySchema>;
export type VersionPolicy = z.infer<typeof VersionPolicySchema>;
export type VersionUpgradePlan = z.infer<typeof VersionUpgradePlanSchema>;
export type VersionComplianceStatus = z.infer<typeof VersionComplianceStatusSchema>;
export declare class VersionManager {
    private readonly contractRegistry;
    private readonly logger;
    private readonly migrationStrategies;
    private readonly versionPolicies;
    private readonly upgradePlans;
    private readonly complianceStatus;
    constructor(contractRegistry: ContractRegistry);
    registerVersionPolicy(policy: VersionPolicy): Promise<boolean>;
    addMigrationStrategy(strategy: VersionMigrationStrategy): Promise<boolean>;
    isUpgradeCompatible(contractName: string, fromVersion: string, toVersion: string): {
        compatible: boolean;
        semverCompliant: boolean;
        breakingChanges: string[];
        warnings: string[];
        migrationRequired: boolean;
        migrationStrategy?: VersionMigrationStrategy;
    };
    validateVersionCompliance(contractName: string, version: string): VersionComplianceStatus;
    createUpgradePlan(contractName: string, fromVersion: string, toVersion: string, timeline?: {
        startDate: Date;
        endDate: Date;
    }): VersionUpgradePlan | null;
    deprecateVersion(contractName: string, version: string, deprecationDate: Date, reason: string): boolean;
    getSupportedVersions(contractName: string): string[];
    getMigrationGuidance(contractName: string, fromVersion: string, toVersion: string): {
        strategy: VersionMigrationStrategy;
        steps: string[];
        estimatedDuration: string;
        risks: string[];
        rollbackPlan: string;
    } | null;
    getAllComplianceViolations(): VersionComplianceStatus[];
    private extractContractNameFromMigration;
    private findMigrationStrategy;
    private analyzeSemanticVersioning;
    private getSupportedVersionsWithPolicy;
}
export declare const validateVersionMigrationStrategy: (data: unknown) => VersionMigrationStrategy;
export declare const validateVersionPolicy: (data: unknown) => VersionPolicy;
export declare const validateVersionUpgradePlan: (data: unknown) => VersionUpgradePlan;
export declare const validateVersionComplianceStatus: (data: unknown) => VersionComplianceStatus;
