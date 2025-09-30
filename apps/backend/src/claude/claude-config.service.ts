import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { join } from 'path';

/**
 * Claude Code configuration schema
 * Implements comprehensive validation for all Claude Code settings
 */
export const ClaudeConfigSchema = z.object({
  // Python wrapper configuration
  wrapper: z.object({
    pythonPath: z.string().min(1).default('python3'),
    wrapperPath: z.string().min(1).default(join(process.cwd(), 'scripts', 'claude_wrapper.py')),
    unbuffered: z.boolean().default(true),
    workingDirectory: z.string().optional(),
  }),

  // Process management
  process: z.object({
    initializationTimeout: z.number().int().min(1000).default(10000), // 10 seconds
    shutdownTimeout: z.number().int().min(1000).default(5000), // 5 seconds
    responseTimeout: z.number().int().min(1000).default(30000), // 30 seconds
    maxRetries: z.number().int().min(0).default(3),
    retryDelay: z.number().int().min(100).default(1000), // 1 second
  }),

  // Session management
  session: z.object({
    maxSessions: z.number().int().min(1).default(10),
    sessionTimeout: z.number().int().min(60000).default(1800000), // 30 minutes
    cleanupInterval: z.number().int().min(30000).default(300000), // 5 minutes
    defaultPermissionMode: z.enum(['ask', 'bypassPermissions']).default('ask'),
    exitOnComplete: z.boolean().default(true),
  }),

  // Queue integration
  queue: z.object({
    enabled: z.boolean().default(true),
    maxConcurrency: z.number().int().min(1).default(5),
    defaultPriority: z.number().int().min(1).max(10).default(5),
    taskTimeout: z.number().int().min(60000).default(3600000), // 1 hour
    retryAttempts: z.number().int().min(0).default(3),
    retryDelay: z.number().int().min(1000).default(5000), // 5 seconds
  }),

  // Streaming configuration
  streaming: z.object({
    enabled: z.boolean().default(true),
    bufferSize: z.number().int().min(1024).default(64 * 1024), // 64KB
    flushInterval: z.number().int().min(10).default(100), // 100ms
    maxChunkSize: z.number().int().min(1024).default(8 * 1024), // 8KB
    compression: z.boolean().default(false),
  }),

  // Error handling
  errorHandling: z.object({
    enableRetry: z.boolean().default(true),
    maxRetryAttempts: z.number().int().min(0).default(3),
    retryBackoff: z.enum(['fixed', 'exponential']).default('exponential'),
    retryDelay: z.number().int().min(100).default(1000),
    enableCircuitBreaker: z.boolean().default(true),
    circuitBreakerThreshold: z.number().int().min(1).default(5),
    circuitBreakerTimeout: z.number().int().min(5000).default(30000), // 30 seconds
  }),

  // Performance monitoring
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsInterval: z.number().int().min(1000).default(60000), // 1 minute
    enablePerformanceLogging: z.boolean().default(false),
    enableResourceMonitoring: z.boolean().default(true),
    alertThresholds: z.object({
      responseTime: z.number().int().min(1000).default(10000), // 10 seconds
      errorRate: z.number().min(0).max(1).default(0.1), // 10%
      memoryUsage: z.number().min(0).max(1).default(0.8), // 80%
    }),
  }),

  // Security settings
  security: z.object({
    enableSandbox: z.boolean().default(false),
    allowedCommands: z.array(z.string()).default(['prompt', 'cancel', 'status', 'shutdown']),
    commandValidation: z.boolean().default(true),
    enableAuditLogging: z.boolean().default(true),
    maxPayloadSize: z.number().int().min(1024).default(1024 * 1024), // 1MB
  }),

  // Environment-specific settings
  environment: z.object({
    enableDebugLogging: z.boolean().default(false),
    enableVerboseOutput: z.boolean().default(false),
    enableTestMode: z.boolean().default(false),
    enableDevelopmentFeatures: z.boolean().default(false),
  }),
});

/**
 * TypeScript type derived from Zod schema
 */
export type ClaudeConfig = z.infer<typeof ClaudeConfigSchema>;

