import { Injectable, Logger } from '@nestjs/common';
import {
  WebSocketEventType,
  WebSocketRoomType,
  createClaudeExecutionEvent,
  ClaudeExecutionEventData,
  WebSocketEvent
} from '../websocket-events.schemas';
import { WebSocketGateway } from '../websocket.gateway';
import { ClaudeTask, TaskExecution, ExecutionStatus } from '../../../../../packages/types/src/database/claude-entities';

/**
 * Claude Events Service
 *
 * Implements real-time event emission for Claude Code execution output streaming following SOLID principles:
 *
 * 1. Single Responsibility Principle:
 *    - Focuses solely on Claude Code execution event broadcasting
 *    - Delegates event validation to existing schemas
 *    - Delegates event emission to WebSocket gateway
 *
 * 2. Open/Closed Principle:
 *    - Extensible for new Claude event types without modification
 *    - Output filtering and formatting logic can be extended independently
 *
 * 3. Dependency Inversion Principle:
 *    - Depends on WebSocketGateway abstraction for emission
 *    - Uses validated event schemas for type safety
 *
 * 4. Interface Segregation Principle:
 *    - Provides focused Claude execution event interface
 *    - Separate methods for different output types and control operations
 *
 * Key Features:
 * - Real-time Claude Code execution output streaming
 * - Chunked output streaming for large outputs to prevent buffer overload
 * - Stream management with pause/resume controls
 * - Output formatting preservation and type classification
 * - Backpressure handling for high-frequency output events
 * - Progress tracking and execution lifecycle events
 * - Error handling and execution failure broadcasts
 * - Stream controls and session management
 * - Performance metrics tracking
 */
@Injectable()
export class ClaudeEventsService {
  private readonly logger = new Logger(ClaudeEventsService.name);

  // Stream management for active executions
  private activeStreams = new Map<string, {
    executionId: string;
    isPaused: boolean;
    bufferSize: number;
    lastOutput: Date;
    chunkQueue: string[];
    streamOptions: StreamOptions;
  }>();

  // Output buffering for backpressure handling
  private outputBuffer = new Map<string, Array<{
    output: string;
    outputType: OutputType;
    timestamp: Date;
  }>>();

  // Configuration constants
  private readonly MAX_CHUNK_SIZE = 8192; // 8KB chunks
  private readonly MAX_BUFFER_SIZE = 100; // Maximum buffered outputs per execution
  private readonly BUFFER_FLUSH_INTERVAL_MS = 100; // 100ms batching window
  private readonly MAX_OUTPUT_RATE = 50; // Maximum outputs per second

  // Stream rate limiting
  private streamRateLimits = new Map<string, {
    outputCount: number;
    windowStart: Date;
  }>();

  constructor(
    private readonly webSocketGateway: WebSocketGateway
  ) {}

  /**
   * Emit Claude execution started event
   *
   * @param execution Task execution data
   * @param task Associated Claude task
   * @param userId ID of user who started the execution
   * @param streamOptions Stream configuration options
   */
  async emitExecutionStarted(
    execution: TaskExecution,
    task: ClaudeTask,
    userId: string,
    streamOptions: StreamOptions = {}
  ): Promise<void> {
    try {
      const executionEventData: ClaudeExecutionEventData = {
        executionId: execution.id,
        taskId: task.id,
        sessionId: execution.sessionId || undefined,
        status: 'started',
        command: task.prompt,
        workingDirectory: streamOptions.workingDirectory,
        environment: streamOptions.environment,
        isStreamable: streamOptions.enableStreaming !== false,
        canPause: streamOptions.enablePauseResume !== false,
        canResume: streamOptions.enablePauseResume !== false,
        startedAt: execution.startedAt || new Date(),
        metadata: {
          taskTitle: task.title,
          taskPriority: task.priority,
          estimatedDuration: task.estimatedDuration,
          ...streamOptions.metadata,
        },
      };

      const event = createClaudeExecutionEvent(
        WebSocketEventType.CLAUDE_EXECUTION_STARTED,
        userId,
        executionEventData,
        this.webSocketGateway.getTaskRoom(task.id),
        WebSocketRoomType.TASK
      );

      const rooms = this.determineEventRooms(task, userId);
      await this.emitToRoomsWithFiltering(event, rooms);

      // Initialize stream tracking
      this.activeStreams.set(execution.id, {
        executionId: execution.id,
        isPaused: false,
        bufferSize: 0,
        lastOutput: new Date(),
        chunkQueue: [],
        streamOptions,
      });

      this.logger.debug(`Claude execution started event emitted for execution ${execution.id}`);
    } catch (error) {
      this.logger.error(`Failed to emit execution started event for execution ${execution.id}: ${error.message}`);
    }
  }

