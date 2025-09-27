import { z } from 'zod';

/**
 * Environment Configuration Schema
 * 
 * Comprehensive Zod schema for validating all environment variables
 * used throughout the backend application. This schema enforces:
 * 
 * - Type safety for all configuration values
 * - Required vs optional environment variables
 * - Format validation (URLs, ports, etc.)
 * - Security validation (no hardcoded secrets)
 * - Environment-specific defaults and overrides
 * 
 * Following SSOT principle - single source of truth for all configuration.
 */

// =============================================================================
// BASIC VALIDATION HELPERS
// =============================================================================

/**
 * Port number validation
 */
const PortSchema = z.coerce.number().int().min(1).max(65535);

/**
 * URL validation with protocol enforcement
 */
const UrlSchema = z.string().url();

/**
 * Database URL validation (PostgreSQL)
 */
const DatabaseUrlSchema = z.string().refine(
  (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
  { message: 'Database URL must be a valid PostgreSQL connection string' }
);

/**
 * Redis URL validation
 */
const RedisUrlSchema = z.string().refine(
  (url) => url.startsWith('redis://') || url.startsWith('rediss://'),
  { message: 'Redis URL must be a valid Redis connection string' }
);

/**
 * Environment enum
 */
const NodeEnvironmentSchema = z.enum(['development', 'test', 'staging', 'production']);

/**
 * Log level validation
 */
const LogLevelSchema = z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']);

// =============================================================================
// CORE ENVIRONMENT SCHEMA
// =============================================================================

/**
 * Complete environment configuration schema
 */
export const EnvironmentSchema = z.object({
  // =============================================================================
  // APPLICATION CONFIGURATION
  // =============================================================================
  
  /**
   * Node.js environment
   */
  NODE_ENV: NodeEnvironmentSchema.default('development'),
  
  /**
   * Application port
   */
  PORT: PortSchema.default(3001),
  
  /**
   * Application host
   */
  HOST: z.string().default('localhost'),
  
  /**
   * Application base URL for external references
   */
  APP_URL: UrlSchema.optional(),
  
  /**
   * API version prefix
   */
  API_PREFIX: z.string().default('api'),
  
  /**
   * API version
   */
  API_VERSION: z.string().default('v1'),
  
  // =============================================================================
  // DATABASE CONFIGURATION
  // =============================================================================
  
  /**
   * PostgreSQL database connection URL
   * Required in all environments
   */
  DATABASE_URL: DatabaseUrlSchema,
  
  /**
   * Database connection pool settings
   */
  DATABASE_POOL_MIN: z.coerce.number().int().min(1).default(5),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(20),
  
  /**
   * Database query timeout (milliseconds)
   */
  DATABASE_TIMEOUT: z.coerce.number().int().min(1000).default(30000),
  
  /**
   * Enable database query logging
   */
  DATABASE_LOGGING: z.coerce.boolean().default(false),
  
  // =============================================================================
  // REDIS CONFIGURATION (for queues and caching)
  // =============================================================================
  
  /**
   * Redis connection URL for BullMQ and caching
   */
  REDIS_URL: RedisUrlSchema.optional(),
  
  /**
   * Redis host (alternative to REDIS_URL)
   */
  REDIS_HOST: z.string().default('localhost'),
  
  /**
   * Redis port (alternative to REDIS_URL)
   */
  REDIS_PORT: PortSchema.default(6379),
  
  /**
   * Redis password
   */
  REDIS_PASSWORD: z.string().optional(),
  
  /**
   * Redis database number
   */
  REDIS_DB: z.coerce.number().int().min(0).max(15).default(0),
  
  // =============================================================================
  // JWT AUTHENTICATION CONFIGURATION
  // =============================================================================
  
  /**
   * JWT secret for signing tokens
   * Must be at least 32 characters in production
   */
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  
  /**
   * JWT access token expiration
   */
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  
  /**
   * JWT refresh token expiration
   */
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  /**
   * JWT issuer
   */
  JWT_ISSUER: z.string().default('cc-task-manager'),
  
  /**
   * JWT audience
   */
  JWT_AUDIENCE: z.string().default('cc-task-manager-api'),
  
  // =============================================================================
  // LOGGING CONFIGURATION
  // =============================================================================
  
  /**
   * Log level for application logging
   */
  LOG_LEVEL: LogLevelSchema.default('info'),
  
  /**
   * Enable structured JSON logging (for production)
   */
  LOG_JSON: z.coerce.boolean().default(false),
  
  /**
   * Log file path (optional)
   */
  LOG_FILE_PATH: z.string().optional(),
  
  /**
   * Enable log file rotation
   */
  LOG_FILE_ROTATION: z.coerce.boolean().default(true),
  
  /**
   * Maximum log file size before rotation
   */
  LOG_FILE_MAX_SIZE: z.string().default('10M'),
  
  /**
   * Maximum number of log files to keep
   */
  LOG_FILE_MAX_FILES: z.coerce.number().int().min(1).default(5),
  
  // =============================================================================
  // CORS CONFIGURATION
  // =============================================================================
  
  /**
   * CORS allowed origins (comma-separated)
   */
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  
  /**
   * CORS credentials support
   */
  CORS_CREDENTIALS: z.coerce.boolean().default(true),
  
  // =============================================================================
  // RATE LIMITING CONFIGURATION
  // =============================================================================
  
  /**
   * Rate limit window duration (milliseconds)
   */
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000), // 15 minutes
  
  /**
   * Maximum requests per window
   */
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(100),
  
  // =============================================================================
  // FILE UPLOAD CONFIGURATION
  // =============================================================================
  
  /**
   * Maximum file upload size (bytes)
   */
  MAX_FILE_SIZE: z.coerce.number().int().min(1024).default(10485760), // 10MB
  
  /**
   * Allowed file types (comma-separated MIME types)
   */
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/gif,application/pdf,text/plain'),
  
  /**
   * File storage directory
   */
  UPLOAD_DIR: z.string().default('./uploads'),
  
  // =============================================================================
  // EMAIL CONFIGURATION (for notifications)
  // =============================================================================
  
  /**
   * SMTP host for email sending
   */
  SMTP_HOST: z.string().optional(),
  
  /**
   * SMTP port
   */
  SMTP_PORT: PortSchema.optional(),
  
  /**
   * SMTP username
   */
  SMTP_USER: z.string().optional(),
  
  /**
   * SMTP password
   */
  SMTP_PASSWORD: z.string().optional(),
  
  /**
   * Email sender address
   */
  EMAIL_FROM: z.string().email().optional(),
  
  // =============================================================================
  // WEBSOCKET CONFIGURATION
  // =============================================================================
  
  /**
   * WebSocket port (can be same as HTTP port)
   */
  WEBSOCKET_PORT: PortSchema.optional(),
  
  /**
   * WebSocket CORS origins
   */
  WEBSOCKET_CORS_ORIGINS: z.string().optional(),
  
  // =============================================================================
  // MONITORING AND OBSERVABILITY
  // =============================================================================
  
  /**
   * Enable application metrics collection
   */
  ENABLE_METRICS: z.coerce.boolean().default(true),
  
  /**
   * Metrics collection port
   */
  METRICS_PORT: PortSchema.optional(),
  
  /**
   * Enable health check endpoints
   */
  ENABLE_HEALTH_CHECKS: z.coerce.boolean().default(true),
  
  /**
   * Application name for monitoring
   */
  APP_NAME: z.string().default('cc-task-manager-backend'),
  
  /**
   * Application version
   */
  APP_VERSION: z.string().default('1.0.0'),
  
  // =============================================================================
  // SECURITY CONFIGURATION
  // =============================================================================
  
  /**
   * Enable HTTPS only mode
   */
  HTTPS_ONLY: z.coerce.boolean().default(false),
  
  /**
   * Session secret for security
   */
  SESSION_SECRET: z.string().min(32).optional(),
  
  /**
   * Password hash rounds for bcrypt
   */
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  
  /**
   * API key for external integrations (optional)
   */
  API_KEY: z.string().optional(),
  
  // =============================================================================
  // DEVELOPMENT CONFIGURATION
  // =============================================================================
  
  /**
   * Enable development mode features
   */
  DEV_MODE: z.coerce.boolean().default(false),
  
  /**
   * Enable API documentation (Swagger)
   */
  ENABLE_DOCS: z.coerce.boolean().default(true),
  
  /**
   * Enable request/response logging in development
   */
  LOG_REQUESTS: z.coerce.boolean().default(false),
});

