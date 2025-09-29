import { Injectable, Logger } from '@nestjs/common';
import {
  WebSocketEventType,
  WebSocketRoomType,
  createTaskEvent,
  TaskEventData,
  WebSocketEvent
} from '../websocket-events.schemas';
import { TaskBase, TaskStatus } from '../../schemas/task.schemas';
import { WebSocketGateway } from '../websocket.gateway';

/**
 * Task Events Service
 *
 * Implements real-time event emission for task lifecycle changes following SOLID principles:
 *
 * 1. Single Responsibility Principle:
 *    - Focuses solely on task-related event broadcasting
 *    - Delegates event validation to existing schemas
 *    - Delegates event emission to WebSocket gateway
 *
 * 2. Open/Closed Principle:
 *    - Extensible for new task event types without modification
 *    - Event filtering logic can be extended independently
 *
 * 3. Dependency Inversion Principle:
 *    - Depends on WebSocketGateway abstraction for emission
 *    - Uses validated event schemas for type safety
 *
 * 4. Interface Segregation Principle:
 *    - Provides focused task event interface
 *    - Separate methods for different event types
 *
 * Key Features:
 * - Task lifecycle event emission (create, update, delete, status changes)
 * - Permission-based event filtering for user privacy
 * - Room-based broadcasting (task rooms, project rooms, user rooms)
 * - High-frequency event batching for performance
 * - Event ordering preservation for data consistency
 * - Comprehensive logging for debugging and monitoring
 */
@Injectable()
export class TaskEventsService {
  private readonly logger = new Logger(TaskEventsService.name);

  // Event batching for high-frequency scenarios
  private eventQueue: Array<{ event: WebSocketEvent; rooms: string[] }> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY_MS = 100; // 100ms batching window
  private readonly MAX_BATCH_SIZE = 50;

  constructor(
    private readonly webSocketGateway: WebSocketGateway
  ) {}

  /**
   * Emit task creation event to relevant rooms
   *
   * @param task Created task data
   * @param createdById ID of user who created the task
   */
  async emitTaskCreated(task: TaskBase, createdById: string): Promise<void> {
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
        createdById,
        taskEventData,
        this.webSocketGateway.getTaskRoom(task.id),
        WebSocketRoomType.TASK
      );

      const rooms = this.determineEventRooms(task, createdById);
      await this.emitToRoomsWithFiltering(event, rooms, task);

