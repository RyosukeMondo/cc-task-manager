import { Injectable, Logger } from '@nestjs/common';
import { ClaudeWrapperService, ClaudeWrapperOptions, ClaudeResponse } from './claude-wrapper.service';

/**
 * Enum for Claude Code command types
 * Following contract-driven design for command validation
 */
export enum ClaudeCommandType {
  PROMPT = 'prompt',
  CANCEL = 'cancel',
  STATUS = 'status',
  SHUTDOWN = 'shutdown',
}

/**
 * Interface for command execution request
 * Ensures type safety for command parameters
 */
export interface ClaudeCommandRequest {
  type: ClaudeCommandType;
  prompt?: string;
  runId?: string;
  options?: ClaudeWrapperOptions;
}

/**
 * Interface for command execution response
 * Provides structured response transformation
 */
export interface ClaudeCommandResponse<T = any> {
  success: boolean;
  runId?: string;
  data?: T;
  error?: string;
  events?: ClaudeResponse[];
}

/**
 * Interface for command execution context
 * Tracks command execution state and metadata
 */
export interface CommandExecutionContext {
  runId: string;
  commandType: ClaudeCommandType;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  events: ClaudeResponse[];
  responseBuffer: any[];
}

/**
 * Interface for streaming command callback
 * Enables real-time response handling
 */
export interface CommandStreamCallback {
  onEvent?: (event: ClaudeResponse) => void;
  onComplete?: (context: CommandExecutionContext) => void;
  onError?: (error: Error, context: CommandExecutionContext) => void;
}

/**
 * Claude Code command execution and response handling service
 *
 * Implements typed interface for Claude Code command execution following SOLID principles:
 *
 * - Single Responsibility: Manages command execution and response handling
 * - Open/Closed: Extensible for new command types and response transformers
 * - Liskov Substitution: Can be substituted with other command execution implementations
 * - Interface Segregation: Focused interface for command operations
 * - Dependency Inversion: Depends on ClaudeWrapperService abstraction
 *
 * Applies KISS principle for simple command execution workflow
 * Ensures DRY/SSOT compliance with centralized command validation and transformation
 * Implements fail-fast validation and comprehensive error handling
 */
@Injectable()
export class ClaudeCommandService {
  private readonly logger = new Logger(ClaudeCommandService.name);
  private readonly activeCommands = new Map<string, CommandExecutionContext>();
  private readonly responseTimeout = 30000; // 30 seconds default timeout

  constructor(private readonly wrapperService: ClaudeWrapperService) {
    this.setupWrapperEventHandlers();
  }

