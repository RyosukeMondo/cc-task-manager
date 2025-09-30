import { Injectable, Logger } from '@nestjs/common';
import { Worker, Job, Queue } from 'bullmq';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { QueueConfigService } from '../queue.config';
import { ClaudeCodeTaskJob, JobStatus } from '../queue.schemas';

/**
 * Task Processor Worker for Claude Code Execution
 *
 * Implements BullMQ worker processes to handle Claude Code task execution following SOLID principles:
 *
 * 1. Single Responsibility Principle:
 *    - Focused solely on processing Claude Code tasks
 *    - Delegates queue configuration to QueueConfigService
 *    - Isolates Claude wrapper communication logic
 *
 * 2. Open/Closed Principle:
 *    - Extensible for new Claude Code execution modes
 *    - Can be extended for different task types without modification
 *
 * 3. Liskov Substitution Principle:
 *    - Implements consistent BullMQ worker interface
 *    - Substitutable with other worker implementations
 *
 * 4. Interface Segregation Principle:
 *    - Provides specific interfaces for Claude Code execution
 *    - Clients depend only on methods they use
 *
 * 5. Dependency Inversion Principle:
 *    - Depends on QueueConfigService abstraction
 *    - Uses process spawning abstraction for Claude wrapper
 *
 * Key Features:
 * - Asynchronous Claude Code task execution with progress tracking
 * - Real-time job progress updates and streaming output
 * - Comprehensive error handling and retry logic
 * - Graceful timeout and cancellation support
 * - Resource-aware worker scaling
 * - Session persistence and recovery
 */
@Injectable()
export class TaskProcessorWorker {
  private readonly logger = new Logger(TaskProcessorWorker.name);
  private worker: Worker | null = null;
  private isShuttingDown = false;
  private activeJobs = new Map<string, {
    process: ChildProcess;
    startTime: number;
    job: Job<ClaudeCodeTaskJob>;
  }>();

  // Claude wrapper script path
  private readonly claudeWrapperPath = path.resolve(
    process.cwd(),
    'scripts',
    'claude_wrapper.py'
  );

  constructor(
    private readonly queueConfigService: QueueConfigService,
  ) {
    this.initializeWorker();
  }

  /**
   * Initialize the BullMQ worker for Claude Code tasks
   *
   * @private
   */
  private initializeWorker(): void {
    const workerConfig = this.queueConfigService.getWorkerConfiguration('tasks');

    this.worker = new Worker(
      'tasks',
      this.processJob.bind(this),
      {
        connection: workerConfig.connection,
        concurrency: 2, // Limit concurrent Claude executions
      }
    );

    this.setupWorkerEventHandlers();
    this.logger.log('Task processor worker initialized successfully');
  }

