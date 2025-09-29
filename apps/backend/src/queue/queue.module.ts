import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueService } from './queue.service';
import { QueueManagerService } from './queue-manager.service';
import { QueueMonitorService } from './queue-monitor.service';
import { QueueController } from './queue.controller';
import { QueueConfigService } from './queue.config';
import { TaskProcessorWorker } from './processors/task-processor.worker';
import { JobSchedulerService } from './scheduler/job-scheduler.service';
import { BackendSchemaRegistry } from '../schemas/schema-registry';

/**
 * Queue Module
 *
 * Provides comprehensive BullMQ integration for job processing and background tasks.
 * Follows SOLID principles with extensible job processor architecture.
 *
 * Features:
 * - Type-safe job scheduling with Zod validation
 * - Centralized queue configuration with Redis connection
 * - Advanced queue management operations (QueueManagerService)
 * - Multiple queue management for different job types
 * - Priority-based job scheduling and execution
 * - Delayed and recurring job execution
 * - Configurable retry strategies and error handling
 * - Bulk operations for efficiency
 * - Rate limiting and performance optimization
 * - Queue metrics and monitoring endpoints
 * - Job search and filtering capabilities
 * - Graceful shutdown handling
 *
 * Services:
 * - QueueService: Basic queue operations and job processing
 * - QueueManagerService: Advanced queue management with comprehensive job control
 * - QueueMonitorService: Comprehensive queue monitoring and metrics collection
 * - QueueConfigService: Centralized configuration management
 * - JobSchedulerService: Advanced job scheduling with cron expressions and dependencies
 * - TaskProcessorWorker: Worker for processing Claude Code task execution
 *
 * Exports services for use by other modules.
 */
@Module({
  imports: [ConfigModule],
  controllers: [QueueController],
  providers: [QueueService, QueueManagerService, QueueMonitorService, QueueConfigService, JobSchedulerService, TaskProcessorWorker, BackendSchemaRegistry],
  exports: [QueueService, QueueManagerService, QueueMonitorService, QueueConfigService, JobSchedulerService, TaskProcessorWorker],
})
export class QueueModule {}