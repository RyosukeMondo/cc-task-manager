import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueJobRepository } from '../../database/repositories/queue-job.repository';
import { ExecutionLogRepository } from '../../database/repositories/execution-log.repository';
import {
  QueueJobEntity,
  QueueJobStatus,
  JobAttemptEntity,
  BackoffType,
} from '../../database/interfaces/queue-job-repository.interface';
import {
  IExecutionLogRepository,
  ExecutionLogEntity,
  LogLevel,
  LogSource,
} from '../../database/interfaces/execution-log-repository.interface';

/**
 * Job Persistence Service
 *
 * Provides comprehensive job state persistence and recovery mechanisms
 * following SOLID principles and ensuring data consistency for reliable
 * queue operations.
 *
 * Key Responsibilities:
 * - Job state persistence for system restart recovery
 * - Job history tracking with comprehensive audit logging
 * - Recovery mechanism implementation with consistency checks
 * - Job lifecycle event logging for observability
 *
 * SOLID Principles Implementation:
 * - Single Responsibility: Focused on job persistence and recovery
 * - Open/Closed: Extensible for new persistence strategies
 * - Liskov Substitution: Consistent interface for all persistence operations
 * - Interface Segregation: Focused interfaces for specific operations
 * - Dependency Inversion: Depends on repository abstractions
 */
@Injectable()
export class JobPersistenceService implements OnModuleInit {
  private readonly logger = new Logger(JobPersistenceService.name);

  constructor(
    private readonly queueJobRepository: QueueJobRepository,
    private readonly executionLogRepository: ExecutionLogRepository,
  ) {}

