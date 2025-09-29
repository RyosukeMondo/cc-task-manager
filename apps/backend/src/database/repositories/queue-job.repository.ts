import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';
import {
  IQueueJobRepository,
  QueueJobEntity,
  QueueJobStatus,
  BackoffType,
  QueueStatistics,
  JobPerformanceMetrics,
  RetryAnalysis,
} from '../interfaces/queue-job-repository.interface';

/**
 * Queue Job Repository Implementation
 * Extends BaseRepository with queue-specific operations
 * Following Single Responsibility Principle for focused functionality
 *
 * Implements Repository Pattern with optimized queries and error handling
 * for BullMQ queue job management and monitoring
 */
@Injectable()
export class QueueJobRepository extends BaseRepository<QueueJobEntity> implements IQueueJobRepository {
  constructor(prisma: PrismaService) {
    super(prisma, 'QueueJob');
  }

  /**
   * Get the Prisma QueueJob model delegate
   */
  protected getModel() {
    return this.prisma.queueJob;
  }

  /**
   * Transform Prisma entity to domain entity with optimized includes
   */
  protected transformToDomain(entity: any): QueueJobEntity {
    return {
      ...entity,
      // Ensure proper type casting for numbers
      priority: Number(entity.priority),
      delay: entity.delay ? Number(entity.delay) : null,
      maxAttempts: Number(entity.maxAttempts),
      backoffDelay: Number(entity.backoffDelay),
    } as QueueJobEntity;
  }

