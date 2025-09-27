import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ApplicationConfigService } from './config.service';
import { ContractRegistry } from '../../../../src/contracts/ContractRegistry';
import { 
  AppConfigSchema,
  DatabaseConfigSchema,
  JwtConfigSchema,
  RedisConfigSchema,
  ServerConfigSchema,
  WebSocketConfigSchema,
  LoggingConfigSchema,
  QueueConfigSchema,
  HealthConfigSchema,
  EnvironmentConfigSchema
} from './config.schema';

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
      server: {
        port: config.PORT || '3000',
        host: config.HOST || '0.0.0.0',
        cors: {
          origin: parseArrayOrString(config.CORS_ORIGIN as string || 'http://localhost:3000,http://localhost:3001'),
          credentials: config.CORS_CREDENTIALS || 'true',
        },
        rateLimiting: {
          ttl: config.RATE_LIMIT_TTL || '60',
          limit: config.RATE_LIMIT_COUNT || '100',
        },
      },
      database: {
        url: config.DATABASE_URL || (() => { throw new Error('DATABASE_URL is required'); })(),
        poolSize: config.DATABASE_POOL_SIZE || '10',
        connectionTimeout: config.DATABASE_CONNECTION_TIMEOUT || '30000',
        queryTimeout: config.DATABASE_QUERY_TIMEOUT || '60000',
        enableLogging: config.DATABASE_LOGGING || 'false',
      },
      jwt: {
        secret: config.JWT_SECRET || (() => { throw new Error('JWT_SECRET is required'); })(),
        expiresIn: config.JWT_EXPIRES_IN || '1h',
        issuer: config.JWT_ISSUER || 'cc-task-manager',
        audience: config.JWT_AUDIENCE || 'cc-task-manager-api',
        algorithm: config.JWT_ALGORITHM || 'HS256',
      },
      redis: {
        host: config.REDIS_HOST || (() => { throw new Error('REDIS_HOST is required'); })(),
        port: config.REDIS_PORT || '6379',
        password: config.REDIS_PASSWORD,
        db: config.REDIS_DB || '0',
        maxRetriesPerRequest: config.REDIS_MAX_RETRIES || '3',
        retryDelayOnFailover: config.REDIS_RETRY_DELAY || '100',
        enableReadyCheck: config.REDIS_READY_CHECK || 'true',
        lazyConnect: config.REDIS_LAZY_CONNECT || 'true',
      },
      websocket: {
        cors: {
          origin: parseArrayOrString(config.WS_CORS_ORIGIN as string || 'http://localhost:3000,http://localhost:3001'),
          credentials: config.WS_CORS_CREDENTIALS || 'true',
        },
        transports: parseArrayOrString(config.WS_TRANSPORTS as string || 'websocket,polling'),
        pingTimeout: config.WS_PING_TIMEOUT || '60000',
        pingInterval: config.WS_PING_INTERVAL || '25000',
      },
      logging: {
        level: config.LOG_LEVEL || 'info',
        prettyPrint: config.LOG_PRETTY_PRINT || 'false',
        enableRequestLogging: config.LOG_REQUESTS || 'true',
        enableErrorStackTrace: config.LOG_ERROR_STACK || 'true',
        redactSensitiveData: config.LOG_REDACT_SENSITIVE || 'true',
      },
      queue: {
        defaultJobOptions: {
          removeOnComplete: config.QUEUE_REMOVE_ON_COMPLETE || '100',
          removeOnFail: config.QUEUE_REMOVE_ON_FAIL || '50',
          attempts: config.QUEUE_ATTEMPTS || '3',
          backoff: {
            type: config.QUEUE_BACKOFF_TYPE || 'exponential',
            delay: config.QUEUE_BACKOFF_DELAY || '2000',
          },
        },
        concurrency: config.QUEUE_CONCURRENCY || '5',
      },
      health: {
        enabled: config.HEALTH_ENABLED || 'true',
        timeout: config.HEALTH_TIMEOUT || '5000',
        retries: config.HEALTH_RETRIES || '3',
        endpoints: {
          health: config.HEALTH_ENDPOINT || '/health',
          readiness: config.HEALTH_READINESS_ENDPOINT || '/health/ready',
          liveness: config.HEALTH_LIVENESS_ENDPOINT || '/health/live',
        },
      },
    };

    // Validate complete configuration
    const validatedConfig = AppConfigSchema.parse(structuredConfig);
    
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
          'server-config',
          '1.0.0',
          ServerConfigSchema,
          {
            description: 'HTTP server and CORS configuration',
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
          'health-config',
          '1.0.0',
          HealthConfigSchema,
          {
            description: 'Health check endpoints configuration',
            compatibleVersions: ['1.0.0'],
          }
        );

        await contractRegistry.registerContract(
          'environment-config',
          '1.0.0',
          EnvironmentConfigSchema,
          {
            description: 'Environment-specific configuration',
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