/**
 * Default configuration for different environments
 */
const DEFAULT_CONFIGS = {
  development: {
    environment: {
      enableDebugLogging: true,
      enableVerboseOutput: true,
      enableDevelopmentFeatures: true,
    },
    monitoring: {
      enablePerformanceLogging: true,
    },
    session: {
      defaultPermissionMode: 'bypassPermissions' as const,
    },
  },
  test: {
    environment: {
      enableTestMode: true,
      enableDebugLogging: false,
      enableVerboseOutput: false,
    },
    session: {
      maxSessions: 2,
      sessionTimeout: 60000, // 1 minute for tests
    },
    process: {
      initializationTimeout: 5000, // 5 seconds for tests
      shutdownTimeout: 2000, // 2 seconds for tests
    },
  },
  production: {
    environment: {
      enableDebugLogging: false,
      enableVerboseOutput: false,
      enableTestMode: false,
      enableDevelopmentFeatures: false,
    },
    monitoring: {
      enablePerformanceLogging: false,
    },
    security: {
      enableSandbox: true,
      enableAuditLogging: true,
    },
    errorHandling: {
      enableCircuitBreaker: true,
    },
  },
} as const;

/**
 * Claude Code Configuration Service
 *
 * Implements configuration management for Claude Code settings following SOLID principles:
 *
 * - Single Responsibility: Manage Claude Code configuration exclusively
 * - Open/Closed: Extensible for new configuration options
 * - Liskov Substitution: Can be substituted with other config implementations
 * - Interface Segregation: Focused interface for Claude Code configuration
 * - Dependency Inversion: Depends on abstractions through ConfigService
 *
 * Applies KISS principle for simple configuration access
 * Ensures DRY/SSOT compliance with centralized configuration logic
 * Implements fail-fast validation and comprehensive error handling
 *
 * Key Features:
 * - Type-safe configuration with Zod validation
 * - Environment-specific configuration support
 * - Dynamic configuration updates
 * - Configuration security validation
 * - Comprehensive error handling with detailed error messages
 */
@Injectable()
export class ClaudeConfigService {
  private readonly logger = new Logger(ClaudeConfigService.name);
  private config: ClaudeConfig;
  private readonly environment: string;

  constructor(private readonly configService: ConfigService) {
    this.environment = this.configService.get('NODE_ENV', 'development');
    this.config = this.loadAndValidateConfig();
    this.validateConfiguration();
    this.logger.log(`Claude Code configuration loaded for environment: ${this.environment}`);
  }

  /**
   * Get complete Claude Code configuration
   * Provides type-safe access to all configuration options
   *
   * @returns Validated Claude Code configuration
   */
  getConfig(): ClaudeConfig {
    return this.config;
  }

  /**
   * Get wrapper configuration
   * Contains Python wrapper and process settings
   *
   * @returns Wrapper configuration object
   */
  getWrapperConfig(): ClaudeConfig['wrapper'] {
    return this.config.wrapper;
  }

  /**
   * Get process management configuration
   * Contains timeouts and retry settings
   *
   * @returns Process configuration object
   */
  getProcessConfig(): ClaudeConfig['process'] {
    return this.config.process;
  }

  /**
   * Get session management configuration
   * Contains session limits and default settings
   *
   * @returns Session configuration object
   */
  getSessionConfig(): ClaudeConfig['session'] {
    return this.config.session;
  }

  /**
   * Get queue configuration
   * Contains queue integration and concurrency settings
   *
   * @returns Queue configuration object
   */
  getQueueConfig(): ClaudeConfig['queue'] {
    return this.config.queue;
  }

  /**
   * Get streaming configuration
   * Contains real-time streaming settings
   *
   * @returns Streaming configuration object
   */
  getStreamingConfig(): ClaudeConfig['streaming'] {
    return this.config.streaming;
  }

  /**
   * Get error handling configuration
   * Contains retry and circuit breaker settings
   *
   * @returns Error handling configuration object
   */
  getErrorHandlingConfig(): ClaudeConfig['errorHandling'] {
    return this.config.errorHandling;
  }