  /**
   * Find queue jobs by Claude task ID
   */
  async findByTaskId(taskId: string): Promise<QueueJobEntity[]> {
    try {
      this.logger.debug('Finding queue jobs by task ID', { taskId });

      const jobs = await this.getModel().findMany({
        where: { taskId },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${jobs.length} queue jobs for task ${taskId}`);
      return jobs.map(job => this.transformToDomain(job));
    } catch (error) {
      this.logger.error('Failed to find queue jobs by task ID', {
        error: error.message,
        taskId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find queue jobs by queue name
   */
  async findByQueueName(queueName: string): Promise<QueueJobEntity[]> {
    try {
      this.logger.debug('Finding queue jobs by queue name', { queueName });

      const jobs = await this.getModel().findMany({
        where: { queueName },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });

      this.logger.debug(`Found ${jobs.length} queue jobs for queue ${queueName}`);
      return jobs.map(job => this.transformToDomain(job));
    } catch (error) {
      this.logger.error('Failed to find queue jobs by queue name', {
        error: error.message,
        queueName,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find queue jobs by status
   */
  async findByStatus(status: QueueJobStatus): Promise<QueueJobEntity[]> {
    try {
      this.logger.debug('Finding queue jobs by status', { status });

      const jobs = await this.getModel().findMany({
        where: { status },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${jobs.length} queue jobs with status ${status}`);
      return jobs.map(job => this.transformToDomain(job));
    } catch (error) {
      this.logger.error('Failed to find queue jobs by status', {
        error: error.message,
        status,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find queue jobs by multiple statuses
   */
  async findByStatuses(statuses: QueueJobStatus[]): Promise<QueueJobEntity[]> {
    try {
      this.logger.debug('Finding queue jobs by multiple statuses', { statuses });

      const jobs = await this.getModel().findMany({
        where: {
          status: {
            in: statuses,
          },
        },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${jobs.length} queue jobs with statuses ${statuses.join(', ')}`);
      return jobs.map(job => this.transformToDomain(job));
    } catch (error) {
      this.logger.error('Failed to find queue jobs by statuses', {
        error: error.message,
        statuses,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find queue jobs by BullMQ job ID
   */
  async findByJobId(jobId: string): Promise<QueueJobEntity | null> {
    try {
      this.logger.debug('Finding queue job by job ID', { jobId });

      const job = await this.getModel().findUnique({
        where: { jobId },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
          attempts: {
            orderBy: { attemptNumber: 'desc' },
          },
        },
      });

      if (!job) {
        this.logger.debug('Queue job not found by job ID', { jobId });
        return null;
      }

      this.logger.debug('Found queue job by job ID', { jobId });
      return this.transformToDomain(job);
    } catch (error) {
      this.logger.error('Failed to find queue job by job ID', {
        error: error.message,
        jobId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find queue jobs by priority (higher priority first)
   */
  async findByPriority(minPriority: number = 0): Promise<QueueJobEntity[]> {
    try {
      this.logger.debug('Finding queue jobs by priority', { minPriority });

      const jobs = await this.getModel().findMany({
        where: {
          priority: {
            gte: minPriority,
          },
        },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });

      this.logger.debug(`Found ${jobs.length} queue jobs with priority >= ${minPriority}`);
      return jobs.map(job => this.transformToDomain(job));
    } catch (error) {
      this.logger.error('Failed to find queue jobs by priority', {
        error: error.message,
        minPriority,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find waiting jobs ready for processing
   */
  async findWaitingJobs(queueName?: string): Promise<QueueJobEntity[]> {
    try {
      this.logger.debug('Finding waiting queue jobs', { queueName });

      const whereClause: any = { status: QueueJobStatus.WAITING };
      if (queueName) {
        whereClause.queueName = queueName;
      }

      const jobs = await this.getModel().findMany({
        where: whereClause,
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });

      this.logger.debug(`Found ${jobs.length} waiting queue jobs`);
      return jobs.map(job => this.transformToDomain(job));
    } catch (error) {
      this.logger.error('Failed to find waiting queue jobs', {
        error: error.message,
        queueName,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find delayed jobs ready for processing
   */
  async findDelayedJobsReady(beforeDate: Date = new Date()): Promise<QueueJobEntity[]> {
    try {
      this.logger.debug('Finding delayed jobs ready for processing', { beforeDate });

      const jobs = await this.getModel().findMany({
        where: {
          status: QueueJobStatus.DELAYED,
          createdAt: {
            lte: beforeDate,
          },
        },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });

      this.logger.debug(`Found ${jobs.length} delayed jobs ready for processing`);
      return jobs.map(job => this.transformToDomain(job));
    } catch (error) {
      this.logger.error('Failed to find delayed jobs ready for processing', {
        error: error.message,
        beforeDate,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find active jobs by queue
   */
  async findActiveJobsByQueue(queueName: string): Promise<QueueJobEntity[]> {
    try {
      this.logger.debug('Finding active jobs by queue', { queueName });

      const jobs = await this.getModel().findMany({
        where: {
          queueName,
          status: QueueJobStatus.ACTIVE,
        },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: { processedAt: 'asc' },
      });

      this.logger.debug(`Found ${jobs.length} active jobs in queue ${queueName}`);
      return jobs.map(job => this.transformToDomain(job));
    } catch (error) {
      this.logger.error('Failed to find active jobs by queue', {
        error: error.message,
        queueName,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find failed jobs for retry analysis
   */
  async findFailedJobs(options: { queueName?: string; fromDate?: Date } = {}): Promise<QueueJobEntity[]> {
    try {
      this.logger.debug('Finding failed jobs', options);

      const whereClause: any = { status: QueueJobStatus.FAILED };
      if (options.queueName) {
        whereClause.queueName = options.queueName;
      }
      if (options.fromDate) {
        whereClause.finishedAt = {
          gte: options.fromDate,
        };
      }

      const jobs = await this.getModel().findMany({
        where: whereClause,
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
          attempts: {
            orderBy: { attemptNumber: 'desc' },
          },
        },
        orderBy: { finishedAt: 'desc' },
      });

      this.logger.debug(`Found ${jobs.length} failed jobs`);
      return jobs.map(job => this.transformToDomain(job));
    } catch (error) {
      this.logger.error('Failed to find failed jobs', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find stuck jobs (no progress for extended time)
   */
  async findStuckJobs(thresholdDate: Date): Promise<QueueJobEntity[]> {
    try {
      this.logger.debug('Finding stuck jobs', { thresholdDate });

      const jobs = await this.getModel().findMany({
        where: {
          status: QueueJobStatus.ACTIVE,
          processedAt: {
            lt: thresholdDate,
          },
        },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: { processedAt: 'asc' },
      });

      this.logger.debug(`Found ${jobs.length} stuck jobs`);
      return jobs.map(job => this.transformToDomain(job));
    } catch (error) {
      this.logger.error('Failed to find stuck jobs', {
        error: error.message,
        thresholdDate,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find jobs with attempts included
   */
  async findWithAttempts(options: { taskId?: string; status?: QueueJobStatus } = {}): Promise<QueueJobEntity[]> {
    try {
      this.logger.debug('Finding jobs with attempts', options);

      const whereClause: any = {};
      if (options.taskId) {
        whereClause.taskId = options.taskId;
      }
      if (options.status) {
        whereClause.status = options.status;
      }

      const jobs = await this.getModel().findMany({
        where: whereClause,
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
          attempts: {
            orderBy: { attemptNumber: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${jobs.length} jobs with attempts`);
      return jobs.map(job => this.transformToDomain(job));
    } catch (error) {
      this.logger.error('Failed to find jobs with attempts', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Update job status with timestamp management
   */
  async updateStatus(id: string, status: QueueJobStatus): Promise<QueueJobEntity> {
    try {
      this.logger.debug('Updating job status', { id, status });

      const updateData: any = { status };
      const now = new Date();

      // Manage timestamps based on status transitions
      switch (status) {
        case QueueJobStatus.ACTIVE:
          updateData.processedAt = now;
          break;
        case QueueJobStatus.COMPLETED:
        case QueueJobStatus.FAILED:
          updateData.finishedAt = now;
          break;
      }

      const updated = await this.getModel().update({
        where: { id },
        data: updateData,
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
      });

      this.logger.log('Job status updated successfully', { id, status });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to update job status', {
        error: error.message,
        id,
        status,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Update job result data
   */
  async updateResult(id: string, result: any): Promise<QueueJobEntity> {
    try {
      this.logger.debug('Updating job result', { id });

      const updated = await this.getModel().update({
        where: { id },
        data: { result },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
      });

      this.logger.debug('Job result updated successfully', { id });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to update job result', {
        error: error.message,
        id,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Start job processing (set status to ACTIVE)
   */
  async startProcessing(id: string): Promise<QueueJobEntity> {
    return this.updateStatus(id, QueueJobStatus.ACTIVE);
  }

  /**
   * Complete job processing (set status to COMPLETED with result)
   */
  async completeProcessing(id: string, result?: any): Promise<QueueJobEntity> {
    try {
      this.logger.debug('Completing job processing', { id });

      const updateData: any = {
        status: QueueJobStatus.COMPLETED,
        finishedAt: new Date(),
      };

      if (result !== undefined) {
        updateData.result = result;
      }

      const updated = await this.getModel().update({
        where: { id },
        data: updateData,
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
      });

      this.logger.log('Job processing completed successfully', { id });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to complete job processing', {
        error: error.message,
        id,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Fail job processing (set status to FAILED)
   */
  async failProcessing(id: string, error?: string): Promise<QueueJobEntity> {
    try {
      this.logger.debug('Failing job processing', { id, error });

      const updateData: any = {
        status: QueueJobStatus.FAILED,
        finishedAt: new Date(),
      };

      if (error) {
        updateData.result = { error };
      }

      const updated = await this.getModel().update({
        where: { id },
        data: updateData,
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
      });

      this.logger.log('Job processing failed', { id, error });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to fail job processing', {
        error: error.message,
        id,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Delay job execution
   */
  async delayJob(id: string, delayMs: number): Promise<QueueJobEntity> {
    try {
      this.logger.debug('Delaying job execution', { id, delayMs });

      const updated = await this.getModel().update({
        where: { id },
        data: {
          status: QueueJobStatus.DELAYED,
          delay: delayMs,
        },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
      });

      this.logger.log('Job execution delayed successfully', { id, delayMs });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to delay job execution', {
        error: error.message,
        id,
        delayMs,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Pause job processing
   */
  async pauseJob(id: string): Promise<QueueJobEntity> {
    return this.updateStatus(id, QueueJobStatus.PAUSED);
  }

  /**
   * Resume job processing
   */
  async resumeJob(id: string): Promise<QueueJobEntity> {
    return this.updateStatus(id, QueueJobStatus.WAITING);
  }

  /**
   * Mark job as stuck
   */
  async markAsStuck(id: string): Promise<QueueJobEntity> {
    return this.updateStatus(id, QueueJobStatus.STUCK);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<QueueStatistics> {
    try {
      this.logger.debug('Getting queue statistics', { queueName });

      const [stats, durations] = await Promise.all([
        // Get status counts
        this.getModel().groupBy({
          by: ['status'],
          where: { queueName },
          _count: { status: true },
        }),

        // Get processing time data
        this.getModel().findMany({
          where: {
            queueName,
            processedAt: { not: null },
            finishedAt: { not: null },
          },
          select: {
            processedAt: true,
            finishedAt: true,
          },
        }),
      ]);

      const total = stats.reduce((sum, stat) => sum + stat._count.status, 0);
      const completed = stats.find(s => s.status === QueueJobStatus.COMPLETED)?._count.status || 0;
      const successRate = total > 0 ? (completed / total) * 100 : 0;

      // Calculate processing times
      const processingTimes = durations
        .map(d => d.finishedAt!.getTime() - d.processedAt!.getTime())
        .filter(t => t >= 0);

      const averageProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
        : null;

      // Calculate throughput (jobs per hour)
      const timeSpanHours = 24; // Simplified - assume 24h period
      const throughputPerHour = total / timeSpanHours;

      const result: QueueStatistics = {
        queueName,
        total,
        waiting: stats.find(s => s.status === QueueJobStatus.WAITING)?._count.status || 0,
        active: stats.find(s => s.status === QueueJobStatus.ACTIVE)?._count.status || 0,
        completed: completed,
        failed: stats.find(s => s.status === QueueJobStatus.FAILED)?._count.status || 0,
        delayed: stats.find(s => s.status === QueueJobStatus.DELAYED)?._count.status || 0,
        paused: stats.find(s => s.status === QueueJobStatus.PAUSED)?._count.status || 0,
        stuck: stats.find(s => s.status === QueueJobStatus.STUCK)?._count.status || 0,
        averageProcessingTime,
        successRate,
        throughputPerHour,
      };

      this.logger.debug('Queue statistics calculated', { queueName, stats: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get queue statistics', {
        error: error.message,
        queueName,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get job performance metrics
   */
  async getJobMetrics(options: { queueName?: string; fromDate?: Date; toDate?: Date } = {}): Promise<JobPerformanceMetrics> {
    try {
      this.logger.debug('Getting job performance metrics', options);

      const whereClause: any = {};
      if (options.queueName) {
        whereClause.queueName = options.queueName;
      }
      if (options.fromDate || options.toDate) {
        whereClause.createdAt = {};
        if (options.fromDate) {
          whereClause.createdAt.gte = options.fromDate;
        }
        if (options.toDate) {
          whereClause.createdAt.lte = options.toDate;
        }
      }

      const jobs = await this.getModel().findMany({
        where: whereClause,
        include: {
          attempts: true,
        },
      });

      const totalJobs = jobs.length;
      const successfulJobs = jobs.filter(j => j.status === QueueJobStatus.COMPLETED).length;
      const successRate = totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 0;

      // Calculate processing times
      const processingTimes = jobs
        .filter(j => j.processedAt && j.finishedAt)
        .map(j => j.finishedAt!.getTime() - j.processedAt!.getTime())
        .sort((a, b) => a - b);

      const averageProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
        : null;
      const medianProcessingTime = processingTimes.length > 0
        ? processingTimes[Math.floor(processingTimes.length / 2)]
        : null;
      const shortestProcessingTime = processingTimes.length > 0 ? processingTimes[0] : null;
      const longestProcessingTime = processingTimes.length > 0 ? processingTimes[processingTimes.length - 1] : null;

      // Calculate jobs per hour
      const timeSpanHours = 24; // Simplified
      const jobsPerHour = totalJobs / timeSpanHours;

      // Calculate average attempts
      const averageAttempts = jobs.length > 0
        ? jobs.reduce((sum, j) => sum + j.attempts.length, 0) / jobs.length
        : 0;

      // Failure distribution by queue
      const failureDistribution: { [queueName: string]: number } = {};
      jobs.filter(j => j.status === QueueJobStatus.FAILED).forEach(j => {
        failureDistribution[j.queueName] = (failureDistribution[j.queueName] || 0) + 1;
      });

      // Priority distribution
      const priorityDistribution: { [priority: string]: number } = {};
      jobs.forEach(j => {
        const priority = j.priority.toString();
        priorityDistribution[priority] = (priorityDistribution[priority] || 0) + 1;
      });

      const result: JobPerformanceMetrics = {
        totalJobs,
        successRate,
        averageProcessingTime,
        medianProcessingTime,
        shortestProcessingTime,
        longestProcessingTime,
        jobsPerHour,
        averageAttempts,
        failureDistribution,
        priorityDistribution,
      };

      this.logger.debug('Job performance metrics calculated', { options, metrics: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get job performance metrics', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get retry analysis data
   */
  async getRetryAnalysis(options: { queueName?: string; fromDate?: Date; toDate?: Date } = {}): Promise<RetryAnalysis> {
    try {
      this.logger.debug('Getting retry analysis', options);

      const whereClause: any = {};
      if (options.queueName) {
        whereClause.queueName = options.queueName;
      }
      if (options.fromDate || options.toDate) {
        whereClause.createdAt = {};
        if (options.fromDate) {
          whereClause.createdAt.gte = options.fromDate;
        }
        if (options.toDate) {
          whereClause.createdAt.lte = options.toDate;
        }
      }

      const jobs = await this.getModel().findMany({
        where: whereClause,
        include: {
          attempts: {
            orderBy: { attemptNumber: 'asc' },
          },
        },
      });

      const jobsWithRetries = jobs.filter(j => j.attempts.length > 1);
      const totalRetries = jobsWithRetries.reduce((sum, j) => sum + (j.attempts.length - 1), 0);
      const averageRetries = jobsWithRetries.length > 0 ? totalRetries / jobsWithRetries.length : 0;
      const maxRetries = Math.max(...jobs.map(j => j.attempts.length - 1), 0);

      // Calculate retry success rate
      const eventuallySuccessful = jobsWithRetries.filter(j => j.status === QueueJobStatus.COMPLETED).length;
      const retrySuccessRate = jobsWithRetries.length > 0 ? (eventuallySuccessful / jobsWithRetries.length) * 100 : 0;

      // Analyze retry reasons (simplified - would need more detailed error tracking)
      const retryReasons: { [reason: string]: number } = {};
      jobs.forEach(j => {
        const failedAttempts = j.attempts.filter(a => a.error);
        failedAttempts.forEach(a => {
          const reason = a.error?.split(':')[0] || 'unknown';
          retryReasons[reason] = (retryReasons[reason] || 0) + 1;
        });
      });

      // Analyze backoff effectiveness
      const backoffEffectiveness: { [backoffType: string]: { successRate: number; averageRetries: number } } = {};
      Object.values(BackoffType).forEach(backoffType => {
        const jobsWithBackoff = jobs.filter(j => j.backoffType === backoffType);
        if (jobsWithBackoff.length > 0) {
          const successful = jobsWithBackoff.filter(j => j.status === QueueJobStatus.COMPLETED).length;
          const avgRetries = jobsWithBackoff.reduce((sum, j) => sum + (j.attempts.length - 1), 0) / jobsWithBackoff.length;
          backoffEffectiveness[backoffType] = {
            successRate: (successful / jobsWithBackoff.length) * 100,
            averageRetries: avgRetries,
          };
        }
      });

      // Calculate time to success
      const successfulJobsWithRetries = jobsWithRetries.filter(j => j.status === QueueJobStatus.COMPLETED);
      const timesToSuccess = successfulJobsWithRetries
        .map(j => {
          const firstAttempt = j.attempts[0];
          const lastAttempt = j.attempts[j.attempts.length - 1];
          if (firstAttempt?.startedAt && lastAttempt?.finishedAt) {
            return lastAttempt.finishedAt.getTime() - firstAttempt.startedAt.getTime();
          }
          return null;
        })
        .filter(t => t !== null) as number[];

      const averageTimeToSuccess = timesToSuccess.length > 0
        ? timesToSuccess.reduce((sum, t) => sum + t, 0) / timesToSuccess.length
        : null;
      const medianTimeToSuccess = timesToSuccess.length > 0
        ? timesToSuccess.sort((a, b) => a - b)[Math.floor(timesToSuccess.length / 2)]
        : null;

      const result: RetryAnalysis = {
        totalRetries,
        averageRetries,
        maxRetries,
        retrySuccessRate,
        retryReasons,
        backoffEffectiveness,
        timeToSuccess: {
          averageTime: averageTimeToSuccess,
          medianTime: medianTimeToSuccess,
        },
      };

      this.logger.debug('Retry analysis calculated', { options, analysis: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get retry analysis', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Clean up completed jobs older than specified date
   */
  async cleanupCompletedJobs(beforeDate: Date): Promise<number> {
    try {
      this.logger.debug('Cleaning up completed jobs', { beforeDate });

      const result = await this.getModel().deleteMany({
        where: {
          status: QueueJobStatus.COMPLETED,
          finishedAt: {
            lt: beforeDate,
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} completed jobs`, { beforeDate });
      return result.count;
    } catch (error) {
      this.logger.error('Failed to clean up completed jobs', {
        error: error.message,
        beforeDate,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Clean up failed jobs older than specified date
   */
  async cleanupFailedJobs(beforeDate: Date): Promise<number> {
    try {
      this.logger.debug('Cleaning up failed jobs', { beforeDate });

      const result = await this.getModel().deleteMany({
        where: {
          status: QueueJobStatus.FAILED,
          finishedAt: {
            lt: beforeDate,
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} failed jobs`, { beforeDate });
      return result.count;
    } catch (error) {
      this.logger.error('Failed to clean up failed jobs', {
        error: error.message,
        beforeDate,
      });
      throw this.handlePrismaError(error);
    }
  }
}