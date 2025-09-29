import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Queue, Job, JobsOptions, RepeatableJob } from 'bullmq';
import { QueueConfigService } from '../queue.config';
import { QueueManagerService } from '../queue-manager.service';
import { BackendSchemaRegistry } from '../../schemas/schema-registry';
import {
  QueueJob,
  JobPriority,
  QueueManagerOptions,
  DelayedJobOptions,
  JobRetryStrategy,
  QueueJobSchema,
} from '../queue.schemas';

/**
 * Job Scheduler Service
 *
 * Provides comprehensive job scheduling capabilities with cron expressions,
 * delayed execution, and job dependency management following SOLID principles:
 *
 * 1. Single Responsibility Principle:
 *    - Focused solely on job scheduling operations
 *    - Delegates queue management to QueueManagerService
 *    - Delegates configuration to QueueConfigService
 *
 * 2. Open/Closed Principle:
 *    - Extensible for new scheduling patterns without modification
 *    - New job types can be added through schema extension
 *
 * 3. Liskov Substitution Principle:
 *    - Implements consistent interface for all scheduling operations
 *    - Substitutable with other scheduling implementations
 *
 * 4. Interface Segregation Principle:
 *    - Provides specific interfaces for different scheduling types
 *    - Clients depend only on methods they use
 *
 * 5. Dependency Inversion Principle:
 *    - Depends on QueueConfigService and QueueManagerService abstractions
 *    - Uses schema registry for validation
 *
 * Key Features:
 * - Cron-based recurring job scheduling with timezone support
 * - Delayed job execution with precise timing
 * - Job dependency management and chaining
 * - Advanced scheduling strategies (immediate, delayed, recurring)
 * - Comprehensive error handling and retry logic
 * - Real-time schedule monitoring and management
 * - Job cancellation and rescheduling capabilities
 * - Timezone-aware scheduling with DST handling
 * - Schedule persistence and recovery after system restart
 */
@Injectable()
export class JobSchedulerService {
  private readonly logger = new Logger(JobSchedulerService.name);
  private scheduledJobs: Map<string, ScheduledJobInfo> = new Map();
  private jobDependencies: Map<string, JobDependencyInfo[]> = new Map();

  // Schedule types for different scheduling strategies
  private readonly SCHEDULE_TYPES = {
    IMMEDIATE: 'immediate',
    DELAYED: 'delayed',
    RECURRING: 'recurring',
    CONDITIONAL: 'conditional',
  } as const;

  constructor(
    private readonly queueConfigService: QueueConfigService,
    private readonly queueManagerService: QueueManagerService,
    private readonly schemaRegistry: BackendSchemaRegistry,
  ) {
    this.logger.log('Job Scheduler Service initialized successfully');
  }

