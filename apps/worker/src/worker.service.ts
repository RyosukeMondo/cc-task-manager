import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { ChildProcess } from 'child_process';
import { join } from 'path';
import { validateTaskExecutionRequest, TaskExecutionRequestSchema } from '@cc-task-manager/schemas';
import { WorkerConfig, TaskExecutionRequest, ProcessConfig } from '@cc-task-manager/types';
import { TaskState } from '@cc-task-manager/types';
import { ProcessManagerService } from './process-manager.service';
import { StateMonitorService, ProcessStateTransition, FileSystemActivity } from './state-monitor.service';
import { 
  ClaudeCodeClientService, 
  ParsedResponse, 
  StructuredError, 
  ClaudeCodeOptions 
} from './claude-code-client.service';
import { ContractRegistry } from '../../../src/contracts/ContractRegistry';
import { ContractValidationPipe, ContractValidationErrorDetails } from '../../../src/contracts/ContractValidationPipe';

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
  // SSOT normalized fields from wrapper
  outcome?: string;
  reason?: string;
  tags?: string[];
  normalizedMessage?: string;
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
    private readonly contractRegistry: ContractRegistry,
  ) {
    this.workerConfig = this.configService.get<WorkerConfig>('worker')!;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing WorkerService');
    
    // Register TaskExecutionRequest contract for validation
    await this.registerTaskExecutionContract();
    
    // Set up event listeners for cross-service coordination
    this.setupEventListeners();
    
    this.logger.log('WorkerService initialized successfully', {
      maxConcurrentTasks: this.workerConfig.maxConcurrentTasks,
      processTimeoutMs: this.workerConfig.processTimeoutMs,
    });
  }

  /**
   * Register TaskExecutionRequest contract for validation
   * 
   * @private Called during module initialization to ensure contract availability
   */
  private async registerTaskExecutionContract(): Promise<void> {
    try {
      const registered = await this.contractRegistry.registerContract(
        'TaskExecutionRequest',
        '1.0.0',
        TaskExecutionRequestSchema,
        {
          description: 'Contract for validating task execution requests in the worker service',
          compatibleVersions: ['1.0.0'],
        }
      );

      if (!registered) {
        this.logger.warn('Failed to register TaskExecutionRequest contract');
      } else {
        this.logger.log('TaskExecutionRequest contract registered successfully');
      }
    } catch (error) {
      this.logger.error('Error registering TaskExecutionRequest contract:', error);
    }
  }

  /**
   * Validate task execution request using contract validation
   * 
   * @param request - Task execution request to validate
   * @returns Promise resolving to validated request
   * @throws Error with structured validation details if validation fails
   * @private
   */
  private async validateTaskRequest(request: TaskExecutionRequest): Promise<TaskExecutionRequest> {
    try {
      // Use contract validation pipe for structured validation
      const validationPipe = new ContractValidationPipe(
        this.contractRegistry,
        {
          contractName: 'TaskExecutionRequest',
          version: '1.0.0',
          location: 'body'
        }
      );

      // Validate the request using the contract validation pipe
      const validatedRequest = validationPipe.transform(request, { type: 'body', metatype: Object, data: '' });
      
      // Additional legacy validation for backward compatibility
      const legacyValidatedRequest = validateTaskExecutionRequest(validatedRequest);
      
      return legacyValidatedRequest;
    } catch (error) {
      // Enhanced error handling for contract validation errors
      if (error instanceof BadRequestException) {
        const contractError = error.getResponse() as ContractValidationErrorDetails;
        this.logger.error('Contract validation failed for task request:', {
          contract: contractError.contract,
          location: contractError.location,
          issues: contractError.issues,
          message: contractError.message,
        });
        throw new Error(`Task validation failed: ${contractError.message}`);
      }
      
      // Handle other validation errors
      this.logger.error('Task request validation failed:', error);
      throw error;
    }
  }

  /**
   * Execute a Claude Code task end-to-end with comprehensive orchestration
   *
   * This method coordinates the entire task execution lifecycle:
   * 1. Validates the task request and configuration
   * 2. Spawns a Claude Code process with secure parameters
   * 3. Monitors the process state and file system activity
   * 4. Handles real-time output parsing and progress tracking
   * 5. Manages timeouts and graceful cleanup
   *
   * @param request - Task execution request containing:
   *   - id: Unique task identifier
   *   - prompt: Claude Code prompt to execute
   *   - sessionName: Session name for logging and tracking
   *   - workingDirectory: Working directory for process execution
   *   - options: Claude Code configuration options
   *   - timeoutMs: Maximum execution time in milliseconds
   *
   * @returns Promise resolving to TaskExecutionResult containing:
   *   - success: Boolean indicating execution success
   *   - state: Final task state (COMPLETED, FAILED, CANCELLED)
   *   - output: Process output if successful
   *   - error: Error message if failed
   *   - correlationId: Unique correlation ID for tracking
   *   - timing information and process metadata
   *
   * @throws {Error} When task validation fails or system limits exceeded
   *
   * @example
   * ```typescript
   * const result = await workerService.executeTask({
   *   id: 'task-123',
   *   prompt: 'Create a simple React component',
   *   sessionName: 'web-dev-session',
   *   workingDirectory: '/path/to/project',
   *   options: { model: 'claude-3-sonnet', maxTokens: 4000 },
   *   timeoutMs: 300000
   * });
   *
   * if (result.success) {
   *   console.log('Task completed:', result.output);
   * } else {
   *   console.error('Task failed:', result.error);
   * }
   * ```
   */
  async executeTask(request: TaskExecutionRequest): Promise<TaskExecutionResult> {
    // Validate request using contract validation
    const validatedRequest = await this.validateTaskRequest(request);
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
   * Get comprehensive status of a running or completed task
   *
   * Provides real-time status information by checking both active task
   * tracking and completed task results. For active tasks, includes
   * process state monitoring and execution metadata.
   *
   * @param taskId - Unique task identifier to query
   *
   * @returns TaskExecutionResult with current status, or undefined if task not found.
   *   For active tasks, includes:
   *   - Real-time process state from StateMonitor
   *   - Process ID and correlation information
   *   - Start time and current execution duration
   *
   *   For completed tasks, includes:
   *   - Final execution result and output
   *   - Complete timing information
   *   - Error details if applicable
   *
   * @example
   * ```typescript
   * const status = workerService.getTaskStatus('task-123');
   * if (status) {
   *   console.log(`Task ${status.taskId} is ${status.state}`);
   *   if (status.pid) {
   *     console.log(`Running in process ${status.pid}`);
   *   }
   * } else {
   *   console.log('Task not found');
   * }
   * ```
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
   * Cancel a running task with graceful cleanup
   *
   * Performs comprehensive task cancellation including:
   * 1. Process termination with SIGTERM followed by SIGKILL if needed
   * 2. State transition notification to monitoring systems
   * 3. Resource cleanup (timers, file watchers, memory maps)
   * 4. Result recording for audit trail
   *
   * @param taskId - Unique identifier of task to cancel
   *
   * @returns Promise resolving to boolean indicating cancellation success:
   *   - true: Task was successfully cancelled and cleaned up
   *   - false: Task was not found or cancellation failed
   *
   * @example
   * ```typescript
   * const cancelled = await workerService.cancelTask('task-123');
   * if (cancelled) {
   *   console.log('Task cancelled successfully');
   * } else {
   *   console.log('Task not found or cancellation failed');
   * }
   * ```
   *
   * @note This operation is idempotent - calling multiple times is safe
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
   * Get all currently active task identifiers
   *
   * Returns a snapshot of all tasks currently being executed by
   * the worker service. Useful for monitoring, debugging, and
   * capacity management.
   *
   * @returns Array of task ID strings for all active tasks
   *
   * @example
   * ```typescript
   * const activeTasks = workerService.getActiveTasks();
   * console.log(`Currently executing ${activeTasks.length} tasks:`);
   * activeTasks.forEach(taskId => console.log(`- ${taskId}`));
   * ```
   */
  getActiveTasks(): string[] {
    return Array.from(this.activeTasks.keys());
  }

  /**
   * Get comprehensive health status of worker service
   *
   * Provides detailed health metrics for monitoring and diagnostics:
   * - Active task count vs configured limits
   * - Process management status
   * - Service uptime information
   * - Resource utilization indicators
   *
   * @returns Health status object containing:
   *   - activeTasks: Current number of executing tasks
   *   - maxConcurrentTasks: Configured maximum task limit
   *   - activeProcesses: Array of active process PIDs
   *   - uptime: Service uptime in seconds
   *
   * @example
   * ```typescript
   * const health = workerService.getHealthStatus();
   * console.log(`Health: ${health.activeTasks}/${health.maxConcurrentTasks} tasks`);
   * console.log(`Uptime: ${health.uptime}s`);
   * console.log(`Processes: ${health.activeProcesses.join(', ')}`);
   * ```
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
   * Handle process execution and real-time output monitoring
   *
   * This is the core execution handler that manages:
   * - Real-time JSON response parsing from Claude Code process
   * - Status detection and state transitions
   * - Progress reporting and callback notifications
   * - Error detection and recovery
   * - Process lifecycle management (stdout/stderr/exit events)
   *
   * The method uses event-driven parsing to handle streaming JSON responses,
   * implementing a robust parser that handles partial lines and maintains
   * state consistency throughout execution.
   *
   * @param context - Task execution context containing:
   *   - taskId: Task identifier for correlation
   *   - process: Active ChildProcess instance
   *   - pid: Process ID for monitoring
   *   - callbacks: Progress and state change handlers
   *
   * @param options - Claude Code options for response interpretation
   *
   * @returns Promise resolving to TaskExecutionResult with complete execution details
   *
   * @throws {Error} When process communication fails or parsing errors occur
   *
   * @internal This method is used internally by executeTask()
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
      let lastNormalized: {
        event?: string;
        outcome?: string | null;
        reason?: string | null;
        tags?: string[];
        message?: string;
        status?: string | null;
      } | null = null;

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
          const trimmedLine = line.trim();
          if (!trimmedLine) {
            continue;
          }

          const parsed = this.claudeCodeClient.parseResponse(trimmedLine, correlationId);

          // Emit normalized SSOT event for downstream consumers (queue/UI/metrics)
          const normalized = this.claudeCodeClient.toNormalizedEvent(parsed);
          if (normalized) {
            this.eventEmitter.emit('worker.normalized', {
              ...normalized,
              correlationId,
              taskId,
              pid,
            });

            // Track last terminal normalized event for final result enrichment
            const termOutcomes = new Set(['completed', 'failed', 'timeout', 'shutdown']);
            const termStatuses = new Set(['completed', 'failed', 'timeout', 'shutdown']);
            if (
              (normalized.outcome && termOutcomes.has(normalized.outcome)) ||
              (normalized.status && termStatuses.has(normalized.status))
            ) {
              lastNormalized = {
                event: normalized.event,
                outcome: normalized.outcome ?? null,
                reason: normalized.reason ?? null,
                tags: normalized.tags,
                message: normalized.message,
                status: normalized.status ?? null,
              };
            }
          }
          const status = parsed.status ?? parsed.data?.status ?? null;
          const returnCode =
            parsed.returnCode ??
            parsed.data?.return_code ??
            (typeof (parsed.data as Record<string, unknown> | undefined)?.returnCode === 'number'
              ? ((parsed.data as Record<string, unknown>).returnCode as number)
              : undefined);

          if (!parsed.success) {
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
            continue;
          }

          if (!status) {
            continue;
          }

          switch (status) {
            case 'completed':
              if (this.claudeCodeClient.isSuccessResponse(parsed)) {
                resolveOnce({
                  taskId,
                  success: true,
                  state: TaskState.COMPLETED,
                  output: parsed.data?.message,
                  correlationId,
                  startTime: context.startTime,
                  endTime: new Date(),
                  pid,
                  outcome: lastNormalized?.outcome ?? undefined,
                  reason: lastNormalized?.reason ?? undefined,
                  tags: lastNormalized?.tags ?? undefined,
                  normalizedMessage: lastNormalized?.message ?? parsed.data?.message,
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
                  outcome: lastNormalized?.outcome ?? 'failed',
                  reason: lastNormalized?.reason ?? undefined,
                  tags: lastNormalized?.tags ?? undefined,
                  normalizedMessage: lastNormalized?.message ?? undefined,
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
                outcome: lastNormalized?.outcome ?? 'failed',
                reason: lastNormalized?.reason ?? undefined,
                tags: lastNormalized?.tags ?? undefined,
                normalizedMessage: lastNormalized?.message ?? undefined,
              });
              break;

            case 'running':
            case 'started':
              if (context.onProgressCallback && parsed.data?.message) {
                context.onProgressCallback(parsed.data.message);
              }
              break;

            default:
              if (['ready', 'state'].includes(parsed.event ?? '')) {
                // Ignore lifecycle events that do not affect task resolution
                break;
              }

              if (returnCode !== undefined && returnCode !== 0) {
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
            outcome: lastNormalized?.outcome ?? (success ? 'completed' : 'failed'),
            reason: lastNormalized?.reason ?? undefined,
            tags: lastNormalized?.tags ?? undefined,
            normalizedMessage: lastNormalized?.message ?? undefined,
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
   * Set up comprehensive event listeners for cross-service coordination
   *
   * Establishes event-driven communication between WorkerService and:
   * - StateMonitorService: Process state transitions and file system activity
   * - ClaudeCodeClientService: Response parsing and communication events
   *
   * This enables loose coupling between services while maintaining
   * coordinated behavior for:
   * - Process lifecycle management
   * - Progress reporting
   * - Error propagation
   * - Resource cleanup coordination
   *
   * Event types handled:
   * - process.stateTransition: Process state changes (idle, active, completed, failed)
   * - fileSystem.activity: File system changes in monitored directories
   * - claude.response.received: Successful Claude Code responses
   * - claude.client.error: Communication and parsing errors
   *
   * @private Called during module initialization
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
   * Handle process state transitions from StateMonitor
   *
   * Processes state change notifications from the StateMonitorService
   * and coordinates appropriate responses:
   * - Updates task context with new state
   * - Triggers progress callbacks if configured
   * - Logs state transitions for audit trail
   * - Maintains state consistency across services
   *
   * @param transition - State transition event containing:
   *   - pid: Process ID that changed state
   *   - fromState: Previous state
   *   - toState: New state
   *   - reason: Reason for transition
   *   - timestamp: When transition occurred
   *
   * @private Event handler method
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
   * Set up task execution timeout with automatic cancellation
   *
   * Implements a safety mechanism to prevent runaway tasks by:
   * 1. Creating a timeout timer for the specified duration
   * 2. Automatically triggering task cancellation when timeout expires
   * 3. Logging timeout events for monitoring and debugging
   * 4. Tracking timeout handles for proper cleanup
   *
   * The timeout is cleared automatically when:
   * - Task completes successfully
   * - Task fails before timeout
   * - Task is manually cancelled
   * - Worker service performs cleanup
   *
   * @param taskId - Task identifier for correlation
   * @param timeoutMs - Timeout duration in milliseconds
   * @param correlationId - Correlation ID for log tracking
   *
   * @private Used internally during task initialization
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
   * Generate unique session logs path for file system monitoring
   *
   * Creates a timestamped directory path structure for organizing
   * session logs and enabling file system activity monitoring.
   *
   * Path format: sessions/{sessionName}/{timestamp}
   * Where timestamp is ISO format with special characters replaced
   * for filesystem compatibility.
   *
   * @param sessionName - Human-readable session name
   *
   * @returns Relative path string suitable for file system operations
   *
   * @example
   * ```typescript
   * const path = this.generateSessionLogsPath('web-development');
   * // Returns: 'sessions/web-development/2024-01-15T10-30-45-123Z'
   * ```
   *
   * @private Used internally for session organization
   */
  private generateSessionLogsPath(sessionName: string): string {
    // Generate a path based on session name and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return join('sessions', sessionName, timestamp);
  }

  /**
   * Comprehensive task resource cleanup
   *
   * Performs complete cleanup of task-related resources to prevent
   * memory leaks and ensure proper system state:
   *
   * 1. Timeout Management:
   *    - Clears execution timeout timers
   *    - Cancels pending timeout callbacks
   *
   * 2. Process Monitoring:
   *    - Stops StateMonitor process tracking
   *    - Removes file system watchers
   *    - Cleans up process metadata
   *
   * 3. Memory Management:
   *    - Removes task from active tracking maps
   *    - Clears callback references
   *    - Releases process handles
   *
   * @param taskId - Unique task identifier to clean up
   *
   * @returns Promise that resolves when all cleanup is complete
   *
   * @note This method is idempotent and safe to call multiple times
   * @private Used internally for task lifecycle management
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