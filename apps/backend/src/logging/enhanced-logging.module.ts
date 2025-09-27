import { Module, Global } from '@nestjs/common';
import { EnhancedLoggerService } from './enhanced-logger.service';

/**
 * Enhanced logging module that works with existing Pino setup
 * Provides structured logging and observability features
 */
@Global()
@Module({
  providers: [EnhancedLoggerService],
  exports: [EnhancedLoggerService],
})
export class EnhancedLoggingModule {}