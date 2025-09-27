import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Correlation ID Middleware
 *
 * Ensures every request has a correlation ID for tracking and debugging.
 * This middleware integrates with the existing error handling infrastructure
 * to provide end-to-end request tracing.
 *
 * Features:
 * - Generates correlation IDs for requests without them
 * - Preserves existing correlation IDs from upstream services
 * - Adds correlation ID to response headers
 * - Makes correlation ID available throughout request lifecycle
 *
 * SOLID Principles:
 * - Single Responsibility: Only manages correlation IDs
 * - Interface Segregation: Minimal middleware interface
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Check for existing correlation ID from various header names
    const existingId =
      req.headers['x-correlation-id'] ||
      req.headers['x-request-id'] ||
      req.headers['correlation-id'] ||
      req.headers['request-id'];

    // Use existing ID or generate a new one
    const correlationId = (existingId as string) || randomUUID();

    // Attach correlation ID to request object for downstream use
    req['correlationId'] = correlationId;

    // Add correlation ID to response headers
    res.setHeader('X-Correlation-Id', correlationId);

    // Continue to next middleware
    next();
  }
}

// Note: correlationId is already declared in src/logging/correlation.middleware.ts
// We rely on that declaration to avoid conflicts