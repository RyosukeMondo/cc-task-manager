import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { ChildProcess } from 'child_process';
import { join } from 'path';
import { 
  WorkerConfig, 
  TaskExecutionRequest, 
  TaskState, 
  validateTaskExecutionRequest, 
  ProcessConfig 
} from '../config/worker.config';
import { ProcessManagerService } from './process-manager.service';
import { StateMonitorService, ProcessStateTransition, FileSystemActivity } from './state-monitor.service';
import { 
  ClaudeCodeClientService, 
  ParsedResponse, 
  StructuredError, 
  ClaudeCodeOptions 
} from './claude-code-client.service';

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  state: TaskState;
  output?: string;
  error?: string;
  correlationId: string;
  startTime: Date;
  endTime?: Date;
  pid?: number;
}

export interface TaskExecutionContext {
  taskId: string;
  correlationId: string;
  process?: ChildProcess;
  pid?: number;
  startTime: Date;
  sessionLogsPath?: string;
  onProgressCallback?: (progress: string) => void;
  onStateChangeCallback?: (state: TaskState) => void;
}

@Injectable()
export class WorkerService implements OnModuleInit {
  private readonly logger = new Logger(WorkerService.name);
  private readonly workerConfig: WorkerConfig;
  
  // Active task tracking
  private readonly activeTasks = new Map<string, TaskExecutionContext>();
  private readonly taskResults = new Map<string, TaskExecutionResult>();
  private readonly taskTimeouts = new Map<string, NodeJS.Timeout>();
  
  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly processManager: ProcessManagerService,
    private readonly stateMonitor: StateMonitorService,
    private readonly claudeCodeClient: ClaudeCodeClientService,
  ) {
    this.workerConfig = this.configService.get<WorkerConfig>('worker')!;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing WorkerService');
    
    // Set up event listeners for cross-service coordination
    this.setupEventListeners();
    
    this.logger.log('WorkerService initialized successfully', {
      maxConcurrentTasks: this.workerConfig.maxConcurrentTasks,
      processTimeoutMs: this.workerConfig.processTimeoutMs,
    });
  }

  /**
   * Execute a Claude Code task end-to-end
   * @param request Task execution request with all parameters
   * @returns Promise resolving to task execution result
   */
  async executeTask(request: TaskExecutionRequest): Promise<TaskExecutionResult> {
    // Validate request
    const validatedRequest = validateTaskExecutionRequest(request);
    const correlationId = randomUUID();
    
    this.logger.log('Starting task execution', {
      correlationId,
      taskId: validatedRequest.id,
      sessionName: validatedRequest.sessionName,
      workingDirectory: validatedRequest.workingDirectory,
      hasOptions: !!validatedRequest.options,
    });

    // Check concurrent task limit
    if (this.activeTasks.size >= this.workerConfig.maxConcurrentTasks) {
      const error = `Maximum concurrent tasks reached (${this.workerConfig.maxConcurrentTasks})`;
      this.logger.warn('Task execution rejected', {
        correlationId,
        taskId: validatedRequest.id,
        reason: error,
        activeTasks: this.activeTasks.size,
      });
      
      return {
        taskId: validatedRequest.id,
        success: false,
        state: TaskState.FAILED,
        error,
        correlationId,
        startTime: new Date(),
        endTime: new Date(),
      };
    }

    const context: TaskExecutionContext = {
      taskId: validatedRequest.id,
      correlationId,
      startTime: new Date(),
    };

    this.activeTasks.set(validatedRequest.id, context);

    try {
      // Step 1: Validate Claude Code configuration
      const configValidation = this.claudeCodeClient.validateConfiguration(
        validatedRequest.options,
        correlationId
      );
      
      if (!configValidation.valid) {
        throw new Error(`Configuration validation failed: ${configValidation.errors?.join(', ')}`);
      }

      // Step 2: Spawn Claude Code process
      const processConfig: ProcessConfig = {
        jobId: validatedRequest.id,
        sessionName: validatedRequest.sessionName,
        workingDirectory: validatedRequest.workingDirectory,
        pythonExecutable: this.workerConfig.pythonExecutable,
        wrapperScriptPath: this.workerConfig.wrapperScriptPath,
        unbuffered: true,
      };

      const process = await this.processManager.spawnClaudeProcess(processConfig);
      
      context.process = process;
      context.pid = process.pid;

      // Step 3: Start monitoring the process
      const sessionLogsPath = this.generateSessionLogsPath(validatedRequest.sessionName);
      context.sessionLogsPath = sessionLogsPath;
      
      await this.stateMonitor.startMonitoring(
        validatedRequest.id,
        process.pid!,
        sessionLogsPath
      );

      // Step 4: Set up task timeout
      this.setupTaskTimeout(validatedRequest.id, validatedRequest.timeoutMs, correlationId);

      // Step 5: Send prompt to Claude Code
      await this.claudeCodeClient.sendPrompt(
        process,
        validatedRequest.prompt,
        validatedRequest.options,
        correlationId
      );

      // Step 6: Handle process output and wait for completion
      const result = await this.handleProcessExecution(
        context,
        validatedRequest.options
      );

      this.logger.log('Task execution completed', {
        correlationId,
        taskId: validatedRequest.id,
        success: result.success,
        state: result.state,
        executionTime: result.endTime ? result.endTime.getTime() - result.startTime.getTime() : 0,
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Task execution failed', {
        correlationId,
        taskId: validatedRequest.id,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Clean up resources on error
      await this.cleanupTask(validatedRequest.id);

      const result: TaskExecutionResult = {
        taskId: validatedRequest.id,
        success: false,
        state: TaskState.FAILED,
        error: errorMessage,
        correlationId,
        startTime: context.startTime,
        endTime: new Date(),
        pid: context.pid,
      };

      this.taskResults.set(validatedRequest.id, result);
      return result;
    }
  }

  /**
   * Get status of a running or completed task
   * @param taskId Task identifier
   * @returns Current task status or undefined if not found
   */
  getTaskStatus(taskId: string): TaskExecutionResult | undefined {
    // Check if task is active
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) {
      const processState = activeTask.pid 
        ? this.stateMonitor.getProcessState(activeTask.pid)
        : undefined;

      return {
        taskId,
        success: false,
        state: processState?.state || TaskState.RUNNING,
        correlationId: activeTask.correlationId,
        startTime: activeTask.startTime,
        pid: activeTask.pid,
      };
    }

    // Check completed tasks
    return this.taskResults.get(taskId);
  }

  /**
   * Cancel a running task
   * @param taskId Task identifier
   * @returns Success boolean
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const context = this.activeTasks.get(taskId);
    if (!context) {
      this.logger.warn('Attempted to cancel non-existent task', { taskId });
      return false;
    }

    this.logger.log('Cancelling task', {
      correlationId: context.correlationId,
      taskId,
      pid: context.pid,
    });

    try {
      // Terminate process if exists
      if (context.pid) {
        await this.processManager.terminateProcess(context.pid);
      }

      // Update state monitor
      if (context.pid) {
        await this.stateMonitor.transitionState(
          context.pid,
          TaskState.CANCELLED,
          'Task manually cancelled'
        );
      }

      // Clean up resources
      await this.cleanupTask(taskId);

      // Record result
      const result: TaskExecutionResult = {
        taskId,
        success: false,
        state: TaskState.CANCELLED,
        correlationId: context.correlationId,
        startTime: context.startTime,
        endTime: new Date(),
        pid: context.pid,
      };

      this.taskResults.set(taskId, result);

      this.logger.log('Task cancelled successfully', {
        correlationId: context.correlationId,
        taskId,
        pid: context.pid,
      });

      return true;
    } catch (error) {
      this.logger.error('Error cancelling task', {
        correlationId: context.correlationId,
        taskId,
        pid: context.pid,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get all active task IDs
   * @returns Array of active task identifiers
   */
  getActiveTasks(): string[] {
    return Array.from(this.activeTasks.keys());
  }

  /**
   * Get health status of worker service
   * @returns Worker health information
   */
  getHealthStatus(): {
    activeTasks: number;
    maxConcurrentTasks: number;
    activeProcesses: number[];
    uptime: number;
  } {
    return {
      activeTasks: this.activeTasks.size,
      maxConcurrentTasks: this.workerConfig.maxConcurrentTasks,
      activeProcesses: this.processManager.getActiveProcesses(),
      uptime: process.uptime(),
    };
  }

  /**
   * Handle process execution and output monitoring
   */
  private async handleProcessExecution(
    context: TaskExecutionContext,
    options: ClaudeCodeOptions
  ): Promise<TaskExecutionResult> {
    const { taskId, correlationId, process, pid } = context;
    
    if (!process || !pid) {
      throw new Error('Process not initialized');
    }

    return new Promise((resolve, reject) => {
      let outputBuffer = '';
      let hasResolved = false;

      const resolveOnce = (result: TaskExecutionResult) => {
        if (!hasResolved) {
          hasResolved = true;
          resolve(result);
        }
      };

      const rejectOnce = (error: Error) => {
        if (!hasResolved) {
          hasResolved = true;
          reject(error);
        }
      };

      // Handle stdout data
      process.stdout?.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;

        // Try to parse JSON responses
        const lines = outputBuffer.split('\n');
        outputBuffer = lines.pop() || ''; // Keep incomplete line

        for (const line of lines) {
          if (line.trim()) {
            const parsed = this.claudeCodeClient.parseResponse(line.trim(), correlationId);
            
            if (parsed.success && parsed.data) {
              // Handle different status updates
              switch (parsed.data.status) {
                case 'completed':
                  if (this.claudeCodeClient.isSuccessResponse(parsed)) {
                    resolveOnce({
                      taskId,
                      success: true,
                      state: TaskState.COMPLETED,
                      output: parsed.data.message,
                      correlationId,
                      startTime: context.startTime,
                      endTime: new Date(),
                      pid,
                    });
                  } else {
                    resolveOnce({
                      taskId,
                      success: false,
                      state: TaskState.FAILED,
                      error: this.claudeCodeClient.extractErrorMessage(parsed),
                      correlationId,
                      startTime: context.startTime,
                      endTime: new Date(),
                      pid,
                    });
                  }
                  break;
                  
                case 'failed':
                case 'error':
                case 'timeout':
                  resolveOnce({
                    taskId,
                    success: false,
                    state: TaskState.FAILED,
                    error: this.claudeCodeClient.extractErrorMessage(parsed),
                    correlationId,
                    startTime: context.startTime,
                    endTime: new Date(),
                    pid,
                  });
                  break;
                  
                case 'running':
                case 'started':
                  // Progress updates - call callback if provided
                  if (context.onProgressCallback && parsed.data.message) {
                    context.onProgressCallback(parsed.data.message);
                  }
                  break;
              }
            }
          }
        }
      });

      // Handle stderr
      process.stderr?.on('data', (data) => {
        this.logger.warn('Process stderr output', {
          correlationId,
          taskId,
          pid,
          stderr: data.toString().trim(),
        });
      });

      // Handle process exit
      process.on('exit', (code, signal) => {
        this.logger.log('Process exited', {
          correlationId,
          taskId,
          pid,
          exitCode: code,
          signal,
        });

        if (!hasResolved) {
          const state = code === 0 ? TaskState.COMPLETED : TaskState.FAILED;
          const success = code === 0;
          
          resolveOnce({
            taskId,
            success,
            state,
            error: success ? undefined : `Process exited with code ${code}`,
            correlationId,
            startTime: context.startTime,
            endTime: new Date(),
            pid,
          });
        }
      });

      // Handle process error
      process.on('error', (error) => {
        this.logger.error('Process error', {
          correlationId,
          taskId,
          pid,
          error: error.message,
        });

        rejectOnce(error);
      });
    });
  }

  /**
   * Set up event listeners for cross-service coordination
   */
  private setupEventListeners(): void {
    // Listen for state transitions from StateMonitor
    this.eventEmitter.on('process.stateTransition', (transition: ProcessStateTransition) => {
      this.handleStateTransition(transition);
    });

    // Listen for file system activity
    this.eventEmitter.on('fileSystem.activity', (activity: FileSystemActivity) => {
      this.handleFileSystemActivity(activity);
    });

    // Listen for Claude Code client events
    this.eventEmitter.on('claude.response.received', (event) => {
      this.handleClaudeResponse(event);
    });

    // Listen for Claude Code client errors
    this.eventEmitter.on('claude.client.error', (error) => {
      this.handleClaudeError(error);
    });
  }

  /**
   * Handle state transitions from StateMonitor
   */
  @OnEvent('process.stateTransition')
  private handleStateTransition(transition: ProcessStateTransition): void {
    const context = Array.from(this.activeTasks.values())
      .find(ctx => ctx.pid === transition.pid);
    
    if (context && context.onStateChangeCallback) {
      context.onStateChangeCallback(transition.toState);
    }

    this.logger.debug('Process state transition', {
      correlationId: transition.correlationId,
      taskId: transition.taskId,
      pid: transition.pid,
      fromState: transition.fromState,
      toState: transition.toState,
      reason: transition.reason,
    });
  }

  /**
   * Handle file system activity from StateMonitor
   */
  @OnEvent('fileSystem.activity')
  private handleFileSystemActivity(activity: FileSystemActivity): void {
    this.logger.debug('File system activity', {
      correlationId: activity.correlationId,
      taskId: activity.taskId,
      pid: activity.pid,
      filePath: activity.filePath,
      eventType: activity.eventType,
    });
  }

  /**
   * Handle Claude Code response events
   */
  private handleClaudeResponse(event: any): void {
    this.logger.debug('Claude Code response received', {
      correlationId: event.correlationId,
      status: event.status,
      pid: event.pid,
    });
  }

  /**
   * Handle Claude Code client errors
   */
  private handleClaudeError(error: any): void {
    this.logger.error('Claude Code client error', {
      correlationId: error.correlationId,
      type: error.type,
      message: error.message,
    });
  }

  /**
   * Set up task timeout
   */
  private setupTaskTimeout(taskId: string, timeoutMs: number, correlationId: string): void {
    const timeout = setTimeout(async () => {
      this.logger.warn('Task timeout reached', {
        correlationId,
        taskId,
        timeoutMs,
      });

      await this.cancelTask(taskId);
    }, timeoutMs);

    this.taskTimeouts.set(taskId, timeout);
  }

  /**
   * Generate session logs path for file monitoring
   */
  private generateSessionLogsPath(sessionName: string): string {
    // Generate a path based on session name and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return join('sessions', sessionName, timestamp);
  }

  /**
   * Clean up task resources
   */
  private async cleanupTask(taskId: string): Promise<void> {
    const context = this.activeTasks.get(taskId);
    if (!context) {
      return;
    }

    // Clear timeout
    const timeout = this.taskTimeouts.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.taskTimeouts.delete(taskId);
    }

    // Stop monitoring
    if (context.pid) {
      await this.stateMonitor.stopMonitoring(context.pid);
    }

    // Remove from active tasks
    this.activeTasks.delete(taskId);
  }
}