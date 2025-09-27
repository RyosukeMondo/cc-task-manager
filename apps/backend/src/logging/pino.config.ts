import { Params } from 'nestjs-pino';
import { z } from 'zod';

// Pino configuration schema for validation
export const PinoConfigSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  transport: z.object({
    target: z.string().optional(),
    options: z.object({
      colorize: z.boolean().optional(),
      translateTime: z.boolean().optional(),
      ignore: z.string().optional(),
    }).optional(),
  }).optional(),
  formatters: z.object({
    level: z.function().optional(),
    log: z.function().optional(),
  }).optional(),
  redact: z.array(z.string()).optional(),
});

export type PinoConfig = z.infer<typeof PinoConfigSchema>;

/**
 * Creates Pino configuration based on environment
 * Follows Single Level of Abstraction Principle (SLAP)
 */
export function createPinoConfig(environment: string = 'production'): Params {
  const isDevelopment = environment === 'development';
  const isTest = environment === 'test';

  const baseConfig: Params = {
    pinoHttp: {
      level: isTest ? 'silent' : isDevelopment ? 'debug' : 'info',

      // Custom log formatting for structured logging
      formatters: {
        level: (label: string) => ({ level: label }),
        log: (object: any) => ({
          ...object,
          // Add hostname for distributed systems
          hostname: process.env.HOSTNAME || 'unknown',
          // Add service name for observability
          service: '@cc-task-manager/backend',
        }),
      },

      // Security-safe error logging - redact sensitive fields
      redact: {
        paths: [
          'password',
          'token',
          'authorization',
          'cookie',
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.password',
          'req.body.token',
          'req.body.confirmPassword',
          'res.body.password',
          'res.body.token',
        ],
        censor: '[REDACTED]',
      },

      // Custom serializers for better logging structure
      serializers: {
        req: (req: any) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          correlationId: req.correlationId,
          userAgent: req.headers?.['user-agent'],
          ip: req.ip || req.connection?.remoteAddress,
          userId: req.user?.id,
        }),
        res: (res: any) => ({
          statusCode: res.statusCode,
          correlationId: res.correlationId,
        }),
        err: (err: any) => ({
          type: err.constructor.name,
          message: err.message,
          stack: err.stack,
          correlationId: err.correlationId,
        }),
      },

      // Request/response logging configuration
      autoLogging: {
        ignore: (req: any) => {
          // Skip health check endpoints to reduce noise
          return req.url?.includes('/health') || req.url?.includes('/metrics');
        },
      },

      // Custom request ID generation for correlation
      genReqId: (req: any) => {
        // Use existing correlation ID or generate new one
        return req.headers['x-correlation-id'] ||
               req.headers['x-request-id'] ||
               generateCorrelationId();
      },
    },
  };

  // Development-specific configuration
  if (isDevelopment) {
    (baseConfig.pinoHttp as any).transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    };
  }

  return baseConfig;
}

/**
 * Generates a correlation ID for request tracking
 * Uses timestamp + random string for uniqueness
 */
function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}`;
}

/**
 * Log levels for structured logging
 */
export const LogLevel = {
  TRACE: 'trace',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
} as const;

export type LogLevelType = typeof LogLevel[keyof typeof LogLevel];