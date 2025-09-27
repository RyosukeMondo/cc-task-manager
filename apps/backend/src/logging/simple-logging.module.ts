import { Module, Global } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SimpleLoggerService } from './simple-logger.service';

/**
 * Simple logging module that works with current TypeScript setup
 */
@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const environment = configService.get<string>('NODE_ENV', 'production');
        const isDev = environment === 'development';

        return {
          pinoHttp: {
            level: isDev ? 'debug' : 'info',
            transport: isDev ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: true,
                ignore: 'pid,hostname',
              },
            } : undefined,
            serializers: {
              req: (req: any) => ({
                method: req.method,
                url: req.url,
                correlationId: req.correlationId,
              }),
              res: (res: any) => ({
                statusCode: res.statusCode,
              }),
            },
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
        };
      },
    }),
  ],
  providers: [SimpleLoggerService],
  exports: [SimpleLoggerService, LoggerModule],
})
export class SimpleLoggingModule {}