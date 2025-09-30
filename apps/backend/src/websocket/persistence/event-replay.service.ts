import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WebSocketGateway } from '../websocket.gateway';
import {
  WebSocketEvent,
  WebSocketEventType,
  WebSocketRoomType,
  validateWebSocketEvent
} from '../websocket-events.schemas';
import { WebSocketEvent as PersistentEvent, WebSocketConnection } from '../../../node_modules/.prisma/client';

/**
 * Event Replay Service for WebSocket Event Persistence and Offline Client Support
 *
 * Implements SOLID principles:
 *
 * 1. Single Responsibility Principle:
 *    - Focused solely on event persistence and replay functionality
 *    - Delegates event validation to existing schemas
 *    - Delegates database operations to PrismaService
 *
 * 2. Open/Closed Principle:
 *    - Extensible for new replay strategies without modification
 *    - Event filtering and prioritization logic can be extended
 *
 * 3. Dependency Inversion Principle:
 *    - Depends on PrismaService abstraction for database operations
 *    - Depends on WebSocketGateway abstraction for event emission
 *
 * 4. Interface Segregation Principle:
 *    - Provides focused event persistence and replay interface
 *    - Separate methods for different replay scenarios
 *
 * Key Features:
 * - Efficient event storage with configurable retention
 * - Intelligent replay logic to prevent overwhelming reconnecting clients
 * - Connection state tracking for missed event detection
 * - Event prioritization for critical vs non-critical events
 * - Automatic event expiration and cleanup
 * - Comprehensive error handling and logging
 * - Performance optimized with batching and indexing
 */
@Injectable()
export class EventReplayService {
  private readonly logger = new Logger(EventReplayService.name);

  // Configuration constants
  private readonly DEFAULT_EVENT_RETENTION_HOURS = 24;
  private readonly MAX_EVENTS_PER_REPLAY = 100;
  private readonly REPLAY_BATCH_SIZE = 10;
  private readonly REPLAY_DELAY_MS = 50; // Delay between replay batches
  private readonly CONNECTION_TIMEOUT_MINUTES = 5;

  // Event priority mapping
  private readonly EVENT_PRIORITIES: Record<WebSocketEventType, number> = {
    // Critical events - highest priority
    [WebSocketEventType.TASK_ASSIGNED]: 10,
    [WebSocketEventType.TASK_STATUS_CHANGED]: 10,
    [WebSocketEventType.SYSTEM_ALERT]: 10,
    [WebSocketEventType.CLAUDE_EXECUTION_FAILED]: 10,

    // Important events - high priority
    [WebSocketEventType.TASK_CREATED]: 8,
    [WebSocketEventType.TASK_UPDATED]: 8,
    [WebSocketEventType.TASK_DELETED]: 8,
    [WebSocketEventType.QUEUE_JOB_FAILED]: 8,
    [WebSocketEventType.SYSTEM_HEALTH_STATUS]: 8,

    // Informational events - medium priority
    [WebSocketEventType.CLAUDE_EXECUTION_COMPLETED]: 6,
    [WebSocketEventType.QUEUE_JOB_COMPLETED]: 6,
    [WebSocketEventType.TASK_COMMENT_ADDED]: 6,
    [WebSocketEventType.CLAUDE_EXECUTION_OUTPUT]: 5,

    // System events
    [WebSocketEventType.NOTIFICATION]: 7,
    [WebSocketEventType.ALERT]: 8,
    [WebSocketEventType.SYSTEM_PERFORMANCE_METRICS]: 4,

    // Queue job events
    [WebSocketEventType.QUEUE_JOB_STARTED]: 5,
    [WebSocketEventType.QUEUE_JOB_PROGRESS]: 4,
    [WebSocketEventType.QUEUE_JOB_STALLED]: 7,

    // Claude execution events
    [WebSocketEventType.CLAUDE_EXECUTION_STARTED]: 6,
    [WebSocketEventType.CLAUDE_EXECUTION_PROGRESS]: 4,
    [WebSocketEventType.CLAUDE_EXECUTION_PAUSED]: 5,
    [WebSocketEventType.CLAUDE_EXECUTION_RESUMED]: 5,

    // Room management
    [WebSocketEventType.JOIN_ROOM]: 2,
    [WebSocketEventType.LEAVE_ROOM]: 2,

    // Connection events
    [WebSocketEventType.CONNECT]: 3,
    [WebSocketEventType.DISCONNECT]: 3,

    // Low priority events
    [WebSocketEventType.USER_JOINED]: 3,
    [WebSocketEventType.USER_LEFT]: 3,
    [WebSocketEventType.USER_TYPING]: 1,
    [WebSocketEventType.USER_STOPPED_TYPING]: 1,
    [WebSocketEventType.HEARTBEAT]: 1,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly webSocketGateway: WebSocketGateway
  ) {
    // Start cleanup processes
    this.startEventCleanup();
    this.startConnectionCleanup();
  }

