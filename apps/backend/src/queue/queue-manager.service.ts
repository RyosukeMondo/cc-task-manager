import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Queue, Job, JobsOptions, QueueScheduler, RepeatableJob } from 'bullmq';
import { QueueConfigService } from './queue.config';
import { BackendSchemaRegistry } from '../schemas/schema-registry';
import {
  QueueJob,
  JobOptions,
  QueueMetrics,
  JobPriority,
  JobStatus,
  QueueManagerOptions,
  BulkJobOperation,
  JobSearchFilters,
  DelayedJobOptions,
  JobRetryStrategy,
  QueueJobSchema,
  JobOptionsSchema,
} from './queue.schemas';

/**
 * Queue Manager Service
 *
 * Provides comprehensive queue management operations following SOLID principles:
 *
 * 1. Single Responsibility Principle:
 *    - Focused solely on queue management operations
 *    - Delegates configuration to QueueConfigService
 *    - Delegates job processing to dedicated workers
 *
 * 2. Open/Closed Principle:
 *    - Extensible for new queue operations without modification
 *    - Job types can be added through schema extension
 *
 * 3. Liskov Substitution Principle:
 *    - Implements consistent interface for all queue operations
 *    - Substitutable with other queue management implementations
 *
 * 4. Interface Segregation Principle:
 *    - Provides specific interfaces for different operation types
 *    - Clients depend only on methods they use
 *
 * 5. Dependency Inversion Principle:
 *    - Depends on QueueConfigService abstraction
 *    - Uses schema registry for validation
 *
 * Key Features:
 * - Comprehensive job lifecycle management
 * - Priority-based job scheduling
 * - Delayed and recurring job execution
 * - Advanced retry strategies with exponential backoff
 * - Bulk operations for efficiency
 * - Real-time monitoring and metrics
 * - Job search and filtering capabilities
 * - Transaction-safe queue operations
 */
@Injectable()
export class QueueManagerService {
  private readonly logger = new Logger(QueueManagerService.name);
  private queues: Map<string, Queue> = new Map();
  private schedulers: Map<string, QueueScheduler> = new Map();

  // Queue names for different job types
  private readonly QUEUE_NAMES = {
    TASKS: 'tasks',
    EMAILS: 'emails',
    REPORTS: 'reports',
    EXPORTS: 'exports',
    SCHEDULED: 'scheduled',
    WEBHOOKS: 'webhooks',
    PRIORITY_HIGH: 'priority-high',
    PRIORITY_NORMAL: 'priority-normal',
    PRIORITY_LOW: 'priority-low',
  } as const;

  constructor(
    private readonly queueConfigService: QueueConfigService,
    private readonly schemaRegistry: BackendSchemaRegistry,
  ) {
    this.initializeQueues();
    this.initializeSchedulers();
    this.logger.log('Queue Manager Service initialized successfully');
  }

  /**
   * Initialize all queues with proper configuration
   *
   * @private
   */
  private initializeQueues(): void {
    Object.values(this.QUEUE_NAMES).forEach(queueName => {
      const queueConfig = this.queueConfigService.getQueueConfiguration(queueName);
      const queue = new Queue(queueName, queueConfig);

      // Set up queue event handlers for monitoring
      this.setupQueueEventHandlers(queue);

      this.queues.set(queueName, queue);
      this.logger.debug(`Initialized queue: ${queueName}`);
    });
  }

  /**
   * Initialize queue schedulers for recurring jobs
   *
   * @private
   */
  private initializeSchedulers(): void {
    Object.values(this.QUEUE_NAMES).forEach(queueName => {
      const schedulerConfig = this.queueConfigService.getWorkerConfiguration(queueName);
      const scheduler = new QueueScheduler(queueName, schedulerConfig);

      this.schedulers.set(queueName, scheduler);
      this.logger.debug(`Initialized scheduler for queue: ${queueName}`);
    });
  }

