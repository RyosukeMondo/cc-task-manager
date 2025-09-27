import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { 
  AppConfig, 
  AppConfigSchema,
  DatabaseConfig,
  JwtConfig,
  RedisConfig,
  ServerConfig,
  WebSocketConfig,
  LoggingConfig,
  QueueConfig,
  HealthConfig,
  EnvironmentConfig
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
@Injectable()
export class ApplicationConfigService {
  private readonly logger = new Logger(ApplicationConfigService.name);
  private readonly config: AppConfig;

  constructor(private readonly nestConfigService: NestConfigService) {
    this.config = this.loadAndValidateConfig();
    this.logger.log('Configuration loaded and validated successfully');
  }

  /**
   * Get complete application configuration
   * 
   * @returns Validated application configuration
   */
  getConfig(): AppConfig {
    return this.config;
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
   * Get server configuration
   * 
   * @returns Server configuration object
   */
  getServerConfig(): ServerConfig {
    return this.config.server;
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
   * Get health check configuration
   * 
   * @returns Health check configuration object
   */
  getHealthConfig(): HealthConfig {
    return this.config.health;
  }

  /**
   * Get environment configuration
   * 
   * @returns Environment configuration object
   */
  getEnvironmentConfig(): EnvironmentConfig {
    return this.config.environment;
  }

  /**
   * Check if application is in development mode
   * 
   * @returns True if in development mode
   */
  isDevelopment(): boolean {
    return this.config.environment.nodeEnv === 'development';
  }

  /**
   * Check if application is in production mode
   * 
   * @returns True if in production mode
   */
  isProduction(): boolean {
    return this.config.environment.nodeEnv === 'production';
  }

  /**
   * Check if application is in test mode
   * 
   * @returns True if in test mode
   */
  isTest(): boolean {
    return this.config.environment.nodeEnv === 'test';
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
  private loadAndValidateConfig(): AppConfig {
    try {
      // Extract configuration from environment variables
      const rawConfig = {
        environment: {
          nodeEnv: this.nestConfigService.get('NODE_ENV', 'development'),
          debug: this.nestConfigService.get('DEBUG', 'false'),
          enableSwagger: this.nestConfigService.get('ENABLE_SWAGGER', 'true'),
          enableMetrics: this.nestConfigService.get('ENABLE_METRICS', 'true'),
          enableTracing: this.nestConfigService.get('ENABLE_TRACING', 'false'),
        },
        server: {
          port: this.nestConfigService.get('PORT', '3000'),
          host: this.nestConfigService.get('HOST', '0.0.0.0'),
          cors: {
            origin: this.parseArrayOrString(this.nestConfigService.get('CORS_ORIGIN', 'http://localhost:3000,http://localhost:3001')),
            credentials: this.nestConfigService.get('CORS_CREDENTIALS', 'true'),
          },
          rateLimiting: {
            ttl: this.nestConfigService.get('RATE_LIMIT_TTL', '60'),
            limit: this.nestConfigService.get('RATE_LIMIT_COUNT', '100'),
          },
        },
        database: {
          url: this.nestConfigService.getOrThrow('DATABASE_URL'),
          poolSize: this.nestConfigService.get('DATABASE_POOL_SIZE', '10'),
          connectionTimeout: this.nestConfigService.get('DATABASE_CONNECTION_TIMEOUT', '30000'),
          queryTimeout: this.nestConfigService.get('DATABASE_QUERY_TIMEOUT', '60000'),
          enableLogging: this.nestConfigService.get('DATABASE_LOGGING', 'false'),
        },
        jwt: {
          secret: this.nestConfigService.getOrThrow('JWT_SECRET'),
          expiresIn: this.nestConfigService.get('JWT_EXPIRES_IN', '1h'),
          issuer: this.nestConfigService.get('JWT_ISSUER', 'cc-task-manager'),
          audience: this.nestConfigService.get('JWT_AUDIENCE', 'cc-task-manager-api'),
          algorithm: this.nestConfigService.get('JWT_ALGORITHM', 'HS256'),
        },
        redis: {
          host: this.nestConfigService.getOrThrow('REDIS_HOST'),
          port: this.nestConfigService.get('REDIS_PORT', '6379'),
          password: this.nestConfigService.get('REDIS_PASSWORD'),
          db: this.nestConfigService.get('REDIS_DB', '0'),
          maxRetriesPerRequest: this.nestConfigService.get('REDIS_MAX_RETRIES', '3'),
          retryDelayOnFailover: this.nestConfigService.get('REDIS_RETRY_DELAY', '100'),
          enableReadyCheck: this.nestConfigService.get('REDIS_READY_CHECK', 'true'),
          lazyConnect: this.nestConfigService.get('REDIS_LAZY_CONNECT', 'true'),
        },
        websocket: {
          cors: {
            origin: this.parseArrayOrString(this.nestConfigService.get('WS_CORS_ORIGIN', 'http://localhost:3000,http://localhost:3001')),
            credentials: this.nestConfigService.get('WS_CORS_CREDENTIALS', 'true'),
          },
          transports: this.parseArrayOrString(this.nestConfigService.get('WS_TRANSPORTS', 'websocket,polling')),
          pingTimeout: this.nestConfigService.get('WS_PING_TIMEOUT', '60000'),
          pingInterval: this.nestConfigService.get('WS_PING_INTERVAL', '25000'),
        },
        logging: {
          level: this.nestConfigService.get('LOG_LEVEL', 'info'),
          prettyPrint: this.nestConfigService.get('LOG_PRETTY_PRINT', 'false'),
          enableRequestLogging: this.nestConfigService.get('LOG_REQUESTS', 'true'),
          enableErrorStackTrace: this.nestConfigService.get('LOG_ERROR_STACK', 'true'),
          redactSensitiveData: this.nestConfigService.get('LOG_REDACT_SENSITIVE', 'true'),
        },
        queue: {
          defaultJobOptions: {
            removeOnComplete: this.nestConfigService.get('QUEUE_REMOVE_ON_COMPLETE', '100'),
            removeOnFail: this.nestConfigService.get('QUEUE_REMOVE_ON_FAIL', '50'),
            attempts: this.nestConfigService.get('QUEUE_ATTEMPTS', '3'),
            backoff: {
              type: this.nestConfigService.get('QUEUE_BACKOFF_TYPE', 'exponential'),
              delay: this.nestConfigService.get('QUEUE_BACKOFF_DELAY', '2000'),
            },
          },
          concurrency: this.nestConfigService.get('QUEUE_CONCURRENCY', '5'),
        },
        health: {
          enabled: this.nestConfigService.get('HEALTH_ENABLED', 'true'),
          timeout: this.nestConfigService.get('HEALTH_TIMEOUT', '5000'),
          retries: this.nestConfigService.get('HEALTH_RETRIES', '3'),
          endpoints: {
            health: this.nestConfigService.get('HEALTH_ENDPOINT', '/health'),
            readiness: this.nestConfigService.get('HEALTH_READINESS_ENDPOINT', '/health/ready'),
            liveness: this.nestConfigService.get('HEALTH_LIVENESS_ENDPOINT', '/health/live'),
          },
        },
      };

      // Validate configuration using Zod schema
      const validatedConfig = AppConfigSchema.parse(rawConfig);
      
      this.logger.log('Configuration validation successful');
      return validatedConfig;
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