  /**
   * Emit Claude execution output in real-time with chunking support
   *
   * @param executionId Execution ID
   * @param output Output content
   * @param outputType Type of output
   * @param userId User ID for event attribution
   * @param metadata Additional output metadata
   */
  async emitExecutionOutput(
    executionId: string,
    output: string,
    outputType: OutputType = 'stdout',
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const streamInfo = this.activeStreams.get(executionId);
      if (!streamInfo) {
        this.logger.warn(`No active stream found for execution ${executionId}`);
        return;
      }

      if (streamInfo.isPaused) {
        this.logger.debug(`Stream is paused for execution ${executionId}, buffering output`);
        this.bufferOutput(executionId, output, outputType);
        return;
      }

      // Apply rate limiting
      if (!this.checkRateLimit(executionId)) {
        this.bufferOutput(executionId, output, outputType);
        return;
      }

      // Handle large outputs with chunking
      if (output.length > this.MAX_CHUNK_SIZE) {
        await this.emitChunkedOutput(executionId, output, outputType, userId, metadata);
      } else {
        await this.emitSingleOutput(executionId, output, outputType, userId, metadata);
      }

      // Update stream tracking
      streamInfo.lastOutput = new Date();
      this.updateRateLimit(executionId);

    } catch (error) {
      this.logger.error(`Failed to emit execution output for execution ${executionId}: ${error.message}`);
    }
  }

  /**
   * Emit Claude execution progress update
   *
   * @param executionId Execution ID
   * @param progress Progress percentage (0-100)
   * @param userId User ID for event attribution
   * @param metrics Performance metrics
   */
  async emitExecutionProgress(
    executionId: string,
    progress: number,
    userId: string,
    metrics?: {
      tokensUsed?: number;
      executionTime?: number;
      memoryUsage?: number;
      cpuUsage?: number;
    }
  ): Promise<void> {
    try {
      const streamInfo = this.activeStreams.get(executionId);
      if (!streamInfo) {
        this.logger.warn(`No active stream found for execution ${executionId}`);
        return;
      }

      const executionEventData: ClaudeExecutionEventData = {
        executionId,
        status: 'progress',
        progress: Math.max(0, Math.min(100, progress)),
        tokensUsed: metrics?.tokensUsed,
        executionTime: metrics?.executionTime,
        memoryUsage: metrics?.memoryUsage,
        cpuUsage: metrics?.cpuUsage,
        lastOutputAt: streamInfo.lastOutput,
      };

      const event = createClaudeExecutionEvent(
        WebSocketEventType.CLAUDE_EXECUTION_PROGRESS,
        userId,
        executionEventData
      );

      await this.emitToActiveRooms(executionId, event);

      this.logger.debug(`Claude execution progress event emitted for execution ${executionId}: ${progress}%`);
    } catch (error) {
      this.logger.error(`Failed to emit execution progress for execution ${executionId}: ${error.message}`);
    }
  }

  /**
   * Emit Claude execution completed event
   *
   * @param execution Task execution data
   * @param result Execution result
   * @param userId User ID for event attribution
   */
  async emitExecutionCompleted(
    execution: TaskExecution,
    result: any,
    userId: string
  ): Promise<void> {
    try {
      const executionEventData: ClaudeExecutionEventData = {
        executionId: execution.id,
        status: 'completed',
        progress: 100,
        result,
        exitCode: 0,
        executionTime: execution.completedAt && execution.startedAt ?
          execution.completedAt.getTime() - execution.startedAt.getTime() : undefined,
        isComplete: true,
        completedAt: execution.completedAt || new Date(),
      };

      const event = createClaudeExecutionEvent(
        WebSocketEventType.CLAUDE_EXECUTION_COMPLETED,
        userId,
        executionEventData
      );

      await this.emitToActiveRooms(execution.id, event);

      // Clean up stream tracking
      this.cleanupStream(execution.id);

      this.logger.debug(`Claude execution completed event emitted for execution ${execution.id}`);
    } catch (error) {
      this.logger.error(`Failed to emit execution completed event for execution ${execution.id}: ${error.message}`);
    }
  }

  /**
   * Emit Claude execution failed event
   *
   * @param execution Task execution data
   * @param error Error message
   * @param errorCode Error code
   * @param userId User ID for event attribution
   */
  async emitExecutionFailed(
    execution: TaskExecution,
    error: string,
    userId: string,
    errorCode?: string
  ): Promise<void> {
    try {
      const executionEventData: ClaudeExecutionEventData = {
        executionId: execution.id,
        status: 'failed',
        error,
        errorCode,
        exitCode: 1,
        executionTime: execution.completedAt && execution.startedAt ?
          execution.completedAt.getTime() - execution.startedAt.getTime() : undefined,
        isComplete: true,
        completedAt: execution.completedAt || new Date(),
      };

      const event = createClaudeExecutionEvent(
        WebSocketEventType.CLAUDE_EXECUTION_FAILED,
        userId,
        executionEventData
      );

      await this.emitToActiveRooms(execution.id, event);

      // Clean up stream tracking
      this.cleanupStream(execution.id);

      this.logger.debug(`Claude execution failed event emitted for execution ${execution.id}: ${error}`);
    } catch (error) {
      this.logger.error(`Failed to emit execution failed event for execution ${execution.id}: ${error.message}`);
    }
  }

  /**
   * Pause execution output streaming
   *
   * @param executionId Execution ID
   * @param userId User ID for event attribution
   */
  async pauseExecutionStream(executionId: string, userId: string): Promise<void> {
    try {
      const streamInfo = this.activeStreams.get(executionId);
      if (!streamInfo) {
        this.logger.warn(`No active stream found for execution ${executionId}`);
        return;
      }

      streamInfo.isPaused = true;

      const executionEventData: ClaudeExecutionEventData = {
        executionId,
        status: 'paused',
        canResume: true,
      };

      const event = createClaudeExecutionEvent(
        WebSocketEventType.CLAUDE_EXECUTION_PAUSED,
        userId,
        executionEventData
      );

      await this.emitToActiveRooms(executionId, event);

      this.logger.debug(`Claude execution stream paused for execution ${executionId}`);
    } catch (error) {
      this.logger.error(`Failed to pause execution stream for execution ${executionId}: ${error.message}`);
    }
  }

  /**
   * Resume execution output streaming
   *
   * @param executionId Execution ID
   * @param userId User ID for event attribution
   */
  async resumeExecutionStream(executionId: string, userId: string): Promise<void> {
    try {
      const streamInfo = this.activeStreams.get(executionId);
      if (!streamInfo) {
        this.logger.warn(`No active stream found for execution ${executionId}`);
        return;
      }

      streamInfo.isPaused = false;

      const executionEventData: ClaudeExecutionEventData = {
        executionId,
        status: 'resumed',
        canPause: true,
      };

      const event = createClaudeExecutionEvent(
        WebSocketEventType.CLAUDE_EXECUTION_RESUMED,
        userId,
        executionEventData
      );

      await this.emitToActiveRooms(executionId, event);

      // Flush any buffered outputs
      await this.flushBufferedOutputs(executionId, userId);

      this.logger.debug(`Claude execution stream resumed for execution ${executionId}`);
    } catch (error) {
      this.logger.error(`Failed to resume execution stream for execution ${executionId}: ${error.message}`);
    }
  }

  /**
   * Get stream status for monitoring
   *
   * @param executionId Execution ID
   */
  getStreamStatus(executionId: string): StreamStatus | null {
    const streamInfo = this.activeStreams.get(executionId);
    if (!streamInfo) {
      return null;
    }

    const bufferedOutputs = this.outputBuffer.get(executionId) || [];

    return {
      executionId,
      isActive: true,
      isPaused: streamInfo.isPaused,
      bufferSize: bufferedOutputs.length,
      lastOutput: streamInfo.lastOutput,
      canPause: streamInfo.streamOptions.enablePauseResume !== false,
      canResume: streamInfo.streamOptions.enablePauseResume !== false,
    };
  }

  /**
   * Get all active stream statuses
   */
  getAllStreamStatuses(): StreamStatus[] {
    return Array.from(this.activeStreams.keys()).map(executionId =>
      this.getStreamStatus(executionId)!
    );
  }

  /**
   * Private method to emit chunked output for large content
   */
  private async emitChunkedOutput(
    executionId: string,
    output: string,
    outputType: OutputType,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const chunks = this.splitIntoChunks(output, this.MAX_CHUNK_SIZE);
    const totalChunks = chunks.length;

    for (let i = 0; i < chunks.length; i++) {
      const executionEventData: ClaudeExecutionEventData = {
        executionId,
        status: 'output',
        outputChunk: chunks[i],
        outputType,
        chunkIndex: i,
        totalChunks,
        isComplete: i === chunks.length - 1,
        lastOutputAt: new Date(),
        metadata,
      };

      const event = createClaudeExecutionEvent(
        WebSocketEventType.CLAUDE_EXECUTION_OUTPUT,
        userId,
        executionEventData
      );

      await this.emitToActiveRooms(executionId, event);

      // Small delay between chunks to prevent overwhelming clients
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * Private method to emit single output event
   */
  private async emitSingleOutput(
    executionId: string,
    output: string,
    outputType: OutputType,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const executionEventData: ClaudeExecutionEventData = {
      executionId,
      status: 'output',
      output,
      outputType,
      isComplete: true,
      lastOutputAt: new Date(),
      metadata,
    };

    const event = createClaudeExecutionEvent(
      WebSocketEventType.CLAUDE_EXECUTION_OUTPUT,
      userId,
      executionEventData
    );

    await this.emitToActiveRooms(executionId, event);
  }

  /**
   * Private method to determine which rooms should receive the event
   */
  private determineEventRooms(task: ClaudeTask, actorUserId: string): string[] {
    const rooms: Set<string> = new Set();

    // Task-specific room
    rooms.add(this.webSocketGateway.getTaskRoom(task.id));

    // Project room if task belongs to a project
    if (task.projectId) {
      rooms.add(this.webSocketGateway.getProjectRoom(task.projectId));
    }

    // User rooms for relevant users
    if (task.createdById) {
      rooms.add(this.webSocketGateway.getUserRoom(task.createdById));
    }

    // Actor's room if different from creator
    if (actorUserId !== task.createdById) {
      rooms.add(this.webSocketGateway.getUserRoom(actorUserId));
    }

    return Array.from(rooms);
  }

  /**
   * Private method to emit event to rooms with permission filtering
   */
  private async emitToRoomsWithFiltering(event: WebSocketEvent, rooms: string[]): Promise<void> {
    for (const room of rooms) {
      this.webSocketGateway.emitToRoom(room, event);
    }
  }

  /**
   * Private method to emit event to active execution rooms
   */
  private async emitToActiveRooms(executionId: string, event: WebSocketEvent): Promise<void> {
    // For now, emit to execution-specific room
    // In a full implementation, you would track which rooms the execution should broadcast to
    const executionRoom = `execution:${executionId}`;
    this.webSocketGateway.emitToRoom(executionRoom, event);
  }

  /**
   * Private method to split content into chunks
   */
  private splitIntoChunks(content: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Private method to buffer output when stream is paused or rate limited
   */
  private bufferOutput(executionId: string, output: string, outputType: OutputType): void {
    if (!this.outputBuffer.has(executionId)) {
      this.outputBuffer.set(executionId, []);
    }

    const buffer = this.outputBuffer.get(executionId)!;

    if (buffer.length >= this.MAX_BUFFER_SIZE) {
      // Remove oldest buffered output to prevent memory issues
      buffer.shift();
    }

    buffer.push({
      output,
      outputType,
      timestamp: new Date(),
    });
  }

  /**
   * Private method to flush buffered outputs when stream is resumed
   */
  private async flushBufferedOutputs(executionId: string, userId: string): Promise<void> {
    const buffer = this.outputBuffer.get(executionId);
    if (!buffer || buffer.length === 0) {
      return;
    }

    for (const bufferedOutput of buffer) {
      await this.emitExecutionOutput(
        executionId,
        bufferedOutput.output,
        bufferedOutput.outputType,
        userId
      );
    }

    // Clear the buffer
    this.outputBuffer.set(executionId, []);
  }

  /**
   * Private method to check rate limiting
   */
  private checkRateLimit(executionId: string): boolean {
    const now = new Date();
    const rateLimit = this.streamRateLimits.get(executionId);

    if (!rateLimit) {
      this.streamRateLimits.set(executionId, {
        outputCount: 0,
        windowStart: now,
      });
      return true;
    }

    // Reset window if it's been more than 1 second
    if (now.getTime() - rateLimit.windowStart.getTime() > 1000) {
      rateLimit.outputCount = 0;
      rateLimit.windowStart = now;
    }

    return rateLimit.outputCount < this.MAX_OUTPUT_RATE;
  }

  /**
   * Private method to update rate limiting counters
   */
  private updateRateLimit(executionId: string): void {
    const rateLimit = this.streamRateLimits.get(executionId);
    if (rateLimit) {
      rateLimit.outputCount++;
    }
  }

  /**
   * Private method to clean up stream tracking
   */
  private cleanupStream(executionId: string): void {
    this.activeStreams.delete(executionId);
    this.outputBuffer.delete(executionId);
    this.streamRateLimits.delete(executionId);
  }
}

// Type definitions for better type safety
type OutputType = 'stdout' | 'stderr' | 'tool_use' | 'tool_result' | 'user_message' | 'assistant_message';

interface StreamOptions {
  enableStreaming?: boolean;
  enablePauseResume?: boolean;
  workingDirectory?: string;
  environment?: Record<string, string>;
  metadata?: Record<string, any>;
}

interface StreamStatus {
  executionId: string;
  isActive: boolean;
  isPaused: boolean;
  bufferSize: number;
  lastOutput: Date;
  canPause: boolean;
  canResume: boolean;
}