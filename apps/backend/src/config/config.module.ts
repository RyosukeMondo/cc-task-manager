import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ApplicationConfigService } from './config.service';
import { ContractRegistry } from '@contracts/ContractRegistry';
import {
  AppConfigSchema,
  DatabaseConfigSchema,
  JwtConfigSchema,
  RedisConfigSchema,
  WebSocketConfigSchema,
  LoggingConfigSchema,
  QueueConfigSchema,
  SecurityConfigSchema,
  MonitoringConfigSchema
} from './config.schema';
import { EnvironmentSchema } from './environment.schema';

/**
 * Configuration validation function for NestJS ConfigModule
 * Implements fail-fast validation on application startup
 */
export function validateConfiguration(config: Record<string, unknown>) {
  try {
    // Extract and structure configuration for validation
    const structuredConfig = {
      environment: {
        nodeEnv: config.NODE_ENV || 'development',
        debug: config.DEBUG || 'false',
        enableSwagger: config.ENABLE_SWAGGER || 'true',
        enableMetrics: config.ENABLE_METRICS || 'true',
        enableTracing: config.ENABLE_TRACING || 'false',
      },
      app: {
        name: config.APP_NAME || 'CC Task Manager Backend',
        version: config.APP_VERSION || '1.0.0',
        port: parseInt(config.PORT as string) || 3000,
        host: config.HOST || '0.0.0.0',
        globalPrefix: config.API_PREFIX || 'api',
        corsOrigins: parseArrayOrString(config.CORS_ORIGINS as string || 'http://localhost:3000,http://localhost:3001'),
        trustProxy: config.TRUST_PROXY === 'true' || false,
      },
      database: {
        url: config.DATABASE_URL || (() => { throw new Error('DATABASE_URL is required'); })(),
        maxConnections: parseInt(config.DATABASE_POOL_MAX as string) || 10,
        connectionTimeout: parseInt(config.DATABASE_TIMEOUT as string) || 30000,
        queryTimeout: 60000,
        ssl: config.DATABASE_SSL === 'true' || false,
      },
      jwt: {
        secret: config.JWT_SECRET || (() => { throw new Error('JWT_SECRET is required'); })(),
        expiresIn: config.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshExpiresIn: config.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: config.JWT_ISSUER || 'cc-task-manager',
        audience: config.JWT_AUDIENCE || 'cc-task-manager-api',
      },
      redis: {
        host: config.REDIS_HOST || 'localhost',
        port: parseInt(config.REDIS_PORT as string) || 6379,
        password: config.REDIS_PASSWORD,
        db: parseInt(config.REDIS_DB as string) || 0,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
      },
      websocket: {
        cors: {
          origin: parseArrayOrString(config.WEBSOCKET_CORS_ORIGINS as string || config.CORS_ORIGINS as string || 'http://localhost:3000,http://localhost:3001'),
          credentials: true,
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
      },
      logging: {
        level: config.LOG_LEVEL as any || 'info',
        pretty: config.LOG_JSON !== 'true',
        redact: ['password', 'token', 'secret', 'authorization'],
        timestamp: true,
        name: config.APP_NAME || 'cc-task-manager-backend',
      },
      queue: {
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential' as const,
            delay: 2000,
          },
        },
        concurrency: 5,
      },
      security: {
        bcryptRounds: parseInt(config.BCRYPT_ROUNDS as string) || 12,
        rateLimitWindowMs: parseInt(config.RATE_LIMIT_WINDOW_MS as string) || 900000,
        rateLimitMax: parseInt(config.RATE_LIMIT_MAX_REQUESTS as string) || 100,
        sessionTimeout: 1800000,
        maxLoginAttempts: 5,
        lockoutDuration: 900000,
      },
      monitoring: {
        healthCheckTimeout: 10000,
        metricsEnabled: config.ENABLE_METRICS === 'true',
        tracingEnabled: false,
        errorReportingEnabled: true,
      },
    };

    // Validate complete configuration using individual schemas
    const validatedConfig = {
      app: AppConfigSchema.parse(structuredConfig.app),
      database: DatabaseConfigSchema.parse(structuredConfig.database),
      jwt: JwtConfigSchema.parse(structuredConfig.jwt),
      redis: RedisConfigSchema.parse(structuredConfig.redis),
      websocket: WebSocketConfigSchema.parse(structuredConfig.websocket),
      logging: LoggingConfigSchema.parse(structuredConfig.logging),
      queue: QueueConfigSchema.parse(structuredConfig.queue),
      security: SecurityConfigSchema.parse(structuredConfig.security),
      monitoring: MonitoringConfigSchema.parse(structuredConfig.monitoring),
    };
    
    console.log('✅ Configuration validation successful');
    return validatedConfig;
  } catch (error) {
    console.error('❌ Configuration validation failed:', error);
    throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper function to parse comma-separated values
 */
function parseArrayOrString(value: string): string | string[] {
  if (!value) return [];
  
  if (value.includes(',')) {
    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }
  
  return value;
}

/**
 * Global Configuration Module
 * 
 * Provides application-wide configuration management with fail-fast validation.
 * Implements SOLID principles:
 * - Single Responsibility: Focused on configuration management
 * - Open/Closed: Extensible for new configuration sections
 * - Liskov Substitution: ApplicationConfigService can be substituted for ConfigService
 * - Interface Segregation: Clean configuration interfaces for each domain
 * - Dependency Inversion: Depends on abstractions, not concrete implementations
 * 
 * Features:
 * - Fail-fast validation on startup
 * - Type-safe configuration access
 * - Integration with existing ContractRegistry for schema management
 * - Environment-specific configuration support
 * - Comprehensive error handling
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateConfiguration,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  providers: [
    ApplicationConfigService,
    {
      provide: 'CONFIG_SCHEMAS',
      useFactory: async (contractRegistry: ContractRegistry) => {
        // Register configuration schemas in ContractRegistry for SSOT
        await contractRegistry.registerContract(
          'app-config',
          '1.0.0',
          AppConfigSchema,
          {
            description: 'Complete application configuration schema',
            compatibleVersions: ['1.0.0'],
          }
        );

        await contractRegistry.registerContract(
          'database-config',
          '1.0.0',
          DatabaseConfigSchema,
          {
            description: 'Database connection and pool configuration',
            compatibleVersions: ['1.0.0'],
          }
        );

        await contractRegistry.registerContract(
          'jwt-config',
          '1.0.0',
          JwtConfigSchema,
          {
            description: 'JWT authentication configuration',
            compatibleVersions: ['1.0.0'],
          }
        );

        await contractRegistry.registerContract(
          'redis-config',
          '1.0.0',
          RedisConfigSchema,
          {
            description: 'Redis connection and queue configuration',
            compatibleVersions: ['1.0.0'],
          }
        );

        await contractRegistry.registerContract(
          'security-config',
          '1.0.0',
          SecurityConfigSchema,
          {
            description: 'Security and authentication configuration',
            compatibleVersions: ['1.0.0'],
          }
        );

        await contractRegistry.registerContract(
          'websocket-config',
          '1.0.0',
          WebSocketConfigSchema,
          {
            description: 'WebSocket server configuration',
            compatibleVersions: ['1.0.0'],
          }
        );

        await contractRegistry.registerContract(
          'logging-config',
          '1.0.0',
          LoggingConfigSchema,
          {
            description: 'Structured logging configuration',
            compatibleVersions: ['1.0.0'],
          }
        );

        await contractRegistry.registerContract(
          'queue-config',
          '1.0.0',
          QueueConfigSchema,
          {
            description: 'BullMQ job queue configuration',
            compatibleVersions: ['1.0.0'],
          }
        );

        await contractRegistry.registerContract(
          'monitoring-config',
          '1.0.0',
          MonitoringConfigSchema,
          {
            description: 'Monitoring and observability configuration',
            compatibleVersions: ['1.0.0'],
          }
        );

        await contractRegistry.registerContract(
          'environment-config',
          '1.0.0',
          EnvironmentSchema,
          {
            description: 'Complete environment configuration schema',
            compatibleVersions: ['1.0.0'],
          }
        );

        return 'Configuration schemas registered successfully';
      },
      inject: [ContractRegistry],
    },
  ],
  exports: [
    ApplicationConfigService,
    NestConfigModule,
  ],
})
export class ConfigModule {}