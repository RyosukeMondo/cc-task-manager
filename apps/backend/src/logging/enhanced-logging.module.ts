import { Module, Global } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { EnhancedLoggerService } from './enhanced-logger.service';

/**
 * Enhanced logging module that works with existing Pino setup
 * Provides structured logging and observability features
 */
@Global()
@Module({
  imports: [LoggerModule],
  providers: [EnhancedLoggerService],
  exports: [EnhancedLoggerService],
})
export class EnhancedLoggingModule {}