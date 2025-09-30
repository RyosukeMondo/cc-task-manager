import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocketAuthGuard } from './websocket-auth.guard';
import {
  WebSocketEventType,
  WebSocketRoomType,
  validateClientWebSocketEvent,
  validateWebSocketEvent,
  createNotificationEvent,
  createUserActivityEvent,
  createTaskEvent,
  WebSocketEventSchema,
  WebSocketAckSchema,
  WebSocketErrorSchema,
  ClientWebSocketEvent,
  WebSocketEvent,
  WebSocketAck,
  WebSocketError,
  NotificationLevel,
  TaskEventData,
  NotificationEventData,
  UserActivityEventData,
} from './websocket-events.schemas';
import { JWTPayload } from '@schemas/auth';
import { UserChannelsService } from './channels/user-channels.service';
import { ConnectionManagerService } from './connection/connection-manager.service';
import { EventReplayService } from './persistence/event-replay.service';

/**
 * WebSocket Gateway for real-time communication
 * Implements JWT authentication, room-based targeting, and Zod event validation
 * Following SOLID principles with clean event handling separation
 * 
 * Features:
 * - JWT authentication for WebSocket connections using WebSocketAuthGuard
 * - Room-based targeting for message delivery
 * - Type-safe event validation using Zod schemas
 * - Comprehensive connection state management
 * - Real-time task status updates and system notifications
 */
