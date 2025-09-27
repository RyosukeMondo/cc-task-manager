import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

/**
 * Enhanced logger service for structured logging with observability
 * Works with existing Pino configuration
 */
@Injectable()
export class EnhancedLoggerService {
  constructor(private readonly logger: PinoLogger) {}

  /**
   * Log info level message with structured metadata
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
   * Log error level message with stack trace
   */
  error(message: string, error?: Error, meta?: Record<string, any>): void {
    const logData = { ...meta };
    if (error) {
      logData.err = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
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
   * Log operation with performance metrics
   */
  logOperation(operation: string, duration: number, success: boolean, meta?: Record<string, any>): void {
    const level = success ? 'info' : 'warn';
    this.logger[level]({
      operation,
      duration,
      success,
      performance: duration > 1000 ? 'slow' : 'normal',
      ...meta,
    }, `Operation ${operation} ${success ? 'completed' : 'failed'} in ${duration}ms`);
  }

  /**
   * Log authentication events for security monitoring
   */
  logAuthEvent(event: string, userId?: string, ip?: string, success?: boolean): void {
    this.info(`Authentication: ${event}`, {
      event,
      userId,
      ip,
      success,
      type: 'auth',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log API request/response
   */
  logApiRequest(method: string, path: string, statusCode: number, duration: number, userId?: string): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this.logger[level]({
      method,
      path,
      statusCode,
      duration,
      userId,
      type: 'api_request',
      performance: duration > 2000 ? 'slow' : 'normal',
    }, `${method} ${path} - ${statusCode} (${duration}ms)`);
  }

  /**
   * Log database operations
   */
  logDatabaseOperation(operation: string, table: string, duration: number, recordCount?: number): void {
    this.info(`Database: ${operation}`, {
      operation,
      table,
      duration,
      recordCount,
      type: 'database',
      performance: duration > 500 ? 'slow' : 'normal',
    });
  }

  /**
   * Log business events for audit trail
   */
  logBusinessEvent(event: string, entity: string, entityId: string, userId: string, changes?: any): void {
    this.info(`Business: ${event}`, {
      event,
      entity,
      entityId,
      userId,
      changes: changes ? JSON.stringify(changes) : undefined,
      type: 'business',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log security events
   */
  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details: Record<string, any>): void {
    const level = severity === 'critical' ? 'error' :
                 severity === 'high' ? 'error' :
                 severity === 'medium' ? 'warn' : 'info';

    this.logger[level]({
      ...details,
      event,
      severity,
      type: 'security',
      timestamp: new Date().toISOString(),
    }, `Security: ${event} (${severity})`);
  }

  /**
   * Create a timing function for operations
   */
  createTimer(operation: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.logOperation(operation, duration, true);
    };
  }
}