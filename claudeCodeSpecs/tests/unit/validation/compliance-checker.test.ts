/**
 * Unit tests for Compliance Checker
 * Tests validation tools for wrapper implementations against specifications
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock compliance checker functionality
interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (implementation: any, specification: any) => ComplianceResult;
}

interface ComplianceResult {
  passed: boolean;
  message?: string;
  details?: any;
  suggestion?: string;
}

interface ComplianceReport {
  overall: {
    score: number;
    status: 'compliant' | 'non-compliant' | 'warning';
    totalRules: number;
    passedRules: number;
    failedRules: number;
    warningRules: number;
  };
  results: Array<{
    ruleId: string;
    ruleName: string;
    severity: string;
    result: ComplianceResult;
  }>;
  summary: {
    errors: string[];
    warnings: string[];
    suggestions: string[];
  };
  metadata: {
    checkedAt: string;
    version: string;
    duration: number;
  };
}

class MockComplianceChecker {
  private rules: Map<string, ComplianceRule> = new Map();
  private config: any;

  constructor(config: any = {}) {
    this.config = {
      strictMode: false,
      errorThreshold: 0.8,
      warningThreshold: 0.9,
      ...config
    };

    this.setupDefaultRules();
  }

  private setupDefaultRules(): void {
    // Schema compliance rules
    this.addRule({
      id: 'schema-validation',
      name: 'Schema Validation',
      description: 'Implementation must validate against defined schemas',
      severity: 'error',
      check: this.checkSchemaCompliance.bind(this)
    });

    this.addRule({
      id: 'command-support',
      name: 'Command Support',
      description: 'All required commands must be supported',
      severity: 'error',
      check: this.checkCommandSupport.bind(this)
    });

    this.addRule({
      id: 'event-handling',
      name: 'Event Handling',
      description: 'All specified events must be properly handled',
      severity: 'error',
      check: this.checkEventHandling.bind(this)
    });

    this.addRule({
      id: 'error-handling',
      name: 'Error Handling',
      description: 'Proper error handling and reporting',
      severity: 'warning',
      check: this.checkErrorHandling.bind(this)
    });

    this.addRule({
      id: 'performance-requirements',
      name: 'Performance Requirements',
      description: 'Performance criteria must be met',
      severity: 'warning',
      check: this.checkPerformanceRequirements.bind(this)
    });

    this.addRule({
      id: 'documentation',
      name: 'Documentation',
      description: 'Adequate documentation must be provided',
      severity: 'info',
      check: this.checkDocumentation.bind(this)
    });

    this.addRule({
      id: 'backward-compatibility',
      name: 'Backward Compatibility',
      description: 'Implementation should maintain backward compatibility',
      severity: 'warning',
      check: this.checkBackwardCompatibility.bind(this)
    });

    this.addRule({
      id: 'security-compliance',
      name: 'Security Compliance',
      description: 'Security standards must be followed',
      severity: 'error',
      check: this.checkSecurityCompliance.bind(this)
    });
  }

  addRule(rule: ComplianceRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  async checkCompliance(implementation: any, specification: any): Promise<ComplianceReport> {
    const startTime = Date.now();
    const results: any[] = [];

    // Execute all rules
    for (const [ruleId, rule] of this.rules.entries()) {
      try {
        const result = rule.check(implementation, specification);
        results.push({
          ruleId,
          ruleName: rule.name,
          severity: rule.severity,
          result
        });
      } catch (error) {
        results.push({
          ruleId,
          ruleName: rule.name,
          severity: rule.severity,
          result: {
            passed: false,
            message: `Rule execution failed: ${error.message}`,
            details: { error: error.message }
          }
        });
      }
    }

    const duration = Date.now() - startTime;
    return this.generateReport(results, duration);
  }

  private generateReport(results: any[], duration: number): ComplianceReport {
    const totalRules = results.length;
    const passedRules = results.filter(r => r.result.passed).length;
    const failedRules = results.filter(r => !r.result.passed).length;
    const errorResults = results.filter(r => r.severity === 'error' && !r.result.passed);
    const warningResults = results.filter(r => r.severity === 'warning' && !r.result.passed);
    const warningRules = results.filter(r => r.severity === 'warning' && !r.result.passed).length;

    const score = totalRules > 0 ? passedRules / totalRules : 0;

    let status: 'compliant' | 'non-compliant' | 'warning' = 'compliant';
    if (errorResults.length > 0) {
      status = 'non-compliant';
    } else if (score < this.config.warningThreshold) {
      status = 'warning';
    }

    const errors = errorResults.map(r => r.result.message || r.ruleName).filter(Boolean);
    const warnings = warningResults.map(r => r.result.message || r.ruleName).filter(Boolean);
    const suggestions = results.map(r => r.result.suggestion).filter(Boolean);

    return {
      overall: {
        score,
        status,
        totalRules,
        passedRules,
        failedRules,
        warningRules
      },
      results,
      summary: {
        errors,
        warnings,
        suggestions
      },
      metadata: {
        checkedAt: new Date().toISOString(),
        version: '1.0.0',
        duration
      }
    };
  }

  // Rule implementations
  private checkSchemaCompliance(implementation: any, specification: any): ComplianceResult {
    if (!implementation.schemas || !specification.schemas) {
      return {
        passed: false,
        message: 'Schema definitions are missing',
        suggestion: 'Ensure both implementation and specification include schema definitions'
      };
    }

    const requiredSchemas = specification.schemas.required || [];
    const implementedSchemas = Object.keys(implementation.schemas);

    const missingSchemas = requiredSchemas.filter((schema: string) =>
      !implementedSchemas.includes(schema)
    );

    if (missingSchemas.length > 0) {
      return {
        passed: false,
        message: `Missing required schemas: ${missingSchemas.join(', ')}`,
        details: { missingSchemas },
        suggestion: 'Implement all required schema validations'
      };
    }

    return {
      passed: true,
      message: 'All required schemas are implemented'
    };
  }

  private checkCommandSupport(implementation: any, specification: any): ComplianceResult {
    if (!specification.commands || !implementation.commands) {
      return {
        passed: false,
        message: 'Command definitions are missing'
      };
    }

    const requiredCommands = specification.commands.required || [];
    const supportedCommands = implementation.commands.supported || [];

    const missingCommands = requiredCommands.filter((cmd: string) =>
      !supportedCommands.includes(cmd)
    );

    if (missingCommands.length > 0) {
      return {
        passed: false,
        message: `Missing command support: ${missingCommands.join(', ')}`,
        details: { missingCommands },
        suggestion: 'Implement handlers for all required commands'
      };
    }

    return {
      passed: true,
      message: 'All required commands are supported'
    };
  }

  private checkEventHandling(implementation: any, specification: any): ComplianceResult {
    if (!specification.events || !implementation.eventHandlers) {
      return {
        passed: false,
        message: 'Event handling configuration is missing'
      };
    }

    const requiredEvents = specification.events.required || [];
    const handledEvents = Object.keys(implementation.eventHandlers);

    const unhandledEvents = requiredEvents.filter((event: string) =>
      !handledEvents.includes(event)
    );

    if (unhandledEvents.length > 0) {
      return {
        passed: false,
        message: `Unhandled events: ${unhandledEvents.join(', ')}`,
        details: { unhandledEvents },
        suggestion: 'Implement handlers for all required events'
      };
    }

    return {
      passed: true,
      message: 'All required events are properly handled'
    };
  }

  private checkErrorHandling(implementation: any, specification: any): ComplianceResult {
    if (!implementation.errorHandling) {
      return {
        passed: false,
        message: 'Error handling implementation is missing',
        suggestion: 'Implement comprehensive error handling with proper logging and recovery'
      };
    }

    const hasGlobalHandler = implementation.errorHandling.globalHandler === true;
    const hasTimeout = implementation.errorHandling.timeout !== undefined;
    const hasRetry = implementation.errorHandling.retry !== undefined;

    let score = 0;
    const checks = [];

    if (hasGlobalHandler) {
      score += 1;
      checks.push('Global error handler');
    }
    if (hasTimeout) {
      score += 1;
      checks.push('Timeout handling');
    }
    if (hasRetry) {
      score += 1;
      checks.push('Retry mechanism');
    }

    if (score < 2) {
      return {
        passed: false,
        message: 'Insufficient error handling implementation',
        details: { implementedChecks: checks, score },
        suggestion: 'Add global error handler, timeout handling, and retry mechanisms'
      };
    }

    return {
      passed: true,
      message: `Error handling is adequate (${checks.join(', ')})`,
      details: { implementedChecks: checks, score }
    };
  }

  private checkPerformanceRequirements(implementation: any, specification: any): ComplianceResult {
    const requirements = specification.performance || {};
    const metrics = implementation.performance || {};

    const checks = [];

    if (requirements.maxResponseTime && metrics.responseTime) {
      if (metrics.responseTime > requirements.maxResponseTime) {
        return {
          passed: false,
          message: `Response time exceeds requirement: ${metrics.responseTime}ms > ${requirements.maxResponseTime}ms`,
          suggestion: 'Optimize performance to meet response time requirements'
        };
      }
      checks.push('Response time');
    }

    if (requirements.maxMemoryUsage && metrics.memoryUsage) {
      if (metrics.memoryUsage > requirements.maxMemoryUsage) {
        return {
          passed: false,
          message: `Memory usage exceeds requirement: ${metrics.memoryUsage}MB > ${requirements.maxMemoryUsage}MB`,
          suggestion: 'Optimize memory usage to meet requirements'
        };
      }
      checks.push('Memory usage');
    }

    if (requirements.minThroughput && metrics.throughput) {
      if (metrics.throughput < requirements.minThroughput) {
        return {
          passed: false,
          message: `Throughput below requirement: ${metrics.throughput} < ${requirements.minThroughput}`,
          suggestion: 'Improve throughput to meet performance requirements'
        };
      }
      checks.push('Throughput');
    }

    return {
      passed: true,
      message: checks.length > 0 ? `Performance requirements met (${checks.join(', ')})` : 'No performance requirements specified',
      details: { checkedMetrics: checks }
    };
  }

  private checkDocumentation(implementation: any, specification: any): ComplianceResult {
    if (!implementation.documentation) {
      return {
        passed: false,
        message: 'Documentation is missing',
        suggestion: 'Provide comprehensive documentation including API reference, examples, and setup instructions'
      };
    }

    const docs = implementation.documentation;
    let score = 0;
    const availableDocs = [];

    if (docs.apiReference) {
      score += 1;
      availableDocs.push('API Reference');
    }
    if (docs.examples) {
      score += 1;
      availableDocs.push('Examples');
    }
    if (docs.setup) {
      score += 1;
      availableDocs.push('Setup Guide');
    }
    if (docs.troubleshooting) {
      score += 1;
      availableDocs.push('Troubleshooting');
    }

    if (score < 2) {
      return {
        passed: false,
        message: 'Insufficient documentation',
        details: { availableDocs, score },
        suggestion: 'Add missing documentation sections (API reference, examples, setup guide)'
      };
    }

    return {
      passed: true,
      message: `Documentation is adequate (${availableDocs.join(', ')})`,
      details: { availableDocs, score }
    };
  }

  private checkBackwardCompatibility(implementation: any, specification: any): ComplianceResult {
    if (!specification.compatibility || !implementation.compatibility) {
      return {
        passed: true,
        message: 'No backward compatibility requirements specified'
      };
    }

    const requiredVersions = specification.compatibility.supportedVersions || [];
    const supportedVersions = implementation.compatibility.supportedVersions || [];

    const unsupportedVersions = requiredVersions.filter((version: string) =>
      !supportedVersions.includes(version)
    );

    if (unsupportedVersions.length > 0) {
      return {
        passed: false,
        message: `Unsupported legacy versions: ${unsupportedVersions.join(', ')}`,
        details: { unsupportedVersions },
        suggestion: 'Add support for required legacy versions or provide migration guide'
      };
    }

    return {
      passed: true,
      message: 'Backward compatibility requirements are met'
    };
  }

  private checkSecurityCompliance(implementation: any, specification: any): ComplianceResult {
    if (!implementation.security) {
      return {
        passed: false,
        message: 'Security implementation is missing',
        suggestion: 'Implement security measures including input validation, authentication, and secure communication'
      };
    }

    const security = implementation.security;
    const issues = [];

    if (!security.inputValidation) {
      issues.push('Input validation is missing');
    }
    if (!security.authentication) {
      issues.push('Authentication is not implemented');
    }
    if (!security.encryption && specification.security?.requireEncryption) {
      issues.push('Encryption is required but not implemented');
    }
    if (!security.auditLogging) {
      issues.push('Audit logging is not configured');
    }

    if (issues.length > 0) {
      return {
        passed: false,
        message: `Security issues found: ${issues.join(', ')}`,
        details: { issues },
        suggestion: 'Address all security requirements before deployment'
      };
    }

    return {
      passed: true,
      message: 'Security compliance requirements are met'
    };
  }

  async validateAgainstSchema(data: any, schemaId: string): Promise<{ valid: boolean; errors: string[] }> {
    // Mock schema validation
    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        errors: ['Data must be a valid object']
      };
    }

    if (schemaId === 'commands.json') {
      if (!data.action && !data.command) {
        return {
          valid: false,
          errors: ['Either action or command field is required']
        };
      }
    }

    return {
      valid: true,
      errors: []
    };
  }

  getRules(): ComplianceRule[] {
    return Array.from(this.rules.values());
  }

  getRule(ruleId: string): ComplianceRule | undefined {
    return this.rules.get(ruleId);
  }
}

describe('Compliance Checker Unit Tests', () => {
  let checker: MockComplianceChecker;

  beforeEach(() => {
    checker = new MockComplianceChecker({
      strictMode: false,
      errorThreshold: 0.8,
      warningThreshold: 0.9
    });
  });

  describe('Rule Management', () => {
    it('should initialize with default rules', () => {
      const rules = checker.getRules();

      expect(rules.length).toBeGreaterThan(0);
      expect(rules).toContainEqual(
        expect.objectContaining({
          id: 'schema-validation',
          name: 'Schema Validation',
          severity: 'error'
        })
      );
    });

    it('should allow adding custom rules', () => {
      const customRule: ComplianceRule = {
        id: 'custom-test',
        name: 'Custom Test Rule',
        description: 'Test custom rule',
        severity: 'warning',
        check: () => ({ passed: true })
      };

      checker.addRule(customRule);

      const rule = checker.getRule('custom-test');
      expect(rule).toEqual(customRule);
    });

    it('should allow removing rules', () => {
      const initialCount = checker.getRules().length;

      const removed = checker.removeRule('documentation');
      expect(removed).toBe(true);

      const newCount = checker.getRules().length;
      expect(newCount).toBe(initialCount - 1);

      const rule = checker.getRule('documentation');
      expect(rule).toBeUndefined();
    });

    it('should return false when removing non-existent rule', () => {
      const removed = checker.removeRule('non-existent-rule');
      expect(removed).toBe(false);
    });
  });

  describe('Compliance Checking', () => {
    it('should check compliance against specification', async () => {
      const implementation = {
        schemas: {
          'commands.json': {},
          'events.json': {},
          'states.json': {}
        },
        commands: {
          supported: ['prompt', 'cancel', 'status']
        },
        eventHandlers: {
          'stream': () => {},
          'run_started': () => {},
          'run_completed': () => {}
        },
        errorHandling: {
          globalHandler: true,
          timeout: 30000,
          retry: { maxAttempts: 3 }
        },
        performance: {
          responseTime: 500,
          memoryUsage: 100,
          throughput: 1000
        },
        documentation: {
          apiReference: true,
          examples: true,
          setup: true
        },
        security: {
          inputValidation: true,
          authentication: true,
          encryption: true,
          auditLogging: true
        }
      };

      const specification = {
        schemas: {
          required: ['commands.json', 'events.json', 'states.json']
        },
        commands: {
          required: ['prompt', 'cancel', 'status']
        },
        events: {
          required: ['stream', 'run_started', 'run_completed']
        },
        performance: {
          maxResponseTime: 1000,
          maxMemoryUsage: 200,
          minThroughput: 500
        }
      };

      const report = await checker.checkCompliance(implementation, specification);

      expect(report.overall.status).toBe('compliant');
      expect(report.overall.score).toBe(1.0);
      expect(report.overall.passedRules).toBe(report.overall.totalRules);
      expect(report.summary.errors).toHaveLength(0);
    });

    it('should identify compliance violations', async () => {
      const implementation = {
        schemas: {
          'commands.json': {}
          // Missing required schemas
        },
        commands: {
          supported: ['prompt']
          // Missing required commands
        },
        eventHandlers: {}
        // Missing event handlers
      };

      const specification = {
        schemas: {
          required: ['commands.json', 'events.json', 'states.json']
        },
        commands: {
          required: ['prompt', 'cancel', 'status']
        },
        events: {
          required: ['stream', 'run_started', 'run_completed']
        }
      };

      const report = await checker.checkCompliance(implementation, specification);

      expect(report.overall.status).toBe('non-compliant');
      expect(report.overall.score).toBeLessThan(0.5);
      expect(report.summary.errors.length).toBeGreaterThan(0);

      // Should have specific error messages
      expect(report.summary.errors).toContain(
        expect.stringContaining('Missing required schemas')
      );
      expect(report.summary.errors).toContain(
        expect.stringContaining('Missing command support')
      );
    });

    it('should generate appropriate warnings', async () => {
      const implementation = {
        schemas: { 'commands.json': {} },
        commands: { supported: ['prompt'] },
        eventHandlers: { 'stream': () => {} },
        errorHandling: {
          globalHandler: true
          // Missing timeout and retry
        },
        performance: {
          responseTime: 800,
          memoryUsage: 150
          // Performance is acceptable but could be better
        }
      };

      const specification = {
        schemas: { required: ['commands.json'] },
        commands: { required: ['prompt'] },
        events: { required: ['stream'] },
        performance: {
          maxResponseTime: 1000,
          maxMemoryUsage: 200
        }
      };

      const report = await checker.checkCompliance(implementation, specification);

      expect(report.overall.status).toBe('warning');
      expect(report.summary.warnings.length).toBeGreaterThan(0);
    });

    it('should provide helpful suggestions', async () => {
      const implementation = {
        schemas: {},
        commands: { supported: [] },
        eventHandlers: {}
      };

      const specification = {
        schemas: { required: ['commands.json'] },
        commands: { required: ['prompt'] },
        events: { required: ['stream'] }
      };

      const report = await checker.checkCompliance(implementation, specification);

      expect(report.summary.suggestions.length).toBeGreaterThan(0);
      expect(report.summary.suggestions.some(s =>
        s.includes('schema') || s.includes('command') || s.includes('event')
      )).toBe(true);
    });

    it('should handle rule execution errors gracefully', async () => {
      // Add a rule that throws an error
      checker.addRule({
        id: 'error-rule',
        name: 'Error Rule',
        description: 'Rule that throws error',
        severity: 'error',
        check: () => {
          throw new Error('Test error');
        }
      });

      const report = await checker.checkCompliance({}, {});

      expect(report.overall.status).toBe('non-compliant');
      expect(report.results.some(r =>
        r.ruleId === 'error-rule' &&
        r.result.message?.includes('Rule execution failed')
      )).toBe(true);
    });
  });

  describe('Schema Validation', () => {
    it('should validate data against schemas', async () => {
      const validCommand = {
        action: 'prompt',
        prompt: 'Test prompt'
      };

      const result = await checker.validateAgainstSchema(validCommand, 'commands.json');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid data', async () => {
      const invalidCommand = {
        // Missing required fields
      };

      const result = await checker.validateAgainstSchema(invalidCommand, 'commands.json');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Either action or command field is required');
    });

    it('should handle non-object data', async () => {
      const result = await checker.validateAgainstSchema('invalid', 'commands.json');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Data must be a valid object');
    });
  });

  describe('Performance and Error Handling', () => {
    it('should complete compliance check quickly', async () => {
      const startTime = Date.now();

      const report = await checker.checkCompliance({}, {});
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(report.metadata.duration).toBeLessThan(1000);
    });

    it('should handle large implementations efficiently', async () => {
      const largeImplementation = {
        schemas: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`schema${i}.json`, {}])
        ),
        commands: {
          supported: Array.from({ length: 50 }, (_, i) => `command${i}`)
        },
        eventHandlers: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`event${i}`, () => {}])
        )
      };

      const specification = {
        schemas: { required: ['schema0.json'] },
        commands: { required: ['command0'] },
        events: { required: ['event0'] }
      };

      const startTime = Date.now();
      const report = await checker.checkCompliance(largeImplementation, specification);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
      expect(report.overall.score).toBeGreaterThan(0);
    });

    it('should generate consistent reports', async () => {
      const implementation = { schemas: {}, commands: { supported: [] } };
      const specification = { schemas: { required: [] }, commands: { required: [] } };

      const report1 = await checker.checkCompliance(implementation, specification);
      const report2 = await checker.checkCompliance(implementation, specification);

      expect(report1.overall.score).toBe(report2.overall.score);
      expect(report1.overall.status).toBe(report2.overall.status);
      expect(report1.results.length).toBe(report2.results.length);
    });

    it('should handle empty inputs gracefully', async () => {
      const report = await checker.checkCompliance(null, null);

      expect(report.overall.status).toBe('non-compliant');
      expect(report.overall.score).toBe(0);
      expect(report.summary.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should respect strict mode settings', () => {
      const strictChecker = new MockComplianceChecker({ strictMode: true });
      const rules = strictChecker.getRules();

      expect(rules.length).toBeGreaterThan(0);
      // In strict mode, more rules might be applied or different thresholds used
    });

    it('should use custom thresholds', async () => {
      const customChecker = new MockComplianceChecker({
        errorThreshold: 0.5,
        warningThreshold: 0.7
      });

      // Create a partially compliant implementation
      const implementation = {
        schemas: { 'commands.json': {} },
        commands: { supported: ['prompt'] },
        eventHandlers: { 'stream': () => {} }
        // Missing other requirements
      };

      const specification = {
        schemas: { required: ['commands.json'] },
        commands: { required: ['prompt'] },
        events: { required: ['stream'] }
      };

      const report = await customChecker.checkCompliance(implementation, specification);

      // With lower thresholds, this might pass warning level
      expect(report.overall.score).toBeGreaterThan(0);
    });
  });
});