@Injectable()
@WSGateway({
  namespace: '/ws',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class WebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);
  private connectedUsers = new Map<string, { userId: string; socket: Socket; rooms: Set<string> }>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly userChannelsService: UserChannelsService,
    private readonly connectionManager: ConnectionManagerService,
    private readonly eventReplayService: EventReplayService
  ) {}

  /**
   * Initialize WebSocket gateway with logging
   */
  afterInit(server: Server): void {
    this.logger.log('WebSocket Gateway initialized');
    this.server = server;
  }

  /**
   * Handle new client connections
   * Authenticates the socket and sets up user session
   */
  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client attempting connection: ${client.id}`);

      // Socket is already authenticated by middleware
      const user = client.data.user as JWTPayload;

      // Check if connection manager can accept new connections
      if (!this.connectionManager.canAcceptConnections()) {
        this.logger.warn(`Connection rejected for ${user.username}: capacity reached`);
        client.emit('error', {
          error: 'Server at capacity, please try again later',
          code: 'CAPACITY_EXCEEDED',
        });
        client.disconnect(true);
        return;
      }

      // Register connection with connection manager
      const registered = this.connectionManager.registerConnection(client, user);
      if (!registered) {
        this.logger.warn(`Failed to register connection for ${user.username}`);
        client.emit('error', {
          error: 'Connection registration failed',
          code: 'REGISTRATION_FAILED',
        });
        client.disconnect(true);
        return;
      }

      // Store connection information (keeping for backward compatibility)
      this.connectedUsers.set(client.id, {
        userId: user.sub,
        socket: client,
        rooms: new Set(),
      });

      // Initialize user channels with permission-based access
      await this.userChannelsService.initializeUserChannels(user.sub, user, this.server);

      // Join user-specific room
      const userRoom = this.getUserRoom(user.sub);
      await client.join(userRoom);
      this.addUserToRoom(client.id, userRoom);
      this.connectionManager.addToRoom(client.id, userRoom);

      // Emit connection event
      const connectionEvent = createUserActivityEvent(
        WebSocketEventType.USER_JOINED,
        user.sub,
        {
          username: user.username,
          activity: 'Connected to WebSocket',
        },
        userRoom,
        WebSocketRoomType.USER
      );

      this.server.to(userRoom).emit('event', connectionEvent);

      this.logger.log(`User ${user.username} (${user.sub}) connected with socket ${client.id}`);

      // Send welcome notification
      this.sendNotificationToUser(user.sub, {
        title: 'Connected',
        message: 'Successfully connected to real-time updates',
        level: NotificationLevel.SUCCESS,
      });

      // Record connection for event replay tracking
      const userRooms = Array.from(this.connectedUsers.get(client.id)?.rooms || []);
      await this.eventReplayService.recordConnection(
        client.id,
        user.sub,
        client.handshake.headers['user-agent'],
        client.handshake.address,
        [userRoom, ...userRooms]
      );

      // Replay missed events for reconnecting user
      const replayedCount = await this.eventReplayService.replayMissedEvents(client.id, user.sub);
      if (replayedCount > 0) {
        this.logger.log(`Replayed ${replayedCount} missed events for user ${user.username}`);
      }

    } catch (error) {
      this.logger.error(`Connection failed for socket ${client.id}: ${error.message}`);
      client.disconnect(true);
    }
  }

  /**
   * Handle client disconnections
   * Cleans up user session and room memberships
   */
  async handleDisconnect(client: Socket) {
    const connection = this.connectedUsers.get(client.id);

    if (connection) {
      this.logger.log(`User ${connection.userId} disconnected (socket: ${client.id})`);

      // Leave all rooms
      for (const room of connection.rooms) {
        await client.leave(room);
      }

      // Emit disconnection event
      const disconnectionEvent = createUserActivityEvent(
        WebSocketEventType.USER_LEFT,
        connection.userId,
        {
          username: client.data.user?.username || 'Unknown',
          activity: 'Disconnected from WebSocket',
        }
      );

      // Broadcast to rooms the user was in
      for (const room of connection.rooms) {
        this.server.to(room).emit('event', disconnectionEvent);
      }

      // Clean up user channels
      await this.userChannelsService.cleanupUserChannels(connection.userId);

      // Clean up connection tracking
      this.connectedUsers.delete(client.id);

      // Record disconnection for event replay tracking
      await this.eventReplayService.recordDisconnection(client.id);
    }

    // Unregister from connection manager
    this.connectionManager.unregisterConnection(client.id);
  }

  /**
   * Handle room join requests
   * Validates room permissions and adds client to room
   */
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; roomType: WebSocketRoomType }
  ) {
    try {
      const user = client.data.user as JWTPayload;
      const { room, roomType } = data;

      this.logger.log(`User ${user.username} requesting to join room: ${room} (${roomType})`);

      // Validate room access permissions
      const hasAccess = await this.validateRoomAccess(user, room, roomType);
      if (!hasAccess) {
        client.emit('error', {
          error: 'Insufficient permissions to join room',
          code: 'ROOM_ACCESS_DENIED',
        });
        return;
      }

      // Join the room
      await client.join(room);
      this.addUserToRoom(client.id, room);
      this.connectionManager.addToRoom(client.id, room);

      // Notify room members
      const joinEvent = createUserActivityEvent(
        WebSocketEventType.USER_JOINED,
        user.sub,
        {
          username: user.username,
          activity: `Joined ${roomType} room`,
          targetId: room,
          targetType: roomType === WebSocketRoomType.TASK ? 'task' : 
                     roomType === WebSocketRoomType.PROJECT ? 'project' : 'user',
        },
        room,
        roomType
      );

      this.server.to(room).emit('event', joinEvent);

      // Send acknowledgment
      client.emit('room-joined', {
        success: true,
        room,
        roomType,
        message: `Successfully joined ${roomType} room`,
      });

      this.logger.log(`User ${user.username} successfully joined room: ${room}`);

    } catch (error) {
      this.logger.error(`Failed to join room: ${error.message}`);
      client.emit('error', {
        error: 'Failed to join room',
        code: 'ROOM_JOIN_FAILED',
      });
    }
  }

  /**
   * Handle room leave requests
   */
  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; roomType: WebSocketRoomType }
  ) {
    try {
      const user = client.data.user as JWTPayload;
      const { room, roomType } = data;

      await client.leave(room);
      this.removeUserFromRoom(client.id, room);
      this.connectionManager.removeFromRoom(client.id, room);

      // Notify room members
      const leaveEvent = createUserActivityEvent(
        WebSocketEventType.USER_LEFT,
        user.sub,
        {
          username: user.username,
          activity: `Left ${roomType} room`,
          targetId: room,
          targetType: roomType === WebSocketRoomType.TASK ? 'task' : 
                     roomType === WebSocketRoomType.PROJECT ? 'project' : 'user',
        },
        room,
        roomType
      );

      this.server.to(room).emit('event', leaveEvent);

      client.emit('room-left', {
        success: true,
        room,
        roomType,
        message: `Successfully left ${roomType} room`,
      });

      this.logger.log(`User ${user.username} left room: ${room}`);

    } catch (error) {
      this.logger.error(`Failed to leave room: ${error.message}`);
      client.emit('error', {
        error: 'Failed to leave room',
        code: 'ROOM_LEAVE_FAILED',
      });
    }
  }

  /**
   * Handle typing indicators
   */
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; targetId?: string }
  ) {
    const user = client.data.user as JWTPayload;
    const { room, targetId } = data;

    const typingEvent = createUserActivityEvent(
      WebSocketEventType.USER_TYPING,
      user.sub,
      {
        username: user.username,
        activity: 'Started typing',
        targetId,
        targetType: 'task',
      },
      room
    );

    // Broadcast to room except sender
    client.to(room).emit('event', typingEvent);
  }

  /**
   * Handle stopped typing indicators
   */
  @SubscribeMessage('stopped-typing')
  async handleStoppedTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; targetId?: string }
  ) {
    const user = client.data.user as JWTPayload;
    const { room, targetId } = data;

    const stoppedTypingEvent = createUserActivityEvent(
      WebSocketEventType.USER_STOPPED_TYPING,
      user.sub,
      {
        username: user.username,
        activity: 'Stopped typing',
        targetId,
        targetType: 'task',
      },
      room
    );

    // Broadcast to room except sender
    client.to(room).emit('event', stoppedTypingEvent);
  }

  /**
   * Handle heartbeat/ping messages
   */
  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    client.emit('heartbeat-ack', { timestamp: new Date() });
  }


  /**
   * Public method to send notifications to specific users
   */
  sendNotificationToUser(userId: string, notification: {
    title: string;
    message: string;
    level?: NotificationLevel;
    actionUrl?: string;
    actionText?: string;
  }) {
    const userRoom = this.getUserRoom(userId);
    const notificationEvent = createNotificationEvent(
      userId,
      {
        title: notification.title,
        message: notification.message,
        level: notification.level || NotificationLevel.INFO,
        actionUrl: notification.actionUrl,
        actionText: notification.actionText,
      },
      userRoom,
      WebSocketRoomType.USER
    );

    this.emitToRoom(userRoom, notificationEvent);
  }

  /**
   * Public method to broadcast events to all connected clients
   */
  broadcast(event: WebSocketEvent) {
    try {
      const validatedEvent = validateWebSocketEvent(event);
      this.server.emit('event', validatedEvent);
      this.logger.debug(`Event broadcasted globally: ${event.eventType}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast event: ${error.message}`);
    }
  }

  /**
   * Private method to authenticate WebSocket connections using JWT
   */
  private async authenticateSocket(socket: Socket): Promise<void> {
    const token = socket.handshake.auth?.token || 
                 socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const payload = this.jwtService.verify(token) as JWTPayload;
      socket.data.user = payload;
      
      this.logger.debug(`Socket ${socket.id} authenticated for user ${payload.username}`);
    } catch (error) {
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  /**
   * Private method to validate room access permissions
   */
  private async validateRoomAccess(
    user: JWTPayload, 
    room: string, 
    roomType: WebSocketRoomType
  ): Promise<boolean> {
    switch (roomType) {
      case WebSocketRoomType.USER:
        // Users can only join their own user room
        return room === this.getUserRoom(user.sub);
      
      case WebSocketRoomType.GLOBAL:
        // All authenticated users can join global room
        return true;
      
      case WebSocketRoomType.PROJECT:
        // TODO: Implement project-specific permission checking
        // For now, allow all authenticated users
        return true;
      
      case WebSocketRoomType.TASK:
        // TODO: Implement task-specific permission checking
        // For now, allow all authenticated users
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Helper method to generate user-specific room names
   */
  getUserRoom(userId: string): string {
    return `user:${userId}`;
  }

  /**
   * Helper method to generate project-specific room names
   */
  getProjectRoom(projectId: string): string {
    return `project:${projectId}`;
  }

  /**
   * Helper method to generate task-specific room names
   */
  getTaskRoom(taskId: string): string {
    return `task:${taskId}`;
  }

  /**
   * Helper method to generate global room name for system-wide events
   */
  getGlobalRoom(): string {
    return `global:system`;
  }

  /**
   * Helper method to track user room memberships
   */
  private addUserToRoom(socketId: string, room: string) {
    const connection = this.connectedUsers.get(socketId);
    if (connection) {
      connection.rooms.add(room);
    }
  }

  /**
   * Helper method to remove user from room tracking
   */
  private removeUserFromRoom(socketId: string, room: string) {
    const connection = this.connectedUsers.get(socketId);
    if (connection) {
      connection.rooms.delete(room);
    }
  }

  /**
   * Get connected users count for monitoring
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Alias for getConnectedUsersCount for compatibility
   */
  getConnectionCount(): number {
    return this.getConnectedUsersCount();
  }

  /**
   * Get connection statistics for monitoring
   */
  getConnectionStats(): Record<string, any> {
    const roomStats: Record<string, number> = {};

    for (const connection of this.connectedUsers.values()) {
      for (const room of connection.rooms) {
        roomStats[room] = (roomStats[room] || 0) + 1;
      }
    }

    return {
      totalConnections: this.connectedUsers.size,
      roomStats,
      timestamp: new Date(),
    };
  }

  /**
   * Helper method to generate admin room name
   */
  getAdminRoom(): string {
    return 'admin:system';
  }

  /**
   * Get connected users by room for debugging
   */
  getUsersByRoom(room: string): string[] {
    const users: string[] = [];
    for (const [socketId, connection] of this.connectedUsers) {
      if (connection.rooms.has(room)) {
        users.push(connection.userId);
      }
    }
    return users;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    for (const connection of this.connectedUsers.values()) {
      if (connection.userId === userId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get detailed connection pool statistics from connection manager
   */
  getDetailedConnectionStats() {
    return this.connectionManager.getPoolStats();
  }

  /**
   * Get connection manager scaling configuration
   */
  getScalingConfiguration() {
    return this.connectionManager.getScalingConfig();
  }

  /**
   * Update connection manager scaling configuration
   */
  updateScalingConfiguration(updates: any) {
    return this.connectionManager.updateScalingConfig(updates);
  }

  /**
   * Check if the gateway can accept new connections
   */
  canAcceptNewConnections(): boolean {
    return this.connectionManager.canAcceptConnections();
  }

  /**
   * Get connections for a specific room using connection manager
   */
  getConnectionsInRoom(room: string) {
    return this.connectionManager.getRoomConnections(room);
  }

  /**
   * Get all connections for a specific user using connection manager
   */
  getUserConnectionDetails(userId: string) {
    return this.connectionManager.getUserConnections(userId);
  }

  /**
   * Emit event to all clients in a specific room
   * Used by event services for real-time broadcasting
   */
  emitToRoom(room: string, event: WebSocketEvent | any) {
    try {
      if (event.eventType) {
        // It's a WebSocket event, validate it
        const validatedEvent = validateWebSocketEvent(event);
        this.server.to(room).emit('event', validatedEvent);
        this.logger.debug(`Event emitted to room ${room}: ${event.eventType}`);
      } else {
        // It's a raw event (like batched events), emit directly
        this.server.to(room).emit('event', event);
        this.logger.debug(`Raw event emitted to room ${room}`);
      }
    } catch (error) {
      this.logger.error(`Failed to emit to room ${room}: ${error.message}`);
    }
  }

  /**
   * Emit event directly to a specific socket connection
   * Used for event replay and targeted messages
   */
  emitToSocket(socketId: string, event: WebSocketEvent) {
    try {
      const validatedEvent = validateWebSocketEvent(event);
      const socket = this.server.sockets.sockets.get(socketId);

      if (socket && socket.connected) {
        socket.emit('event', validatedEvent);
        this.logger.debug(`Event emitted to socket ${socketId}: ${event.eventType}`);
      } else {
        this.logger.warn(`Socket not found or disconnected: ${socketId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to emit to socket ${socketId}: ${error.message}`);
    }
  }
}