/**
 * Type inference for the environment configuration
 */
export type EnvironmentConfig = z.infer<typeof EnvironmentSchema>;

// =============================================================================
// ENVIRONMENT-SPECIFIC VALIDATION
// =============================================================================

/**
 * Production environment validation
 * Enforces stricter requirements for production deployments
 */
export const ProductionEnvironmentSchema = EnvironmentSchema.extend({
  NODE_ENV: z.literal('production'),
  JWT_SECRET: z.string().min(64, 'JWT secret must be at least 64 characters in production'),
  SESSION_SECRET: z.string().min(64, 'Session secret must be at least 64 characters in production'),
  HTTPS_ONLY: z.literal(true),
  LOG_JSON: z.literal(true),
  DEV_MODE: z.literal(false),
  DATABASE_LOGGING: z.literal(false),
  LOG_REQUESTS: z.literal(false),
}).refine(
  (config) => config.SMTP_HOST !== undefined,
  { message: 'SMTP configuration is required in production' }
);

/**
 * Development environment validation
 * More relaxed requirements for development
 */
export const DevelopmentEnvironmentSchema = EnvironmentSchema.extend({
  NODE_ENV: z.literal('development'),
  JWT_SECRET: z.string().min(32), // Less strict for development
  HTTPS_ONLY: z.literal(false),
  LOG_JSON: z.literal(false),
  DEV_MODE: z.literal(true),
  ENABLE_DOCS: z.literal(true),
});

