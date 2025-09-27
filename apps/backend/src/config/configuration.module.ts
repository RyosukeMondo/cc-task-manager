import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Configuration schema and validation
import { 
  createEnvironmentConfig, 
  EnvironmentConfig,
  validateEnvironmentConfig,
  REQUIRED_ENV_VARS,
  REQUIRED_PRODUCTION_ENV_VARS,
  SENSITIVE_ENV_VARS 
} from './environment.schema';

// Configuration service
import { AppConfigurationService } from './configuration.service';

/**
 * Configuration Module
 * 
 * Provides centralized configuration management with comprehensive validation
 * using Zod schemas and @nestjs/config integration.
 * 
 * Features:
 * - Environment variable validation with Zod schemas
 * - Fail-fast startup validation
 * - Environment-specific configuration validation
 * - Type-safe configuration access
 * - Security-focused configuration (no hardcoded secrets)
 * - Support for environment-specific overrides
 * 
 * This module follows the SSOT principle by providing a single source
 * of truth for all application configuration values.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      // Load configuration from environment variables
      load: [
        () => {
          console.log('🔧 Loading and validating environment configuration...');
          
          // Create and validate configuration
          const config = createEnvironmentConfig();
          
          console.log(`✅ Configuration loaded for ${config.NODE_ENV} environment`);
          console.log(`📋 Application: ${config.APP_NAME} v${config.APP_VERSION}`);
          console.log(`🌐 Server: ${config.HOST}:${config.PORT}`);
          console.log(`🗄️ Database: ${maskSensitiveUrl(config.DATABASE_URL)}`);
          
          if (config.REDIS_URL) {
            console.log(`🔴 Redis: ${maskSensitiveUrl(config.REDIS_URL)}`);
          }
          
          return config;
        },
      ],
      
      // Global configuration access
      isGlobal: true,
      
      // Cache configuration for performance
      cache: true,
      
      // Expand variables (e.g., $PORT)
      expandVariables: true,
      
      // Validation options
      validationOptions: {
        allowUnknown: false,
        abortEarly: false,
      },
      
      // Custom validation function
      validate: (config: Record<string, unknown>) => {
        return validateEnvironmentConfig(config);
      },
    }),
  ],
  providers: [
    // Configuration service for typed access
    AppConfigurationService,
    
    // Provide typed configuration factory
    {
      provide: 'ENVIRONMENT_CONFIG',
      useFactory: (configService: ConfigService): EnvironmentConfig => {
        return configService.get<EnvironmentConfig>('config') || createEnvironmentConfig();
      },
      inject: [ConfigService],
    },
    
    // Configuration validation service
    {
      provide: 'CONFIG_VALIDATOR',
      useFactory: () => ({
        validate: validateEnvironmentConfig,
        createConfig: createEnvironmentConfig,
      }),
    },
  ],
  exports: [
    ConfigModule,
    AppConfigurationService,
    'ENVIRONMENT_CONFIG',
    'CONFIG_VALIDATOR',
  ],
})
export class AppConfigurationModule {
  constructor(private readonly configService: AppConfigurationService) {
    // Perform startup validation
    this.validateStartupConfiguration();
  }
  
  /**
   * Validate configuration at startup and provide helpful error messages
   */
  private validateStartupConfiguration(): void {
    console.log('🔍 Performing startup configuration validation...');
    
    try {
      const config = this.configService.getEnvironmentConfig();
      
      // Check required environment variables
      this.validateRequiredVariables(config);
      
      // Validate environment-specific requirements
      this.validateEnvironmentSpecificRequirements(config);
      
      // Check for common configuration issues
      this.checkConfigurationWarnings(config);
      
      console.log('✅ Startup configuration validation passed');
      
    } catch (error) {
      console.error('❌ Startup configuration validation failed:');
      console.error(error.message);
      
      console.error('\n💡 Configuration Help:');
      console.error('  - Check your .env file or environment variables');
      console.error('  - Ensure all required variables are set');
      console.error('  - Verify variable formats (URLs, ports, etc.)');
      console.error('  - Check environment-specific requirements\n');
      
      process.exit(1);
    }
  }
  
  /**
   * Validate that all required environment variables are present
   */
  private validateRequiredVariables(config: EnvironmentConfig): void {
    const requiredVars = config.NODE_ENV === 'production' 
      ? REQUIRED_PRODUCTION_ENV_VARS 
      : REQUIRED_ENV_VARS;
    
    const missing: string[] = [];
    
    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value || value.trim() === '') {
        missing.push(varName);
      }
    }
    
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }
  }
  
  /**
   * Validate environment-specific requirements
   */
  private validateEnvironmentSpecificRequirements(config: EnvironmentConfig): void {
    switch (config.NODE_ENV) {
      case 'production':
        this.validateProductionRequirements(config);
        break;
      case 'development':
        this.validateDevelopmentRequirements(config);
        break;
      case 'test':
        this.validateTestRequirements(config);
        break;
    }
  }
  
  /**
   * Validate production environment requirements
   */
  private validateProductionRequirements(config: EnvironmentConfig): void {
    const issues: string[] = [];
    
    if (!config.HTTPS_ONLY) {
      issues.push('HTTPS_ONLY must be enabled in production');
    }
    
    if (!config.LOG_JSON) {
      issues.push('LOG_JSON must be enabled in production for structured logging');
    }
    
    if (config.DEV_MODE) {
      issues.push('DEV_MODE must be disabled in production');
    }
    
    if (config.JWT_SECRET.length < 64) {
      issues.push('JWT_SECRET must be at least 64 characters in production');
    }
    
    if (!config.SESSION_SECRET || config.SESSION_SECRET.length < 64) {
      issues.push('SESSION_SECRET must be at least 64 characters in production');
    }
    
    if (issues.length > 0) {
      throw new Error(
        `Production environment validation failed:\n  - ${issues.join('\n  - ')}`
      );
    }
  }
  
  /**
   * Validate development environment requirements
   */
  private validateDevelopmentRequirements(config: EnvironmentConfig): void {
    // Development-specific validation
    if (!config.ENABLE_DOCS) {
      console.warn('⚠️  API documentation is disabled in development');
    }
    
    if (!config.DEV_MODE) {
      console.warn('⚠️  Development mode features are disabled');
    }
  }
  
  /**
   * Validate test environment requirements
   */
  private validateTestRequirements(config: EnvironmentConfig): void {
    if (!config.DATABASE_URL.includes('test')) {
      throw new Error(
        'Test environment must use a test database (DATABASE_URL should contain "test")'
      );
    }
    
    if (config.LOG_LEVEL !== 'error') {
      console.warn('⚠️  Consider setting LOG_LEVEL=error in test environment');
    }
  }
  
  /**
   * Check for common configuration warnings
   */
  private checkConfigurationWarnings(config: EnvironmentConfig): void {
    const warnings: string[] = [];
    
    // Database connection warnings
    if (config.DATABASE_URL.includes('localhost') && config.NODE_ENV === 'production') {
      warnings.push('Using localhost database in production');
    }
    
    // Redis warnings
    if (!config.REDIS_URL && !config.REDIS_HOST) {
      warnings.push('Redis not configured - background jobs may not work');
    }
    
    // Email warnings
    if (!config.SMTP_HOST && config.NODE_ENV !== 'test') {
      warnings.push('Email not configured - notifications may not work');
    }
    
    // Security warnings
    if (config.CORS_ORIGINS.includes('*') && config.NODE_ENV === 'production') {
      warnings.push('CORS allows all origins in production');
    }
    
    // Log warnings if any
    if (warnings.length > 0) {
      console.warn('⚠️  Configuration warnings:');
      warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
  }
  
  /**
   * Static method to validate configuration without creating module
   */
  static validateConfiguration(config?: Record<string, unknown>): EnvironmentConfig {
    const envConfig = config || process.env;
    return validateEnvironmentConfig(envConfig);
  }
  
  /**
   * Static method to create configuration module with custom validation
   */
  static forRoot(options?: ConfigurationModuleOptions) {
    return {
      module: AppConfigurationModule,
      providers: [
        {
          provide: 'CONFIG_OPTIONS',
          useValue: options || {},
        },
      ],
    };
  }
}

/**
 * Configuration module options
 */
export interface ConfigurationModuleOptions {
  /**
   * Skip startup validation (not recommended)
   */
  skipValidation?: boolean;
  
  /**
   * Additional validation rules
   */
  customValidation?: (config: EnvironmentConfig) => void;
  
  /**
   * Override default configuration values
   */
  defaults?: Partial<EnvironmentConfig>;
  
  /**
   * Enable verbose logging during validation
   */
  verbose?: boolean;
}

/**
 * Utility function to mask sensitive URLs for logging
 */
function maskSensitiveUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    if (urlObj.password) {
      urlObj.password = '***';
    }
    
    if (urlObj.username && urlObj.username !== 'postgres') {
      urlObj.username = '***';
    }
    
    return urlObj.toString();
  } catch {
    return '[INVALID_URL]';
  }
}

/**
 * Utility function to check if environment variable is sensitive
 */
export function isSensitiveVariable(varName: string): boolean {
  return SENSITIVE_ENV_VARS.includes(varName as any) || 
         varName.toLowerCase().includes('secret') ||
         varName.toLowerCase().includes('password') ||
         varName.toLowerCase().includes('key');
}