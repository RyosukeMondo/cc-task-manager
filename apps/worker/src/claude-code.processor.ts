import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { validateTaskExecutionRequest } from '@cc-task-manager/schemas';
import { WorkerConfig, TaskExecutionRequest } from '@cc-task-manager/types';
import { WorkerService, TaskExecutionResult } from './worker.service';

export interface ClaudeCodeJobData {
  taskId: string;
  prompt: string;
  sessionName: string;
  workingDirectory: string;
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  };
  timeoutMs?: number;
}

@Injectable()
@Processor('claude-code-queue')
export class ClaudeCodeProcessor extends WorkerHost {
  private readonly logger = new Logger(ClaudeCodeProcessor.name);
  private readonly workerConfig: WorkerConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly workerService: WorkerService,
  ) {
    super();
    this.workerConfig = this.configService.get<WorkerConfig>('worker')!;
    
    // Concurrency is configured in the @Processor decorator
    
    this.logger.log('ClaudeCodeProcessor initialized', {
      queueName: this.workerConfig.queueName,
      concurrency: this.workerConfig.maxConcurrentTasks,
    });
  }

  /**
   * Process Claude Code tasks from the queue
   * @param job BullMQ job containing task data
   * @returns Task execution result
   */
  async process(job: Job<ClaudeCodeJobData>): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const { data } = job;
    
    this.logger.log('Processing Claude Code job', {
      jobId: job.id,
      taskId: data.taskId,
      sessionName: data.sessionName,
      workingDirectory: data.workingDirectory,
      hasOptions: !!data.options,
      timeoutMs: data.timeoutMs,
    });

    try {
      // Validate job data
      const taskRequest: TaskExecutionRequest = validateTaskExecutionRequest({
        id: data.taskId,
        prompt: data.prompt,
        sessionName: data.sessionName,
        workingDirectory: data.workingDirectory,
        options: data.options || {},
        timeoutMs: data.timeoutMs,
      });

      // Set up progress reporting
      let lastProgressUpdate = 0;
      const progressCallback = (progress: string) => {
        const now = Date.now();
        // Rate limit progress updates to avoid overwhelming the queue
        if (now - lastProgressUpdate > 1000) { // Max 1 update per second
          job.updateProgress({
            message: progress,
            timestamp: now,
            taskId: data.taskId,
          });
          lastProgressUpdate = now;
        }
      };

      // Set up state change callback
      const stateChangeCallback = (state: string) => {
        job.updateProgress({
          state,
          timestamp: Date.now(),
          taskId: data.taskId,
        });
      };

      // Execute the task using WorkerService
      const result = await this.workerService.executeTask({
        ...taskRequest,
        onProgressCallback: progressCallback,
        onStateChangeCallback: stateChangeCallback,
      } as any);

      const executionTime = Date.now() - startTime;

      this.logger.log('Claude Code job completed', {
        jobId: job.id,
        taskId: data.taskId,
        success: result.success,
        state: result.state,
        executionTime,
        pid: result.pid,
      });

      // Update final progress
      await job.updateProgress({
        completed: true,
        success: result.success,
        state: result.state,
        executionTime,
        timestamp: Date.now(),
        taskId: data.taskId,
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Claude Code job failed', {
        jobId: job.id,
        taskId: data.taskId,
        error: errorMessage,
        executionTime,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Update progress with error
      await job.updateProgress({
        completed: true,
        success: false,
        error: errorMessage,
        executionTime,
        timestamp: Date.now(),
        taskId: data.taskId,
      });

      // Return failed result instead of throwing to allow BullMQ retry logic
      const failedResult: TaskExecutionResult = {
        taskId: data.taskId,
        success: false,
        state: 'failed' as any,
        error: errorMessage,
        correlationId: job.id?.toString() || 'unknown',
        startTime: new Date(startTime),
        endTime: new Date(),
      };

      return failedResult;
    }
  }

  /**
   * Handle job completion
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<ClaudeCodeJobData>, result: TaskExecutionResult) {
    this.logger.log('Job completed successfully', {
      jobId: job.id,
      taskId: result.taskId,
      state: result.state,
      success: result.success,
      executionTime: result.endTime ? result.endTime.getTime() - result.startTime.getTime() : 0,
    });
  }

  /**
   * Handle job failure
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<ClaudeCodeJobData>, error: Error) {
    this.logger.error('Job failed', {
      jobId: job.id,
      taskId: job.data.taskId,
      error: error.message,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      stack: error.stack,
    });
  }

  /**
   * Handle job stall (stuck for too long)
   */
  @OnWorkerEvent('stalled')
  onStalled(job: Job<ClaudeCodeJobData>) {
    this.logger.warn('Job stalled', {
      jobId: job.id,
      taskId: job.data.taskId,
      attempts: job.attemptsMade,
    });
  }

  /**
   * Handle job progress updates
   */
  @OnWorkerEvent('progress')
  onProgress(job: Job<ClaudeCodeJobData>, progress: any) {
    this.logger.debug('Job progress update', {
      jobId: job.id,
      taskId: job.data.taskId,
      progress: typeof progress === 'object' ? progress.message : progress,
      state: typeof progress === 'object' ? progress.state : undefined,
    });
  }

  /**
   * Handle worker active event (job starts processing)
   */
  @OnWorkerEvent('active')
  onActive(job: Job<ClaudeCodeJobData>) {
    this.logger.debug('Job became active', {
      jobId: job.id,
      taskId: job.data.taskId,
      attempts: job.attemptsMade,
    });
  }

  /**
   * Handle worker error events
   */
  @OnWorkerEvent('error')
  onError(error: Error) {
    this.logger.error('Worker error', {
      error: error.message,
      stack: error.stack,
    });
  }
}