/**
 * Test environment validation
 * Specific requirements for testing
 */
export const TestEnvironmentSchema = EnvironmentSchema.extend({
  NODE_ENV: z.literal('test'),
  DATABASE_URL: DatabaseUrlSchema.refine(
    (url) => url.includes('test'),
    { message: 'Test environment must use a test database' }
  ),
  LOG_LEVEL: z.literal('error'), // Minimal logging in tests
  ENABLE_DOCS: z.literal(false),
  ENABLE_METRICS: z.literal(false),
});

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Validate environment configuration based on NODE_ENV
 */
export function validateEnvironmentConfig(config: unknown): EnvironmentConfig {
  // First, validate with the base schema
  const baseConfig = EnvironmentSchema.parse(config);
  
  // Then apply environment-specific validation
  switch (baseConfig.NODE_ENV) {
    case 'production':
      return ProductionEnvironmentSchema.parse(config);
    case 'development':
      return DevelopmentEnvironmentSchema.parse(config);
    case 'test':
      return TestEnvironmentSchema.parse(config);
    default:
      return baseConfig;
  }
}

/**
 * Create configuration from environment variables with validation
 */
export function createEnvironmentConfig(): EnvironmentConfig {
  try {
    return validateEnvironmentConfig(process.env);
  } catch (error) {
    console.error('❌ Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error(`  - ${error.message}`);
    }
    
    console.error('\n💡 Please check your environment variables and try again.');
    process.exit(1);
  }
}

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

/**
 * Required environment variables for all environments
 */
export const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
] as const;

/**
 * Required environment variables for production
 */
export const REQUIRED_PRODUCTION_ENV_VARS = [
  ...REQUIRED_ENV_VARS,
  'SESSION_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'EMAIL_FROM',
] as const;

/**
 * Sensitive environment variables that should not be logged
 */
export const SENSITIVE_ENV_VARS = [
  'JWT_SECRET',
  'SESSION_SECRET',
  'DATABASE_URL',
  'REDIS_PASSWORD',
  'SMTP_PASSWORD',
  'API_KEY',
] as const;