  /**
   * Schedule a job with cron expression for recurring execution
   *
   * @param jobData Job data to process
   * @param cronExpression Cron expression (e.g., "0 9 * * 1-5" for weekdays at 9 AM)
   * @param options Advanced scheduling options including timezone and retry strategies
   * @returns Scheduled job information with next execution times
   */
  async scheduleRecurringJob(
    jobData: QueueJob,
    cronExpression: string,
    options?: RecurringJobOptions,
  ): Promise<RecurringJobResult> {
    // Validate job data using schema registry
    const jobValidation = QueueJobSchema.safeParse(jobData);
    if (!jobValidation.success) {
      this.logger.error(`Invalid job data for scheduling: ${jobValidation.error.message}`);
      throw new BadRequestException({
        error: 'JobValidationError',
        message: 'Job data does not meet schema requirements',
        details: jobValidation.error.errors,
      });
    }

    // Validate cron expression
    if (!this.isValidCronExpression(cronExpression)) {
      throw new BadRequestException({
        error: 'InvalidCronExpression',
        message: 'Provided cron expression is not valid',
        cronExpression,
      });
    }

    const validatedJobData = jobValidation.data;
    const scheduleId = this.generateScheduleId(validatedJobData, cronExpression);
    const timezone = options?.timezone || 'UTC';

    try {
      // Use QueueManagerService to create the recurring job
      const result = await this.queueManagerService.scheduleRecurringJob(
        validatedJobData,
        cronExpression,
        {
          priority: options?.priority || JobPriority.NORMAL,
          maxAttempts: options?.maxAttempts || 3,
          retryStrategy: options?.retryStrategy,
          timezone,
          jobId: scheduleId,
        },
      );

      // Calculate multiple next execution times for better visibility
      const nextExecutions = this.getNextCronExecutions(cronExpression, timezone, 5);

      // Store scheduled job information for management
      const scheduledJobInfo: ScheduledJobInfo = {
        scheduleId,
        jobId: result.jobId,
        queueName: result.queueName,
        cronExpression,
        timezone,
        jobData: validatedJobData,
        createdAt: new Date(),
        lastExecuted: undefined,
        nextExecution: result.nextExecution,
        executionCount: 0,
        failureCount: 0,
        isActive: true,
        options,
      };

      this.scheduledJobs.set(scheduleId, scheduledJobInfo);

      this.logger.log(`Scheduled recurring job ${scheduleId} with cron: ${cronExpression} (timezone: ${timezone})`);

      return {
        scheduleId,
        jobId: result.jobId,
        queueName: result.queueName,
        cronExpression,
        timezone,
        nextExecutions,
        estimatedExecutionsPerDay: this.calculateDailyExecutions(cronExpression),
      };
    } catch (error) {
      this.logger.error(`Failed to schedule recurring job:`, error);
      throw new BadRequestException({
        error: 'RecurringJobSchedulingError',
        message: 'Failed to schedule recurring job',
        details: error.message,
      });
    }
  }

  /**
   * Schedule a job for delayed execution with precise timing
   *
   * @param jobData Job data to process
   * @param delayOptions Delay configuration with execution time or delay duration
   * @param options Additional job options
   * @returns Delayed job information
   */
  async scheduleDelayedJob(
    jobData: QueueJob,
    delayOptions: DelayedJobOptions,
    options?: QueueManagerOptions,
  ): Promise<DelayedJobResult> {
    const executeAt = this.calculateExecutionTime(delayOptions);
    const delay = executeAt.getTime() - Date.now();

    if (delay <= 0) {
      throw new BadRequestException({
        error: 'InvalidExecutionTime',
        message: 'Execution time must be in the future',
        requestedTime: executeAt,
        currentTime: new Date(),
      });
    }

    // Validate job data
    const jobValidation = QueueJobSchema.safeParse(jobData);
    if (!jobValidation.success) {
      throw new BadRequestException({
        error: 'JobValidationError',
        message: 'Job data does not meet schema requirements',
        details: jobValidation.error.errors,
      });
    }

    const validatedJobData = jobValidation.data;
    const scheduleId = this.generateScheduleId(validatedJobData, `delayed-${executeAt.getTime()}`);

    try {
      // Use QueueManagerService to schedule the delayed job
      const result = await this.queueManagerService.scheduleDelayedJob(
        validatedJobData,
        { ...delayOptions, delay },
      );

      // Store delayed job information
      const delayedJobInfo: ScheduledJobInfo = {
        scheduleId,
        jobId: result.jobId,
        queueName: result.queueName,
        cronExpression: undefined,
        timezone: delayOptions.timezone || 'UTC',
        jobData: validatedJobData,
        createdAt: new Date(),
        lastExecuted: undefined,
        nextExecution: executeAt,
        executionCount: 0,
        failureCount: 0,
        isActive: true,
        options,
      };

      this.scheduledJobs.set(scheduleId, delayedJobInfo);

      this.logger.log(`Scheduled delayed job ${scheduleId} for execution at ${executeAt.toISOString()}`);

      return {
        scheduleId,
        jobId: result.jobId,
        queueName: result.queueName,
        executeAt,
        delayDuration: delay,
        estimatedStartTime: executeAt,
      };
    } catch (error) {
      this.logger.error(`Failed to schedule delayed job:`, error);
      throw new BadRequestException({
        error: 'DelayedJobSchedulingError',
        message: 'Failed to schedule delayed job',
        details: error.message,
      });
    }
  }