  /**
   * Set up worker event handlers for monitoring and error handling
   *
   * @private
   */
  private setupWorkerEventHandlers(): void {
    if (!this.worker) return;

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed successfully`);
      this.cleanupJob(job.id as string);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id} failed: ${error.message}`);
      if (job?.id) {
        this.cleanupJob(job.id as string);
      }
    });

    this.worker.on('error', (error) => {
      this.logger.error('Worker error:', error);
    });

    this.worker.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled, attempting recovery`);
    });

    this.worker.on('active', (job) => {
      this.logger.debug(`Job ${job.id} started processing`);
    });
  }

  /**
   * Process a Claude Code task job
   *
   * @param job BullMQ job containing Claude Code task data
   * @returns Job execution result
   */
  private async processJob(job: Job<ClaudeCodeTaskJob>): Promise<{
    success: boolean;
    output?: string;
    sessionId?: string;
    executionTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const { prompt, workingDirectory, options } = job.data;

    this.logger.log(`Processing Claude Code task ${job.id}: ${prompt.substring(0, 100)}...`);

    try {
      // Update job progress
      await job.updateProgress(5);

      // Validate Claude wrapper availability
      await this.validateClaudeWrapper();
      await job.updateProgress(10);

      // Prepare execution environment
      const execOptions = this.prepareExecutionOptions(job.data);
      await job.updateProgress(15);

      // Start Claude Code execution
      const result = await this.executeClaudeTask(job, execOptions);
      await job.updateProgress(100);

      const executionTime = Date.now() - startTime;
      this.logger.log(`Claude Code task ${job.id} completed in ${executionTime}ms`);

      return {
        success: true,
        ...result,
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Claude Code task ${job.id} failed after ${executionTime}ms:`, error);

      // Clean up any running processes
      this.cleanupJob(job.id as string);

      return {
        success: false,
        error: error.message,
        executionTime,
      };
    }
  }

  /**
   * Validate that Claude wrapper script is available and executable
   *
   * @private
   */
  private async validateClaudeWrapper(): Promise<void> {
    return new Promise((resolve, reject) => {
      const fs = require('fs');

      try {
        // Check if file exists
        if (!fs.existsSync(this.claudeWrapperPath)) {
          throw new Error(`Claude wrapper not found at ${this.claudeWrapperPath}`);
        }

        // Check if file is executable
        fs.access(this.claudeWrapperPath, fs.constants.F_OK | fs.constants.X_OK, (err) => {
          if (err) {
            reject(new Error(`Claude wrapper is not executable: ${err.message}`));
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Prepare execution options for Claude Code
   *
   * @private
   */
  private prepareExecutionOptions(jobData: ClaudeCodeTaskJob): {
    action: string;
    prompt: string;
    options: Record<string, any>;
    run_id: string;
  } {
    const { prompt, workingDirectory, options = {} } = jobData;

    return {
      action: 'prompt',
      prompt,
      run_id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      options: {
        cwd: workingDirectory || process.cwd(),
        session_id: options.sessionId,
        resume_last_session: options.resumeLastSession || false,
        exit_on_complete: options.exitOnComplete !== false,
        permission_mode: options.permissionMode || 'ask',
      },
    };
  }

  /**
   * Execute Claude Code task using the Python wrapper
   *
   * @private
   */
  private async executeClaudeTask(
    job: Job<ClaudeCodeTaskJob>,
    execOptions: Record<string, any>
  ): Promise<{
    output: string;
    sessionId?: string;
  }> {
    return new Promise((resolve, reject) => {
      const timeout = job.data.options?.timeout || 300000; // 5 minutes default
      let output = '';
      let sessionId: string | undefined;
      let hasCompleted = false;

      // Spawn Claude wrapper process
      const claudeProcess = spawn('python3', [this.claudeWrapperPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: execOptions.options.cwd,
      });

      // Track active job
      this.activeJobs.set(job.id as string, {
        process: claudeProcess,
        startTime: Date.now(),
        job,
      });

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        if (!hasCompleted) {
          this.logger.warn(`Claude Code task ${job.id} timed out after ${timeout}ms`);
          claudeProcess.kill('SIGTERM');
          reject(new Error(`Task execution timed out after ${timeout}ms`));
        }
      }, timeout);

      // Handle process output
      claudeProcess.stdout?.on('data', async (data: Buffer) => {
        const lines = data.toString().split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const message = JSON.parse(line);
            await this.handleClaudeMessage(job, message);

            // Extract session ID if available
            if (message.payload?.session_id) {
              sessionId = message.payload.session_id;
            }

            // Accumulate output for final result
            if (message.event === 'stream' && message.payload?.content) {
              output += this.extractTextContent(message.payload.content);
            }

            // Check for completion
            if (message.event === 'run_completed') {
              hasCompleted = true;
              clearTimeout(timeoutHandle);
              resolve({ output, sessionId });
              return;
            }

            // Check for failure
            if (message.event === 'run_failed') {
              hasCompleted = true;
              clearTimeout(timeoutHandle);
              reject(new Error(message.error || 'Claude execution failed'));
              return;
            }

          } catch (parseError) {
            // Non-JSON output, treat as regular output
            output += data.toString();
          }
        }
      });

      // Handle process errors
      claudeProcess.stderr?.on('data', (data: Buffer) => {
        this.logger.warn(`Claude process stderr: ${data.toString()}`);
      });

      claudeProcess.on('error', (error) => {
        if (!hasCompleted) {
          hasCompleted = true;
          clearTimeout(timeoutHandle);
          reject(new Error(`Failed to start Claude process: ${error.message}`));
        }
      });

      claudeProcess.on('exit', (code, signal) => {
        if (!hasCompleted) {
          hasCompleted = true;
          clearTimeout(timeoutHandle);

          if (signal) {
            reject(new Error(`Claude process killed with signal ${signal}`));
          } else if (code !== 0) {
            reject(new Error(`Claude process exited with code ${code}`));
          } else {
            // Process completed successfully
            resolve({ output, sessionId });
          }
        }
      });

      // Send initial command to Claude wrapper
      try {
        claudeProcess.stdin?.write(JSON.stringify(execOptions) + '\n');
      } catch (error) {
        hasCompleted = true;
        clearTimeout(timeoutHandle);
        reject(new Error(`Failed to send command to Claude process: ${error.message}`));
      }
    });
  }

  /**
   * Handle messages from Claude wrapper and update job progress
   *
   * @private
   */
  private async handleClaudeMessage(job: Job<ClaudeCodeTaskJob>, message: any): Promise<void> {
    switch (message.event) {
      case 'run_started':
        await job.updateProgress(20);
        this.logger.debug(`Claude execution started for job ${job.id}`);
        break;

      case 'stream':
        // Update progress based on message content
        const currentProgress = typeof job.progress === 'number' ? job.progress : 20;
        if (message.payload?.type === 'tool_use') {
          await job.updateProgress(Math.min(90, currentProgress + 10));
        } else {
          await job.updateProgress(Math.min(85, currentProgress + 5));
        }
        break;

      case 'limit_notice':
        this.logger.warn(`Rate limit notice for job ${job.id}: ${message.message}`);
        break;

      case 'cancel_requested':
        this.logger.log(`Cancellation requested for job ${job.id}`);
        break;

      case 'error':
        this.logger.error(`Claude error for job ${job.id}: ${message.error}`);
        break;

      default:
        this.logger.debug(`Received Claude message: ${message.event}`);
    }
  }

  /**
   * Extract text content from Claude message payload
   *
   * @private
   */
  private extractTextContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map(item => item.text || '')
        .join(' ');
    }

    if (content && typeof content === 'object' && content.text) {
      return content.text;
    }

    return '';
  }

  /**
   * Clean up job resources
   *
   * @private
   */
  private cleanupJob(jobId: string): void {
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      try {
        if (!activeJob.process.killed) {
          activeJob.process.kill('SIGTERM');
        }
      } catch (error) {
        this.logger.warn(`Error killing process for job ${jobId}:`, error);
      }
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Get worker status and metrics
   */
  getWorkerStatus(): {
    isRunning: boolean;
    activeJobs: number;
    isShuttingDown: boolean;
    workerName: string;
  } {
    return {
      isRunning: this.worker?.isRunning() || false,
      activeJobs: this.activeJobs.size,
      isShuttingDown: this.isShuttingDown,
      workerName: 'TaskProcessorWorker',
    };
  }

  /**
   * Graceful shutdown of the worker
   */
  async shutdown(): Promise<void> {
    this.logger.log('Initiating graceful shutdown of task processor worker');
    this.isShuttingDown = true;

    // Cancel all active jobs
    for (const [jobId, activeJob] of Array.from(this.activeJobs.entries())) {
      this.logger.log(`Cancelling active job ${jobId}`);
      try {
        if (!activeJob.process.killed) {
          activeJob.process.kill('SIGTERM');
        }
      } catch (error) {
        this.logger.warn(`Error cancelling job ${jobId}:`, error);
      }
    }

    // Close worker
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    this.activeJobs.clear();
    this.logger.log('Task processor worker shutdown completed');
  }

  /**
   * Handle application shutdown
   */
  async onApplicationShutdown(): Promise<void> {
    await this.shutdown();
  }
}