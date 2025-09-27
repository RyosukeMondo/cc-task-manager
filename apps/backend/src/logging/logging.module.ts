import { Module, Global } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerService } from './logger.service';
import { createPinoConfig } from './pino.config.simple';

/**
 * Global logging module providing structured logging with Pino
 * Implements Dependency Inversion Principle - depends on abstractions (ConfigService)
 */
@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const environment = configService.get<string>('NODE_ENV', 'production');
        return createPinoConfig(environment);
      },
    }),
  ],
  providers: [LoggerService],
  exports: [LoggerService, LoggerModule],
})
export class LoggingModule {}

/**
 * Enhanced logger module for specific contexts
 * Provides scoped logger instances
 */
@Module({
  imports: [LoggingModule],
  providers: [
    {
      provide: 'CONTEXT_LOGGER',
      useFactory: (loggerService: LoggerService) => {
        return (context: string) => {
          // Return a logger bound to specific context
          return {
            ...loggerService,
            context,
          };
        };
      },
      inject: [LoggerService],
    },
  ],
  exports: ['CONTEXT_LOGGER'],
})
export class ContextualLoggingModule {}