  /**
   * Persist a WebSocket event for potential replay
   *
   * @param event WebSocket event to persist
   * @param retentionHours Hours to retain event (optional)
   */
  async persistEvent(event: WebSocketEvent, retentionHours?: number): Promise<void> {
    try {
      // Validate event structure
      const validatedEvent = validateWebSocketEvent(event);

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + (retentionHours || this.DEFAULT_EVENT_RETENTION_HOURS));

      // Determine event priority
      const priority = this.EVENT_PRIORITIES[validatedEvent.eventType] || 5;

      // Check if this event type should be persisted
      if (!this.shouldPersistEvent(validatedEvent)) {
        this.logger.debug(`Skipping persistence for event type: ${validatedEvent.eventType}`);
        return;
      }

      // Store event in database
      await this.prisma.webSocketEvent.create({
        data: {
          eventType: validatedEvent.eventType,
          correlationId: validatedEvent.correlationId,
          room: validatedEvent.room,
          roomType: validatedEvent.roomType,
          targetUserId: this.extractTargetUserId(validatedEvent),
          userId: validatedEvent.userId,
          eventData: validatedEvent.data as any,
          priority,
          broadcastAt: validatedEvent.timestamp || new Date(),
          expiresAt,
        },
      });

      this.logger.debug(`Event persisted: ${validatedEvent.eventType} for user ${validatedEvent.userId}`);
    } catch (error) {
      this.logger.error(`Failed to persist event: ${error.message}`, {
        eventType: event.eventType,
        userId: event.userId,
        error: error.stack,
      });
    }
  }

  /**
   * Record a new WebSocket connection for replay tracking
   *
   * @param socketId Socket connection ID
   * @param userId User ID for the connection
   * @param userAgent User agent string
   * @param ipAddress Client IP address
   * @param rooms Initial rooms the connection joins
   */
  async recordConnection(
    socketId: string,
    userId: string,
    userAgent?: string,
    ipAddress?: string,
    rooms: string[] = []
  ): Promise<void> {
    try {
      // Check for existing active connection
      const existingConnection = await this.prisma.webSocketConnection.findUnique({
        where: { socketId },
      });

      if (existingConnection) {
        // Update existing connection
        await this.prisma.webSocketConnection.update({
          where: { socketId },
          data: {
            isActive: true,
            lastHeartbeat: new Date(),
            rooms,
            replayFromTime: null, // Reset replay for reconnection
            replayCompleted: false,
          },
        });
      } else {
        // Create new connection record
        await this.prisma.webSocketConnection.create({
          data: {
            socketId,
            userId,
            userAgent,
            ipAddress,
            rooms,
            isActive: true,
            lastHeartbeat: new Date(),
            lastEventAt: new Date(),
          },
        });
      }

      this.logger.debug(`Connection recorded: ${socketId} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to record connection: ${error.message}`, {
        socketId,
        userId,
        error: error.stack,
      });
    }
  }

  /**
   * Update connection heartbeat and last activity
   *
   * @param socketId Socket connection ID
   * @param rooms Current rooms (optional update)
   */
  async updateConnectionActivity(socketId: string, rooms?: string[]): Promise<void> {
    try {
      const updateData: any = {
        lastHeartbeat: new Date(),
        lastEventAt: new Date(),
      };

      if (rooms) {
        updateData.rooms = rooms;
      }

      await this.prisma.webSocketConnection.update({
        where: { socketId },
        data: updateData,
      });
    } catch (error) {
      // Log but don't throw - heartbeat updates should not break the connection
      this.logger.warn(`Failed to update connection activity: ${error.message}`, {
        socketId,
      });
    }
  }

  /**
   * Mark a connection as disconnected and determine replay requirements
   *
   * @param socketId Socket connection ID
   */
  async recordDisconnection(socketId: string): Promise<void> {
    try {
      const now = new Date();

      await this.prisma.webSocketConnection.update({
        where: { socketId },
        data: {
          isActive: false,
          disconnectedAt: now,
          replayFromTime: now, // Set replay start time to disconnection time
        },
      });

      this.logger.debug(`Connection disconnected: ${socketId}`);
    } catch (error) {
      this.logger.error(`Failed to record disconnection: ${error.message}`, {
        socketId,
        error: error.stack,
      });
    }
  }

  /**
   * Replay missed events for a reconnecting client
   *
   * @param socketId Socket connection ID
   * @param userId User ID for additional filtering
   * @returns Number of events replayed
   */
  async replayMissedEvents(socketId: string, userId: string): Promise<number> {
    try {
      // Get connection info
      const connection = await this.prisma.webSocketConnection.findUnique({
        where: { socketId },
      });

      if (!connection || !connection.replayFromTime) {
        this.logger.debug(`No replay needed for connection: ${socketId}`);
        return 0;
      }

      // Get missed events for this user/connection
      const missedEvents = await this.getMissedEventsForUser(
        userId,
        connection.replayFromTime,
        connection.rooms
      );

      if (missedEvents.length === 0) {
        // Mark replay as completed
        await this.prisma.webSocketConnection.update({
          where: { socketId },
          data: {
            replayCompleted: true,
            replayFromTime: null,
          },
        });

        this.logger.debug(`No missed events to replay for: ${socketId}`);
        return 0;
      }

      // Replay events in intelligent batches
      let replayedCount = 0;
      const batches = this.createReplayBatches(missedEvents);

      for (const batch of batches) {
        await this.replayEventBatch(socketId, batch);
        replayedCount += batch.length;

        // Add delay between batches to prevent overwhelming client
        if (batches.length > 1) {
          await this.delay(this.REPLAY_DELAY_MS);
        }
      }

      // Mark replay as completed
      await this.prisma.webSocketConnection.update({
        where: { socketId },
        data: {
          replayCompleted: true,
          replayFromTime: null,
        },
      });

      // Mark replayed events
      await this.markEventsAsReplayed(missedEvents.map(e => e.id));

      this.logger.log(`Replayed ${replayedCount} events for connection: ${socketId}`);
      return replayedCount;
    } catch (error) {
      this.logger.error(`Failed to replay missed events: ${error.message}`, {
        socketId,
        userId,
        error: error.stack,
      });
      return 0;
    }
  }

  /**
   * Get events that were missed by a user since a specific time
   *
   * @private
   */
  private async getMissedEventsForUser(
    userId: string,
    since: Date,
    userRooms: string[]
  ): Promise<PersistentEvent[]> {
    const whereConditions = {
      AND: [
        {
          broadcastAt: {
            gte: since,
          },
        },
        {
          persisted: true,
        },
        {
          OR: [
            {
              expiresAt: {
                gte: new Date(),
              },
            },
            {
              expiresAt: null,
            },
          ],
        },
        {
          OR: [
            // Events targeted at this user
            {
              targetUserId: userId,
            },
            // Events for user's current rooms
            {
              room: {
                in: userRooms,
              },
            },
            // Events from this user (for consistency)
            {
              userId: userId,
            },
          ],
        },
      ],
    };

    return this.prisma.webSocketEvent.findMany({
      where: whereConditions,
      orderBy: [
        { priority: 'desc' }, // High priority first
        { broadcastAt: 'asc' }, // Chronological order within priority
      ],
      take: this.MAX_EVENTS_PER_REPLAY,
    });
  }

  /**
   * Create intelligent batches for event replay
   *
   * @private
   */
  private createReplayBatches(events: PersistentEvent[]): PersistentEvent[][] {
    const batches: PersistentEvent[][] = [];
    let currentBatch: PersistentEvent[] = [];

    for (const event of events) {
      currentBatch.push(event);

      // Create batch based on size or priority boundaries
      if (
        currentBatch.length >= this.REPLAY_BATCH_SIZE ||
        (currentBatch.length > 0 && event.priority !== currentBatch[0].priority)
      ) {
        batches.push([...currentBatch]);
        currentBatch = [];
      }
    }

    // Add remaining events
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * Replay a batch of events to a specific connection
   *
   * @private
   */
  private async replayEventBatch(socketId: string, events: PersistentEvent[]): Promise<void> {
    for (const persistedEvent of events) {
      try {
        // Reconstruct WebSocket event from persisted data
        const replayEvent: any = {
          eventType: persistedEvent.eventType as WebSocketEventType,
          userId: persistedEvent.userId,
          timestamp: persistedEvent.broadcastAt,
          correlationId: persistedEvent.correlationId || undefined,
          room: persistedEvent.room || undefined,
          roomType: persistedEvent.roomType as WebSocketRoomType || undefined,
          data: persistedEvent.eventData as any,
        };

        // Emit event directly to the specific socket (cast as any for replay compatibility)
        this.webSocketGateway.emitToSocket(socketId, replayEvent);

        // Update replay count
        await this.prisma.webSocketEvent.update({
          where: { id: persistedEvent.id },
          data: {
            replayCount: { increment: 1 },
            replayedAt: new Date(),
          },
        });
      } catch (error) {
        this.logger.warn(`Failed to replay individual event: ${error.message}`, {
          eventId: persistedEvent.id,
          eventType: persistedEvent.eventType,
        });
      }
    }
  }

  /**
   * Mark events as replayed in batch
   *
   * @private
   */
  private async markEventsAsReplayed(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;

    try {
      await this.prisma.webSocketEvent.updateMany({
        where: {
          id: {
            in: eventIds,
          },
        },
        data: {
          replayed: true,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to mark events as replayed: ${error.message}`);
    }
  }

  /**
   * Determine if an event should be persisted based on type and configuration
   *
   * @private
   */
  private shouldPersistEvent(event: WebSocketEvent): boolean {
    // Don't persist low-priority or frequent events
    const lowPriorityEvents = [
      WebSocketEventType.USER_TYPING,
      WebSocketEventType.USER_STOPPED_TYPING,
      WebSocketEventType.HEARTBEAT,
    ];

    return !lowPriorityEvents.includes(event.eventType);
  }

  /**
   * Extract target user ID from event data
   *
   * @private
   */
  private extractTargetUserId(event: WebSocketEvent): string | undefined {
    // Extract target user from event data based on event type
    if (event.data && typeof event.data === 'object') {
      const data = event.data as any;

      // Task events - target assignee
      if (data.assigneeId) {
        return data.assigneeId;
      }

      // Comment events - target task owner
      if (data.authorId && event.eventType === WebSocketEventType.TASK_COMMENT_ADDED) {
        return data.authorId;
      }
    }

    return undefined;
  }

  /**
   * Start automatic cleanup of expired events
   *
   * @private
   */
  private startEventCleanup(): void {
    // Run cleanup every hour
    setInterval(async () => {
      try {
        const result = await this.prisma.webSocketEvent.deleteMany({
          where: {
            expiresAt: {
              lt: new Date(),
            },
          },
        });

        if (result.count > 0) {
          this.logger.log(`Cleaned up ${result.count} expired events`);
        }
      } catch (error) {
        this.logger.error(`Event cleanup failed: ${error.message}`);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Start automatic cleanup of old connections
   *
   * @private
   */
  private startConnectionCleanup(): void {
    // Run cleanup every 30 minutes
    setInterval(async () => {
      try {
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffTime.getHours() - 24); // Keep connections for 24 hours

        const result = await this.prisma.webSocketConnection.deleteMany({
          where: {
            AND: [
              { isActive: false },
              {
                disconnectedAt: {
                  lt: cutoffTime,
                },
              },
            ],
          },
        });

        if (result.count > 0) {
          this.logger.log(`Cleaned up ${result.count} old connection records`);
        }
      } catch (error) {
        this.logger.error(`Connection cleanup failed: ${error.message}`);
      }
    }, 30 * 60 * 1000); // 30 minutes
  }

  /**
   * Utility method to add delay
   *
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get statistics about event persistence and replay
   */
  async getReplayStatistics(): Promise<{
    totalEvents: number;
    expiredEvents: number;
    replayedEvents: number;
    activeConnections: number;
    pendingReplays: number;
  }> {
    try {
      const [
        totalEvents,
        expiredEvents,
        replayedEvents,
        activeConnections,
        pendingReplays,
      ] = await Promise.all([
        this.prisma.webSocketEvent.count(),
        this.prisma.webSocketEvent.count({
          where: {
            expiresAt: {
              lt: new Date(),
            },
          },
        }),
        this.prisma.webSocketEvent.count({
          where: {
            replayed: true,
          },
        }),
        this.prisma.webSocketConnection.count({
          where: {
            isActive: true,
          },
        }),
        this.prisma.webSocketConnection.count({
          where: {
            AND: [
              { replayFromTime: { not: null } },
              { replayCompleted: false },
            ],
          },
        }),
      ]);

      return {
        totalEvents,
        expiredEvents,
        replayedEvents,
        activeConnections,
        pendingReplays,
      };
    } catch (error) {
      this.logger.error(`Failed to get replay statistics: ${error.message}`);
      return {
        totalEvents: 0,
        expiredEvents: 0,
        replayedEvents: 0,
        activeConnections: 0,
        pendingReplays: 0,
      };
    }
  }

  /**
   * Force cleanup of expired events (manual trigger)
   */
  async cleanupExpiredEvents(): Promise<number> {
    try {
      const result = await this.prisma.webSocketEvent.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      this.logger.log(`Manual cleanup removed ${result.count} expired events`);
      return result.count;
    } catch (error) {
      this.logger.error(`Manual event cleanup failed: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get missed events count for a user (for monitoring/dashboard)
   */
  async getMissedEventsCount(userId: string, since: Date): Promise<number> {
    try {
      return await this.prisma.webSocketEvent.count({
        where: {
          AND: [
            {
              broadcastAt: {
                gte: since,
              },
            },
            {
              persisted: true,
            },
            {
              OR: [
                {
                  expiresAt: {
                    gte: new Date(),
                  },
                },
                {
                  expiresAt: null,
                },
              ],
            },
            {
              OR: [
                { targetUserId: userId },
                { userId: userId },
              ],
            },
          ],
        },
      });
    } catch (error) {
      this.logger.error(`Failed to get missed events count: ${error.message}`);
      return 0;
    }
  }
}