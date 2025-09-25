import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create NestJS application
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until Pino logger is ready
  });

  // Use Pino logger
  app.useLogger(app.get(Logger));
  
  // Get configuration service
  const configService = app.get(ConfigService);
  const workerConfig = configService.get('worker');
  
  // Set up global validation pipe for request validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    })
  );

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Start the application
  const port = process.env.PORT || 3000;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Claude Code Task Manager started on port ${port}`, 'Bootstrap');
  logger.log(`Worker configuration:`, 'Bootstrap');
  logger.log(`- Max concurrent tasks: ${workerConfig.maxConcurrentTasks}`, 'Bootstrap');
  logger.log(`- Queue name: ${workerConfig.queueName}`, 'Bootstrap');
  logger.log(`- Redis: ${workerConfig.redisHost}:${workerConfig.redisPort}`, 'Bootstrap');
  logger.log(`- Python executable: ${workerConfig.pythonExecutable}`, 'Bootstrap');
  logger.log(`- Wrapper script: ${workerConfig.wrapperScriptPath}`, 'Bootstrap');
  logger.log(`Application is ready to process Claude Code tasks!`, 'Bootstrap');
}

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});