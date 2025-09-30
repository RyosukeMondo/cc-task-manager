import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
  ClaudeWrapperService,
  ClaudeResponse,
  ClaudeWrapperOptions,
} from './claude-wrapper.service';
import { ClaudeSessionService } from './claude-session.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import {
  WebSocketEventType,
  WebSocketRoomType,
  NotificationLevel,
  createTaskEvent,
} from '../websocket/websocket-events.schemas';

/**
 * Interface for Claude Code streaming configuration
 * Following contract-driven design principles
 */
export interface ClaudeStreamConfig {
  sessionId?: string;
  streamId?: string;
  userId?: string;
  bufferSize?: number;
  maxBufferTime?: number; // milliseconds
  enableBackpressure?: boolean;
  compressionLevel?: number;
  maxOutputSize?: number; // bytes
  roomId?: string;
  roomType?: WebSocketRoomType;
}

/**
 * Interface for Claude Code stream metadata
 * Tracks streaming session state and performance
 */
export interface ClaudeStreamMetadata {
  streamId: string;
  sessionId?: string;
  userId?: string;
  createdAt: Date;
  lastActivityAt: Date;
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'error' | 'terminated';
  totalBytes: number;
  totalChunks: number;
  averageLatency: number;
  bufferSize: number;
  roomId?: string;
  roomType?: WebSocketRoomType;
}

/**
 * Interface for stream output chunk
 * Represents a single unit of streaming data
 */
export interface StreamOutputChunk {
  streamId: string;
  sequence: number;
  timestamp: Date;
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'status' | 'completion';
  content: any;
  metadata?: {
    runId?: string;
    commandType?: string;
    isPartial?: boolean;
    totalSize?: number;
    compressed?: boolean;
  };
}

/**
 * Interface for stream statistics
 * Provides insights into streaming performance
 */
export interface StreamStatistics {
  totalStreams: number;
  activeStreams: number;
  totalBytesStreamed: number;
  averageLatency: number;
  averageChunksPerStream: number;
  compressionRatio: number;
  streamsByStatus: Record<string, number>;
}

/**
 * Claude Code output streaming and real-time updates service
 *
 * Creates streaming service for real-time Claude Code output following SOLID principles:
 *
 * - Single Responsibility: Manages Claude Code output streaming
 * - Open/Closed: Extensible for new streaming protocols and formats
 * - Liskov Substitution: Can be substituted with other streaming implementations
 * - Interface Segregation: Focused interface for streaming operations
 * - Dependency Inversion: Depends on WebSocket and session service abstractions
 *
 * Applies KISS principle for simple streaming workflow
 * Ensures DRY/SSOT compliance with centralized stream management
 * Implements fail-fast validation and comprehensive error handling
 * Provides real-time visibility into Claude Code execution progress
 * Handles large output volumes efficiently with backpressure control
 */
