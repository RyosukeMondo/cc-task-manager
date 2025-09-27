import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

/**
 * Simple logger service with correlation ID support
 * Avoids complex TypeScript configuration issues
 */
@Injectable()
export class SimpleLoggerService {
  constructor(private readonly logger: PinoLogger) {}

  /**
   * Log info level message
   */
  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(meta || {}, message);
  }

  /**
   * Log warning level message
   */
  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(meta || {}, message);
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error, meta?: Record<string, any>): void {
    const logData = { ...meta };
    if (error) {
      logData.err = error;
    }
    this.logger.error(logData, message);
  }

  /**
   * Log debug level message
   */
  debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(meta || {}, message);
  }

  /**
   * Log operation timing
   */
  logOperation(operation: string, duration: number, meta?: Record<string, any>): void {
    this.info(`Operation: ${operation}`, {
      operation,
      duration,
      ...meta,
    });
  }

  /**
   * Log authentication events
   */
  logAuth(event: string, userId?: string, ip?: string): void {
    this.info(`Auth: ${event}`, {
      event,
      userId,
      ip,
      type: 'auth',
    });
  }

  /**
   * Log API requests
   */
  logRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.info(`${method} ${path}`, {
      method,
      path,
      statusCode,
      duration,
      type: 'request',
    });
  }
}