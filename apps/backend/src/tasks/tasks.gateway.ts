import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWTPayload } from '@schemas/auth';

/**
 * TasksGateway - WebSocket Gateway for Task Events
 *
 * Implements real-time task updates via WebSocket following SOLID principles:
 *
 * 1. Single Responsibility Principle:
 *    - Focuses solely on task-related WebSocket communication
 *    - Delegates authentication to JwtService
 *    - Delegates event emission to TaskEventsService
 *
 * 2. Open/Closed Principle:
 *    - Extensible for new task event types without modification
 *    - Event handler methods can be added independently
 *
 * 3. Dependency Inversion Principle:
 *    - Depends on JwtService abstraction for authentication
 *    - Uses Socket.IO server abstraction
 *
 * Key Features:
 * - JWT authentication for WebSocket connections
 * - Task-specific namespace for isolation
 * - Real-time event broadcasting (task:created, task:updated, task:deleted)
 * - Connection lifecycle management
 * - Room-based targeting for efficient message delivery
 */
@Injectable()
@WSGateway({
  namespace: 'tasks',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class TasksGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TasksGateway.name);
  private connectedClients = new Map<string, { userId: string; socket: Socket }>();

  constructor(
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Initialize WebSocket gateway with logging
   */
  afterInit(server: Server): void {
    this.logger.log('TasksGateway initialized on namespace: /tasks');
    this.server = server;
  }

  /**
   * Handle new client connections
   * Authenticates the socket and sets up user session
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      this.logger.log(`Client attempting connection to tasks namespace: ${client.id}`);

      // Authenticate the socket connection
      await this.authenticateSocket(client);
      const user = client.data.user as JWTPayload;

      // Store connection information
      this.connectedClients.set(client.id, {
        userId: user.sub,
        socket: client,
      });

      // Join user-specific room for targeted task updates
      const userRoom = this.getUserRoom(user.sub);
      await client.join(userRoom);

      this.logger.log(`User ${user.username} (${user.sub}) connected to tasks namespace with socket ${client.id}`);

      // Send connection acknowledgment
      client.emit('connection:success', {
        message: 'Successfully connected to task updates',
        userId: user.sub,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Connection failed for socket ${client.id}: ${error.message}`);
      client.emit('connection:error', {
        error: 'Authentication failed',
        message: error.message,
      });
      client.disconnect(true);
    }
  }

  /**
   * Handle client disconnections
   * Cleans up user session and room memberships
   */
  async handleDisconnect(client: Socket): Promise<void> {
    const connection = this.connectedClients.get(client.id);

    if (connection) {
      this.logger.log(`User ${connection.userId} disconnected from tasks namespace (socket: ${client.id})`);
      this.connectedClients.delete(client.id);
    } else {
      this.logger.log(`Unknown client disconnected: ${client.id}`);
    }
  }

  /**
   * Handle task subscription requests
   * Allows clients to subscribe to specific task updates
   */
  @SubscribeMessage('task:subscribe')
  async handleSubscribeToTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string }
  ): Promise<void> {
    try {
      const user = client.data.user as JWTPayload;
      const { taskId } = data;

      if (!taskId) {
        client.emit('error', {
          error: 'Task ID is required',
          code: 'INVALID_TASK_ID',
        });
        return;
      }

      // Join task-specific room
      const taskRoom = this.getTaskRoom(taskId);
      await client.join(taskRoom);

      this.logger.log(`User ${user.username} subscribed to task: ${taskId}`);

      client.emit('task:subscribed', {
        success: true,
        taskId,
        message: `Successfully subscribed to task ${taskId}`,
      });

    } catch (error) {
      this.logger.error(`Failed to subscribe to task: ${error.message}`);
      client.emit('error', {
        error: 'Failed to subscribe to task',
        code: 'SUBSCRIPTION_FAILED',
        message: error.message,
      });
    }
  }

  /**
   * Handle task unsubscription requests
   * Allows clients to unsubscribe from specific task updates
   */
  @SubscribeMessage('task:unsubscribe')
  async handleUnsubscribeFromTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string }
  ): Promise<void> {
    try {
      const user = client.data.user as JWTPayload;
      const { taskId } = data;

      if (!taskId) {
        client.emit('error', {
          error: 'Task ID is required',
          code: 'INVALID_TASK_ID',
        });
        return;
      }

      // Leave task-specific room
      const taskRoom = this.getTaskRoom(taskId);
      await client.leave(taskRoom);

      this.logger.log(`User ${user.username} unsubscribed from task: ${taskId}`);

      client.emit('task:unsubscribed', {
        success: true,
        taskId,
        message: `Successfully unsubscribed from task ${taskId}`,
      });

    } catch (error) {
      this.logger.error(`Failed to unsubscribe from task: ${error.message}`);
      client.emit('error', {
        error: 'Failed to unsubscribe from task',
        code: 'UNSUBSCRIPTION_FAILED',
        message: error.message,
      });
    }
  }

  /**
   * Emit task creation event to relevant clients
   *
   * @param task Created task data
   */
  emitTaskCreated(task: any): void {
    try {
      const event = {
        eventType: 'task:created',
        task,
        timestamp: new Date().toISOString(),
      };

      // Emit to task room
      const taskRoom = this.getTaskRoom(task.id);
      this.server.to(taskRoom).emit('task:created', event);

      // Emit to creator's room
      if (task.createdById) {
        const userRoom = this.getUserRoom(task.createdById);
        this.server.to(userRoom).emit('task:created', event);
      }

      // Emit to assignee's room if assigned
      if (task.assigneeId && task.assigneeId !== task.createdById) {
        const assigneeRoom = this.getUserRoom(task.assigneeId);
        this.server.to(assigneeRoom).emit('task:created', event);
      }

      this.logger.debug(`Task created event emitted for task ${task.id}`);
    } catch (error) {
      this.logger.error(`Failed to emit task created event: ${error.message}`);
    }
  }

  /**
   * Emit task update event to relevant clients
   *
   * @param task Updated task data
   */
  emitTaskUpdated(task: any): void {
    try {
      const event = {
        eventType: 'task:updated',
        task,
        timestamp: new Date().toISOString(),
      };

      // Emit to task room
      const taskRoom = this.getTaskRoom(task.id);
      this.server.to(taskRoom).emit('task:updated', event);

      // Emit to creator's room
      if (task.createdById) {
        const userRoom = this.getUserRoom(task.createdById);
        this.server.to(userRoom).emit('task:updated', event);
      }

      // Emit to assignee's room if assigned
      if (task.assigneeId && task.assigneeId !== task.createdById) {
        const assigneeRoom = this.getUserRoom(task.assigneeId);
        this.server.to(assigneeRoom).emit('task:updated', event);
      }

      this.logger.debug(`Task updated event emitted for task ${task.id}`);
    } catch (error) {
      this.logger.error(`Failed to emit task updated event: ${error.message}`);
    }
  }

  /**
   * Emit task deletion event to relevant clients
   *
   * @param taskId Deleted task ID
   */
  emitTaskDeleted(taskId: string): void {
    try {
      const event = {
        eventType: 'task:deleted',
        taskId,
        timestamp: new Date().toISOString(),
      };

      // Emit to task room
      const taskRoom = this.getTaskRoom(taskId);
      this.server.to(taskRoom).emit('task:deleted', event);

      this.logger.debug(`Task deleted event emitted for task ${taskId}`);
    } catch (error) {
      this.logger.error(`Failed to emit task deleted event: ${error.message}`);
    }
  }

  /**
   * Authenticate WebSocket connection using JWT
   *
   * @private
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
   * Helper method to generate user-specific room names
   *
   * @private
   */
  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }

  /**
   * Helper method to generate task-specific room names
   *
   * @private
   */
  private getTaskRoom(taskId: string): string {
    return `task:${taskId}`;
  }

  /**
   * Get connected clients count for monitoring
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get connection statistics for monitoring
   */
  getConnectionStats(): { totalConnections: number; timestamp: Date } {
    return {
      totalConnections: this.connectedClients.size,
      timestamp: new Date(),
    };
  }
}
