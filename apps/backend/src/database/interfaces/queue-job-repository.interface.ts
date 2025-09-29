import { IBaseRepository } from './base-repository.interface';

/**
 * Queue Job Repository Interface
 * Extends base repository with queue-specific operations
 * Following Interface Segregation Principle for focused interfaces
 */
export interface IQueueJobRepository extends IBaseRepository<QueueJobEntity> {
  /**
   * Find queue jobs by Claude task ID
   */
  findByTaskId(taskId: string): Promise<QueueJobEntity[]>;

  /**
   * Find queue jobs by queue name
   */
  findByQueueName(queueName: string): Promise<QueueJobEntity[]>;

  /**
   * Find queue jobs by status
   */
  findByStatus(status: QueueJobStatus): Promise<QueueJobEntity[]>;

  /**
   * Find queue jobs by multiple statuses
   */
  findByStatuses(statuses: QueueJobStatus[]): Promise<QueueJobEntity[]>;

  /**
   * Find queue jobs by BullMQ job ID
   */
  findByJobId(jobId: string): Promise<QueueJobEntity | null>;

  /**
   * Find queue jobs by priority (higher priority first)
   */
  findByPriority(minPriority?: number): Promise<QueueJobEntity[]>;

  /**
   * Find waiting jobs ready for processing
   */
  findWaitingJobs(queueName?: string): Promise<QueueJobEntity[]>;

  /**
   * Find delayed jobs ready for processing
   */
  findDelayedJobsReady(beforeDate?: Date): Promise<QueueJobEntity[]>;

  /**
   * Find active jobs by queue
   */
  findActiveJobsByQueue(queueName: string): Promise<QueueJobEntity[]>;

  /**
   * Find failed jobs for retry analysis
   */
  findFailedJobs(options?: { queueName?: string; fromDate?: Date }): Promise<QueueJobEntity[]>;

  /**
   * Find stuck jobs (no progress for extended time)
   */
  findStuckJobs(thresholdDate: Date): Promise<QueueJobEntity[]>;

  /**
   * Find jobs with attempts included
   */
  findWithAttempts(options?: { taskId?: string; status?: QueueJobStatus }): Promise<QueueJobEntity[]>;

  /**
   * Update job status with timestamp management
   */
  updateStatus(id: string, status: QueueJobStatus): Promise<QueueJobEntity>;

  /**
   * Update job result data
   */
  updateResult(id: string, result: any): Promise<QueueJobEntity>;

  /**
   * Start job processing (set status to ACTIVE)
   */
  startProcessing(id: string): Promise<QueueJobEntity>;

  /**
   * Complete job processing (set status to COMPLETED with result)
   */
  completeProcessing(id: string, result?: any): Promise<QueueJobEntity>;

  /**
   * Fail job processing (set status to FAILED)
   */
  failProcessing(id: string, error?: string): Promise<QueueJobEntity>;

  /**
   * Delay job execution
   */
  delayJob(id: string, delayMs: number): Promise<QueueJobEntity>;

  /**
   * Pause job processing
   */
  pauseJob(id: string): Promise<QueueJobEntity>;

  /**
   * Resume job processing
   */
  resumeJob(id: string): Promise<QueueJobEntity>;

  /**
   * Mark job as stuck
   */
  markAsStuck(id: string): Promise<QueueJobEntity>;

  /**
   * Get queue statistics
   */
  getQueueStats(queueName: string): Promise<QueueStatistics>;

  /**
   * Get job performance metrics
   */
  getJobMetrics(options?: { queueName?: string; fromDate?: Date; toDate?: Date }): Promise<JobPerformanceMetrics>;

  /**
   * Get retry analysis data
   */
  getRetryAnalysis(options?: { queueName?: string; fromDate?: Date; toDate?: Date }): Promise<RetryAnalysis>;

  /**
   * Clean up completed jobs older than specified date
   */
  cleanupCompletedJobs(beforeDate: Date): Promise<number>;

  /**
   * Clean up failed jobs older than specified date
   */
  cleanupFailedJobs(beforeDate: Date): Promise<number>;
}

/**
 * Queue Job Entity interface aligned with Prisma model
 */
export interface QueueJobEntity {
  id: string;
  taskId: string;
  queueName: string;
  jobId: string; // BullMQ job ID
  status: QueueJobStatus;
  priority: number;
  delay: number | null;
  maxAttempts: number;
  backoffType: BackoffType;
  backoffDelay: number;
  jobData: any; // JSON job data
  jobOptions: any | null; // JSON job options
  result: any | null; // JSON result
  createdAt: Date;
  processedAt: Date | null;
  finishedAt: Date | null;

  // Optional relationships for optimized queries
  task?: {
    id: string;
    title: string;
    status: string;
  };
  attempts?: JobAttemptEntity[];
}

/**
 * Job Attempt Entity for tracking retry attempts
 */
export interface JobAttemptEntity {
  id: string;
  queueJobId: string;
  attemptNumber: number;
  status: AttemptStatus;
  error: string | null;
  result: any | null;
  startedAt: Date;
  finishedAt: Date | null;
}

/**
 * Queue Job Status enumeration matching Prisma schema
 */
export enum QueueJobStatus {
  WAITING = 'WAITING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DELAYED = 'DELAYED',
  PAUSED = 'PAUSED',
  STUCK = 'STUCK',
}

/**
 * Attempt Status enumeration
 */
export enum AttemptStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Backoff Type enumeration
 */
export enum BackoffType {
  FIXED = 'FIXED',
  EXPONENTIAL = 'EXPONENTIAL',
  LINEAR = 'LINEAR',
}

/**
 * Queue Statistics interface
 */
export interface QueueStatistics {
  queueName: string;
  total: number;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  stuck: number;
  averageProcessingTime: number | null; // milliseconds
  successRate: number; // percentage (0-100)
  throughputPerHour: number;
}

/**
 * Job Performance Metrics interface
 */
export interface JobPerformanceMetrics {
  totalJobs: number;
  successRate: number;
  averageProcessingTime: number | null; // milliseconds
  medianProcessingTime: number | null; // milliseconds
  shortestProcessingTime: number | null; // milliseconds
  longestProcessingTime: number | null; // milliseconds
  jobsPerHour: number;
  averageAttempts: number;
  failureDistribution: {
    [queueName: string]: number;
  };
  priorityDistribution: {
    [priority: string]: number;
  };
}

/**
 * Retry Analysis interface
 */
export interface RetryAnalysis {
  totalRetries: number;
  averageRetries: number;
  maxRetries: number;
  retrySuccessRate: number; // percentage of retries that eventually succeed
  retryReasons: {
    [reason: string]: number;
  };
  backoffEffectiveness: {
    [backoffType: string]: {
      successRate: number;
      averageRetries: number;
    };
  };
  timeToSuccess: {
    averageTime: number | null; // milliseconds from first attempt to success
    medianTime: number | null; // milliseconds
  };
}