  /**
   * Set up event handlers for queue monitoring
   *
   * @private
   */
  private setupQueueEventHandlers(queue: Queue): void {
    queue.on('error', (error) => {
      this.logger.error(`Queue ${queue.name} error:`, error);
    });

    queue.on('waiting', (job) => {
      this.logger.debug(`Job ${job.id} waiting in queue ${queue.name}`);
    });

    queue.on('active', (job) => {
      this.logger.debug(`Job ${job.id} active in queue ${queue.name}`);
    });

    queue.on('completed', (job, result) => {
      this.logger.debug(`Job ${job.id} completed in queue ${queue.name}`);
    });

    queue.on('failed', (job, error) => {
      this.logger.warn(`Job ${job?.id} failed in queue ${queue.name}: ${error.message}`);
    });

    queue.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled in queue ${queue.name}`);
    });
  }

  /**
   * Add a job to the appropriate queue with comprehensive options
   *
   * @param jobData Job data to process
   * @param options Advanced job options including priority, delay, and retry strategies
   * @returns Job ID and queue information
   */
  async addJob(
    jobData: QueueJob,
    options?: QueueManagerOptions,
  ): Promise<{ jobId: string; queueName: string; estimatedDelay?: number }> {
    // Validate job data using schema registry
    const jobValidation = QueueJobSchema.safeParse(jobData);
    if (!jobValidation.success) {
      this.logger.error(`Invalid job data: ${jobValidation.error.message}`);
      throw new BadRequestException({
        error: 'JobValidationError',
        message: 'Job data does not meet schema requirements',
        details: jobValidation.error.errors,
      });
    }

    // Validate options if provided
    if (options) {
      const optionsValidation = JobOptionsSchema.safeParse(options);
      if (!optionsValidation.success) {
        this.logger.error(`Invalid job options: ${optionsValidation.error.message}`);
        throw new BadRequestException({
          error: 'JobOptionsValidationError',
          message: 'Job options do not meet schema requirements',
          details: optionsValidation.error.errors,
        });
      }
    }

    const validatedJobData = jobValidation.data;
    const queueName = this.determineQueueByPriority(validatedJobData, options?.priority);
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new NotFoundException(`Queue ${queueName} not found`);
    }

    // Build comprehensive job options
    const jobOptions = this.buildJobOptions(options);

    try {
      const job = await queue.add(
        validatedJobData.type,
        validatedJobData,
        jobOptions,
      );

      this.logger.log(`Added job ${job.id} to queue ${queueName} with priority ${options?.priority || 'normal'}`);

      return {
        jobId: job.id as string,
        queueName,
        estimatedDelay: jobOptions.delay,
      };
    } catch (error) {
      this.logger.error(`Failed to add job to queue ${queueName}:`, error);
      throw new BadRequestException({
        error: 'JobCreationError',
        message: 'Failed to create job',
        details: error.message,
      });
    }
  }

  /**
   * Add multiple jobs in a single transaction
   *
   * @param jobsData Array of jobs to add
   * @param options Common options for all jobs
   * @returns Array of job IDs and queue information
   */
  async addBulkJobs(
    jobsData: QueueJob[],
    options?: QueueManagerOptions,
  ): Promise<Array<{ jobId: string; queueName: string }>> {
    if (jobsData.length === 0) {
      throw new BadRequestException('At least one job must be provided for bulk operation');
    }

    const results: Array<{ jobId: string; queueName: string }> = [];

    // Group jobs by queue to optimize bulk operations
    const jobsByQueue = new Map<string, QueueJob[]>();

    for (const jobData of jobsData) {
      const queueName = this.determineQueueByPriority(jobData, options?.priority);
      if (!jobsByQueue.has(queueName)) {
        jobsByQueue.set(queueName, []);
      }
      jobsByQueue.get(queueName)!.push(jobData);
    }

    // Add jobs to each queue in bulk
    for (const [queueName, jobs] of jobsByQueue) {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new NotFoundException(`Queue ${queueName} not found`);
      }

      const jobOptions = this.buildJobOptions(options);
      const jobsToAdd = jobs.map(jobData => ({
        name: jobData.type,
        data: jobData,
        opts: jobOptions,
      }));

      try {
        const addedJobs = await queue.addBulk(jobsToAdd);

        for (const job of addedJobs) {
          results.push({
            jobId: job.id as string,
            queueName,
          });
        }

        this.logger.log(`Added ${jobs.length} jobs to queue ${queueName} in bulk`);
      } catch (error) {
        this.logger.error(`Failed to add bulk jobs to queue ${queueName}:`, error);
        throw new BadRequestException({
          error: 'BulkJobCreationError',
          message: `Failed to create bulk jobs for queue ${queueName}`,
          details: error.message,
        });
      }
    }

    this.logger.log(`Successfully added ${results.length} jobs across ${jobsByQueue.size} queues`);
    return results;
  }

  /**
   * Schedule a job for delayed execution
   *
   * @param jobData Job data to process
   * @param delayOptions Delay configuration
   * @returns Scheduled job information
   */
  async scheduleDelayedJob(
    jobData: QueueJob,
    delayOptions: DelayedJobOptions,
  ): Promise<{ jobId: string; queueName: string; executeAt: Date }> {
    const executeAt = this.calculateExecutionTime(delayOptions);
    const delay = executeAt.getTime() - Date.now();

    if (delay <= 0) {
      throw new BadRequestException('Execution time must be in the future');
    }

    const options: QueueManagerOptions = {
      ...delayOptions,
      delay,
    };

    const result = await this.addJob(jobData, options);

    this.logger.log(`Scheduled job ${result.jobId} for execution at ${executeAt.toISOString()}`);

    return {
      ...result,
      executeAt,
    };
  }

  /**
   * Schedule a recurring job with cron expression
   *
   * @param jobData Job data to process
   * @param cronExpression Cron expression for recurring schedule
   * @param options Additional job options
   * @returns Repeatable job information
   */
  async scheduleRecurringJob(
    jobData: QueueJob,
    cronExpression: string,
    options?: QueueManagerOptions,
  ): Promise<{ jobId: string; queueName: string; nextExecution: Date }> {
    const queueName = this.determineQueueByPriority(jobData, options?.priority);
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new NotFoundException(`Queue ${queueName} not found`);
    }

    const jobOptions: JobsOptions = {
      ...this.buildJobOptions(options),
      repeat: {
        cron: cronExpression,
        tz: options?.timezone || 'UTC',
      },
    };

    try {
      const job = await queue.add(
        jobData.type,
        jobData,
        jobOptions,
      );

      // Calculate next execution time
      const nextExecution = this.getNextCronExecution(cronExpression, options?.timezone);

      this.logger.log(`Scheduled recurring job ${job.id} with cron: ${cronExpression}`);

      return {
        jobId: job.id as string,
        queueName,
        nextExecution,
      };
    } catch (error) {
      this.logger.error(`Failed to schedule recurring job:`, error);
      throw new BadRequestException({
        error: 'RecurringJobCreationError',
        message: 'Failed to create recurring job',
        details: error.message,
      });
    }
  }

  /**
   * Get job by ID with comprehensive information
   *
   * @param jobId Job ID to retrieve
   * @param queueName Optional queue name for optimization
   * @returns Job information including status and progress
   */
  async getJob(jobId: string, queueName?: string): Promise<{
    id: string;
    name: string;
    data: any;
    status: JobStatus;
    progress: number;
    priority: number;
    attempts: number;
    maxAttempts: number;
    createdAt: Date;
    processedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    error?: string;
    returnValue?: any;
  }> {
    let job: Job | undefined;

    if (queueName) {
      const queue = this.queues.get(queueName);
      if (queue) {
        job = await queue.getJob(jobId);
      }
    } else {
      // Search across all queues if queue name not provided
      for (const queue of this.queues.values()) {
        job = await queue.getJob(jobId);
        if (job) break;
      }
    }

    if (!job) {
      throw new NotFoundException({
        error: 'JobNotFound',
        message: `Job with ID ${jobId} not found`,
        jobId,
      });
    }

    const status = await this.getJobStatus(job);

    return {
      id: job.id as string,
      name: job.name,
      data: job.data,
      status,
      progress: job.progress,
      priority: job.opts.priority || 0,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts || 1,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      failedAt: job.failedReason ? new Date(job.finishedOn || Date.now()) : undefined,
      error: job.failedReason,
      returnValue: job.returnvalue,
    };
  }

  /**
   * Update job priority
   *
   * @param jobId Job ID to update
   * @param priority New priority level
   * @param queueName Optional queue name for optimization
   */
  async updateJobPriority(
    jobId: string,
    priority: JobPriority,
    queueName?: string,
  ): Promise<void> {
    const job = await this.findJob(jobId, queueName);

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const status = await this.getJobStatus(job);

    if (status !== JobStatus.WAITING && status !== JobStatus.DELAYED) {
      throw new BadRequestException(`Cannot update priority for job in ${status} state`);
    }

    try {
      await job.changePriority({ priority: this.getPriorityValue(priority) });
      this.logger.log(`Updated job ${jobId} priority to ${priority}`);
    } catch (error) {
      this.logger.error(`Failed to update job ${jobId} priority:`, error);
      throw new BadRequestException({
        error: 'JobUpdateError',
        message: 'Failed to update job priority',
        details: error.message,
      });
    }
  }

  /**
   * Retry a failed job with optional new options
   *
   * @param jobId Job ID to retry
   * @param retryStrategy Optional retry strategy override
   * @param queueName Optional queue name for optimization
   */
  async retryJob(
    jobId: string,
    retryStrategy?: JobRetryStrategy,
    queueName?: string,
  ): Promise<void> {
    const job = await this.findJob(jobId, queueName);

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const status = await this.getJobStatus(job);

    if (status !== JobStatus.FAILED) {
      throw new BadRequestException(`Cannot retry job in ${status} state`);
    }

    try {
      if (retryStrategy) {
        // Update retry options if provided
        await job.update({
          ...job.data,
        });

        // Update job options with new retry strategy
        const newOptions = {
          ...job.opts,
          attempts: retryStrategy.maxAttempts,
          backoff: {
            type: retryStrategy.backoffType,
            delay: retryStrategy.backoffDelay,
          },
        };

        // Remove and re-add with new options
        await job.remove();
        await job.queue.add(job.name, job.data, newOptions);
      } else {
        // Simple retry with existing options
        await job.retry();
      }

      this.logger.log(`Retried job ${jobId}`);
    } catch (error) {
      this.logger.error(`Failed to retry job ${jobId}:`, error);
      throw new BadRequestException({
        error: 'JobRetryError',
        message: 'Failed to retry job',
        details: error.message,
      });
    }
  }

  /**
   * Cancel a job (remove from queue)
   *
   * @param jobId Job ID to cancel
   * @param queueName Optional queue name for optimization
   */
  async cancelJob(jobId: string, queueName?: string): Promise<void> {
    const job = await this.findJob(jobId, queueName);

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const status = await this.getJobStatus(job);

    if (status === JobStatus.ACTIVE) {
      throw new BadRequestException('Cannot cancel active job');
    }

    if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
      throw new BadRequestException(`Cannot cancel ${status} job`);
    }

    try {
      await job.remove();
      this.logger.log(`Cancelled job ${jobId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}:`, error);
      throw new BadRequestException({
        error: 'JobCancellationError',
        message: 'Failed to cancel job',
        details: error.message,
      });
    }
  }

  /**
   * Perform bulk operations on multiple jobs
   *
   * @param operation Bulk operation details
   * @returns Operation results
   */
  async bulkJobOperation(operation: BulkJobOperation): Promise<{
    success: boolean;
    processed: number;
    failed: number;
    results: Array<{ jobId: string; success: boolean; error?: string }>;
  }> {
    const { jobIds, operation: operationType, options } = operation;
    const results: Array<{ jobId: string; success: boolean; error?: string }> = [];
    let processed = 0;
    let failed = 0;

    for (const jobId of jobIds) {
      try {
        switch (operationType) {
          case 'retry':
            await this.retryJob(jobId, options?.retryStrategy);
            break;
          case 'cancel':
            await this.cancelJob(jobId);
            break;
          case 'updatePriority':
            if (!options?.priority) {
              throw new BadRequestException('Priority is required for updatePriority operation');
            }
            await this.updateJobPriority(jobId, options.priority);
            break;
          default:
            throw new BadRequestException(`Unsupported bulk operation: ${operationType}`);
        }

        results.push({ jobId, success: true });
        processed++;
      } catch (error) {
        results.push({
          jobId,
          success: false,
          error: error.message,
        });
        failed++;
        this.logger.warn(`Bulk operation ${operationType} failed for job ${jobId}: ${error.message}`);
      }
    }

    this.logger.log(`Bulk operation ${operationType} completed: ${processed} successful, ${failed} failed`);

    return {
      success: failed === 0,
      processed,
      failed,
      results,
    };
  }

  /**
   * Search jobs with filtering and pagination
   *
   * @param filters Search filters
   * @returns Paginated job results
   */
  async searchJobs(filters: JobSearchFilters): Promise<{
    jobs: Array<{ id: string; name: string; status: JobStatus; priority: number; createdAt: Date }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const { queueName, status, priority, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    const queuesToSearch = queueName
      ? [this.queues.get(queueName)].filter(Boolean)
      : Array.from(this.queues.values());

    let allJobs: Job[] = [];

    for (const queue of queuesToSearch) {
      if (!queue) continue;

      let jobs: Job[] = [];

      if (status) {
        switch (status) {
          case JobStatus.WAITING:
            jobs = await queue.getWaiting(0, -1);
            break;
          case JobStatus.ACTIVE:
            jobs = await queue.getActive(0, -1);
            break;
          case JobStatus.COMPLETED:
            jobs = await queue.getCompleted(0, -1);
            break;
          case JobStatus.FAILED:
            jobs = await queue.getFailed(0, -1);
            break;
          case JobStatus.DELAYED:
            jobs = await queue.getDelayed(0, -1);
            break;
        }
      } else {
        // Get all jobs if no status filter
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(0, -1),
          queue.getActive(0, -1),
          queue.getCompleted(0, -1),
          queue.getFailed(0, -1),
          queue.getDelayed(0, -1),
        ]);
        jobs = [...waiting, ...active, ...completed, ...failed, ...delayed];
      }

      // Apply priority filter
      if (priority !== undefined) {
        const priorityValue = this.getPriorityValue(priority);
        jobs = jobs.filter(job => (job.opts.priority || 0) === priorityValue);
      }

      allJobs = [...allJobs, ...jobs];
    }

    // Sort by creation time (newest first)
    allJobs.sort((a, b) => b.timestamp - a.timestamp);

    const total = allJobs.length;
    const paginatedJobs = allJobs.slice(offset, offset + limit);

    const jobResults = await Promise.all(
      paginatedJobs.map(async (job) => ({
        id: job.id as string,
        name: job.name,
        status: await this.getJobStatus(job),
        priority: job.opts.priority || 0,
        createdAt: new Date(job.timestamp),
      }))
    );

    return {
      jobs: jobResults,
      total,
      page,
      limit,
    };
  }

  /**
   * Get comprehensive queue metrics
   *
   * @param queueName Optional specific queue name
   * @returns Queue metrics and statistics
   */
  async getQueueMetrics(queueName?: string): Promise<QueueMetrics[]> {
    const queuesToCheck = queueName
      ? [this.queues.get(queueName)].filter(Boolean)
      : Array.from(this.queues.values());

    const metrics: QueueMetrics[] = [];

    for (const queue of queuesToCheck) {
      if (!queue) continue;

      try {
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
          throughput: await this.calculateThroughput(queue),
          averageProcessingTime: await this.calculateAverageProcessingTime(queue),
          failureRate: completed > 0 ? (failed / (completed + failed)) * 100 : 0,
        });
      } catch (error) {
        this.logger.error(`Failed to get metrics for queue ${queue.name}:`, error);
        metrics.push({
          queueName: queue.name,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
          timestamp: new Date(),
          throughput: 0,
          averageProcessingTime: 0,
          failureRate: 0,
        });
      }
    }

    return metrics;
  }

  /**
   * Pause queue processing
   *
   * @param queueName Queue name to pause
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new NotFoundException(`Queue ${queueName} not found`);
    }

    await queue.pause();
    this.logger.log(`Queue ${queueName} paused`);
  }

  /**
   * Resume queue processing
   *
   * @param queueName Queue name to resume
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new NotFoundException(`Queue ${queueName} not found`);
    }

    await queue.resume();
    this.logger.log(`Queue ${queueName} resumed`);
  }

  /**
   * Clean completed or failed jobs from queue
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
    status: 'completed' | 'failed' = 'completed',
  ): Promise<string[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new NotFoundException(`Queue ${queueName} not found`);
    }

    const cleaned = await queue.clean(grace, limit, status);
    this.logger.log(`Cleaned ${cleaned.length} ${status} jobs from queue ${queueName}`);
    return cleaned;
  }

  /**
   * Get all repeatable jobs
   *
   * @param queueName Optional queue name filter
   * @returns Array of repeatable job configurations
   */
  async getRepeatableJobs(queueName?: string): Promise<RepeatableJob[]> {
    const queuesToCheck = queueName
      ? [this.queues.get(queueName)].filter(Boolean)
      : Array.from(this.queues.values());

    const repeatableJobs: RepeatableJob[] = [];

    for (const queue of queuesToCheck) {
      if (!queue) continue;

      try {
        const jobs = await queue.getRepeatableJobs();
        repeatableJobs.push(...jobs);
      } catch (error) {
        this.logger.error(`Failed to get repeatable jobs for queue ${queue.name}:`, error);
      }
    }

    return repeatableJobs;
  }

  /**
   * Remove a repeatable job
   *
   * @param queueName Queue name
   * @param jobId Job ID or job key
   * @param repeatOptions Repeat options used when creating the job
   */
  async removeRepeatableJob(
    queueName: string,
    jobId: string,
    repeatOptions: { cron?: string; every?: number },
  ): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new NotFoundException(`Queue ${queueName} not found`);
    }

    try {
      await queue.removeRepeatable(jobId, repeatOptions);
      this.logger.log(`Removed repeatable job ${jobId} from queue ${queueName}`);
    } catch (error) {
      this.logger.error(`Failed to remove repeatable job ${jobId}:`, error);
      throw new BadRequestException({
        error: 'RepeatableJobRemovalError',
        message: 'Failed to remove repeatable job',
        details: error.message,
      });
    }
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Determine appropriate queue based on job type and priority
   *
   * @private
   */
  private determineQueueByPriority(jobData: QueueJob, priority?: JobPriority): string {
    // Use priority queues for high-priority jobs
    if (priority === JobPriority.HIGH || priority === JobPriority.URGENT) {
      return this.QUEUE_NAMES.PRIORITY_HIGH;
    }

    if (priority === JobPriority.LOW) {
      return this.QUEUE_NAMES.PRIORITY_LOW;
    }

    // Default to normal priority queue or job-type specific queue
    switch (jobData.type) {
      case 'EMAIL':
        return this.QUEUE_NAMES.EMAILS;
      case 'REPORT_GENERATION':
        return this.QUEUE_NAMES.REPORTS;
      case 'DATA_EXPORT':
        return this.QUEUE_NAMES.EXPORTS;
      case 'SCHEDULED_TASK':
        return this.QUEUE_NAMES.SCHEDULED;
      case 'WEBHOOK':
        return this.QUEUE_NAMES.WEBHOOKS;
      case 'CLAUDE_CODE_TASK':
        return this.QUEUE_NAMES.TASKS;
      case 'TASK_NOTIFICATION':
      default:
        return this.QUEUE_NAMES.PRIORITY_NORMAL;
    }
  }

  /**
   * Build comprehensive job options from manager options
   *
   * @private
   */
  private buildJobOptions(options?: QueueManagerOptions): JobsOptions {
    const defaultOptions = this.queueConfigService.getDefaultJobOptions();

    if (!options) {
      return defaultOptions;
    }

    return {
      ...defaultOptions,
      priority: options.priority ? this.getPriorityValue(options.priority) : defaultOptions.priority,
      delay: options.delay || defaultOptions.delay,
      attempts: options.maxAttempts || defaultOptions.attempts,
      backoff: options.retryStrategy ? {
        type: options.retryStrategy.backoffType,
        delay: options.retryStrategy.backoffDelay,
      } : defaultOptions.backoff,
      removeOnComplete: options.removeOnComplete ?? defaultOptions.removeOnComplete,
      removeOnFail: options.removeOnFail ?? defaultOptions.removeOnFail,
      jobId: options.jobId || defaultOptions.jobId,
    };
  }

  /**
   * Get numeric priority value from priority enum
   *
   * @private
   */
  private getPriorityValue(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.URGENT:
        return 100;
      case JobPriority.HIGH:
        return 75;
      case JobPriority.NORMAL:
        return 50;
      case JobPriority.LOW:
        return 25;
      default:
        return 50;
    }
  }

  /**
   * Calculate execution time from delay options
   *
   * @private
   */
  private calculateExecutionTime(delayOptions: DelayedJobOptions): Date {
    const now = new Date();

    if (delayOptions.executeAt) {
      return new Date(delayOptions.executeAt);
    }

    if (delayOptions.delay) {
      return new Date(now.getTime() + delayOptions.delay);
    }

    throw new BadRequestException('Either executeAt or delay must be provided');
  }

  /**
   * Get next execution time for cron expression
   *
   * @private
   */
  private getNextCronExecution(cronExpression: string, timezone = 'UTC'): Date {
    // This is a simplified implementation
    // In a real application, you would use a proper cron parser like 'cron-parser'
    const now = new Date();
    return new Date(now.getTime() + 60000); // Return 1 minute from now as placeholder
  }

  /**
   * Find job across queues
   *
   * @private
   */
  private async findJob(jobId: string, queueName?: string): Promise<Job | undefined> {
    if (queueName) {
      const queue = this.queues.get(queueName);
      return queue ? await queue.getJob(jobId) : undefined;
    }

    // Search across all queues
    for (const queue of this.queues.values()) {
      const job = await queue.getJob(jobId);
      if (job) return job;
    }

    return undefined;
  }

  /**
   * Get job status
   *
   * @private
   */
  private async getJobStatus(job: Job): Promise<JobStatus> {
    const state = await job.getState();

    switch (state) {
      case 'waiting':
        return JobStatus.WAITING;
      case 'active':
        return JobStatus.ACTIVE;
      case 'completed':
        return JobStatus.COMPLETED;
      case 'failed':
        return JobStatus.FAILED;
      case 'delayed':
        return JobStatus.DELAYED;
      case 'paused':
        return JobStatus.PAUSED;
      default:
        return JobStatus.WAITING;
    }
  }

  /**
   * Calculate queue throughput (jobs per minute)
   *
   * @private
   */
  private async calculateThroughput(queue: Queue): Promise<number> {
    try {
      // Get completed jobs from the last hour
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const recentJobs = await queue.getCompleted(0, 100);

      const recentCompletedJobs = recentJobs.filter(
        job => job.finishedOn && job.finishedOn > oneHourAgo
      );

      // Calculate jobs per minute
      return recentCompletedJobs.length / 60;
    } catch (error) {
      this.logger.warn(`Failed to calculate throughput for queue ${queue.name}:`, error);
      return 0;
    }
  }

  /**
   * Calculate average processing time in milliseconds
   *
   * @private
   */
  private async calculateAverageProcessingTime(queue: Queue): Promise<number> {
    try {
      const completedJobs = await queue.getCompleted(0, 50);

      const processingTimes = completedJobs
        .filter(job => job.processedOn && job.finishedOn)
        .map(job => job.finishedOn! - job.processedOn!);

      if (processingTimes.length === 0) return 0;

      const average = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
      return Math.round(average);
    } catch (error) {
      this.logger.warn(`Failed to calculate average processing time for queue ${queue.name}:`, error);
      return 0;
    }
  }
}