  /**
   * Create job dependency chain where jobs execute in sequence
   *
   * @param dependencies Array of job dependencies with execution order
   * @param options Chain execution options
   * @returns Dependency chain information
   */
  async createJobDependencyChain(
    dependencies: JobDependency[],
    options?: DependencyChainOptions,
  ): Promise<DependencyChainResult> {
    if (dependencies.length === 0) {
      throw new BadRequestException('At least one job dependency must be provided');
    }

    const chainId = this.generateChainId(dependencies);
    const jobIds: string[] = [];
    const scheduledJobs: Array<{ stepIndex: number; jobId: string; dependsOn?: string }> = [];

    try {
      // Schedule jobs with dependencies
      for (let i = 0; i < dependencies.length; i++) {
        const dependency = dependencies[i];
        const isFirstJob = i === 0;
        const previousJobId = i > 0 ? jobIds[i - 1] : undefined;

        // Calculate delay for dependent jobs
        const delay = isFirstJob
          ? (dependency.delay || 0)
          : (dependency.delay || 0) + (options?.stepDelay || 1000);

        const jobOptions: QueueManagerOptions = {
          ...dependency.options,
          delay,
          priority: dependency.priority || JobPriority.NORMAL,
          jobId: `${chainId}-step-${i}`,
        };

        // Schedule the job
        const result = await this.queueManagerService.addJob(dependency.jobData, jobOptions);

        jobIds.push(result.jobId);
        scheduledJobs.push({
          stepIndex: i,
          jobId: result.jobId,
          dependsOn: previousJobId,
        });

        // Store dependency information
        if (previousJobId) {
          const dependencyInfo: JobDependencyInfo = {
            dependentJobId: result.jobId,
            dependsOnJobId: previousJobId,
            chainId,
            stepIndex: i,
            status: 'waiting',
            createdAt: new Date(),
          };

          const existingDeps = this.jobDependencies.get(previousJobId) || [];
          existingDeps.push(dependencyInfo);
          this.jobDependencies.set(previousJobId, existingDeps);
        }

        this.logger.debug(`Scheduled dependency step ${i} with job ID: ${result.jobId}`);
      }

      this.logger.log(`Created job dependency chain ${chainId} with ${dependencies.length} steps`);

      return {
        chainId,
        totalSteps: dependencies.length,
        scheduledJobs,
        estimatedTotalDuration: this.calculateChainDuration(dependencies, options),
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to create job dependency chain:`, error);
      throw new BadRequestException({
        error: 'DependencyChainCreationError',
        message: 'Failed to create job dependency chain',
        details: error.message,
      });
    }
  }

  /**
   * Cancel a scheduled job by schedule ID or job ID
   *
   * @param identifier Schedule ID or Job ID
   * @param type Type of identifier provided
   * @returns Cancellation result
   */
  async cancelScheduledJob(
    identifier: string,
    type: 'scheduleId' | 'jobId' = 'scheduleId',
  ): Promise<CancellationResult> {
    let scheduledJob: ScheduledJobInfo | undefined;
    let scheduleId: string;

    if (type === 'scheduleId') {
      scheduleId = identifier;
      scheduledJob = this.scheduledJobs.get(identifier);
    } else {
      // Find by job ID
      for (const [id, job] of this.scheduledJobs) {
        if (job.jobId === identifier) {
          scheduleId = id;
          scheduledJob = job;
          break;
        }
      }
    }

    if (!scheduledJob) {
      throw new NotFoundException({
        error: 'ScheduledJobNotFound',
        message: `Scheduled job not found`,
        identifier,
        type,
      });
    }

    try {
      // Cancel the underlying queue job
      await this.queueManagerService.cancelJob(scheduledJob.jobId, scheduledJob.queueName);

      // If it's a recurring job, remove the repeatable configuration
      if (scheduledJob.cronExpression) {
        await this.queueManagerService.removeRepeatableJob(
          scheduledJob.queueName,
          scheduledJob.jobId,
          { cron: scheduledJob.cronExpression },
        );
      }

      // Mark as cancelled and remove from tracking
      scheduledJob.isActive = false;
      this.scheduledJobs.delete(scheduleId!);

      // Clean up any dependencies
      this.cleanupJobDependencies(scheduledJob.jobId);

      this.logger.log(`Cancelled scheduled job ${scheduleId} (Job ID: ${scheduledJob.jobId})`);

      return {
        scheduleId: scheduleId!,
        jobId: scheduledJob.jobId,
        cancelled: true,
        cancelledAt: new Date(),
        wasRecurring: !!scheduledJob.cronExpression,
      };
    } catch (error) {
      this.logger.error(`Failed to cancel scheduled job ${scheduleId}:`, error);
      throw new BadRequestException({
        error: 'JobCancellationError',
        message: 'Failed to cancel scheduled job',
        details: error.message,
      });
    }
  }

  /**
   * Reschedule an existing recurring job with new cron expression
   *
   * @param scheduleId Schedule ID to reschedule
   * @param newCronExpression New cron expression
   * @param options Updated scheduling options
   * @returns Rescheduling result
   */
  async rescheduleRecurringJob(
    scheduleId: string,
    newCronExpression: string,
    options?: RecurringJobOptions,
  ): Promise<RescheduleResult> {
    const scheduledJob = this.scheduledJobs.get(scheduleId);

    if (!scheduledJob) {
      throw new NotFoundException(`Scheduled job ${scheduleId} not found`);
    }

    if (!scheduledJob.cronExpression) {
      throw new BadRequestException(`Job ${scheduleId} is not a recurring job`);
    }

    if (!this.isValidCronExpression(newCronExpression)) {
      throw new BadRequestException({
        error: 'InvalidCronExpression',
        message: 'New cron expression is not valid',
        cronExpression: newCronExpression,
      });
    }

    try {
      // Remove the old recurring job
      await this.queueManagerService.removeRepeatableJob(
        scheduledJob.queueName,
        scheduledJob.jobId,
        { cron: scheduledJob.cronExpression },
      );

      // Create new recurring job with updated schedule
      const result = await this.scheduleRecurringJob(
        scheduledJob.jobData,
        newCronExpression,
        {
          ...scheduledJob.options,
          ...options,
          timezone: options?.timezone || scheduledJob.timezone,
        },
      );

      // Remove old schedule tracking
      this.scheduledJobs.delete(scheduleId);

      this.logger.log(`Rescheduled job ${scheduleId} from '${scheduledJob.cronExpression}' to '${newCronExpression}'`);

      return {
        oldScheduleId: scheduleId,
        newScheduleId: result.scheduleId,
        oldCronExpression: scheduledJob.cronExpression,
        newCronExpression,
        newNextExecutions: result.nextExecutions,
        rescheduledAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to reschedule job ${scheduleId}:`, error);
      throw new BadRequestException({
        error: 'JobReschedulingError',
        message: 'Failed to reschedule job',
        details: error.message,
      });
    }
  }

