import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { BackendSchemaRegistry } from '../schemas/schema-registry';
import {
  QueueJob,
  JobOptions,
  QueueMetrics,
  TaskNotificationJob,
  EmailJob,
  ReportGenerationJob,
  DataExportJob,
  ScheduledTaskJob,
  WebhookDeliveryJob,
  QueueJobSchema,
  JobOptionsSchema,
} from './queue.schemas';

/**
 * Queue Service
 *
 * Implements BullMQ integration for reliable job processing following SOLID principles:
 *
 * 1. Single Responsibility Principle:
 *    - Manages queue operations and job scheduling
 *    - Delegates specific job processing to dedicated processors
 *
 * 2. Open/Closed Principle:
 *    - Extensible for new job types without modifying core logic
 *    - Job processors can be added/removed dynamically
 *
 * 3. Dependency Inversion Principle:
 *    - Depends on abstractions (interfaces) for job processors
 *    - Uses schema registry for validation
 *
 * Key Features:
 * - Type-safe job scheduling with Zod validation
 * - Multiple queue management for different job types
 * - Configurable retry strategies and error handling
 * - Queue metrics and monitoring
 * - Graceful shutdown handling
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private readonly redisConfig: any;

  // Queue names
  private readonly TASK_QUEUE = 'tasks';
  private readonly EMAIL_QUEUE = 'emails';
  private readonly REPORT_QUEUE = 'reports';
  private readonly EXPORT_QUEUE = 'exports';
  private readonly SCHEDULED_QUEUE = 'scheduled';
  private readonly WEBHOOK_QUEUE = 'webhooks';

  constructor(
    private readonly configService: ConfigService,
    private readonly schemaRegistry: BackendSchemaRegistry,
  ) {
    this.redisConfig = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
    };

    this.initializeQueues();
    this.initializeWorkers();
    this.initializeEventListeners();
  }

  /**
   * Initialize all queues
   */
  private initializeQueues(): void {
    const queueNames = [
      this.TASK_QUEUE,
      this.EMAIL_QUEUE,
      this.REPORT_QUEUE,
      this.EXPORT_QUEUE,
      this.SCHEDULED_QUEUE,
      this.WEBHOOK_QUEUE,
    ];

    for (const queueName of queueNames) {
      const queue = new Queue(queueName, {
        connection: this.redisConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 100, // Keep last 100 completed jobs
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          },
        },
      });

      this.queues.set(queueName, queue);
      this.logger.log(`Initialized queue: ${queueName}`);
    }
  }

  /**
   * Initialize workers for job processing
   */
  private initializeWorkers(): void {
    // Task notification worker
    const taskWorker = new Worker(
      this.TASK_QUEUE,
      async (job: Job<TaskNotificationJob>) => {
        return await this.processTaskNotification(job);
      },
      {
        connection: this.redisConfig,
        concurrency: 5,
      }
    );
    this.workers.set(this.TASK_QUEUE, taskWorker);

    // Email worker
    const emailWorker = new Worker(
      this.EMAIL_QUEUE,
      async (job: Job<EmailJob>) => {
        return await this.processEmail(job);
      },
      {
        connection: this.redisConfig,
        concurrency: 10,
      }
    );
    this.workers.set(this.EMAIL_QUEUE, emailWorker);

    // Report generation worker
    const reportWorker = new Worker(
      this.REPORT_QUEUE,
      async (job: Job<ReportGenerationJob>) => {
        return await this.processReport(job);
      },
      {
        connection: this.redisConfig,
        concurrency: 2, // Limit concurrent report generation
      }
    );
    this.workers.set(this.REPORT_QUEUE, reportWorker);

    // Data export worker
    const exportWorker = new Worker(
      this.EXPORT_QUEUE,
      async (job: Job<DataExportJob>) => {
        return await this.processDataExport(job);
      },
      {
        connection: this.redisConfig,
        concurrency: 3,
      }
    );
    this.workers.set(this.EXPORT_QUEUE, exportWorker);

    // Scheduled task worker
    const scheduledWorker = new Worker(
      this.SCHEDULED_QUEUE,
      async (job: Job<ScheduledTaskJob>) => {
        return await this.processScheduledTask(job);
      },
      {
        connection: this.redisConfig,
        concurrency: 5,
      }
    );
    this.workers.set(this.SCHEDULED_QUEUE, scheduledWorker);

    // Webhook delivery worker
    const webhookWorker = new Worker(
      this.WEBHOOK_QUEUE,
      async (job: Job<WebhookDeliveryJob>) => {
        return await this.processWebhook(job);
      },
      {
        connection: this.redisConfig,
        concurrency: 10,
      }
    );
    this.workers.set(this.WEBHOOK_QUEUE, webhookWorker);

    this.logger.log('All workers initialized');
  }

  /**
   * Initialize event listeners for queue monitoring
   */
  private initializeEventListeners(): void {
    this.queues.forEach((queue, queueName) => {
      const queueEvents = new QueueEvents(queueName, {
        connection: this.redisConfig,
      });

      queueEvents.on('completed', ({ jobId, returnvalue }) => {
        this.logger.debug(`Job ${jobId} completed in queue ${queueName}`);
      });

      queueEvents.on('failed', ({ jobId, failedReason }) => {
        this.logger.error(`Job ${jobId} failed in queue ${queueName}: ${failedReason}`);
      });

      queueEvents.on('progress', ({ jobId, data }) => {
        this.logger.debug(`Job ${jobId} progress in queue ${queueName}: ${JSON.stringify(data)}`);
      });

      this.queueEvents.set(queueName, queueEvents);
    });
  }

  /**
   * Add a job to the appropriate queue with validation
   *
   * @param jobData Job data to process
   * @param options Job options
   * @returns Job ID
   */
  async addJob(jobData: QueueJob, options?: JobOptions): Promise<string> {
    // Validate job data
    const validationResult = QueueJobSchema.safeParse(jobData);
    if (!validationResult.success) {
      this.logger.error(`Invalid job data: ${validationResult.error.message}`);
      throw new Error(`Invalid job data: ${validationResult.error.message}`);
    }

    // Validate job options if provided
    if (options) {
      const optionsValidation = JobOptionsSchema.safeParse(options);
      if (!optionsValidation.success) {
        this.logger.error(`Invalid job options: ${optionsValidation.error.message}`);
        throw new Error(`Invalid job options: ${optionsValidation.error.message}`);
      }
      options = optionsValidation.data;
    }

    // Determine queue based on job type
    let queueName: string;
    switch (validationResult.data.type) {
      case 'TASK_NOTIFICATION':
        queueName = this.TASK_QUEUE;
        break;
      case 'EMAIL':
        queueName = this.EMAIL_QUEUE;
        break;
      case 'REPORT_GENERATION':
        queueName = this.REPORT_QUEUE;
        break;
      case 'DATA_EXPORT':
        queueName = this.EXPORT_QUEUE;
        break;
      case 'SCHEDULED_TASK':
        queueName = this.SCHEDULED_QUEUE;
        break;
      case 'WEBHOOK':
        queueName = this.WEBHOOK_QUEUE;
        break;
      default:
        throw new Error(`Unknown job type: ${(validationResult.data as any).type}`);
    }

    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    // Add job to queue
    const job = await queue.add(
      validationResult.data.type,
      validationResult.data,
      options
    );

    this.logger.log(`Added job ${job.id} to queue ${queueName}`);
    return job.id as string;
  }

  /**
   * Get queue metrics for monitoring
   *
   * @param queueName Optional queue name, returns all if not specified
   * @returns Queue metrics
   */
  async getQueueMetrics(queueName?: string): Promise<QueueMetrics[]> {
    const metrics: QueueMetrics[] = [];
    const queuesToCheck = queueName
      ? [this.queues.get(queueName)].filter(Boolean)
      : Array.from(this.queues.values());

    for (const queue of queuesToCheck) {
      if (!queue) continue;

      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);

      metrics.push({
        queueName: queue.name,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
        timestamp: new Date(),
      });
    }

    return metrics;
  }

  /**
   * Pause a queue
   *
   * @param queueName Queue name to pause
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    await queue.pause();
    this.logger.log(`Queue ${queueName} paused`);
  }

  /**
   * Resume a paused queue
   *
   * @param queueName Queue name to resume
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    await queue.resume();
    this.logger.log(`Queue ${queueName} resumed`);
  }

  /**
   * Clean completed/failed jobs from a queue
   *
   * @param queueName Queue name to clean
   * @param grace Grace period in milliseconds
   * @param limit Maximum number of jobs to clean
   * @param status Job status to clean
   */
  async cleanQueue(
    queueName: string,
    grace: number = 0,
    limit: number = 100,
    status: 'completed' | 'failed' = 'completed'
  ): Promise<string[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const cleaned = await queue.clean(grace, limit, status);
    this.logger.log(`Cleaned ${cleaned.length} ${status} jobs from queue ${queueName}`);
    return cleaned;
  }

  /**
   * Get health status of all queues
   *
   * @returns Array of queue health information
   */
  async getQueuesHealth(): Promise<Array<{
    name: string;
    status: 'healthy' | 'unhealthy';
    activeJobs: number;
    waitingJobs: number;
    completedJobs: number;
    failedJobs: number;
  }>> {
    const healthChecks = [];

    for (const [name, queue] of this.queues.entries()) {
      try {
        const [active, waiting, completed, failed] = await Promise.all([
          queue.getActiveCount(),
          queue.getWaitingCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
        ]);

        const failureRate = completed > 0 ? (failed / (completed + failed)) * 100 : 0;
        const status = failureRate > 10 ? 'unhealthy' : 'healthy';

        healthChecks.push({
          name,
          status,
          activeJobs: active,
          waitingJobs: waiting,
          completedJobs: completed,
          failedJobs: failed,
        });
      } catch (error) {
        this.logger.error(`Failed to get health for queue ${name}: ${error.message}`);
        healthChecks.push({
          name,
          status: 'unhealthy',
          activeJobs: 0,
          waitingJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
        });
      }
    }

    return healthChecks;
  }

  /**
   * Process task notification job
   */
  private async processTaskNotification(job: Job<TaskNotificationJob>): Promise<void> {
    const { taskId, notificationType, recipientIds, taskTitle } = job.data;

    this.logger.debug(`Processing task notification: ${notificationType} for task ${taskId}`);

    // TODO: Implement actual notification logic
    // This would typically involve:
    // 1. Fetching user preferences
    // 2. Formatting notification message
    // 3. Sending via WebSocket/Push/Email based on preferences

    await job.updateProgress(50);

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    await job.updateProgress(100);

    this.logger.log(`Task notification processed: ${notificationType} for ${recipientIds.length} recipients`);
  }

  /**
   * Process email job
   */
  private async processEmail(job: Job<EmailJob>): Promise<void> {
    const { to, subject, template, templateData } = job.data;

    this.logger.debug(`Processing email: "${subject}" to ${to.join(', ')}`);

    // TODO: Implement actual email sending logic
    // This would typically involve:
    // 1. Loading email template
    // 2. Rendering template with data
    // 3. Sending via email service (SendGrid, AWS SES, etc.)

    await job.updateProgress(50);

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 500));

    await job.updateProgress(100);

    this.logger.log(`Email sent: "${subject}" to ${to.length} recipients`);
  }

  /**
   * Process report generation job
   */
  private async processReport(job: Job<ReportGenerationJob>): Promise<void> {
    const { reportType, parameters, format, recipients } = job.data;

    this.logger.debug(`Generating report: ${reportType} in ${format} format`);

    // TODO: Implement actual report generation logic
    // This would typically involve:
    // 1. Fetching data based on parameters
    // 2. Processing and aggregating data
    // 3. Generating report in specified format
    // 4. Storing or sending to recipients

    await job.updateProgress(25);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await job.updateProgress(50);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await job.updateProgress(75);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await job.updateProgress(100);

    this.logger.log(`Report generated: ${reportType} in ${format} format`);
  }

  /**
   * Process data export job
   */
  private async processDataExport(job: Job<DataExportJob>): Promise<void> {
    const { exportType, filters, format, destination } = job.data;

    this.logger.debug(`Processing data export: ${exportType} to ${format}`);

    // TODO: Implement actual data export logic
    // This would typically involve:
    // 1. Querying database with filters
    // 2. Formatting data based on format type
    // 3. Uploading to destination (S3, email, etc.)

    await job.updateProgress(33);
    await new Promise(resolve => setTimeout(resolve, 1500));

    await job.updateProgress(66);
    await new Promise(resolve => setTimeout(resolve, 1500));

    await job.updateProgress(100);

    this.logger.log(`Data export completed: ${exportType} to ${destination}`);
  }

  /**
   * Process scheduled task job
   */
  private async processScheduledTask(job: Job<ScheduledTaskJob>): Promise<void> {
    const { taskType, parameters } = job.data;

    this.logger.debug(`Processing scheduled task: ${taskType}`);

    // TODO: Implement actual scheduled task logic based on task type
    switch (taskType) {
      case 'DATABASE_CLEANUP':
        // Clean up old records
        break;
      case 'CACHE_REFRESH':
        // Refresh cache entries
        break;
      case 'METRICS_AGGREGATION':
        // Aggregate metrics
        break;
      case 'HEALTH_CHECK':
        // Perform health checks
        break;
      case 'BACKUP':
        // Perform backup
        break;
    }

    await job.updateProgress(50);
    await new Promise(resolve => setTimeout(resolve, 2000));

    await job.updateProgress(100);

    this.logger.log(`Scheduled task completed: ${taskType}`);
  }

  /**
   * Process webhook delivery job
   */
  private async processWebhook(job: Job<WebhookDeliveryJob>): Promise<void> {
    const { url, method, headers, payload } = job.data;

    this.logger.debug(`Delivering webhook: ${method} ${url}`);

    // TODO: Implement actual webhook delivery logic
    // This would typically involve:
    // 1. Making HTTP request to webhook URL
    // 2. Handling retries based on retry strategy
    // 3. Logging response for audit

    try {
      // Simulate webhook delivery
      await new Promise(resolve => setTimeout(resolve, 1000));

      await job.updateProgress(100);

      this.logger.log(`Webhook delivered successfully: ${method} ${url}`);
    } catch (error) {
      this.logger.error(`Webhook delivery failed: ${error.message}`);
      throw error; // Will trigger retry based on job options
    }
  }

  /**
   * Gracefully shutdown all queues and workers
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down queue service...');

    // Close all workers
    for (const [name, worker] of this.workers) {
      await worker.close();
      this.logger.debug(`Worker ${name} closed`);
    }

    // Close all queue events
    for (const [name, events] of this.queueEvents) {
      await events.close();
      this.logger.debug(`Queue events ${name} closed`);
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      await queue.close();
      this.logger.debug(`Queue ${name} closed`);
    }

    this.logger.log('Queue service shutdown complete');
  }
}