@Injectable()
export class ClaudeStreamService extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(ClaudeStreamService.name);
  private readonly streams = new Map<string, ClaudeStreamMetadata>();
  private readonly streamBuffers = new Map<string, StreamOutputChunk[]>();
  private readonly flushTimers = new Map<string, NodeJS.Timeout>();
  private readonly backpressureQueues = new Map<string, StreamOutputChunk[]>();

  // Default configuration
  private readonly defaultConfig: Required<ClaudeStreamConfig> = {
    sessionId: '',
    streamId: '',
    userId: '',
    bufferSize: 100, // chunks
    maxBufferTime: 100, // milliseconds
    enableBackpressure: true,
    compressionLevel: 6, // gzip compression level
    maxOutputSize: 10 * 1024 * 1024, // 10 MB
    roomId: '',
    roomType: WebSocketRoomType.USER,
  };

  constructor(
    private readonly sessionService: ClaudeSessionService,
    private readonly webSocketGateway: WebSocketGateway
  ) {
    super();
    this.setupPerformanceMonitoring();
  }

  /**
   * Create new Claude Code streaming session
   * Implements stream initialization with proper WebSocket integration
   */
  async createStream(
    config: ClaudeStreamConfig = {},
    sessionId?: string
  ): Promise<string> {
    // Fail-fast validation
    this.validateStreamConfig(config);

    const streamConfig = { ...this.defaultConfig, ...config };
    const streamId = streamConfig.streamId || this.generateStreamId();

    // Check if stream already exists
    if (this.streams.has(streamId)) {
      throw new Error(`Stream ${streamId} already exists`);
    }

    this.logger.debug(`Creating Claude stream: ${streamId}`);

    try {
      // Initialize stream metadata
      const metadata: ClaudeStreamMetadata = {
        streamId,
        sessionId: sessionId || streamConfig.sessionId,
        userId: streamConfig.userId,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        status: 'initializing',
        totalBytes: 0,
        totalChunks: 0,
        averageLatency: 0,
        bufferSize: streamConfig.bufferSize,
        roomId: streamConfig.roomId,
        roomType: streamConfig.roomType,
      };

      this.streams.set(streamId, metadata);
      this.streamBuffers.set(streamId, []);

      // Setup session event handlers if session provided
      if (metadata.sessionId) {
        await this.attachToSession(streamId, metadata.sessionId);
      }

      // Setup buffer flush timer
      if (streamConfig.maxBufferTime > 0) {
        this.setupBufferFlush(streamId, streamConfig.maxBufferTime);
      }

      // Setup backpressure handling if enabled
      if (streamConfig.enableBackpressure) {
        this.backpressureQueues.set(streamId, []);
      }

      // Update stream status
      metadata.status = 'active';
      metadata.lastActivityAt = new Date();

      this.logger.log(`Claude stream created successfully: ${streamId}`);
      this.emit('stream_created', { streamId, sessionId, metadata });

      // Notify WebSocket clients if room configured
      if (metadata.roomId && metadata.userId) {
        this.notifyStreamCreated(metadata);
      }

      return streamId;
    } catch (error) {
      // Cleanup on failure
      await this.terminateStream(streamId);

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create stream ${streamId}: ${errorMessage}`, error);
      throw new Error(`Stream creation failed: ${errorMessage}`);
    }
  }

  /**
   * Attach stream to existing Claude session
   * Implements session integration with event forwarding
   */
  private async attachToSession(streamId: string, sessionId: string): Promise<void> {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found for stream attachment`);
    }

    this.logger.debug(`Attaching stream ${streamId} to session ${sessionId}`);

    // Listen for session events and forward to stream
    this.sessionService.on('session_response', (data: any) => {
      if (data.sessionId === sessionId) {
        this.processClaudeResponse(streamId, data.response);
      }
    });

    this.sessionService.on('session_error', (data: any) => {
      if (data.sessionId === sessionId) {
        this.processStreamError(streamId, data.error);
      }
    });

    this.sessionService.on('session_terminated', (data: any) => {
      if (data.sessionId === sessionId) {
        this.completeStream(streamId, 'Session terminated');
      }
    });
  }

  /**
   * Process Claude Code response and create stream chunks
   * Implements response parsing and chunk creation
   */
  private processClaudeResponse(streamId: string, response: ClaudeResponse): void {
    const stream = this.streams.get(streamId);
    if (!stream || stream.status !== 'active') {
      return;
    }

    try {
      // Update stream activity
      stream.lastActivityAt = new Date();

      // Create stream chunk based on response type
      const chunk = this.createStreamChunk(streamId, response, stream.totalChunks);

      // Add to buffer
      this.addChunkToBuffer(streamId, chunk);

      // Update statistics
      stream.totalChunks++;
      stream.totalBytes += this.calculateChunkSize(chunk);

      // Check if this indicates completion
      if (this.isCompletionResponse(response)) {
        this.completeStream(streamId, 'Command completed');
      }

      this.logger.debug(`Processed response for stream ${streamId}: ${response.event}`);
    } catch (error) {
      this.logger.error(`Failed to process response for stream ${streamId}:`, error);
      this.processStreamError(streamId, error as Error);
    }
  }

  /**
   * Create stream chunk from Claude response
   * Implements response transformation to streaming format
   */
  private createStreamChunk(
    streamId: string,
    response: ClaudeResponse,
    sequence: number
  ): StreamOutputChunk {
    const baseChunk: StreamOutputChunk = {
      streamId,
      sequence,
      timestamp: new Date(),
      type: 'text',
      content: response,
      metadata: {
        runId: response.run_id,
      },
    };

    // Determine chunk type based on response event
    switch (response.event) {
      case 'stream':
        baseChunk.type = 'text';
        baseChunk.content = this.extractStreamContent(response);
        break;

      case 'tool_use':
        baseChunk.type = 'tool_use';
        baseChunk.content = response.payload;
        baseChunk.metadata = {
          ...baseChunk.metadata,
          commandType: 'tool_use',
        };
        break;

      case 'tool_result':
        baseChunk.type = 'tool_result';
        baseChunk.content = response.payload;
        baseChunk.metadata = {
          ...baseChunk.metadata,
          commandType: 'tool_result',
        };
        break;

      case 'run_completed':
      case 'run_failed':
      case 'run_cancelled':
        baseChunk.type = 'completion';
        baseChunk.content = {
          status: response.event,
          payload: response.payload,
          error: response.error,
        };
        break;

      case 'error':
        baseChunk.type = 'error';
        baseChunk.content = {
          error: response.error || 'Unknown error',
          payload: response.payload,
        };
        break;

      default:
        baseChunk.type = 'status';
        baseChunk.content = response;
    }

    return baseChunk;
  }

  /**
   * Extract meaningful content from stream response
   * Implements content parsing for different response types
   */
  private extractStreamContent(response: ClaudeResponse): any {
    if (response.payload && typeof response.payload === 'object') {
      // Extract text content from payload
      if (response.payload.content && Array.isArray(response.payload.content)) {
        const textContent = response.payload.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('');

        if (textContent) {
          return { text: textContent, raw: response.payload };
        }
      }

      return response.payload;
    }

    return response;
  }

  /**
   * Add chunk to stream buffer
   * Implements buffering with automatic flush
   */
  private addChunkToBuffer(streamId: string, chunk: StreamOutputChunk): void {
    const buffer = this.streamBuffers.get(streamId);
    if (!buffer) {
      this.logger.warn(`No buffer found for stream ${streamId}`);
      return;
    }

    const stream = this.streams.get(streamId);
    if (!stream) {
      return;
    }

    // Check backpressure
    if (this.shouldApplyBackpressure(streamId)) {
      this.handleBackpressure(streamId, chunk);
      return;
    }

    buffer.push(chunk);

    // Auto-flush if buffer is full
    if (buffer.length >= stream.bufferSize) {
      this.flushBuffer(streamId);
    }
  }

  /**
   * Check if backpressure should be applied
   * Implements backpressure detection
   */
  private shouldApplyBackpressure(streamId: string): boolean {
    const buffer = this.streamBuffers.get(streamId);
    const backpressureQueue = this.backpressureQueues.get(streamId);

    if (!buffer || !backpressureQueue) {
      return false;
    }

    // Apply backpressure if buffer is significantly full
    const totalPending = buffer.length + backpressureQueue.length;
    return totalPending > (this.defaultConfig.bufferSize * 2);
  }

  /**
   * Handle backpressure by queuing chunks
   * Implements backpressure management
   */
  private handleBackpressure(streamId: string, chunk: StreamOutputChunk): void {
    const backpressureQueue = this.backpressureQueues.get(streamId);
    if (!backpressureQueue) {
      return;
    }

    backpressureQueue.push(chunk);
    this.logger.debug(`Applied backpressure for stream ${streamId}, queue size: ${backpressureQueue.length}`);

    // Start backpressure processing if not already started
    this.processBackpressureQueue(streamId);
  }

  /**
   * Process backpressure queue
   * Implements gradual backpressure release
   */
  private async processBackpressureQueue(streamId: string): Promise<void> {
    const backpressureQueue = this.backpressureQueues.get(streamId);
    const buffer = this.streamBuffers.get(streamId);

    if (!backpressureQueue || !buffer || backpressureQueue.length === 0) {
      return;
    }

    // Move chunks from backpressure queue to buffer gradually
    const maxRelease = Math.min(5, backpressureQueue.length);
    const chunksToRelease = backpressureQueue.splice(0, maxRelease);

    for (const chunk of chunksToRelease) {
      buffer.push(chunk);
    }

    // Flush buffer if it's getting full
    const stream = this.streams.get(streamId);
    if (stream && buffer.length >= stream.bufferSize) {
      this.flushBuffer(streamId);
    }

    // Continue processing if more chunks in queue
    if (backpressureQueue.length > 0) {
      setTimeout(() => this.processBackpressureQueue(streamId), 50);
    }
  }

  /**
   * Flush stream buffer to WebSocket clients
   * Implements efficient batch transmission
   */
  private flushBuffer(streamId: string): void {
    const buffer = this.streamBuffers.get(streamId);
    const stream = this.streams.get(streamId);

    if (!buffer || !stream || buffer.length === 0) {
      return;
    }

    try {
      // Create batch payload
      const batchPayload = {
        streamId,
        chunks: buffer.splice(0), // Remove all chunks from buffer
        metadata: {
          totalChunks: stream.totalChunks,
          totalBytes: stream.totalBytes,
          timestamp: new Date(),
        },
      };

      // Send via WebSocket if room configured
      if (stream.roomId) {
        this.sendStreamBatch(stream, batchPayload);
      }

      // Emit event for local listeners
      this.emit('stream_batch', batchPayload);

      this.logger.debug(`Flushed ${batchPayload.chunks.length} chunks for stream ${streamId}`);
    } catch (error) {
      this.logger.error(`Failed to flush buffer for stream ${streamId}:`, error);
    }
  }

  /**
   * Send stream batch via WebSocket
   * Implements WebSocket transmission with room targeting
   */
  private sendStreamBatch(stream: ClaudeStreamMetadata, batchPayload: any): void {
    if (!stream.roomId) {
      return;
    }

    try {
      // Create WebSocket event
      const streamEvent = createTaskEvent(
        WebSocketEventType.TASK_STATUS_CHANGED,
        stream.userId || 'system',
        {
          taskId: stream.streamId,
          status: 'streaming',
          data: batchPayload,
          metadata: {
            type: 'claude_stream_batch',
            streamId: stream.streamId,
            sessionId: stream.sessionId,
          },
        },
        stream.roomId,
        stream.roomType || WebSocketRoomType.USER
      );

      this.webSocketGateway.emitToRoom(stream.roomId, streamEvent);
    } catch (error) {
      this.logger.error(`Failed to send stream batch via WebSocket:`, error);
    }
  }

  /**
   * Setup buffer flush timer
   * Implements timed buffer flushing
   */
  private setupBufferFlush(streamId: string, maxBufferTime: number): void {
    const flushTimer = setInterval(() => {
      const buffer = this.streamBuffers.get(streamId);
      if (buffer && buffer.length > 0) {
        this.flushBuffer(streamId);
      }
    }, maxBufferTime);

    this.flushTimers.set(streamId, flushTimer);
  }

  /**
   * Process stream error
   * Implements error handling and notification
   */
  private processStreamError(streamId: string, error: Error): void {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return;
    }

    this.logger.error(`Stream ${streamId} error:`, error);

    // Create error chunk
    const errorChunk: StreamOutputChunk = {
      streamId,
      sequence: stream.totalChunks,
      timestamp: new Date(),
      type: 'error',
      content: {
        error: error.message,
        stack: error.stack,
      },
      metadata: {
        isPartial: false,
      },
    };

    // Add to buffer and flush immediately
    this.addChunkToBuffer(streamId, errorChunk);
    this.flushBuffer(streamId);

    // Update stream status
    stream.status = 'error';
    stream.lastActivityAt = new Date();

    // Notify via WebSocket if configured
    if (stream.roomId && stream.userId) {
      this.webSocketGateway.sendNotificationToUser(stream.userId, {
        title: 'Stream Error',
        message: `Claude Code stream ${streamId} encountered an error: ${error.message}`,
        level: NotificationLevel.ERROR,
      });
    }

    this.emit('stream_error', { streamId, error });
  }

  /**
   * Complete stream
   * Implements stream completion with cleanup
   */
  private completeStream(streamId: string, reason?: string): void {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return;
    }

    this.logger.debug(`Completing stream ${streamId}: ${reason || 'No reason provided'}`);

    // Flush any remaining buffer
    this.flushBuffer(streamId);

    // Create completion chunk
    const completionChunk: StreamOutputChunk = {
      streamId,
      sequence: stream.totalChunks,
      timestamp: new Date(),
      type: 'completion',
      content: {
        status: 'completed',
        reason: reason || 'Stream completed',
        totalChunks: stream.totalChunks,
        totalBytes: stream.totalBytes,
      },
    };

    // Send completion chunk
    const buffer = this.streamBuffers.get(streamId);
    if (buffer) {
      buffer.push(completionChunk);
      this.flushBuffer(streamId);
    }

    // Update stream status
    stream.status = 'completed';
    stream.lastActivityAt = new Date();

    this.logger.log(`Stream completed: ${streamId}`);
    this.emit('stream_completed', { streamId, reason });

    // Notify via WebSocket if configured
    if (stream.roomId && stream.userId) {
      this.notifyStreamCompleted(stream, reason);
    }
  }

  /**
   * Terminate stream and cleanup resources
   * Implements graceful stream termination with resource cleanup
   */
  async terminateStream(streamId: string, reason?: string): Promise<void> {
    const stream = this.streams.get(streamId);

    if (!stream) {
      this.logger.warn(`Stream ${streamId} not found for termination`);
      return;
    }

    if (stream.status === 'terminated') {
      this.logger.warn(`Stream ${streamId} is already terminated`);
      return;
    }

    this.logger.debug(`Terminating stream ${streamId}: ${reason || 'No reason provided'}`);

    try {
      // Flush any remaining buffer
      this.flushBuffer(streamId);

      stream.status = 'terminated';
      stream.lastActivityAt = new Date();

      await this.cleanupStream(streamId);

      this.logger.log(`Stream terminated: ${streamId}`);
      this.emit('stream_terminated', { streamId, reason });

      // Notify via WebSocket if configured
      if (stream.roomId && stream.userId) {
        this.webSocketGateway.sendNotificationToUser(stream.userId, {
          title: 'Stream Terminated',
          message: `Claude Code stream ${streamId} was terminated${reason ? `: ${reason}` : ''}`,
          level: NotificationLevel.WARNING,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to terminate stream ${streamId}: ${errorMessage}`, error);
      throw new Error(`Stream termination failed: ${errorMessage}`);
    }
  }

  /**
   * Cleanup stream resources
   * Implements comprehensive resource cleanup
   */
  private async cleanupStream(streamId: string): Promise<void> {
    this.logger.debug(`Cleaning up stream resources: ${streamId}`);

    try {
      // Clear flush timer
      const flushTimer = this.flushTimers.get(streamId);
      if (flushTimer) {
        clearInterval(flushTimer);
        this.flushTimers.delete(streamId);
      }

      // Clear buffers
      this.streamBuffers.delete(streamId);
      this.backpressureQueues.delete(streamId);

      // Remove stream metadata
      this.streams.delete(streamId);

      this.logger.debug(`Stream cleanup completed: ${streamId}`);
    } catch (error) {
      this.logger.error(`Stream cleanup failed for ${streamId}:`, error);
    }
  }

  /**
   * Get stream metadata by ID
   * Implements stream state inspection
   */
  getStream(streamId: string): ClaudeStreamMetadata | undefined {
    return this.streams.get(streamId);
  }

  /**
   * Get all active streams
   * Provides overview of streaming state
   */
  getActiveStreams(): ClaudeStreamMetadata[] {
    return Array.from(this.streams.values())
      .filter(stream => stream.status === 'active');
  }

  /**
   * Get stream statistics
   * Implements streaming analytics and monitoring
   */
  getStreamStatistics(): StreamStatistics {
    const allStreams = Array.from(this.streams.values());
    const totalBytesStreamed = allStreams.reduce((sum, s) => sum + s.totalBytes, 0);
    const totalChunks = allStreams.reduce((sum, s) => sum + s.totalChunks, 0);

    const streamsByStatus = allStreams.reduce((counts, stream) => {
      counts[stream.status] = (counts[stream.status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const averageLatency = allStreams.length > 0
      ? allStreams.reduce((sum, s) => sum + s.averageLatency, 0) / allStreams.length
      : 0;

    const averageChunksPerStream = allStreams.length > 0
      ? totalChunks / allStreams.length
      : 0;

    return {
      totalStreams: allStreams.length,
      activeStreams: allStreams.filter(s => s.status === 'active').length,
      totalBytesStreamed,
      averageLatency,
      averageChunksPerStream,
      compressionRatio: 1.0, // Placeholder for compression ratio calculation
      streamsByStatus,
    };
  }

  /**
   * Pause stream
   * Implements stream pause functionality
   */
  async pauseStream(streamId: string): Promise<void> {
    const stream = this.validateStreamExists(streamId);

    if (stream.status !== 'active') {
      throw new Error(`Stream ${streamId} is not active (status: ${stream.status})`);
    }

    stream.status = 'paused';
    stream.lastActivityAt = new Date();

    this.logger.log(`Stream paused: ${streamId}`);
    this.emit('stream_paused', { streamId });
  }

  /**
   * Resume paused stream
   * Implements stream resume functionality
   */
  async resumeStream(streamId: string): Promise<void> {
    const stream = this.validateStreamExists(streamId);

    if (stream.status !== 'paused') {
      throw new Error(`Stream ${streamId} is not paused (status: ${stream.status})`);
    }

    stream.status = 'active';
    stream.lastActivityAt = new Date();

    this.logger.log(`Stream resumed: ${streamId}`);
    this.emit('stream_resumed', { streamId });
  }

  /**
   * Helper methods for stream management
   */

  private isCompletionResponse(response: ClaudeResponse): boolean {
    return ['run_completed', 'run_failed', 'run_cancelled', 'auto_shutdown'].includes(response.event);
  }

  private calculateChunkSize(chunk: StreamOutputChunk): number {
    return JSON.stringify(chunk).length;
  }

  private validateStreamExists(streamId: string): ClaudeStreamMetadata {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }
    return stream;
  }

  private validateStreamConfig(config: ClaudeStreamConfig): void {
    if (config.bufferSize !== undefined && config.bufferSize < 1) {
      throw new Error('bufferSize must be at least 1');
    }

    if (config.maxBufferTime !== undefined && config.maxBufferTime < 0) {
      throw new Error('maxBufferTime must be non-negative');
    }

    if (config.maxOutputSize !== undefined && config.maxOutputSize < 0) {
      throw new Error('maxOutputSize must be non-negative');
    }

    if (config.compressionLevel !== undefined && (config.compressionLevel < 0 || config.compressionLevel > 9)) {
      throw new Error('compressionLevel must be between 0 and 9');
    }
  }

  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifyStreamCreated(stream: ClaudeStreamMetadata): void {
    if (stream.userId) {
      this.webSocketGateway.sendNotificationToUser(stream.userId, {
        title: 'Stream Created',
        message: `Claude Code streaming started for session ${stream.sessionId}`,
        level: NotificationLevel.INFO,
      });
    }
  }

  private notifyStreamCompleted(stream: ClaudeStreamMetadata, reason?: string): void {
    if (stream.userId) {
      this.webSocketGateway.sendNotificationToUser(stream.userId, {
        title: 'Stream Completed',
        message: `Claude Code stream completed successfully. ${stream.totalChunks} chunks processed.`,
        level: NotificationLevel.SUCCESS,
      });
    }
  }

  private setupPerformanceMonitoring(): void {
    // Setup periodic performance monitoring
    setInterval(() => {
      const stats = this.getStreamStatistics();
      if (stats.activeStreams > 0) {
        this.logger.debug(`Stream performance: ${stats.activeStreams} active, ${stats.totalBytesStreamed} bytes, ${stats.averageLatency}ms avg latency`);
      }
    }, 60000); // Every minute
  }

  /**
   * Module lifecycle cleanup
   * Implements NestJS module cleanup pattern
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.debug('ClaudeStreamService module destroy called');

    // Clear all flush timers
    for (const [streamId, timer] of Array.from(this.flushTimers.entries())) {
      clearInterval(timer);
    }
    this.flushTimers.clear();

    // Terminate all active streams
    const activeStreams = Array.from(this.streams.keys());
    await Promise.allSettled(
      activeStreams.map(streamId =>
        this.terminateStream(streamId, 'Module shutdown')
      )
    );

    this.logger.log('ClaudeStreamService cleanup completed');
  }
}