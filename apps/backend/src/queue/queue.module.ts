import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { QueueConfigService } from './queue.config';
import { BackendSchemaRegistry } from '../schemas/schema-registry';

/**
 * Queue Module
 *
 * Provides BullMQ integration for job processing and background tasks.
 * Follows SOLID principles with extensible job processor architecture.
 *
 * Features:
 * - Type-safe job scheduling with Zod validation
 * - Centralized queue configuration with Redis connection
 * - Multiple queue management for different job types
 * - Configurable retry strategies and error handling
 * - Rate limiting and performance optimization
 * - Queue metrics and monitoring endpoints
 * - Graceful shutdown handling
 *
 * Exports QueueService and QueueConfigService for use by other modules.
 */
@Module({
  imports: [ConfigModule],
  controllers: [QueueController],
  providers: [QueueService, QueueConfigService, BackendSchemaRegistry],
  exports: [QueueService, QueueConfigService],
})
export class QueueModule {}