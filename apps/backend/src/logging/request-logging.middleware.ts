import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { EnhancedLoggerService } from './enhanced-logger.service';

/**
 * Request logging middleware for correlation and observability
 * Works with existing infrastructure
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: EnhancedLoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Generate correlation ID
    const correlationId = this.generateCorrelationId(req);
    const startTime = Date.now();

    // Add correlation data to request
    (req as any).correlationId = correlationId;
    (req as any).startTime = startTime;

    // Add correlation header to response
    res.setHeader('x-correlation-id', correlationId);

    // Log request start (only for non-health check endpoints)
    if (!this.shouldSkipLogging(req)) {
      this.logger.info('Request started', {
        correlationId,
        method: req.method,
        path: req.path,
        ip: this.getClientIp(req),
        userAgent: req.headers['user-agent'],
        contentType: req.headers['content-type'],
      });
    }

    // Capture response
    const originalSend = res.send;
    res.send = function(body: any) {
      const duration = Date.now() - startTime;

      // Log request completion
      if (!RequestLoggingMiddleware.prototype.shouldSkipLogging(req)) {
        const logger = (req as any)._logger;
        if (logger) {
          logger.logApiRequest(
            req.method,
            req.path,
            res.statusCode,
            duration,
            (req as any).user?.id
          );
        }
      }

      return originalSend.call(this, body);
    };

    // Store logger reference for cleanup logging
    (req as any)._logger = this.logger;

    next();
  }

  private generateCorrelationId(req: Request): string {
    // Use existing header or generate new one
    return (req.headers['x-correlation-id'] as string) ||
           (req.headers['x-request-id'] as string) ||
           this.createNewCorrelationId();
  }

  private createNewCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `req-${timestamp}-${randomPart}`;
  }

  private getClientIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           (req.headers['x-real-ip'] as string) ||
           req.connection?.remoteAddress ||
           req.ip ||
           'unknown';
  }

  private shouldSkipLogging(req: Request): boolean {
    const path = req.path;
    // Skip logging for health checks and static assets
    return path.includes('/health') ||
           path.includes('/metrics') ||
           path.includes('/favicon') ||
           path.includes('/static');
  }
}