  /**
   * Get monitoring configuration
   * Contains performance monitoring and alerting settings
   *
   * @returns Monitoring configuration object
   */
  getMonitoringConfig(): ClaudeConfig['monitoring'] {
    return this.config.monitoring;
  }

  /**
   * Get security configuration
   * Contains security validation and audit settings
   *
   * @returns Security configuration object
   */
  getSecurityConfig(): ClaudeConfig['security'] {
    return this.config.security;
  }

  /**
   * Get environment-specific configuration
   * Contains environment-specific feature flags
   *
   * @returns Environment configuration object
   */
  getEnvironmentConfig(): ClaudeConfig['environment'] {
    return this.config.environment;
  }

  /**
   * Check if feature is enabled based on environment
   * Provides environment-aware feature detection
   *
   * @param feature Feature name to check
   * @returns True if feature is enabled
   */
  isFeatureEnabled(feature: keyof ClaudeConfig['environment']): boolean {
    return this.config.environment[feature];
  }

  /**
   * Check if application is in development mode
   *
   * @returns True if in development mode
   */
  isDevelopment(): boolean {
    return this.environment === 'development';
  }

  /**
   * Check if application is in production mode
   *
   * @returns True if in production mode
   */
  isProduction(): boolean {
    return this.environment === 'production';
  }

  /**
   * Check if application is in test mode
   *
   * @returns True if in test mode
   */
  isTest(): boolean {
    return this.environment === 'test';
  }