      this.logger.debug(`Task created event emitted for task ${task.id} to ${rooms.length} rooms`);
    } catch (error) {
      this.logger.error(`Failed to emit task created event for task ${task.id}: ${error.message}`);
    }
  }

  /**
   * Emit task update event to relevant rooms
   *
   * @param task Updated task data
   * @param previousTask Previous task state for change tracking
   * @param updatedById ID of user who updated the task
   */
  async emitTaskUpdated(task: TaskBase, previousTask: TaskBase, updatedById: string): Promise<void> {
    try {
      // Calculate what changed for efficient updates
      const changes = this.calculateTaskChanges(previousTask, task);

      const taskEventData: TaskEventData = {
        taskId: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        projectId: task.projectId,
        changes,
      };

      const event = createTaskEvent(
        WebSocketEventType.TASK_UPDATED,
        updatedById,
        taskEventData,
        this.webSocketGateway.getTaskRoom(task.id),
        WebSocketRoomType.TASK
      );

      const rooms = this.determineEventRooms(task, updatedById);
      await this.emitToRoomsWithFiltering(event, rooms, task);

      this.logger.debug(`Task updated event emitted for task ${task.id} to ${rooms.length} rooms`);
    } catch (error) {
      this.logger.error(`Failed to emit task updated event for task ${task.id}: ${error.message}`);
    }
  }

  /**
   * Emit task status change event to relevant rooms
   *
   * @param task Task with new status
   * @param previousStatus Previous task status
   * @param changedById ID of user who changed the status
   */
  async emitTaskStatusChanged(task: TaskBase, previousStatus: TaskStatus, changedById: string): Promise<void> {
    try {
      const taskEventData: TaskEventData = {
        taskId: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        projectId: task.projectId,
        previousStatus,
      };

      const event = createTaskEvent(
        WebSocketEventType.TASK_STATUS_CHANGED,
        changedById,
        taskEventData,
        this.webSocketGateway.getTaskRoom(task.id),
        WebSocketRoomType.TASK
      );

      const rooms = this.determineEventRooms(task, changedById);
      await this.emitToRoomsWithFiltering(event, rooms, task);

      this.logger.debug(`Task status changed event emitted for task ${task.id}: ${previousStatus} → ${task.status}`);
    } catch (error) {
      this.logger.error(`Failed to emit task status changed event for task ${task.id}: ${error.message}`);
    }
  }

  /**
   * Emit task assignment event to relevant rooms
   *
   * @param task Task that was assigned
   * @param previousAssigneeId Previous assignee ID (if any)
   * @param assignedById ID of user who made the assignment
   */
  async emitTaskAssigned(task: TaskBase, previousAssigneeId: string | null, assignedById: string): Promise<void> {
    try {
      if (!task.assigneeId) {
        // Task was unassigned
        return this.emitTaskUnassigned(task, previousAssigneeId!, assignedById);
      }

      const taskEventData: TaskEventData = {
        taskId: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        projectId: task.projectId,
      };

      const event = createTaskEvent(
        WebSocketEventType.TASK_ASSIGNED,
        assignedById,
        taskEventData,
        this.webSocketGateway.getTaskRoom(task.id),
        WebSocketRoomType.TASK
      );

      const rooms = this.determineEventRooms(task, assignedById);

      // Include previous assignee's room if there was one
      if (previousAssigneeId && previousAssigneeId !== task.assigneeId) {
        rooms.push(this.webSocketGateway.getUserRoom(previousAssigneeId));
      }

      await this.emitToRoomsWithFiltering(event, rooms, task);

      this.logger.debug(`Task assigned event emitted for task ${task.id}: ${previousAssigneeId || 'unassigned'} → ${task.assigneeId}`);
    } catch (error) {
      this.logger.error(`Failed to emit task assigned event for task ${task.id}: ${error.message}`);
    }
  }

  /**
   * Emit task deletion event to relevant rooms
   *
   * @param task Task that was deleted
   * @param deletedById ID of user who deleted the task
   */
  async emitTaskDeleted(task: TaskBase, deletedById: string): Promise<void> {
    try {
      const taskEventData: TaskEventData = {
        taskId: task.id,
        title: task.title,
      };

      const event = createTaskEvent(
        WebSocketEventType.TASK_DELETED,
        deletedById,
        taskEventData,
        this.webSocketGateway.getTaskRoom(task.id),
        WebSocketRoomType.TASK
      );

      const rooms = this.determineEventRooms(task, deletedById);
      await this.emitToRoomsWithFiltering(event, rooms, task);

      this.logger.debug(`Task deleted event emitted for task ${task.id} to ${rooms.length} rooms`);
    } catch (error) {
      this.logger.error(`Failed to emit task deleted event for task ${task.id}: ${error.message}`);
    }
  }

  /**
   * Emit task comment added event to relevant rooms
   *
   * @param task Task that received a comment
   * @param commentId ID of the new comment
   * @param commentContent Content of the comment
   * @param authorId ID of comment author
   */
  async emitTaskCommentAdded(
    task: TaskBase,
    commentId: string,
    commentContent: string,
    authorId: string
  ): Promise<void> {
    try {
      const taskEventData = {
        taskId: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        projectId: task.projectId,
        commentId,
        commentContent: commentContent.length > 100 ?
          `${commentContent.substring(0, 97)}...` : commentContent, // Truncate for event
        authorId,
      };

      const event = createTaskEvent(
        WebSocketEventType.TASK_COMMENT_ADDED,
        authorId,
        taskEventData,
        this.webSocketGateway.getTaskRoom(task.id),
        WebSocketRoomType.TASK
      );

      const rooms = this.determineEventRooms(task, authorId);
      await this.emitToRoomsWithFiltering(event, rooms, task);

      this.logger.debug(`Task comment added event emitted for task ${task.id}`);
    } catch (error) {
      this.logger.error(`Failed to emit task comment added event for task ${task.id}: ${error.message}`);
    }
  }

  /**
   * Emit multiple task events efficiently using batching
   *
   * @param events Array of task events to emit
   */
  async emitBatchTaskEvents(events: Array<{
    type: WebSocketEventType;
    task: TaskBase;
    userId: string;
    additionalData?: Record<string, any>;
  }>): Promise<void> {
    try {
      for (const eventData of events) {
        const { type, task, userId, additionalData = {} } = eventData;

        const taskEventData: TaskEventData = {
          taskId: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          assigneeId: task.assigneeId,
          projectId: task.projectId,
          ...additionalData,
        };

        const event = createTaskEvent(
          type,
          userId,
          taskEventData,
          this.webSocketGateway.getTaskRoom(task.id),
          WebSocketRoomType.TASK
        );

        const rooms = this.determineEventRooms(task, userId);
        this.queueEventForBatch(event, rooms);
      }

      await this.flushBatchedEvents();
      this.logger.debug(`Batch emitted ${events.length} task events`);
    } catch (error) {
      this.logger.error(`Failed to emit batch task events: ${error.message}`);
    }
  }

  /**
   * Determine which rooms should receive the event based on task data and permissions
   *
   * @private
   */
  private determineEventRooms(task: TaskBase, actorUserId: string): string[] {
    const rooms: Set<string> = new Set();

    // Task-specific room - all users interested in this specific task
    rooms.add(this.webSocketGateway.getTaskRoom(task.id));

    // Project room - if task belongs to a project
    if (task.projectId) {
      rooms.add(this.webSocketGateway.getProjectRoom(task.projectId));
    }

    // User rooms for relevant users
    // Creator's room
    if (task.createdById) {
      rooms.add(this.webSocketGateway.getUserRoom(task.createdById));
    }

    // Assignee's room
    if (task.assigneeId) {
      rooms.add(this.webSocketGateway.getUserRoom(task.assigneeId));
    }

    // Actor's room (if different from creator/assignee)
    if (actorUserId !== task.createdById && actorUserId !== task.assigneeId) {
      rooms.add(this.webSocketGateway.getUserRoom(actorUserId));
    }

    return Array.from(rooms);
  }

  /**
   * Emit event to multiple rooms with permission filtering
   *
   * @private
   */
  private async emitToRoomsWithFiltering(event: WebSocketEvent, rooms: string[], task: TaskBase): Promise<void> {
    for (const room of rooms) {
      // Apply permission filtering based on room type
      if (await this.hasRoomPermission(room, task)) {
        this.webSocketGateway.emitToRoom(room, event);
      }
    }
  }

  /**
   * Check if a room has permission to receive events for this task
   *
   * @private
   */
  private async hasRoomPermission(room: string, task: TaskBase): Promise<boolean> {
    // For now, implement basic permission logic
    // In a full implementation, you would check user permissions against the task

    // Task rooms - only accessible to users with task access
    if (room.startsWith('task:')) {
      return true; // For now, allow all task room access
    }

    // Project rooms - only accessible to project members
    if (room.startsWith('project:')) {
      return true; // For now, allow all project room access
    }

    // User rooms - always accessible to the user themselves
    if (room.startsWith('user:')) {
      return true;
    }

    return false;
  }

  /**
   * Calculate changes between previous and current task state
   *
   * @private
   */
  private calculateTaskChanges(previousTask: TaskBase, currentTask: TaskBase): Record<string, any> {
    const changes: Record<string, any> = {};

    // Compare significant fields
    const fieldsToTrack = [
      'title', 'description', 'status', 'priority', 'assigneeId',
      'dueDate', 'startDate', 'estimatedHours', 'actualHours', 'category'
    ];

    for (const field of fieldsToTrack) {
      const previousValue = (previousTask as any)[field];
      const currentValue = (currentTask as any)[field];

      if (previousValue !== currentValue) {
        changes[field] = {
          from: previousValue,
          to: currentValue,
        };
      }
    }

    return changes;
  }

  /**
   * Handle task unassignment event
   *
   * @private
   */
  private async emitTaskUnassigned(task: TaskBase, previousAssigneeId: string, unassignedById: string): Promise<void> {
    const taskEventData: TaskEventData = {
      taskId: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      assigneeId: null,
      projectId: task.projectId,
    };

    const event = createTaskEvent(
      WebSocketEventType.TASK_ASSIGNED, // Use same event type, null assigneeId indicates unassignment
      unassignedById,
      taskEventData,
      this.webSocketGateway.getTaskRoom(task.id),
      WebSocketRoomType.TASK
    );

    const rooms = this.determineEventRooms(task, unassignedById);
    // Include previous assignee's room
    rooms.push(this.webSocketGateway.getUserRoom(previousAssigneeId));

    await this.emitToRoomsWithFiltering(event, rooms, task);
  }

  /**
   * Queue event for batch processing
   *
   * @private
   */
  private queueEventForBatch(event: WebSocketEvent, rooms: string[]): void {
    this.eventQueue.push({ event, rooms });

    if (this.eventQueue.length >= this.MAX_BATCH_SIZE) {
      this.flushBatchedEvents();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatchedEvents();
      }, this.BATCH_DELAY_MS);
    }
  }

  /**
   * Flush batched events to their respective rooms
   *
   * @private
   */
  private async flushBatchedEvents(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.eventQueue.length === 0) {
      return;
    }

    const eventsToProcess = [...this.eventQueue];
    this.eventQueue = [];

    try {
      for (const { event, rooms } of eventsToProcess) {
        for (const room of rooms) {
          this.webSocketGateway.emitToRoom(room, event);
        }
      }

      this.logger.debug(`Flushed ${eventsToProcess.length} batched events`);
    } catch (error) {
      this.logger.error(`Failed to flush batched events: ${error.message}`);
    }
  }

  /**
   * Get event queue status for monitoring
   */
  getEventQueueStatus(): { queueSize: number; hasPendingBatch: boolean } {
    return {
      queueSize: this.eventQueue.length,
      hasPendingBatch: this.batchTimer !== null,
    };
  }
}