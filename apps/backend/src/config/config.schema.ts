import { z } from 'zod';

/**
 * Database configuration schema
 */
export const DatabaseConfigSchema = z.object({
  url: z.string().url('Invalid database URL'),
  maxConnections: z.number().int().min(1).max(100).default(10),
  connectionTimeout: z.number().int().min(1000).default(30000),
  queryTimeout: z.number().int().min(1000).default(60000),
  ssl: z.boolean().default(false),
});

/**
 * JWT configuration schema
 */
export const JwtConfigSchema = z.object({
  secret: z.string().min(32, 'JWT secret must be at least 32 characters'),
  expiresIn: z.string().regex(/^\d+[smhd]$/, 'Invalid JWT expiration format').default('1h'),
  refreshExpiresIn: z.string().regex(/^\d+[smhd]$/, 'Invalid refresh token expiration format').default('7d'),
  issuer: z.string().min(1).default('cc-task-manager'),
  audience: z.string().min(1).default('cc-task-manager-api'),
});

/**
 * Redis configuration schema
 */
export const RedisConfigSchema = z.object({
  host: z.string().min(1, 'Redis host is required'),
  port: z.number().int().min(1).max(65535).default(6379),
  password: z.string().optional(),
  db: z.number().int().min(0).max(15).default(0),
  retryDelayOnFailover: z.number().int().min(100).default(100),
  maxRetriesPerRequest: z.number().int().min(1).default(3),
  lazyConnect: z.boolean().default(true),
});

/**
 * Application configuration schema
 */
export const AppConfigSchema = z.object({
  name: z.string().min(1).default('CC Task Manager Backend'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning').default('1.0.0'),
  port: z.number().int().min(1).max(65535).default(3000),
  host: z.string().min(1).default('0.0.0.0'),
  globalPrefix: z.string().min(1).default('api'),
  corsOrigins: z.array(z.string().url()).default(['http://localhost:3000']),
  trustProxy: z.boolean().default(false),
});

/**
 * Logging configuration schema
 */
export const LoggingConfigSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  pretty: z.boolean().default(false),
  redact: z.array(z.string()).default(['password', 'token', 'secret', 'authorization']),
  timestamp: z.boolean().default(true),
  name: z.string().min(1).default('cc-task-manager-backend'),
});

/**
 * Security configuration schema
 */
export const SecurityConfigSchema = z.object({
  bcryptRounds: z.number().int().min(10).max(15).default(12),
  rateLimitWindowMs: z.number().int().min(1000).default(900000), // 15 minutes
  rateLimitMax: z.number().int().min(1).default(100),
  sessionTimeout: z.number().int().min(300000).default(1800000), // 30 minutes
  maxLoginAttempts: z.number().int().min(1).default(5),
  lockoutDuration: z.number().int().min(60000).default(900000), // 15 minutes
});

/**
 * WebSocket configuration schema
 */
export const WebSocketConfigSchema = z.object({
  cors: z.object({
    origin: z.array(z.string().url()).default(['http://localhost:3000']),
    credentials: z.boolean().default(true),
  }),
  transports: z.array(z.enum(['websocket', 'polling'])).default(['websocket', 'polling']),
  pingTimeout: z.number().int().min(1000).default(60000),
  pingInterval: z.number().int().min(1000).default(25000),
});

/**
 * Monitoring configuration schema
 */
export const MonitoringConfigSchema = z.object({
  healthCheckTimeout: z.number().int().min(1000).default(10000),
  metricsEnabled: z.boolean().default(true),
  tracingEnabled: z.boolean().default(false),
  errorReportingEnabled: z.boolean().default(true),
});

/**
 * Queue configuration schema
 */
export const QueueConfigSchema = z.object({
  defaultJobOptions: z.object({
    removeOnComplete: z.number().int().min(1).default(100),
    removeOnFail: z.number().int().min(1).default(50),
    attempts: z.number().int().min(1).default(3),
    backoff: z.object({
      type: z.enum(['fixed', 'exponential']).default('exponential'),
      delay: z.number().int().min(1000).default(2000),
    }),
    delay: z.number().int().min(0).default(0),
    priority: z.number().int().min(1).max(100).default(50),
    jobId: z.string().optional(),
  }),
  concurrency: z.number().int().min(1).default(5),
  settings: z.object({
    stalledInterval: z.number().int().min(1000).default(30000),
    maxStalledCount: z.number().int().min(1).default(1),
    retryProcessDelay: z.number().int().min(1000).default(5000),
  }),
  limiter: z.object({
    max: z.number().int().min(1).default(100),
    duration: z.number().int().min(1000).default(60000),
  }),
});

/**
 * Complete application configuration schema
 * SSOT for all environment variables and configuration
 */
export const AppConfigurationSchema = z.object({
  // Environment metadata
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  
  // Application configuration
  app: AppConfigSchema,
  
  // Database configuration
  database: DatabaseConfigSchema,
  
  // JWT configuration
  jwt: JwtConfigSchema,
  
  // Redis configuration
  redis: RedisConfigSchema,
  
  // Logging configuration
  logging: LoggingConfigSchema,
  
  // Security configuration
  security: SecurityConfigSchema,
  
  // WebSocket configuration
  websocket: WebSocketConfigSchema,
  
  // Monitoring configuration
  monitoring: MonitoringConfigSchema,
  
  // Queue configuration
  queue: QueueConfigSchema,
});

/**
 * TypeScript types derived from Zod schemas
 */
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type JwtConfig = z.infer<typeof JwtConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type WebSocketConfig = z.infer<typeof WebSocketConfigSchema>;
export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;
export type QueueConfig = z.infer<typeof QueueConfigSchema>;
export type AppConfiguration = z.infer<typeof AppConfigurationSchema>;

/**
 * Validation helper functions for runtime type checking
 */
export const validateDatabaseConfig = (data: unknown): DatabaseConfig => {
  return DatabaseConfigSchema.parse(data);
};

export const validateJwtConfig = (data: unknown): JwtConfig => {
  return JwtConfigSchema.parse(data);
};

export const validateRedisConfig = (data: unknown): RedisConfig => {
  return RedisConfigSchema.parse(data);
};

export const validateAppConfig = (data: unknown): AppConfig => {
  return AppConfigSchema.parse(data);
};

export const validateLoggingConfig = (data: unknown): LoggingConfig => {
  return LoggingConfigSchema.parse(data);
};

export const validateSecurityConfig = (data: unknown): SecurityConfig => {
  return SecurityConfigSchema.parse(data);
};

export const validateWebSocketConfig = (data: unknown): WebSocketConfig => {
  return WebSocketConfigSchema.parse(data);
};

export const validateMonitoringConfig = (data: unknown): MonitoringConfig => {
  return MonitoringConfigSchema.parse(data);
};

export const validateQueueConfig = (data: unknown): QueueConfig => {
  return QueueConfigSchema.parse(data);
};

export const validateAppConfiguration = (data: unknown): AppConfiguration => {
  return AppConfigurationSchema.parse(data);
};