import { Injectable, Inject } from '@nestjs/common';
import { INQUIRER } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Context for correlation tracking across async operations
 */
export interface LogContext {
  correlationId: string;
  userId?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

/**
 * Enhanced logger service with correlation ID support
 * Implements Single Responsibility Principle - focused on logging with correlation
 */
@Injectable()
export class LoggerService {
  private static asyncLocalStorage = new AsyncLocalStorage<LogContext>();

  constructor(
    private readonly logger: PinoLogger,
    @Inject(INQUIRER) private readonly parentClass: object,
  ) {}

  /**
   * Creates a child logger with context
   */
  private createContextLogger(context?: Partial<LogContext>) {
    const currentContext = LoggerService.asyncLocalStorage.getStore();
    const mergedContext = { ...currentContext, ...context };

    return this.logger.logger.child({
      context: this.getContextName(),
      ...mergedContext,
    });
  }

  /**
   * Gets the context name from the parent class
   */
  private getContextName(): string {
    if (!this.parentClass) {
      return 'Application';
    }
    return this.parentClass.constructor.name;
  }

  /**
   * Runs operation within correlation context
   */
  static runWithCorrelation<T>(
    context: LogContext,
    operation: () => T | Promise<T>,
  ): T | Promise<T> {
    return LoggerService.asyncLocalStorage.run(context, operation);
  }

  /**
   * Gets current correlation context
   */
  static getCurrentContext(): LogContext | undefined {
    return LoggerService.asyncLocalStorage.getStore();
  }

  /**
   * Logs trace level message
   */
  trace(message: string, meta?: Record<string, any>): void {
    const contextLogger = this.createContextLogger(meta);
    contextLogger.trace(message);
  }

  /**
   * Logs debug level message
   */
  debug(message: string, meta?: Record<string, any>): void {
    const contextLogger = this.createContextLogger(meta);
    contextLogger.debug(message);
  }

  /**
   * Logs info level message
   */
  info(message: string, meta?: Record<string, any>): void {
    const contextLogger = this.createContextLogger(meta);
    contextLogger.info(message);
  }

  /**
   * Logs warning level message
   */
  warn(message: string, meta?: Record<string, any>): void {
    const contextLogger = this.createContextLogger(meta);
    contextLogger.warn(message);
  }

  /**
   * Logs error level message
   */
  error(message: string, error?: Error, meta?: Record<string, any>): void {
    const contextLogger = this.createContextLogger(meta);

    if (error) {
      contextLogger.error({ err: error }, message);
    } else {
      contextLogger.error(message);
    }
  }

  /**
   * Logs fatal level message
   */
  fatal(message: string, error?: Error, meta?: Record<string, any>): void {
    const contextLogger = this.createContextLogger(meta);

    if (error) {
      contextLogger.fatal({ err: error }, message);
    } else {
      contextLogger.fatal(message);
    }
  }

  /**
   * Logs operation start with timing
   */
  startOperation(operation: string, meta?: Record<string, any>): () => void {
    const start = Date.now();
    const contextLogger = this.createContextLogger({ operation, ...meta });

    contextLogger.info(`Starting operation: ${operation}`);

    return () => {
      const duration = Date.now() - start;
      contextLogger.info(`Completed operation: ${operation}`, {
        duration,
        operation,
      });
    };
  }

  /**
   * Logs database operation with query performance
   */
  logDatabaseOperation(
    operation: string,
    query?: string,
    duration?: number,
    meta?: Record<string, any>,
  ): void {
    const contextLogger = this.createContextLogger(meta);

    contextLogger.info(`Database ${operation}`, {
      operation: `db_${operation}`,
      query: query ? query.substring(0, 200) : undefined, // Truncate long queries
      duration,
      ...meta,
    });
  }

  /**
   * Logs API request/response with security considerations
   */
  logApiCall(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    userId?: string,
    meta?: Record<string, any>,
  ): void {
    const contextLogger = this.createContextLogger({ userId, ...meta });

    contextLogger.info(`API ${method} ${url}`, {
      operation: 'api_call',
      method,
      url,
      statusCode,
      duration,
      userId,
      ...meta,
    });
  }

  /**
   * Logs authentication events for security monitoring
   */
  logAuthEvent(
    event: 'login' | 'logout' | 'token_refresh' | 'unauthorized',
    userId?: string,
    ip?: string,
    meta?: Record<string, any>,
  ): void {
    const contextLogger = this.createContextLogger({ userId, ...meta });

    contextLogger.info(`Authentication: ${event}`, {
      operation: 'auth_event',
      event,
      userId,
      ip,
      ...meta,
    });
  }

  /**
   * Logs business logic events for audit trail
   */
  logBusinessEvent(
    event: string,
    entity: string,
    entityId: string,
    userId?: string,
    meta?: Record<string, any>,
  ): void {
    const contextLogger = this.createContextLogger({ userId, ...meta });

    contextLogger.info(`Business event: ${event}`, {
      operation: 'business_event',
      event,
      entity,
      entityId,
      userId,
      ...meta,
    });
  }

  /**
   * Logs security events for monitoring
   */
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
  ): void {
    const contextLogger = this.createContextLogger(details);

    const logMethod = severity === 'critical' ? 'fatal' :
                     severity === 'high' ? 'error' :
                     severity === 'medium' ? 'warn' : 'info';

    contextLogger[logMethod](`Security event: ${event}`, {
      operation: 'security_event',
      event,
      severity,
      ...details,
    });
  }
}