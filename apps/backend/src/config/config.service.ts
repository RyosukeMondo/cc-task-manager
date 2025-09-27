import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import {
  AppConfig,
  DatabaseConfig,
  JwtConfig,
  RedisConfig,
  WebSocketConfig,
  LoggingConfig,
  QueueConfig,
  SecurityConfig,
  MonitoringConfig
} from './config.schema';

/**
 * Application Configuration Service
 * 
 * Provides type-safe access to configuration values with Zod validation.
 * Implements Dependency Inversion Principle by abstracting configuration access.
 * Follows Single Responsibility Principle with focused configuration management.
 * 
 * Key Features:
 * - Type-safe configuration access
 * - Fail-fast validation on startup
 * - Environment-specific configuration support
 * - Comprehensive error handling
 * - Integration with existing ContractRegistry patterns
 */
interface ApplicationConfig {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  redis: RedisConfig;
  websocket: WebSocketConfig;
  logging: LoggingConfig;
  queue: QueueConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
}

@Injectable()
export class ApplicationConfigService {
  private readonly logger = new Logger(ApplicationConfigService.name);
  private readonly config: ApplicationConfig;

  constructor(private readonly nestConfigService: NestConfigService) {
    this.config = this.loadAndValidateConfig();
    this.logger.log('Configuration loaded and validated successfully');
  }

  /**
   * Get complete application configuration
   *
   * @returns Validated application configuration
   */
  getConfig(): ApplicationConfig {
    return this.config;
  }

  /**
   * Get app configuration
   *
   * @returns App configuration object
   */
  getAppConfig(): AppConfig {
    return this.config.app;
  }

  /**
   * Get database configuration
   * 
   * @returns Database configuration object
   */
  getDatabaseConfig(): DatabaseConfig {
    return this.config.database;
  }

  /**
   * Get JWT configuration
   * 
   * @returns JWT configuration object
   */
  getJwtConfig(): JwtConfig {
    return this.config.jwt;
  }

  /**
   * Get Redis configuration
   * 
   * @returns Redis configuration object
   */
  getRedisConfig(): RedisConfig {
    return this.config.redis;
  }

  /**
   * Get security configuration
   *
   * @returns Security configuration object
   */
  getSecurityConfig(): SecurityConfig {
    return this.config.security;
  }

  /**
   * Get WebSocket configuration
   * 
   * @returns WebSocket configuration object
   */
  getWebSocketConfig(): WebSocketConfig {
    return this.config.websocket;
  }

  /**
   * Get logging configuration
   * 
   * @returns Logging configuration object
   */
  getLoggingConfig(): LoggingConfig {
    return this.config.logging;
  }

  /**
   * Get queue configuration
   * 
   * @returns Queue configuration object
   */
  getQueueConfig(): QueueConfig {
    return this.config.queue;
  }

  /**
   * Get monitoring configuration
   *
   * @returns Monitoring configuration object
   */
  getMonitoringConfig(): MonitoringConfig {
    return this.config.monitoring;
  }

  /**
   * Get node environment
   *
   * @returns Current node environment
   */
  getNodeEnv(): string {
    return this.nestConfigService.get('NODE_ENV', 'development');
  }

  /**
   * Check if application is in development mode
   *
   * @returns True if in development mode
   */
  isDevelopment(): boolean {
    return this.getNodeEnv() === 'development';
  }

  /**
   * Check if application is in production mode
   *
   * @returns True if in production mode
   */
  isProduction(): boolean {
    return this.getNodeEnv() === 'production';
  }

  /**
   * Check if application is in test mode
   *
   * @returns True if in test mode
   */
  isTest(): boolean {
    return this.getNodeEnv() === 'test';
  }

  /**
   * Get a specific configuration value by key path
   * 
   * @param key Configuration key path (e.g., 'database.url', 'server.port')
   * @param defaultValue Optional default value
   * @returns Configuration value or default
   */
  get<T = any>(key: string, defaultValue?: T): T {
    return this.nestConfigService.get<T>(key, defaultValue);
  }

  /**
   * Get configuration value or throw error if not found
   * 
   * @param key Configuration key path
   * @returns Configuration value
   * @throws Error if configuration key is not found
   */
  getOrThrow<T = any>(key: string): T {
    return this.nestConfigService.getOrThrow<T>(key);
  }

  /**
   * Load and validate configuration from environment variables
   * 
   * @private
   * @returns Validated application configuration
   * @throws Error if validation fails
   */
  private loadAndValidateConfig(): ApplicationConfig {
    try {
      // Get validated configuration from ConfigModule
      const validatedConfig = {
        app: this.nestConfigService.get('app'),
        database: this.nestConfigService.get('database'),
        jwt: this.nestConfigService.get('jwt'),
        redis: this.nestConfigService.get('redis'),
        websocket: this.nestConfigService.get('websocket'),
        logging: this.nestConfigService.get('logging'),
        queue: this.nestConfigService.get('queue'),
        security: this.nestConfigService.get('security'),
        monitoring: this.nestConfigService.get('monitoring'),
      };

      if (!validatedConfig.app || !validatedConfig.database || !validatedConfig.jwt || !validatedConfig.redis) {
        throw new Error('Required configuration sections are missing');
      }

      return validatedConfig as ApplicationConfig;
    } catch (error) {
      this.logger.error('Configuration validation failed:', error);
      
      if (error instanceof Error) {
        throw new Error(`Configuration validation failed: ${error.message}`);
      }
      
      throw new Error('Configuration validation failed with unknown error');
    }
  }

  /**
   * Parse comma-separated string into array, or return single value
   * 
   * @private
   * @param value String value to parse
   * @returns Array of strings or single string
   */
  private parseArrayOrString(value: string): string | string[] {
    if (!value) return [];
    
    // Check if value contains comma - if so, split into array
    if (value.includes(',')) {
      return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    }
    
    return value;
  }
}