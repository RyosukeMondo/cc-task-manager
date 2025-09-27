import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SimpleLoggerService } from './simple-logger.service';

/**
 * Simple correlation middleware for request tracking
 * Minimal implementation that works with current TypeScript setup
 */
@Injectable()
export class SimpleCorrelationMiddleware implements NestMiddleware {
  constructor(private readonly logger: SimpleLoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Generate correlation ID
    const correlationId = this.generateCorrelationId();

    // Add to request
    (req as any).correlationId = correlationId;
    (req as any).startTime = Date.now();

    // Add to response headers
    res.setHeader('x-correlation-id', correlationId);

    // Log request start
    this.logger.info('Request started', {
      correlationId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Setup response logging
    const originalEnd = res.end;
    res.end = function(chunk: any, encoding?: any) {
      const duration = Date.now() - (req as any).startTime;

      // Use SimpleLoggerService to log completion
      const logger = (req as any).logger ||
        // Fallback logging
        console.log(`Request completed: ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);

      return originalEnd.call(this, chunk, encoding);
    };

    next();
  }

  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${randomPart}`;
  }
}