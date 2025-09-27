import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { BackendSchemaRegistry } from '../schemas/schema-registry';

/**
 * Queue Module
 *
 * Provides BullMQ integration for job processing and background tasks.
 * Follows SOLID principles with extensible job processor architecture.
 *
 * Features:
 * - Type-safe job scheduling with Zod validation
 * - Multiple queue management for different job types
 * - Configurable retry strategies and error handling
 * - Queue metrics and monitoring endpoints
 * - Graceful shutdown handling
 *
 * Exports QueueService for use by other modules to schedule jobs.
 */
@Module({
  imports: [ConfigModule],
  controllers: [QueueController],
  providers: [QueueService, BackendSchemaRegistry],
  exports: [QueueService],
})
export class QueueModule {}