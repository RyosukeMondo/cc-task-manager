import { Logger } from '@nestjs/common';
import { ConfigFactory } from '@nestjs/config';
import { AppConfiguration, AppConfigurationSchema } from './config.schema';

/**
 * Configuration factory for NestJS ConfigModule
 * Implements fail-fast validation with comprehensive error reporting
 */
export const configFactory: ConfigFactory<AppConfiguration> = (): AppConfiguration => {
  const logger = new Logger('ConfigFactory');
  
  try {
    logger.log('Loading and validating application configuration...');
    
    // Load environment variables with proper transformations
    const rawConfig = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      
      // Application configuration
      app: {
        name: process.env.APP_NAME || 'CC Task Manager Backend',
        version: process.env.APP_VERSION || '1.0.0',
        port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
        host: process.env.HOST || '0.0.0.0',
        globalPrefix: process.env.GLOBAL_PREFIX || 'api',
        corsOrigins: process.env.CORS_ORIGINS 
          ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
          : ['http://localhost:3000'],
        trustProxy: process.env.TRUST_PROXY === 'true',
      },
      
      // Database configuration
      database: {
        url: process.env.DATABASE_URL || 'postgresql://localhost:5432/cc_task_manager',
        maxConnections: process.env.DB_MAX_CONNECTIONS 
          ? parseInt(process.env.DB_MAX_CONNECTIONS, 10) 
          : 10,
        connectionTimeout: process.env.DB_CONNECTION_TIMEOUT 
          ? parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) 
          : 30000,
        queryTimeout: process.env.DB_QUERY_TIMEOUT 
          ? parseInt(process.env.DB_QUERY_TIMEOUT, 10) 
          : 60000,
        ssl: process.env.DB_SSL === 'true',
      },
      
      // JWT configuration
      jwt: {
        secret: process.env.JWT_SECRET || (() => {
          if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET is required in production environment');
          }
          logger.warn('Using default JWT_SECRET for development - this is insecure for production');
          return 'development-jwt-secret-change-in-production-32-chars-minimum';
        })(),
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: process.env.JWT_ISSUER || 'cc-task-manager',
        audience: process.env.JWT_AUDIENCE || 'cc-task-manager-api',
      },
      
      // Redis configuration
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
        retryDelayOnFailover: process.env.REDIS_RETRY_DELAY 
          ? parseInt(process.env.REDIS_RETRY_DELAY, 10) 
          : 100,
        maxRetriesPerRequest: process.env.REDIS_MAX_RETRIES 
          ? parseInt(process.env.REDIS_MAX_RETRIES, 10) 
          : 3,
        lazyConnect: process.env.REDIS_LAZY_CONNECT !== 'false',
      },
      
      // Logging configuration
      logging: {
        level: (process.env.LOG_LEVEL as any) || 'info',
        pretty: process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV === 'development',
        redact: process.env.LOG_REDACT 
          ? process.env.LOG_REDACT.split(',').map(field => field.trim())
          : ['password', 'token', 'secret', 'authorization'],
        timestamp: process.env.LOG_TIMESTAMP !== 'false',
        name: process.env.LOG_NAME || 'cc-task-manager-backend',
      },
      
      // Security configuration
      security: {
        bcryptRounds: process.env.BCRYPT_ROUNDS 
          ? parseInt(process.env.BCRYPT_ROUNDS, 10) 
          : 12,
        rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS 
          ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) 
          : 900000,
        rateLimitMax: process.env.RATE_LIMIT_MAX 
          ? parseInt(process.env.RATE_LIMIT_MAX, 10) 
          : 100,
        sessionTimeout: process.env.SESSION_TIMEOUT 
          ? parseInt(process.env.SESSION_TIMEOUT, 10) 
          : 1800000,
        maxLoginAttempts: process.env.MAX_LOGIN_ATTEMPTS 
          ? parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) 
          : 5,
        lockoutDuration: process.env.LOCKOUT_DURATION 
          ? parseInt(process.env.LOCKOUT_DURATION, 10) 
          : 900000,
      },
      
      // WebSocket configuration
      websocket: {
        cors: {
          origin: process.env.WS_CORS_ORIGINS 
            ? process.env.WS_CORS_ORIGINS.split(',').map(origin => origin.trim())
            : ['http://localhost:3000'],
          credentials: process.env.WS_CORS_CREDENTIALS !== 'false',
        },
        transports: process.env.WS_TRANSPORTS 
          ? process.env.WS_TRANSPORTS.split(',').map(transport => transport.trim() as 'websocket' | 'polling')
          : ['websocket', 'polling'],
        pingTimeout: process.env.WS_PING_TIMEOUT 
          ? parseInt(process.env.WS_PING_TIMEOUT, 10) 
          : 60000,
        pingInterval: process.env.WS_PING_INTERVAL 
          ? parseInt(process.env.WS_PING_INTERVAL, 10) 
          : 25000,
      },
      
      // Monitoring configuration
      monitoring: {
        healthCheckTimeout: process.env.HEALTH_CHECK_TIMEOUT 
          ? parseInt(process.env.HEALTH_CHECK_TIMEOUT, 10) 
          : 10000,
        metricsEnabled: process.env.METRICS_ENABLED !== 'false',
        tracingEnabled: process.env.TRACING_ENABLED === 'true',
        errorReportingEnabled: process.env.ERROR_REPORTING_ENABLED !== 'false',
      },
      
      // Queue configuration
      queue: {
        defaultJobOptions: {
          removeOnComplete: process.env.QUEUE_REMOVE_ON_COMPLETE 
            ? parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE, 10) 
            : 100,
          removeOnFail: process.env.QUEUE_REMOVE_ON_FAIL 
            ? parseInt(process.env.QUEUE_REMOVE_ON_FAIL, 10) 
            : 50,
          attempts: process.env.QUEUE_ATTEMPTS 
            ? parseInt(process.env.QUEUE_ATTEMPTS, 10) 
            : 3,
          backoff: {
            type: (process.env.QUEUE_BACKOFF_TYPE as any) || 'exponential',
            delay: process.env.QUEUE_BACKOFF_DELAY 
              ? parseInt(process.env.QUEUE_BACKOFF_DELAY, 10) 
              : 2000,
          },
        },
        concurrency: process.env.QUEUE_CONCURRENCY 
          ? parseInt(process.env.QUEUE_CONCURRENCY, 10) 
          : 5,
      },
    };

    // Validate configuration with Zod schema
    const validatedConfig = AppConfigurationSchema.parse(rawConfig);
    
    logger.log('Configuration validation successful');
    logger.debug(`Environment: ${validatedConfig.NODE_ENV}`);
    logger.debug(`Application: ${validatedConfig.app.name} v${validatedConfig.app.version}`);
    logger.debug(`Port: ${validatedConfig.app.port}`);
    logger.debug(`Database: ${validatedConfig.database.url.replace(/\/\/.*@/, '//***@')}`); // Mask credentials
    logger.debug(`Redis: ${validatedConfig.redis.host}:${validatedConfig.redis.port}`);
    
    return validatedConfig;
  } catch (error) {
    logger.error('Configuration validation failed:', error);
    
    if (error instanceof Error) {
      // Enhanced error reporting for configuration issues
      const errorMessage = [
        '╔══════════════════════════════════════════════════════════════╗',
        '║                 CONFIGURATION VALIDATION FAILED             ║',
        '╠══════════════════════════════════════════════════════════════╣',
        `║ Error: ${error.message.substring(0, 54).padEnd(54)} ║`,
        '╠══════════════════════════════════════════════════════════════╣',
        '║ This application requires valid configuration to start.      ║',
        '║ Please check your environment variables and try again.       ║',
        '║                                                              ║',
        '║ Common issues:                                               ║',
        '║ • Missing required environment variables                     ║',
        '║ • Invalid format for numeric/boolean values                  ║',
        '║ • Invalid URL formats                                        ║',
        '║ • JWT_SECRET too short (minimum 32 characters)               ║',
        '║                                                              ║',
        '║ For development, check .env.example for required variables.  ║',
        '╚══════════════════════════════════════════════════════════════╝',
      ].join('\n');
      
      console.error(errorMessage);
    }
    
    // Fail fast - exit the application immediately
    process.exit(1);
  }
};