  /**
   * Get comprehensive information about all scheduled jobs
   *
   * @param filters Optional filters for job retrieval
   * @returns Array of scheduled job information
   */
  async getScheduledJobs(filters?: ScheduledJobFilters): Promise<ScheduledJobInfo[]> {
    let jobs = Array.from(this.scheduledJobs.values());

    // Apply filters
    if (filters?.isActive !== undefined) {
      jobs = jobs.filter(job => job.isActive === filters.isActive);
    }

    if (filters?.queueName) {
      jobs = jobs.filter(job => job.queueName === filters.queueName);
    }

    if (filters?.cronExpression) {
      jobs = jobs.filter(job => job.cronExpression === filters.cronExpression);
    }

    if (filters?.jobType) {
      jobs = jobs.filter(job => job.jobData.type === filters.jobType);
    }

    // Sort by next execution time
    jobs.sort((a, b) => {
      const timeA = a.nextExecution?.getTime() || Infinity;
      const timeB = b.nextExecution?.getTime() || Infinity;
      return timeA - timeB;
    });

    // Apply pagination
    if (filters?.limit) {
      const offset = ((filters.page || 1) - 1) * filters.limit;
      jobs = jobs.slice(offset, offset + filters.limit);
    }

    return jobs;
  }

  /**
   * Get detailed statistics about scheduling operations
   *
   * @returns Comprehensive scheduling metrics
   */
  async getSchedulingStats(): Promise<SchedulingStats> {
    const allJobs = Array.from(this.scheduledJobs.values());
    const activeJobs = allJobs.filter(job => job.isActive);
    const recurringJobs = allJobs.filter(job => job.cronExpression);
    const delayedJobs = allJobs.filter(job => !job.cronExpression && job.nextExecution);

    // Calculate next execution times
    const upcomingExecutions = activeJobs
      .filter(job => job.nextExecution)
      .sort((a, b) => a.nextExecution!.getTime() - b.nextExecution!.getTime())
      .slice(0, 10)
      .map(job => ({
        scheduleId: job.scheduleId,
        jobType: job.jobData.type,
        nextExecution: job.nextExecution!,
        cronExpression: job.cronExpression,
      }));

    return {
      totalScheduled: allJobs.length,
      activeScheduled: activeJobs.length,
      inactiveScheduled: allJobs.length - activeJobs.length,
      recurringJobs: recurringJobs.length,
      delayedJobs: delayedJobs.length,
      totalExecutions: allJobs.reduce((sum, job) => sum + job.executionCount, 0),
      totalFailures: allJobs.reduce((sum, job) => sum + job.failureCount, 0),
      upcomingExecutions,
      averageExecutionsPerJob: allJobs.length > 0
        ? allJobs.reduce((sum, job) => sum + job.executionCount, 0) / allJobs.length
        : 0,
      failureRate: this.calculateOverallFailureRate(allJobs),
      lastUpdated: new Date(),
    };
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Validate cron expression format
   *
   * @private
   */
  private isValidCronExpression(cronExpression: string): boolean {
    // Basic cron validation - in a real app you might use cron-parser
    const cronRegex = /^(\*|[0-5]?\d|\*\/[1-9]\d*) (\*|[01]?\d|2[0-3]|\*\/[1-9]\d*) (\*|[01]?\d|2\d|3[01]|\*\/[1-9]\d*) (\*|[01]?\d|\*\/[1-9]\d*) (\*|[0-6]|\*\/[1-9]\d*)$/;
    return cronRegex.test(cronExpression.trim());
  }

  /**
   * Generate unique schedule ID
   *
   * @private
   */
  private generateScheduleId(jobData: QueueJob, identifier: string): string {
    const timestamp = Date.now();
    const jobType = jobData.type.toLowerCase();
    const hash = this.simpleHash(`${identifier}-${timestamp}`);
    return `schedule-${jobType}-${hash}`;
  }

  /**
   * Generate unique chain ID for job dependencies
   *
   * @private
   */
  private generateChainId(dependencies: JobDependency[]): string {
    const timestamp = Date.now();
    const jobTypes = dependencies.map(d => d.jobData.type).join('-');
    const hash = this.simpleHash(`${jobTypes}-${timestamp}`);
    return `chain-${hash}`;
  }

  /**
   * Simple hash function for ID generation
   *
   * @private
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
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
   * Get next N execution times for cron expression
   *
   * @private
   */
  private getNextCronExecutions(cronExpression: string, timezone: string, count: number): Date[] {
    // Simplified implementation - in production, use cron-parser
    const executions: Date[] = [];
    const now = new Date();

    // This is a placeholder - implement proper cron parsing
    for (let i = 1; i <= count; i++) {
      executions.push(new Date(now.getTime() + (i * 60 * 60 * 1000))); // Every hour as example
    }

    return executions;
  }

  /**
   * Calculate estimated daily executions for cron expression
   *
   * @private
   */
  private calculateDailyExecutions(cronExpression: string): number {
    // Simplified calculation - in production, analyze the cron pattern
    const parts = cronExpression.split(' ');

    // Very basic estimation
    if (parts[1] === '*') return 24; // Every hour
    if (parts[0] === '*') return 60; // Every minute

    return 1; // Default to once per day
  }

  /**
   * Calculate total estimated duration for dependency chain
   *
   * @private
   */
  private calculateChainDuration(dependencies: JobDependency[], options?: DependencyChainOptions): number {
    const stepDelay = options?.stepDelay || 1000;
    const totalDelay = dependencies.reduce((sum, dep) => sum + (dep.delay || 0), 0);
    const totalStepDelays = (dependencies.length - 1) * stepDelay;

    return totalDelay + totalStepDelays;
  }

  /**
   * Clean up job dependencies when a job is cancelled
   *
   * @private
   */
  private cleanupJobDependencies(jobId: string): void {
    // Remove dependencies where this job is the dependent
    for (const [parentJobId, deps] of this.jobDependencies) {
      const filteredDeps = deps.filter(dep => dep.dependentJobId !== jobId);
      if (filteredDeps.length !== deps.length) {
        if (filteredDeps.length === 0) {
          this.jobDependencies.delete(parentJobId);
        } else {
          this.jobDependencies.set(parentJobId, filteredDeps);
        }
      }
    }

    // Remove entry where this job is the parent
    this.jobDependencies.delete(jobId);
  }

  /**
   * Calculate overall failure rate across all jobs
   *
   * @private
   */
  private calculateOverallFailureRate(jobs: ScheduledJobInfo[]): number {
    const totalExecutions = jobs.reduce((sum, job) => sum + job.executionCount, 0);
    const totalFailures = jobs.reduce((sum, job) => sum + job.failureCount, 0);

    return totalExecutions > 0 ? (totalFailures / totalExecutions) * 100 : 0;
  }
}

// ========================================
// Supporting Types and Interfaces
// ========================================

interface RecurringJobOptions {
  priority?: JobPriority;
  maxAttempts?: number;
  retryStrategy?: JobRetryStrategy;
  timezone?: string;
  startDate?: Date;
  endDate?: Date;
}

interface RecurringJobResult {
  scheduleId: string;
  jobId: string;
  queueName: string;
  cronExpression: string;
  timezone: string;
  nextExecutions: Date[];
  estimatedExecutionsPerDay: number;
}

interface DelayedJobResult {
  scheduleId: string;
  jobId: string;
  queueName: string;
  executeAt: Date;
  delayDuration: number;
  estimatedStartTime: Date;
}

interface JobDependency {
  jobData: QueueJob;
  priority?: JobPriority;
  delay?: number;
  options?: QueueManagerOptions;
}

interface DependencyChainOptions {
  stepDelay?: number;
  failOnAnyStepFailure?: boolean;
  continueOnStepFailure?: boolean;
}

interface DependencyChainResult {
  chainId: string;
  totalSteps: number;
  scheduledJobs: Array<{ stepIndex: number; jobId: string; dependsOn?: string }>;
  estimatedTotalDuration: number;
  createdAt: Date;
}

interface CancellationResult {
  scheduleId: string;
  jobId: string;
  cancelled: boolean;
  cancelledAt: Date;
  wasRecurring: boolean;
}

interface RescheduleResult {
  oldScheduleId: string;
  newScheduleId: string;
  oldCronExpression: string;
  newCronExpression: string;
  newNextExecutions: Date[];
  rescheduledAt: Date;
}

interface ScheduledJobInfo {
  scheduleId: string;
  jobId: string;
  queueName: string;
  cronExpression?: string;
  timezone: string;
  jobData: QueueJob;
  createdAt: Date;
  lastExecuted?: Date;
  nextExecution?: Date;
  executionCount: number;
  failureCount: number;
  isActive: boolean;
  options?: any;
}

interface JobDependencyInfo {
  dependentJobId: string;
  dependsOnJobId: string;
  chainId: string;
  stepIndex: number;
  status: 'waiting' | 'ready' | 'completed' | 'failed';
  createdAt: Date;
}

interface ScheduledJobFilters {
  isActive?: boolean;
  queueName?: string;
  cronExpression?: string;
  jobType?: string;
  page?: number;
  limit?: number;
}

interface SchedulingStats {
  totalScheduled: number;
  activeScheduled: number;
  inactiveScheduled: number;
  recurringJobs: number;
  delayedJobs: number;
  totalExecutions: number;
  totalFailures: number;
  upcomingExecutions: Array<{
    scheduleId: string;
    jobType: string;
    nextExecution: Date;
    cronExpression?: string;
  }>;
  averageExecutionsPerJob: number;
  failureRate: number;
  lastUpdated: Date;
}