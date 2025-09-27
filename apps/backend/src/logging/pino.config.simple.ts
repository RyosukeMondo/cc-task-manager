import { Params } from 'nestjs-pino';

/**
 * Creates Pino configuration based on environment
 * Simplified version to avoid TypeScript issues
 */
export function createPinoConfig(environment: string = 'production'): Params {
  const isDevelopment = environment === 'development';
  const isTest = environment === 'test';

  if (isTest) {
    return {
      pinoHttp: {
        level: 'silent',
      },
    };
  }

  if (isDevelopment) {
    return {
      pinoHttp: {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
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
          ],
          censor: '[REDACTED]',
        },
        genReqId: (req: any) => {
          return req.headers['x-correlation-id'] ||
                 req.headers['x-request-id'] ||
                 generateCorrelationId();
        },
      },
    };
  }

  // Production configuration
  return {
    pinoHttp: {
      level: 'info',
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
        ],
        censor: '[REDACTED]',
      },
      genReqId: (req: any) => {
        return req.headers['x-correlation-id'] ||
               req.headers['x-request-id'] ||
               generateCorrelationId();
      },
    },
  };
}

/**
 * Generates a correlation ID for request tracking
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