/**
 * Environment-specific configuration overrides
 * Allows for environment-specific configuration adjustments
 */
export const getEnvironmentSpecificConfig = (baseConfig: AppConfiguration): AppConfiguration => {
  const logger = new Logger('EnvironmentConfig');
  
  switch (baseConfig.NODE_ENV) {
    case 'development':
      logger.log('Applying development configuration overrides');
      return {
        ...baseConfig,
        logging: {
          ...baseConfig.logging,
          level: 'debug',
          pretty: true,
        },
        monitoring: {
          ...baseConfig.monitoring,
          tracingEnabled: false,
        },
      };
      
    case 'test':
      logger.log('Applying test configuration overrides');
      return {
        ...baseConfig,
        logging: {
          ...baseConfig.logging,
          level: 'warn',
          pretty: false,
        },
        monitoring: {
          ...baseConfig.monitoring,
          metricsEnabled: false,
          tracingEnabled: false,
          errorReportingEnabled: false,
        },
      };
      
    case 'staging':
      logger.log('Applying staging configuration overrides');
      return {
        ...baseConfig,
        logging: {
          ...baseConfig.logging,
          level: 'info',
          pretty: false,
        },
        monitoring: {
          ...baseConfig.monitoring,
          tracingEnabled: true,
        },
      };
      
    case 'production':
      logger.log('Applying production configuration overrides');
      return {
        ...baseConfig,
        logging: {
          ...baseConfig.logging,
          level: 'warn',
          pretty: false,
        },
        monitoring: {
          ...baseConfig.monitoring,
          tracingEnabled: true,
          errorReportingEnabled: true,
        },
        security: {
          ...baseConfig.security,
          bcryptRounds: 14, // Higher security in production
        },
      };
      
    default:
      logger.warn(`Unknown environment: ${baseConfig.NODE_ENV}, using base configuration`);
      return baseConfig;
  }
};