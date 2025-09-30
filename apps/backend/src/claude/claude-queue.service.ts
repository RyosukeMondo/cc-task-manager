import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  ClaudeSessionService,
  ClaudeSessionConfig,
  ClaudeSessionMetadata
} from './claude-session.service';
import {
  ClaudeCommandService,
  ClaudeCommandType,
  ClaudeCommandRequest,
  ClaudeCommandResponse,
  CommandStreamCallback
} from './claude-command.service';
import {
  ClaudeWrapperOptions,
  ClaudeResponse
} from './claude-wrapper.service';

/**
 * Claude Code task job data schema
 * Provides type-safe validation for Claude Code queue jobs
 */
export const ClaudeTaskJobSchema = z.object({
  type: z.literal('CLAUDE_TASK'),
  taskId: z.string().uuid(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  command: z.object({
    type: z.nativeEnum(ClaudeCommandType),
    prompt: z.string().optional(),
    runId: z.string().optional(),
    options: z.record(z.unknown()).optional(),
  }),
  sessionConfig: z.object({
    maxIdleTime: z.number().optional(),
    maxSessionTime: z.number().optional(),
    maxConcurrentCommands: z.number().optional(),
    autoCleanup: z.boolean().optional(),
    workingDirectory: z.string().optional(),
    permissionMode: z.enum(['ask', 'bypassPermissions']).optional(),
    resumeLastSession: z.boolean().optional(),
  }).optional(),
  priority: z.number().int().min(0).max(1000).default(500),
  metadata: z.object({
    correlationId: z.string().uuid().optional(),
    timestamp: z.date().default(() => new Date()),
    retryCount: z.number().int().min(0).default(0),
    tags: z.array(z.string()).optional(),
    parentTaskId: z.string().optional(),
  }),
});

/**
 * Claude Code task execution result schema
 * Provides structured response for completed tasks
 */
export const ClaudeTaskResultSchema = z.object({
  taskId: z.string(),
  sessionId: z.string(),
  runId: z.string().optional(),
  success: z.boolean(),
  startTime: z.date(),
  endTime: z.date(),
  executionTime: z.number(), // milliseconds
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  events: z.array(z.record(z.unknown())),
  resourceUsage: z.object({
    memoryUsage: z.number().optional(),
    cpuTime: z.number().optional(),
    diskSpace: z.number().optional(),
  }).optional(),
});

/**
 * Queue status and metrics schema
 * Provides monitoring data for Claude Code queue operations
 */
export const ClaudeQueueMetricsSchema = z.object({
  queueName: z.string(),
  activeTasks: z.number(),
  waitingTasks: z.number(),
  completedTasks: z.number(),
  failedTasks: z.number(),
  activeSessions: z.number(),
  idleSessions: z.number(),
  totalSessions: z.number(),
  averageExecutionTime: z.number(),
  successRate: z.number(),
  timestamp: z.date(),
});

// Type exports
export type ClaudeTaskJob = z.infer<typeof ClaudeTaskJobSchema>;
export type ClaudeTaskResult = z.infer<typeof ClaudeTaskResultSchema>;
export type ClaudeQueueMetrics = z.infer<typeof ClaudeQueueMetricsSchema>;

/**
 * Interface for task execution options
 * Provides configuration for queue job processing
 */
export interface TaskExecutionOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  timeout?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

/**
 * Interface for task progress updates
 * Enables real-time progress tracking
 */
export interface TaskProgressUpdate {
  taskId: string;
  sessionId: string;
  progress: number; // 0-100
  status: 'queued' | 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  estimatedRemainingTime?: number;
  intermediateResults?: any;
}

/**
 * Claude Code task execution queue integration service
 *
 * Integrates Claude Code execution with BullMQ job processing following SOLID principles:
 *
 * - Single Responsibility: Manages Claude Code task queuing and execution
 * - Open/Closed: Extensible for new task types and execution strategies
 * - Liskov Substitution: Can be substituted with other queue execution implementations
 * - Interface Segregation: Focused interface for Claude Code queue operations
 * - Dependency Inversion: Depends on session and command service abstractions
 *
 * Applies KISS principle for simple queue integration workflow
 * Ensures DRY/SSOT compliance with centralized task validation and tracking
 * Implements fail-fast validation and comprehensive error handling
 * Provides seamless integration with existing BullMQ infrastructure
 */
@Injectable()
export class ClaudeQueueService extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(ClaudeQueueService.name);
  private readonly CLAUDE_QUEUE_NAME = 'claude-tasks';

  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private queueEvents: QueueEvents | null = null;
  private readonly redisConfig: any;

  // Task tracking
  private readonly activeTasks = new Map<string, ClaudeTaskJob>();
  private readonly taskSessions = new Map<string, string>(); // taskId -> sessionId
  private readonly executionMetrics = new Map<string, {
    startTime: Date;
    endTime?: Date;
    events: ClaudeResponse[];
  }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionService: ClaudeSessionService,
    private readonly commandService: ClaudeCommandService
  ) {
    super();

    this.redisConfig = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
    };
  }

  /**
   * Initialize Claude Code queue and worker
   * Implements queue setup with proper configuration
   */
  async initialize(): Promise<void> {
    try {
      this.logger.debug('Initializing Claude Code queue service');

      // Initialize queue
      this.queue = new Queue(this.CLAUDE_QUEUE_NAME, {
        connection: this.redisConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 50, // Keep last 50 completed jobs
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          },
        },
      });

      // Initialize worker
      this.worker = new Worker(
        this.CLAUDE_QUEUE_NAME,
        async (job: Job<ClaudeTaskJob>) => {
          return await this.processClaudeTask(job);
        },
        {
          connection: this.redisConfig,
          concurrency: this.configService.get('CLAUDE_QUEUE_CONCURRENCY', 3),
        }
      );

      // Initialize queue events for monitoring
      this.queueEvents = new QueueEvents(this.CLAUDE_QUEUE_NAME, {
        connection: this.redisConfig,
      });

      this.setupEventHandlers();

      this.logger.log('Claude Code queue service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to initialize Claude queue service: ${errorMessage}`, error);
      throw new Error(`Claude queue initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Queue Claude Code task for execution
   * Implements task validation and queue submission
   */
  async queueTask(
    taskData: Omit<ClaudeTaskJob, 'type'>,
    options?: TaskExecutionOptions
  ): Promise<string> {
    // Fail-fast validation
    if (!this.queue) {
      throw new Error('Claude queue service not initialized. Call initialize() first.');
    }

    const taskJob: ClaudeTaskJob = {
      type: 'CLAUDE_TASK',
      ...taskData,
    };

    // Validate task data
    const validationResult = ClaudeTaskJobSchema.safeParse(taskJob);
    if (!validationResult.success) {
      this.logger.error(`Invalid Claude task data: ${validationResult.error.message}`);
      throw new Error(`Invalid Claude task data: ${validationResult.error.message}`);
    }

    const validatedTask = validationResult.data;

    try {
      this.logger.debug(`Queueing Claude task: ${validatedTask.taskId}`);

      // Prepare job options
      const jobOptions = {
        priority: options?.priority || validatedTask.priority,
        delay: options?.delay,
        attempts: options?.attempts || 3,
        removeOnComplete: options?.removeOnComplete ?? true,
        removeOnFail: options?.removeOnFail ?? false,
        jobId: validatedTask.taskId, // Use taskId as job ID for consistency
      };

      // Add job to queue
      const job = await this.queue.add(
        'CLAUDE_TASK',
        validatedTask,
        jobOptions
      );

      // Track active task
      this.activeTasks.set(validatedTask.taskId, validatedTask);

      this.logger.log(`Claude task queued successfully: ${validatedTask.taskId} (job: ${job.id})`);
      this.emit('task_queued', { taskId: validatedTask.taskId, jobId: job.id });

      return job.id as string;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to queue Claude task ${validatedTask.taskId}: ${errorMessage}`, error);
      throw new Error(`Task queueing failed: ${errorMessage}`);
    }
  }

  /**
   * Process Claude Code task from queue
   * Implements comprehensive task execution with session management
   */
  private async processClaudeTask(job: Job<ClaudeTaskJob>): Promise<ClaudeTaskResult> {
    const task = job.data;
    const startTime = new Date();

    this.logger.debug(`Processing Claude task: ${task.taskId}`);

    // Initialize execution metrics
    this.executionMetrics.set(task.taskId, {
      startTime,
      events: [],
    });

    try {
      await job.updateProgress(10);
      this.emitProgressUpdate(task.taskId, '', 10, 'initializing');

      // Create or reuse session
      const sessionId = await this.getOrCreateSession(task);
      this.taskSessions.set(task.taskId, sessionId);

      await job.updateProgress(25);
      this.emitProgressUpdate(task.taskId, sessionId, 25, 'running', 'Session ready');

      // Validate command service is ready
      if (!this.commandService.isReady()) {
        throw new Error('Claude command service is not ready');
      }

      await job.updateProgress(30);

      // Execute command with streaming callback
      const streamCallback: CommandStreamCallback = {
        onEvent: (event) => {
          const metrics = this.executionMetrics.get(task.taskId);
          if (metrics) {
            metrics.events.push(event);
          }
          this.emit('task_event', { taskId: task.taskId, sessionId, event });
        },
        onComplete: (context) => {
          this.logger.debug(`Command completed for task ${task.taskId}: ${context.runId}`);
        },
        onError: (error, context) => {
          this.logger.error(`Command error for task ${task.taskId}: ${error.message}`);
        },
      };

      await job.updateProgress(40);

      // Execute the command
      const commandResponse = await this.sessionService.executeCommandInSession(
        sessionId,
        task.command.type,
        task.command.prompt,
        task.command.options as ClaudeWrapperOptions
      );

      await job.updateProgress(80);
      this.emitProgressUpdate(task.taskId, sessionId, 80, 'running', 'Command executed');

      // Wait for command completion (if needed)
      // This could be enhanced with more sophisticated completion detection
      await new Promise(resolve => setTimeout(resolve, 1000));

      await job.updateProgress(90);

      const endTime = new Date();
      const executionTime = endTime.getTime() - startTime.getTime();

      // Update execution metrics
      const metrics = this.executionMetrics.get(task.taskId);
      if (metrics) {
        metrics.endTime = endTime;
      }

      // Prepare task result
      const result: ClaudeTaskResult = {
        taskId: task.taskId,
        sessionId,
        runId: commandResponse,
        success: true,
        startTime,
        endTime,
        executionTime,
        result: { commandResponse },
        events: metrics?.events || [],
        resourceUsage: {
          // TODO: Implement actual resource usage tracking
          memoryUsage: process.memoryUsage().heapUsed,
          cpuTime: executionTime,
        },
      };

      await job.updateProgress(100);
      this.emitProgressUpdate(task.taskId, sessionId, 100, 'completed');

      this.logger.log(`Claude task completed successfully: ${task.taskId} (${executionTime}ms)`);
      this.emit('task_completed', { taskId: task.taskId, result });

      return result;

    } catch (error) {
      const endTime = new Date();
      const executionTime = endTime.getTime() - startTime.getTime();
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update execution metrics
      const metrics = this.executionMetrics.get(task.taskId);
      if (metrics) {
        metrics.endTime = endTime;
      }

      const sessionId = this.taskSessions.get(task.taskId) || '';

      // Prepare failure result
      const result: ClaudeTaskResult = {
        taskId: task.taskId,
        sessionId,
        success: false,
        startTime,
        endTime,
        executionTime,
        error: errorMessage,
        events: metrics?.events || [],
        resourceUsage: {
          memoryUsage: process.memoryUsage().heapUsed,
          cpuTime: executionTime,
        },
      };

      this.emitProgressUpdate(task.taskId, sessionId, 0, 'failed', errorMessage);

      this.logger.error(`Claude task failed: ${task.taskId} - ${errorMessage}`, error);
      this.emit('task_failed', { taskId: task.taskId, error: errorMessage, result });

      // Re-throw to trigger BullMQ retry mechanism
      throw error;

    } finally {
      // Cleanup task tracking
      this.activeTasks.delete(task.taskId);
      this.taskSessions.delete(task.taskId);

      // Keep metrics for a short time for debugging
      setTimeout(() => {
        this.executionMetrics.delete(task.taskId);
      }, 60000); // 1 minute
    }
  }

  /**
   * Get or create Claude session for task execution
   * Implements session reuse and lifecycle management
   */
  private async getOrCreateSession(task: ClaudeTaskJob): Promise<string> {
    // Use existing session if specified and active
    if (task.sessionId) {
      const existingSession = this.sessionService.getSession(task.sessionId);
      if (existingSession && existingSession.status === 'active') {
        this.logger.debug(`Reusing existing session: ${task.sessionId}`);
        return task.sessionId;
      }
    }

    // Create new session
    const sessionConfig: ClaudeSessionConfig = {
      maxIdleTime: task.sessionConfig?.maxIdleTime || 30 * 60 * 1000, // 30 minutes
      maxSessionTime: task.sessionConfig?.maxSessionTime || 24 * 60 * 60 * 1000, // 24 hours
      maxConcurrentCommands: task.sessionConfig?.maxConcurrentCommands || 5,
      autoCleanup: task.sessionConfig?.autoCleanup ?? true,
      workingDirectory: task.sessionConfig?.workingDirectory,
      permissionMode: task.sessionConfig?.permissionMode || 'bypassPermissions',
      resumeLastSession: task.sessionConfig?.resumeLastSession || false,
    };

    const sessionId = await this.sessionService.createSession(sessionConfig, task.userId);
    this.logger.debug(`Created new session for task ${task.taskId}: ${sessionId}`);

    return sessionId;
  }

  /**
   * Emit progress update event
   * Implements real-time progress tracking
   */
  private emitProgressUpdate(
    taskId: string,
    sessionId: string,
    progress: number,
    status: TaskProgressUpdate['status'],
    currentStep?: string
  ): void {
    const update: TaskProgressUpdate = {
      taskId,
      sessionId,
      progress,
      status,
      currentStep,
    };

    this.emit('progress_update', update);
  }

  /**
   * Setup event handlers for queue monitoring
   * Implements comprehensive event handling for queue operations
   */
  private setupEventHandlers(): void {
    if (!this.queueEvents || !this.worker) {
      return;
    }

    // Queue event handlers
    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.logger.debug(`Claude task job ${jobId} completed`);
      this.emit('job_completed', { jobId, result: returnvalue });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.error(`Claude task job ${jobId} failed: ${failedReason}`);
      this.emit('job_failed', { jobId, error: failedReason });
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      this.logger.debug(`Claude task job ${jobId} progress: ${JSON.stringify(data)}`);
      this.emit('job_progress', { jobId, progress: data });
    });

    // Worker event handlers
    this.worker.on('completed', (job) => {
      this.logger.debug(`Worker completed job ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Worker failed job ${job?.id}: ${err.message}`);
    });

    this.worker.on('error', (err) => {
      this.logger.error('Worker error:', err);
      this.emit('worker_error', err);
    });

    this.worker.on('stalled', (jobId) => {
      this.logger.warn(`Worker job ${jobId} stalled`);
      this.emit('job_stalled', { jobId });
    });
  }

  /**
   * Get queue metrics for monitoring
   * Implements comprehensive metrics collection
   */
  async getQueueMetrics(): Promise<ClaudeQueueMetrics> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      // Get session statistics
      const sessionStats = this.sessionService.getSessionStatistics();
      const successRate = completed > 0 ? ((completed / (completed + failed)) * 100) : 100;

      const metrics: ClaudeQueueMetrics = {
        queueName: this.CLAUDE_QUEUE_NAME,
        activeTasks: active,
        waitingTasks: waiting,
        completedTasks: completed,
        failedTasks: failed,
        activeSessions: sessionStats.activeSessions,
        idleSessions: sessionStats.idleSessions,
        totalSessions: sessionStats.totalSessions,
        averageExecutionTime: sessionStats.averageSessionDuration * 1000, // Convert to ms
        successRate,
        timestamp: new Date(),
      };

      return metrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get queue metrics: ${errorMessage}`, error);
      throw new Error(`Queue metrics retrieval failed: ${errorMessage}`);
    }
  }

  /**
   * Cancel a queued or active task
   * Implements graceful task cancellation
   */
  async cancelTask(taskId: string): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    try {
      this.logger.debug(`Cancelling Claude task: ${taskId}`);

      // Find and cancel the job
      const job = await this.queue.getJob(taskId);
      if (job) {
        await job.remove();
        this.logger.log(`Claude task job cancelled: ${taskId}`);
      }

      // Cancel active session command if exists
      const sessionId = this.taskSessions.get(taskId);
      if (sessionId) {
        const activeCommands = this.commandService.getActiveCommands();
        for (const [runId, context] of Array.from(activeCommands)) {
          if (context.status === 'running') {
            await this.commandService.executeCommand({
              type: ClaudeCommandType.CANCEL,
              runId,
            });
          }
        }
      }

      // Clean up tracking
      this.activeTasks.delete(taskId);
      this.taskSessions.delete(taskId);
      this.executionMetrics.delete(taskId);

      this.emit('task_cancelled', { taskId });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to cancel task ${taskId}: ${errorMessage}`, error);
      throw new Error(`Task cancellation failed: ${errorMessage}`);
    }
  }

  /**
   * Get active task information
   * Provides visibility into currently processing tasks
   */
  getActiveTasks(): ReadonlyMap<string, ClaudeTaskJob> {
    return new Map(this.activeTasks);
  }

  /**
   * Get task execution metrics
   * Provides performance data for completed and active tasks
   */
  getTaskMetrics(taskId: string): { startTime: Date; endTime?: Date; events: ClaudeResponse[] } | undefined {
    return this.executionMetrics.get(taskId);
  }

  /**
   * Pause the Claude Code queue
   * Implements queue management for maintenance
   */
  async pauseQueue(): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    await this.queue.pause();
    this.logger.log('Claude queue paused');
    this.emit('queue_paused');
  }

  /**
   * Resume the Claude Code queue
   * Implements queue management for resuming operations
   */
  async resumeQueue(): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    await this.queue.resume();
    this.logger.log('Claude queue resumed');
    this.emit('queue_resumed');
  }

  /**
   * Clean completed/failed jobs from queue
   * Implements queue maintenance operations
   */
  async cleanQueue(
    grace: number = 0,
    limit: number = 100,
    status: 'completed' | 'failed' = 'completed'
  ): Promise<string[]> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    const cleaned = await this.queue.clean(grace, limit, status);
    this.logger.log(`Cleaned ${cleaned.length} ${status} jobs from Claude queue`);
    return cleaned;
  }

  /**
   * Get queue health status
   * Implements health monitoring for queue operations
   */
  async getQueueHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      queueConnected: boolean;
      workerActive: boolean;
      activeTasks: number;
      failureRate: number;
      avgExecutionTime: number;
    };
  }> {
    try {
      const metrics = await this.getQueueMetrics();
      const failureRate = metrics.completedTasks > 0
        ? (metrics.failedTasks / (metrics.completedTasks + metrics.failedTasks)) * 100
        : 0;

      const isHealthy = failureRate < 10 && this.queue !== null && this.worker !== null;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: {
          queueConnected: this.queue !== null,
          workerActive: this.worker !== null,
          activeTasks: metrics.activeTasks,
          failureRate,
          avgExecutionTime: metrics.averageExecutionTime,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          queueConnected: false,
          workerActive: false,
          activeTasks: 0,
          failureRate: 100,
          avgExecutionTime: 0,
        },
      };
    }
  }

  /**
   * Module lifecycle cleanup
   * Implements NestJS module cleanup pattern
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.debug('ClaudeQueueService module destroy called');

    try {
      // Close worker
      if (this.worker) {
        await this.worker.close();
        this.logger.debug('Claude queue worker closed');
      }

      // Close queue events
      if (this.queueEvents) {
        await this.queueEvents.close();
        this.logger.debug('Claude queue events closed');
      }

      // Close queue
      if (this.queue) {
        await this.queue.close();
        this.logger.debug('Claude queue closed');
      }

      // Clear tracking data
      this.activeTasks.clear();
      this.taskSessions.clear();
      this.executionMetrics.clear();

      this.logger.log('ClaudeQueueService cleanup completed');
    } catch (error) {
      this.logger.error('Error during ClaudeQueueService cleanup:', error);
    }
  }
}