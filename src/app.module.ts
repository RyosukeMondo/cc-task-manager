import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import workerConfig from './config/worker.config';
import { WorkerModule } from './worker/worker.module';

@Module({
  imports: [
    // Global configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [workerConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    
    // Global logging module using Pino
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const config = configService.get('worker');
        return {
          pinoHttp: {
            level: config?.logLevel || 'info',
            transport:
              process.env.NODE_ENV !== 'production'
                ? {
                    target: 'pino-pretty',
                    options: {
                      colorize: true,
                      translateTime: 'SYS:standard',
                      ignore: 'hostname,pid',
                    },
                  }
                : undefined,
            serializers: {
              req: (req) => ({
                method: req.method,
                url: req.url,
                headers: config?.enableDetailedLogs ? req.headers : undefined,
              }),
              res: (res) => ({
                statusCode: res.statusCode,
                headers: config?.enableDetailedLogs ? res.headers : undefined,
              }),
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.token',
                'res.headers["set-cookie"]',
              ],
              remove: true,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    
    // Worker module with all Claude Code task processing logic
    WorkerModule,
  ],
  providers: [],
})
export class AppModule {}