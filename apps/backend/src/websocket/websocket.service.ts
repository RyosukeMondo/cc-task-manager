import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';
import {
  WebSocketEventType,
  WebSocketRoomType,
  createTaskEvent,
  createNotificationEvent,
  createUserActivityEvent,
  TaskEventData,
  NotificationEventData,
  UserActivityEventData,
  NotificationLevel,
} from './websocket-events.schemas';
import { TaskBase, TaskStatus } from '../schemas/task.schemas';

/**
 * WebSocket Service for business logic coordination
 * 
 * This service demonstrates SOLID principles:
 * 1. Single Responsibility Principle - coordinates WebSocket business logic
 * 2. Open/Closed Principle - extensible for new event types and integrations
 * 3. Dependency Inversion Principle - depends on WebSocketGateway abstraction
 * 
 * Responsibilities:
 * - Coordinate between WebSocket gateway and business services
 * - Transform domain events into WebSocket events
 * - Manage room-based messaging logic
 * - Handle complex event orchestration
 */
@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);

  constructor(private readonly gateway: WebSocketGateway) {}

  /**
   * Handle task-related events and broadcast to relevant rooms
   */
  async handleTaskCreated(task: TaskBase, createdByUserId: string) {
    try {
      const taskEventData: TaskEventData = {
        taskId: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        projectId: task.projectId,
      };

      const event = createTaskEvent(
        WebSocketEventType.TASK_CREATED,
        createdByUserId,
        taskEventData
      );

      // Broadcast to relevant rooms
      await this.broadcastTaskEvent(task, event);

      // Send notification to assignee if different from creator
      if (task.assigneeId && task.assigneeId !== createdByUserId) {
        this.gateway.sendNotificationToUser(task.assigneeId, {
          title: 'New Task Assigned',
          message: `You have been assigned a new task: "${task.title}"`,
          level: NotificationLevel.INFO,
          actionUrl: `/tasks/${task.id}`,
          actionText: 'View Task',
        });
      }

      this.logger.log(`Task created event broadcast for task ${task.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle task created event: ${error.message}`);
    }
  }

  /**
   * Handle task update events
   */
  async handleTaskUpdated(
    previousTask: TaskBase,
    updatedTask: TaskBase,
    updatedByUserId: string,
    changes: Record<string, any>
  ) {
    try {
      const taskEventData: TaskEventData = {
        taskId: updatedTask.id,
        title: updatedTask.title,
        status: updatedTask.status,
        priority: updatedTask.priority,
        assigneeId: updatedTask.assigneeId,
        projectId: updatedTask.projectId,
        changes,
      };

      const event = createTaskEvent(
        WebSocketEventType.TASK_UPDATED,
        updatedByUserId,
        taskEventData
      );

      // Broadcast to relevant rooms
      await this.broadcastTaskEvent(updatedTask, event);

      // Handle specific change notifications
      await this.handleTaskChangeNotifications(
        previousTask,
        updatedTask,
        updatedByUserId,
        changes
      );

      this.logger.log(`Task updated event broadcast for task ${updatedTask.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle task updated event: ${error.message}`);
    }
  }

  /**
   * Get WebSocket gateway statistics
   */
  getStatistics() {
    return {
      connectedUsers: this.gateway.getConnectedUsersCount(),
      timestamp: new Date(),
    };
  }

  /**
   * Private method to broadcast task events to relevant rooms
   */
  private async broadcastTaskEvent(task: TaskBase, event: any) {
    // Always broadcast to task-specific room
    const taskRoom = this.gateway.getTaskRoom(task.id);
    this.gateway.emitToRoom(taskRoom, event);

    // Broadcast to project room if task belongs to a project
    if (task.projectId) {
      const projectRoom = this.gateway.getProjectRoom(task.projectId);
      this.gateway.emitToRoom(projectRoom, event);
    }

    // Broadcast to assignee's personal room
    if (task.assigneeId) {
      const assigneeRoom = this.getUserRoom(task.assigneeId);
      this.gateway.emitToRoom(assigneeRoom, event);
    }

    // Broadcast to creator's personal room
    const creatorRoom = this.getUserRoom(task.createdById);
    this.gateway.emitToRoom(creatorRoom, event);
  }

  /**
   * Private method to handle task change notifications
   */
  private async handleTaskChangeNotifications(
    previousTask: TaskBase,
    updatedTask: TaskBase,
    updatedByUserId: string,
    changes: Record<string, any>
  ) {
    // Handle assignee changes
    if (changes.assigneeId && previousTask.assigneeId !== updatedTask.assigneeId) {
      if (updatedTask.assigneeId && updatedTask.assigneeId !== updatedByUserId) {
        this.gateway.sendNotificationToUser(updatedTask.assigneeId, {
          title: 'Task Assigned',
          message: `You have been assigned to task: "${updatedTask.title}"`,
          level: NotificationLevel.INFO,
          actionUrl: `/tasks/${updatedTask.id}`,
          actionText: 'View Task',
        });
      }
    }

    // Handle priority changes
    if (changes.priority && previousTask.priority !== updatedTask.priority) {
      if (updatedTask.assigneeId && updatedTask.assigneeId !== updatedByUserId) {
        this.gateway.sendNotificationToUser(updatedTask.assigneeId, {
          title: 'Task Priority Changed',
          message: `Priority of task "${updatedTask.title}" changed to ${updatedTask.priority}`,
          level: updatedTask.priority === 'urgent' ? NotificationLevel.WARNING : NotificationLevel.INFO,
          actionUrl: `/tasks/${updatedTask.id}`,
          actionText: 'View Task',
        });
      }
    }
  }

  /**
   * Helper method to generate user-specific room names
   */
  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }
}
