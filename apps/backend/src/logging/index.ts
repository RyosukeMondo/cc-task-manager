/**
 * Enhanced logging module exports
 * Provides structured logging with Pino and correlation tracking
 */

export { EnhancedLoggingModule } from './enhanced-logging.module';
export { EnhancedLoggerService } from './enhanced-logger.service';
export { RequestLoggingMiddleware } from './request-logging.middleware';

// Re-export common types for convenience
export type { PinoLogger } from 'nestjs-pino';