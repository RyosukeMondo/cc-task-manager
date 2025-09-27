import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const logger = new Logger('WorkerApplication');
  
  try {
    const app = await NestFactory.create(WorkerModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('WORKER_PORT', 3001);

    // Enable graceful shutdown
    app.enableShutdownHooks();

    await app.listen(port);
    logger.log(`Worker application started on port ${port}`);
  } catch (error) {
    logger.error('Failed to start worker application', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const logger = new Logger('WorkerApplication');
  logger.error('Unhandled Promise Rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const logger = new Logger('WorkerApplication');
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

bootstrap();