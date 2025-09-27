import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService, LogContext } from './logger.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extend Express Request and Response for correlation tracking
 */
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      startTime: number;
    }
    interface Response {
      responseBody?: any;
    }
  }
}

/**
 * Middleware for correlation ID management and request context
 * Implements Single Level of Abstraction Principle (SLAP)
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Extract or generate correlation ID
    const correlationId = this.extractCorrelationId(req);

    // Set correlation ID on request
    req.correlationId = correlationId;
    req.startTime = Date.now();

    // Set correlation ID header on response
    res.setHeader('x-correlation-id', correlationId);

    // Create log context
    const logContext: LogContext = {
      correlationId,
      userId: this.extractUserId(req),
      operation: `${req.method} ${req.path}`,
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: this.extractClientIp(req),
        method: req.method,
        path: req.path,
      },
    };

    // Run request within correlation context
    LoggerService.runWithCorrelation(logContext, () => {
      // Log request start
      this.logRequestStart(req);

      // Setup response logging
      this.setupResponseLogging(req, res);

      next();
    });
  }

  /**
   * Extracts correlation ID from headers or generates new one
   */
  private extractCorrelationId(req: Request): string {
    return (
      req.headers['x-correlation-id'] as string ||
      req.headers['x-request-id'] as string ||
      req.headers['x-trace-id'] as string ||
      uuidv4()
    );
  }

  /**
   * Extracts user ID from request (if authenticated)
   */
  private extractUserId(req: Request): string | undefined {
    // Extract from JWT payload or session
    return (req as any).user?.id || (req as any).user?.sub;
  }

  /**
   * Extracts client IP address considering proxy headers
   */
  private extractClientIp(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Logs request start with sanitized information
   */
  private logRequestStart(req: Request): void {
    const shouldLogBody = this.shouldLogRequestBody(req);

    this.logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      query: req.query,
      body: shouldLogBody ? this.sanitizeBody(req.body) : '[EXCLUDED]',
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
    });
  }

  /**
   * Sets up response logging when response finishes
   */
  private setupResponseLogging(req: Request, res: Response): void {
    const originalSend = res.send;
    const originalJson = res.json;

    // Override res.send to capture response
    res.send = function(body: any) {
      res.responseBody = body;
      return originalSend.call(this, body);
    };

    // Override res.json to capture JSON response
    res.json = function(body: any) {
      res.responseBody = body;
      return originalJson.call(this, body);
    };

    // Log when response finishes
    res.on('finish', () => {
      this.logRequestComplete(req, res);
    });

    // Log on response close (client disconnection)
    res.on('close', () => {
      if (!res.writableEnded) {
        this.logger.warn('Request connection closed by client', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
        });
      }
    });
  }

  /**
   * Logs request completion with performance metrics
   */
  private logRequestComplete(req: Request, res: Response): void {
    const duration = Date.now() - req.startTime;
    const statusCode = res.statusCode;

    // Determine log level based on status code
    const logLevel = this.getLogLevelForStatus(statusCode);

    const logData = {
      method: req.method,
      path: req.path,
      statusCode,
      duration,
      contentLength: res.getHeader('content-length'),
      responseBody: this.shouldLogResponseBody(res)
        ? this.sanitizeBody((res as any).responseBody)
        : '[EXCLUDED]',
    };

    switch (logLevel) {
      case 'error':
        this.logger.error('Request completed with error', undefined, logData);
        break;
      case 'warn':
        this.logger.warn('Request completed with warning', logData);
        break;
      default:
        this.logger.info('Request completed', logData);
    }

    // Log performance warning for slow requests
    if (duration > 5000) {
      this.logger.warn('Slow request detected', {
        ...logData,
        performance: 'slow',
        threshold: '5000ms',
      });
    }
  }

  /**
   * Determines appropriate log level based on HTTP status code
   */
  private getLogLevelForStatus(statusCode: number): 'info' | 'warn' | 'error' {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  /**
   * Determines if request body should be logged
   */
  private shouldLogRequestBody(req: Request): boolean {
    const method = req.method.toLowerCase();
    const contentType = req.headers['content-type'] || '';

    // Don't log file uploads or large payloads
    if (contentType.includes('multipart/form-data')) return false;
    if (contentType.includes('application/octet-stream')) return false;

    // Log bodies for POST, PUT, PATCH requests
    return ['post', 'put', 'patch'].includes(method);
  }

  /**
   * Determines if response body should be logged
   */
  private shouldLogResponseBody(res: Response): boolean {
    const contentType = res.getHeader('content-type') as string || '';
    const contentLength = parseInt(res.getHeader('content-length') as string || '0');

    // Don't log large responses or binary content
    if (contentLength > 10000) return false;
    if (!contentType.includes('application/json')) return false;

    return true;
  }

  /**
   * Sanitizes request/response body for secure logging
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'confirmPassword',
      'currentPassword',
      'newPassword',
    ];

    const sanitized = { ...body };

    const sanitizeObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      }

      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          if (sensitiveFields.some(field => lowerKey.includes(field))) {
            result[key] = '[REDACTED]';
          } else {
            result[key] = sanitizeObject(value);
          }
        }
        return result;
      }

      return obj;
    };

    return sanitizeObject(sanitized);
  }
}