  /**
   * Execute Claude Code command with typed response handling
   * Implements fail-fast validation and structured response transformation
   */
  async executeCommand<T = any>(
    request: ClaudeCommandRequest,
    callback?: CommandStreamCallback
  ): Promise<ClaudeCommandResponse<T>> {
    // Fail-fast validation
    this.validateCommandRequest(request);

    const runId = request.runId || this.generateRunId();
    const context: CommandExecutionContext = {
      runId,
      commandType: request.type,
      startTime: new Date(),
      status: 'pending',
      events: [],
      responseBuffer: [],
    };

    this.activeCommands.set(runId, context);
    this.logger.debug(`Executing command: ${request.type} with runId: ${runId}`);

    try {
      context.status = 'running';

      // Execute command based on type
      switch (request.type) {
        case ClaudeCommandType.PROMPT:
          return await this.executePromptCommand(request, context, callback);
        case ClaudeCommandType.CANCEL:
          return await this.executeCancelCommand(request, context);
        case ClaudeCommandType.STATUS:
          return await this.executeStatusCommand(request, context);
        case ClaudeCommandType.SHUTDOWN:
          return await this.executeShutdownCommand(request, context);
        default:
          throw new Error(`Unsupported command type: ${request.type}`);
      }
    } catch (error) {
      context.status = 'failed';
      context.endTime = new Date();

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Command execution failed: ${errorMessage}`, error);

      callback?.onError?.(error as Error, context);

      return {
        success: false,
        runId,
        error: errorMessage,
        events: context.events,
      };
    } finally {
      // Cleanup context after completion
      setTimeout(() => this.activeCommands.delete(runId), 60000); // Keep for 1 minute for debugging
    }
  }

  /**
   * Execute prompt command with streaming response handling
   * Implements comprehensive response parsing and transformation
   */
  private async executePromptCommand(
    request: ClaudeCommandRequest,
    context: CommandExecutionContext,
    callback?: CommandStreamCallback
  ): Promise<ClaudeCommandResponse> {
    if (!request.prompt) {
      throw new Error('Prompt is required for prompt command');
    }

    // Setup response collection
    const responsePromise = this.createResponsePromise(context, callback);

    // Execute prompt through wrapper service
    const wrapperRunId = await this.wrapperService.executePrompt(
      request.prompt,
      request.options || {},
      context.runId
    );

    // Wait for execution to complete
    const response = await responsePromise;

    context.status = 'completed';
    context.endTime = new Date();

    callback?.onComplete?.(context);

    return {
      success: true,
      runId: wrapperRunId,
      data: response,
      events: context.events,
    };
  }

  /**
   * Execute cancel command
   * Implements graceful command cancellation
   */
  private async executeCancelCommand(
    request: ClaudeCommandRequest,
    context: CommandExecutionContext
  ): Promise<ClaudeCommandResponse> {
    if (!request.runId) {
      throw new Error('Run ID is required for cancel command');
    }

    await this.wrapperService.cancelExecution(request.runId);

    // Update context for cancelled command
    const cancelledContext = this.activeCommands.get(request.runId);
    if (cancelledContext) {
      cancelledContext.status = 'cancelled';
      cancelledContext.endTime = new Date();
    }

    context.status = 'completed';
    context.endTime = new Date();

    return {
      success: true,
      runId: request.runId,
      data: { cancelled: true },
      events: context.events,
    };
  }

  /**
   * Execute status command
   * Implements status information retrieval
   */
  private async executeStatusCommand(
    request: ClaudeCommandRequest,
    context: CommandExecutionContext
  ): Promise<ClaudeCommandResponse> {
    await this.wrapperService.getStatus();

    // Collect status response (will be handled by event listeners)
    const statusResponse = await this.waitForStatusResponse(context);

    context.status = 'completed';
    context.endTime = new Date();

    return {
      success: true,
      data: statusResponse,
      events: context.events,
    };
  }

  /**
   * Execute shutdown command
   * Implements graceful system shutdown
   */
  private async executeShutdownCommand(
    request: ClaudeCommandRequest,
    context: CommandExecutionContext
  ): Promise<ClaudeCommandResponse> {
    await this.wrapperService.shutdown();

    context.status = 'completed';
    context.endTime = new Date();

    return {
      success: true,
      data: { shutdown: true },
      events: context.events,
    };
  }

  /**
   * Create promise for response collection
   * Implements timeout-based response handling
   */
  private createResponsePromise(
    context: CommandExecutionContext,
    callback?: CommandStreamCallback
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command execution timeout after ${this.responseTimeout}ms`));
      }, this.responseTimeout);

      // Setup completion handler
      const originalOnComplete = callback?.onComplete;
      const wrappedCallback: CommandStreamCallback = {
        ...callback,
        onComplete: (ctx) => {
          clearTimeout(timeout);
          originalOnComplete?.(ctx);
          resolve(this.transformResponseData(ctx.responseBuffer));
        },
        onError: (error, ctx) => {
          clearTimeout(timeout);
          callback?.onError?.(error, ctx);
          reject(error);
        },
      };

      // Store wrapped callback for event handling
      context.responseBuffer.push(wrappedCallback);
    });
  }

  /**
   * Wait for status response
   * Implements specific handling for status commands
   */
  private async waitForStatusResponse(context: CommandExecutionContext): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Status response timeout'));
      }, 5000); // Shorter timeout for status

      const statusHandler = (event: ClaudeResponse) => {
        if (event.event === 'status') {
          clearTimeout(timeout);
          resolve(event.payload || event);
        }
      };

      context.responseBuffer.push(statusHandler);
    });
  }

  /**
   * Setup wrapper service event handlers
   * Implements event routing and response collection
   */
  private setupWrapperEventHandlers(): void {
    this.wrapperService.on('response', (response: ClaudeResponse) => {
      this.handleWrapperResponse(response);
    });

    this.wrapperService.on('stream', (response: ClaudeResponse) => {
      this.handleStreamEvent(response);
    });

    this.wrapperService.on('run_completed', (response: ClaudeResponse) => {
      this.handleRunCompleted(response);
    });

    this.wrapperService.on('run_cancelled', (response: ClaudeResponse) => {
      this.handleRunCancelled(response);
    });

    this.wrapperService.on('error', (error: Error) => {
      this.handleWrapperError(error);
    });
  }

  /**
   * Handle wrapper service responses
   * Implements response routing to active commands
   */
  private handleWrapperResponse(response: ClaudeResponse): void {
    const runId = response.run_id;
    if (!runId) {
      this.logger.debug('Received response without run_id:', response.event);
      return;
    }

    const context = this.activeCommands.get(runId);
    if (!context) {
      this.logger.debug(`No active command context for run_id: ${runId}`);
      return;
    }

    context.events.push(response);

    // Route to callback handlers
    this.routeEventToCallbacks(response, context);
  }

  /**
   * Handle stream events
   * Implements real-time stream processing
   */
  private handleStreamEvent(response: ClaudeResponse): void {
    this.handleWrapperResponse(response);
  }

  /**
   * Handle run completion
   * Implements completion state management
   */
  private handleRunCompleted(response: ClaudeResponse): void {
    const runId = response.run_id;
    if (!runId) return;

    const context = this.activeCommands.get(runId);
    if (!context) return;

    context.status = 'completed';
    context.endTime = new Date();
    context.events.push(response);

    // Trigger completion callbacks
    this.triggerCompletionCallbacks(context);
  }

  /**
   * Handle run cancellation
   * Implements cancellation state management
   */
  private handleRunCancelled(response: ClaudeResponse): void {
    const runId = response.run_id;
    if (!runId) return;

    const context = this.activeCommands.get(runId);
    if (!context) return;

    context.status = 'cancelled';
    context.endTime = new Date();
    context.events.push(response);

    // Trigger completion callbacks
    this.triggerCompletionCallbacks(context);
  }

  /**
   * Handle wrapper service errors
   * Implements error propagation to active commands
   */
  private handleWrapperError(error: Error): void {
    // Propagate error to all active commands
    for (const [runId, context] of this.activeCommands.entries()) {
      if (context.status === 'running') {
        context.status = 'failed';
        context.endTime = new Date();

        this.triggerErrorCallbacks(error, context);
      }
    }
  }

  /**
   * Route events to callback handlers
   * Implements callback dispatch for active commands
   */
  private routeEventToCallbacks(response: ClaudeResponse, context: CommandExecutionContext): void {
    for (const callback of context.responseBuffer) {
      if (typeof callback === 'function') {
        callback(response);
      } else if (callback && typeof callback === 'object' && 'onEvent' in callback) {
        (callback as CommandStreamCallback).onEvent?.(response);
      }
    }
  }

  /**
   * Trigger completion callbacks
   * Implements completion notification for command contexts
   */
  private triggerCompletionCallbacks(context: CommandExecutionContext): void {
    for (const callback of context.responseBuffer) {
      if (callback && typeof callback === 'object' && 'onComplete' in callback) {
        (callback as CommandStreamCallback).onComplete?.(context);
      }
    }
  }

  /**
   * Trigger error callbacks
   * Implements error notification for command contexts
   */
  private triggerErrorCallbacks(error: Error, context: CommandExecutionContext): void {
    for (const callback of context.responseBuffer) {
      if (callback && typeof callback === 'object' && 'onError' in callback) {
        (callback as CommandStreamCallback).onError?.(error, context);
      }
    }
  }

  /**
   * Transform response data from collected events
   * Implements response data aggregation and transformation
   */
  private transformResponseData(responseBuffer: any[]): any {
    // Extract meaningful data from collected events
    const events = responseBuffer.filter(item =>
      item && typeof item === 'object' && 'event' in item
    );

    if (events.length === 0) {
      return null;
    }

    // Return the last meaningful event payload
    const lastEvent = events[events.length - 1];
    return lastEvent.payload || lastEvent;
  }

  /**
   * Validate command request
   * Implements contract-driven validation for command requests
   */
  private validateCommandRequest(request: ClaudeCommandRequest): void {
    if (!request) {
      throw new Error('Command request is required');
    }

    if (!request.type) {
      throw new Error('Command type is required');
    }

    if (!Object.values(ClaudeCommandType).includes(request.type)) {
      throw new Error(`Invalid command type: ${request.type}. Must be one of: ${Object.values(ClaudeCommandType).join(', ')}`);
    }

    // Type-specific validation
    switch (request.type) {
      case ClaudeCommandType.PROMPT:
        if (!request.prompt || request.prompt.trim().length === 0) {
          throw new Error('Prompt is required and cannot be empty for prompt command');
        }
        break;

      case ClaudeCommandType.CANCEL:
        if (!request.runId) {
          throw new Error('Run ID is required for cancel command');
        }
        break;
    }

    // Validate options if provided
    if (request.options) {
      this.validateCommandOptions(request.options);
    }
  }

  /**
   * Validate command options
   * Implements options validation for type safety
   */
  private validateCommandOptions(options: ClaudeWrapperOptions): void {
    // Permission mode validation
    if (options.permission_mode && !['ask', 'bypassPermissions'].includes(options.permission_mode)) {
      throw new Error(`Invalid permission_mode: ${options.permission_mode}. Must be 'ask' or 'bypassPermissions'`);
    }

    // Working directory validation
    if (options.cwd && typeof options.cwd !== 'string') {
      throw new Error('cwd must be a string');
    }

    if (options.working_directory && typeof options.working_directory !== 'string') {
      throw new Error('working_directory must be a string');
    }

    // Boolean option validation
    if (options.exit_on_complete !== undefined && typeof options.exit_on_complete !== 'boolean') {
      throw new Error('exit_on_complete must be a boolean');
    }

    if (options.resume_last_session !== undefined && typeof options.resume_last_session !== 'boolean') {
      throw new Error('resume_last_session must be a boolean');
    }
  }

  /**
   * Generate unique run ID
   * Implements run ID generation for command tracking
   */
  private generateRunId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active command context
   * Provides access to command execution state
   */
  getCommandContext(runId: string): CommandExecutionContext | undefined {
    return this.activeCommands.get(runId);
  }

  /**
   * Get all active commands
   * Provides overview of currently executing commands
   */
  getActiveCommands(): ReadonlyMap<string, CommandExecutionContext> {
    return new Map(this.activeCommands);
  }

  /**
   * Check if wrapper service is ready for commands
   * Provides wrapper service readiness check
   */
  isReady(): boolean {
    return this.wrapperService.isWrapperReady();
  }

  /**
   * Initialize command service
   * Ensures wrapper service is ready for command execution
   */
  async initialize(): Promise<void> {
    if (!this.wrapperService.isWrapperReady()) {
      await this.wrapperService.initialize();
    }
    this.logger.log('Claude Command Service initialized successfully');
  }
}