  /**
   * Update configuration at runtime
   * Allows dynamic configuration updates with validation
   *
   * @param updates Partial configuration updates
   * @throws Error if validation fails
   */
  updateConfig(updates: Partial<ClaudeConfig>): void {
    try {
      // Merge updates with current config
      const updatedConfig = this.mergeDeep(this.config, updates);

      // Validate the updated configuration
      const validatedConfig = ClaudeConfigSchema.parse(updatedConfig);

      // Update the configuration
      this.config = validatedConfig;

      this.logger.log('Configuration updated successfully');
      this.logger.debug(`Updated configuration keys: ${Object.keys(updates).join(', ')}`);
    } catch (error) {
      this.logger.error('Configuration update failed:', error);
      throw new Error(`Configuration update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate current configuration
   * Performs comprehensive validation of configuration values
   *
   * @throws Error if validation fails
   */
  validateConfiguration(): void {
    try {
      // Validate wrapper path exists (development check)
      if (this.isDevelopment()) {
        const wrapperPath = this.config.wrapper.wrapperPath;
        const fs = require('fs');

        if (!fs.existsSync(wrapperPath)) {
          this.logger.warn(`Claude wrapper script not found at: ${wrapperPath}`);
          this.logger.warn('This may cause runtime issues when initializing Claude Code wrapper');
        }
      }

      // Validate timeout consistency
      if (this.config.process.responseTimeout <= this.config.process.initializationTimeout) {
        throw new Error('Response timeout must be greater than initialization timeout');
      }

      // Validate security settings
      if (this.isProduction() && !this.config.security.enableAuditLogging) {
        this.logger.warn('Audit logging is disabled in production environment');
      }

      // Validate monitoring thresholds
      const thresholds = this.config.monitoring.alertThresholds;
      if (thresholds.errorRate < 0 || thresholds.errorRate > 1) {
        throw new Error('Error rate threshold must be between 0 and 1');
      }

      this.logger.debug('Configuration validation completed successfully');
    } catch (error) {
      this.logger.error('Configuration validation failed:', error);
      throw error;
    }
  }

  /**
   * Get configuration summary for debugging
   * Provides sanitized configuration overview
   *
   * @returns Configuration summary object
   */
  getConfigSummary(): Record<string, any> {
    return {
      environment: this.environment,
      wrapper: {
        pythonPath: this.config.wrapper.pythonPath,
        wrapperExists: require('fs').existsSync(this.config.wrapper.wrapperPath),
      },
      session: {
        maxSessions: this.config.session.maxSessions,
        permissionMode: this.config.session.defaultPermissionMode,
      },
      queue: {
        enabled: this.config.queue.enabled,
        maxConcurrency: this.config.queue.maxConcurrency,
      },
      streaming: {
        enabled: this.config.streaming.enabled,
      },
      monitoring: {
        enabled: this.config.monitoring.enabled,
      },
      features: this.config.environment,
    };
  }

  /**
   * Load and validate configuration from environment variables
   * Implements environment-specific configuration loading
   *
   * @private
   * @returns Validated Claude Code configuration
   * @throws Error if validation fails
   */
  private loadAndValidateConfig(): ClaudeConfig {
    try {
      // Start with base configuration
      const baseConfig = this.buildBaseConfig();

      // Apply environment-specific overrides
      const envOverrides = this.getEnvironmentOverrides();
      const mergedConfig = this.mergeDeep(baseConfig, envOverrides);

      // Apply configuration from environment variables
      const envConfig = this.loadFromEnvironment();
      const finalConfig = this.mergeDeep(mergedConfig, envConfig);

      // Validate final configuration
      const validatedConfig = ClaudeConfigSchema.parse(finalConfig);

      this.logger.debug(`Configuration loaded for environment: ${this.environment}`);
      return validatedConfig;
    } catch (error) {
      this.logger.error('Configuration loading failed:', error);

      if (error instanceof z.ZodError) {
        const errorDetails = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        throw new Error(`Configuration validation failed: ${errorDetails}`);
      }

      throw new Error(`Configuration loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build base configuration with defaults
   *
   * @private
   * @returns Base configuration object
   */
  private buildBaseConfig(): any {
    return ClaudeConfigSchema.parse({});
  }

  /**
   * Get environment-specific configuration overrides
   *
   * @private
   * @returns Environment-specific configuration
   */
  private getEnvironmentOverrides(): any {
    const envConfig = DEFAULT_CONFIGS[this.environment as keyof typeof DEFAULT_CONFIGS];
    return envConfig || {};
  }

  /**
   * Load configuration from environment variables
   *
   * @private
   * @returns Configuration from environment variables
   */
  private loadFromEnvironment(): any {
    return {
      wrapper: {
        pythonPath: this.configService.get('CLAUDE_PYTHON_PATH'),
        wrapperPath: this.configService.get('CLAUDE_WRAPPER_PATH'),
        workingDirectory: this.configService.get('CLAUDE_WORKING_DIRECTORY'),
      },
      session: {
        maxSessions: this.configService.get('CLAUDE_MAX_SESSIONS'),
        sessionTimeout: this.configService.get('CLAUDE_SESSION_TIMEOUT'),
        defaultPermissionMode: this.configService.get('CLAUDE_PERMISSION_MODE'),
      },
      queue: {
        enabled: this.configService.get('CLAUDE_QUEUE_ENABLED'),
        maxConcurrency: this.configService.get('CLAUDE_QUEUE_CONCURRENCY'),
      },
      streaming: {
        enabled: this.configService.get('CLAUDE_STREAMING_ENABLED'),
      },
      monitoring: {
        enabled: this.configService.get('CLAUDE_MONITORING_ENABLED'),
      },
      security: {
        enableSandbox: this.configService.get('CLAUDE_ENABLE_SANDBOX'),
        enableAuditLogging: this.configService.get('CLAUDE_ENABLE_AUDIT_LOGGING'),
      },
    };
  }

  /**
   * Deep merge two objects
   * Implements recursive object merging
   *
   * @private
   * @param target Target object
   * @param source Source object
   * @returns Merged object
   */
  private mergeDeep(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== undefined && source[key] !== null) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key]) &&
            typeof target[key] === 'object' && !Array.isArray(target[key])) {
          result[key] = this.mergeDeep(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }
}

/**
 * Validation helper function for runtime type checking
 * Provides standalone configuration validation
 *
 * @param data Unknown data to validate
 * @returns Validated Claude Code configuration
 * @throws Error if validation fails
 */
export const validateClaudeConfig = (data: unknown): ClaudeConfig => {
  return ClaudeConfigSchema.parse(data);
};