  /**
   * Initialize recovery mechanisms on module startup
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Initializing job persistence service');
      await this.performSystemStartupRecovery();
      this.logger.log('Job persistence service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize job persistence service', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Persist job state for recovery purposes
   *
   * @param jobData - Job data to persist
   * @param options - Persistence options
   * @returns Promise resolving to persisted job entity
   */
  async persistJobState(
    jobData: Partial<QueueJobEntity>,
    options: {
      includeAuditLog?: boolean;
      logLevel?: LogLevel;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<QueueJobEntity> {
    try {
      this.logger.debug('Persisting job state', {
        jobId: jobData.jobId,
        taskId: jobData.taskId,
        status: jobData.status,
      });

      // Validate required job data
      this.validateJobData(jobData);

      // Create or update job record
      const persistedJob = await this.upsertJobRecord(jobData);

      // Create audit log entry if requested
      if (options.includeAuditLog !== false) {
        await this.createAuditLogEntry(persistedJob, {
          action: 'STATE_PERSISTED',
          level: options.logLevel || LogLevel.INFO,
          metadata: {
            ...options.metadata,
            previousState: jobData.status,
            newState: persistedJob.status,
          },
        });
      }

      this.logger.debug('Job state persisted successfully', {
        id: persistedJob.id,
        jobId: persistedJob.jobId,
        status: persistedJob.status,
      });

      return persistedJob;
    } catch (error) {
      this.logger.error('Failed to persist job state', {
        error: error.message,
        jobData,
        options,
      });
      throw error;
    }
  }

  /**
   * Restore job states after system restart
   *
   * @param options - Recovery options
   * @returns Promise resolving to recovery results
   */
  async performSystemStartupRecovery(options: {
    recoverActiveJobs?: boolean;
    recoverStuckJobs?: boolean;
    stuckJobThresholdMinutes?: number;
    maxRecoveryAttempts?: number;
  } = {}): Promise<{
    activeJobsRecovered: number;
    stuckJobsRecovered: number;
    failedRecoveries: number;
    totalProcessed: number;
  }> {
    try {
      this.logger.log('Starting system startup recovery process');

      const {
        recoverActiveJobs = true,
        recoverStuckJobs = true,
        stuckJobThresholdMinutes = 60,
        maxRecoveryAttempts = 3,
      } = options;

      let activeJobsRecovered = 0;
      let stuckJobsRecovered = 0;
      let failedRecoveries = 0;

      // Recover active jobs that were interrupted by system shutdown
      if (recoverActiveJobs) {
        const activeJobs = await this.queueJobRepository.findByStatus(QueueJobStatus.ACTIVE);

        for (const job of activeJobs) {
          try {
            await this.recoverActiveJob(job, maxRecoveryAttempts);
            activeJobsRecovered++;

            await this.createAuditLogEntry(job, {
              action: 'JOB_RECOVERED',
              level: LogLevel.INFO,
              metadata: {
                recoveryType: 'ACTIVE_JOB_RECOVERY',
                previousStatus: QueueJobStatus.ACTIVE,
              },
            });
          } catch (error) {
            this.logger.error('Failed to recover active job', {
              jobId: job.jobId,
              error: error.message,
            });
            failedRecoveries++;
          }
        }
      }

      // Recover stuck jobs based on time threshold
      if (recoverStuckJobs) {
        const stuckThreshold = new Date(Date.now() - stuckJobThresholdMinutes * 60 * 1000);
        const stuckJobs = await this.queueJobRepository.findStuckJobs(stuckThreshold);

        for (const job of stuckJobs) {
          try {
            await this.recoverStuckJob(job, maxRecoveryAttempts);
            stuckJobsRecovered++;

            await this.createAuditLogEntry(job, {
              action: 'STUCK_JOB_RECOVERED',
              level: LogLevel.WARN,
              metadata: {
                recoveryType: 'STUCK_JOB_RECOVERY',
                stuckDurationMinutes: Math.floor((Date.now() - job.processedAt!.getTime()) / (60 * 1000)),
              },
            });
          } catch (error) {
            this.logger.error('Failed to recover stuck job', {
              jobId: job.jobId,
              error: error.message,
            });
            failedRecoveries++;
          }
        }
      }

      const totalProcessed = activeJobsRecovered + stuckJobsRecovered + failedRecoveries;

      const result = {
        activeJobsRecovered,
        stuckJobsRecovered,
        failedRecoveries,
        totalProcessed,
      };

      this.logger.log('System startup recovery completed', result);

      // Create system-level audit log
      await this.createSystemAuditLogEntry({
        action: 'SYSTEM_STARTUP_RECOVERY',
        level: failedRecoveries > 0 ? LogLevel.WARN : LogLevel.INFO,
        metadata: {
          ...result,
          recoveryOptions: options,
        },
      });

      return result;
    } catch (error) {
      this.logger.error('System startup recovery failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Track job history with comprehensive audit logging
   *
   * @param job - Job entity to track
   * @param event - Event details
   * @returns Promise resolving to audit log entry
   */
  async trackJobHistory(
    job: QueueJobEntity,
    event: {
      action: string;
      level?: LogLevel;
      details?: string;
      metadata?: Record<string, any>;
      timestamp?: Date;
    }
  ): Promise<ExecutionLogEntity> {
    try {
      this.logger.debug('Tracking job history', {
        jobId: job.jobId,
        action: event.action,
        level: event.level,
      });

      const auditLogEntry = await this.createAuditLogEntry(job, event);

      this.logger.debug('Job history tracked successfully', {
        logId: auditLogEntry.id,
        jobId: job.jobId,
        action: event.action,
      });

      return auditLogEntry;
    } catch (error) {
      this.logger.error('Failed to track job history', {
        error: error.message,
        jobId: job.jobId,
        event,
      });
      throw error;
    }
  }

  /**
   * Get job history for a specific job
   *
   * @param jobId - BullMQ job ID or internal job ID
   * @param options - Query options
   * @returns Promise resolving to job history entries
   */
  async getJobHistory(
    jobId: string,
    options: {
      includeMetadata?: boolean;
      limit?: number;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ): Promise<ExecutionLogEntity[]> {
    try {
      this.logger.debug('Retrieving job history', { jobId, options });

      // First find the job to get the internal ID
      const job = await this.queueJobRepository.findByJobId(jobId);
      if (!job) {
        throw new Error(`Job not found with ID: ${jobId}`);
      }

      const history = await this.executionLogRepository.findByTimeRange(
        options.fromDate || new Date(0),
        options.toDate || new Date()
      );

      this.logger.debug(`Retrieved ${history.length} history entries for job ${jobId}`);
      return history;
    } catch (error) {
      this.logger.error('Failed to retrieve job history', {
        error: error.message,
        jobId,
        options,
      });
      throw error;
    }
  }

  /**
   * Clean up old job history entries
   *
   * @param options - Cleanup options
   * @returns Promise resolving to cleanup results
   */
  async cleanupJobHistory(options: {
    olderThanDays?: number;
    keepSuccessfulJobs?: boolean;
    keepFailedJobs?: boolean;
    dryRun?: boolean;
  } = {}): Promise<{
    completedJobsDeleted: number;
    failedJobsDeleted: number;
    historyEntriesDeleted: number;
    totalDeleted: number;
  }> {
    try {
      const {
        olderThanDays = 30,
        keepSuccessfulJobs = false,
        keepFailedJobs = true,
        dryRun = false,
      } = options;

      this.logger.log('Starting job history cleanup', options);

      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      let completedJobsDeleted = 0;
      let failedJobsDeleted = 0;
      let historyEntriesDeleted = 0;

      // Clean up completed jobs if not keeping them
      if (!keepSuccessfulJobs) {
        if (!dryRun) {
          completedJobsDeleted = await this.queueJobRepository.cleanupCompletedJobs(cutoffDate);
        } else {
          const completedJobs = await this.queueJobRepository.findByStatuses([QueueJobStatus.COMPLETED]);
          completedJobsDeleted = completedJobs.filter(j => j.finishedAt && j.finishedAt < cutoffDate).length;
        }
      }

      // Clean up failed jobs if not keeping them
      if (!keepFailedJobs) {
        if (!dryRun) {
          failedJobsDeleted = await this.queueJobRepository.cleanupFailedJobs(cutoffDate);
        } else {
          const failedJobs = await this.queueJobRepository.findByStatuses([QueueJobStatus.FAILED]);
          failedJobsDeleted = failedJobs.filter(j => j.finishedAt && j.finishedAt < cutoffDate).length;
        }
      }

      // Clean up execution log entries
      if (!dryRun) {
        historyEntriesDeleted = await this.executionLogRepository.cleanupOldLogs(cutoffDate);
      } else {
        // For dry run, estimate based on date filter
        const oldLogs = await this.executionLogRepository.findByTimeRange(
          new Date(0),
          cutoffDate
        );
        historyEntriesDeleted = oldLogs.length;
      }

      const result = {
        completedJobsDeleted,
        failedJobsDeleted,
        historyEntriesDeleted,
        totalDeleted: completedJobsDeleted + failedJobsDeleted + historyEntriesDeleted,
      };

      this.logger.log(`Job history cleanup ${dryRun ? '(dry run) ' : ''}completed`, result);

      // Create audit log for cleanup operation
      await this.createSystemAuditLogEntry({
        action: dryRun ? 'HISTORY_CLEANUP_DRY_RUN' : 'HISTORY_CLEANUP',
        level: LogLevel.INFO,
        metadata: {
          ...result,
          options,
          cutoffDate: cutoffDate.toISOString(),
        },
      });

      return result;
    } catch (error) {
      this.logger.error('Job history cleanup failed', {
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Validate job data before persistence
   *
   * @private
   */
  private validateJobData(jobData: Partial<QueueJobEntity>): void {
    if (!jobData.taskId) {
      throw new Error('Task ID is required for job persistence');
    }
    if (!jobData.queueName) {
      throw new Error('Queue name is required for job persistence');
    }
    if (!jobData.jobId) {
      throw new Error('Job ID is required for job persistence');
    }
    if (!jobData.status) {
      throw new Error('Job status is required for job persistence');
    }
  }

  /**
   * Create or update job record
   *
   * @private
   */
  private async upsertJobRecord(jobData: Partial<QueueJobEntity>): Promise<QueueJobEntity> {
    // Check if job already exists
    const existingJob = await this.queueJobRepository.findByJobId(jobData.jobId!);

    if (existingJob) {
      // Update existing job
      return await this.queueJobRepository.update(existingJob.id, {
        ...jobData,
        // Preserve creation timestamp
        createdAt: existingJob.createdAt,
      } as Partial<QueueJobEntity>);
    } else {
      // Create new job
      return await this.queueJobRepository.create({
        ...jobData,
        // Set default values
        priority: jobData.priority || 0,
        maxAttempts: jobData.maxAttempts || 3,
        backoffType: jobData.backoffType || BackoffType.EXPONENTIAL,
        backoffDelay: jobData.backoffDelay || 2000,
        createdAt: new Date(),
      } as QueueJobEntity);
    }
  }

  /**
   * Recover an active job after system restart
   *
   * @private
   */
  private async recoverActiveJob(job: QueueJobEntity, maxAttempts: number): Promise<void> {
    this.logger.debug('Recovering active job', { jobId: job.jobId });

    // Reset job to waiting status for re-processing
    await this.queueJobRepository.updateStatus(job.id, QueueJobStatus.WAITING);

    // Clear processing timestamps
    await this.queueJobRepository.update(job.id, {
      processedAt: null,
    } as Partial<QueueJobEntity>);
  }

  /**
   * Recover a stuck job
   *
   * @private
   */
  private async recoverStuckJob(job: QueueJobEntity, maxAttempts: number): Promise<void> {
    this.logger.debug('Recovering stuck job', { jobId: job.jobId });

    // Mark as stuck first
    await this.queueJobRepository.markAsStuck(job.id);

    // Then reset to waiting if under retry limit
    // This logic could be enhanced based on specific requirements
    if ((job.attempts?.length || 0) < maxAttempts) {
      await this.queueJobRepository.updateStatus(job.id, QueueJobStatus.WAITING);
    }
  }

  /**
   * Create audit log entry for job events
   *
   * @private
   */
  private async createAuditLogEntry(
    job: QueueJobEntity,
    event: {
      action: string;
      level?: LogLevel;
      details?: string;
      metadata?: Record<string, any>;
      timestamp?: Date;
    }
  ): Promise<ExecutionLogEntity> {
    return await this.executionLogRepository.create({
      executionId: job.id,
      source: LogSource.QUEUE,
      level: event.level || LogLevel.INFO,
      message: `Job ${event.action}: ${job.jobId}`,
      details: {
        ...(typeof event.details === 'object' && event.details !== null ? event.details : {}),
        ...event.metadata,
        taskId: job.taskId,
        queueName: job.queueName,
        status: job.status,
        priority: job.priority,
      },
      component: 'job-persistence',
      operation: event.action,
      correlationId: job.jobId,
      timestamp: event.timestamp || new Date(),
    } as Omit<ExecutionLogEntity, 'id'>);
  }

  /**
   * Create system-level audit log entry
   *
   * @private
   */
  private async createSystemAuditLogEntry(event: {
    action: string;
    level?: LogLevel;
    details?: string;
    metadata?: Record<string, any>;
    timestamp?: Date;
  }): Promise<ExecutionLogEntity> {
    return await this.executionLogRepository.create({
      executionId: 'system',
      source: LogSource.SYSTEM,
      level: event.level || LogLevel.INFO,
      message: `System ${event.action}`,
      details: {
        ...event.metadata,
        service: 'JobPersistenceService',
        originalDetails: event.details,
      },
      component: 'job-persistence-service',
      operation: event.action,
      correlationId: null,
      timestamp: event.timestamp || new Date(),
    } as Omit<ExecutionLogEntity, 'id'>);
  }
}