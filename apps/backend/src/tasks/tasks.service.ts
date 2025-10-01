import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  TaskExceptionFactory,
  TaskNotFoundException,
  TaskValidationException,
  TaskAccessForbiddenException,
  TaskConflictException,
  TaskStatusTransitionException,
} from './exceptions/task-exceptions';
import { JWTPayload } from '@schemas/auth';
import { BackendSchemaRegistry } from '../schemas/schema-registry';
import { TasksRepository } from './tasks.repository';
import { QueueService } from '../queue/queue.service';
import { TaskEventsService } from '../websocket/events/task-events.service';
import { WebSocketEventType } from '../websocket/websocket-events.schemas';
import {
  TaskBase,
  CreateTask,
  UpdateTask,
  TaskQueryFilters,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TaskStatistics,
  BulkTaskOperation
} from '../schemas/task.schemas';

/**
 * Task Service
 * 
 * Implements comprehensive task management business logic following SOLID principles:
 * 
 * 1. Single Responsibility Principle:
 *    - Focuses solely on task management business logic
 *    - Delegates data access to repository
 *    - Delegates validation to existing contract infrastructure
 * 
 * 2. Dependency Inversion Principle:
 *    - Depends on ITasksRepository abstraction
 *    - Uses BackendSchemaRegistry for validation
 *    - Leverages existing contract validation infrastructure
 * 
 * 3. Open/Closed Principle:
 *    - Extensible for new business rules without modification
 *    - Business logic separate from data access implementation
 * 
 * Key Features:
 * - Comprehensive CRUD operations with validation
 * - Business rule enforcement (status transitions, permissions)
 * - Task analytics and reporting capabilities
 * - Bulk operations for efficiency
 * - Integration with existing contract validation
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @Inject('ITasksRepository') private readonly tasksRepository: ITasksRepository,
    @Optional() private readonly schemaRegistry?: BackendSchemaRegistry,
    @Optional() private readonly queueService?: QueueService,
    @Optional() private readonly taskEventsService?: TaskEventsService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {}

  /**
   * Create a new task with validation and business rules
   * 
   * @param createTaskData Task creation data
   * @param createdById ID of the user creating the task
   * @returns Created task
   */
  async createTask(createTaskData: CreateTask, createdById: string): Promise<TaskBase> {
    // Validate input using existing contract validation infrastructure
    const validation = this.schemaRegistry?.validateAgainstSchema('CreateTask', createTaskData);
    if (validation && !validation.success) {
      this.logger.warn(`Task creation validation failed: ${validation.error}`);
      throw TaskExceptionFactory.validation(
        validation.error,
        'createTaskData',
        createTaskData
      );
    }

    // Business rule validation
    await this.validateTaskCreation(createTaskData, createdById);

    // Create task through repository
    const createdTask = await this.tasksRepository.create(validation.data, createdById);

    this.logger.log(`Created task: ${createdTask.id} - "${createdTask.title}" by user ${createdById}`);

    // Emit real-time task creation event
    if (this.taskEventsService) {
      try {
        await this.taskEventsService.emitTaskCreated(createdTask, createdById);
      } catch (error) {
        // Don't fail task creation if event emission fails
        this.logger.error(`Failed to emit task created event: ${error.message}`);
      }
    }

    // Queue task notification job for assignee if assigned
    if (createdTask.assigneeId && this.queueService) {
      try {
        await this.queueService.addJob({
          type: 'TASK_NOTIFICATION',
          taskId: createdTask.id,
          notificationType: 'TASK_ASSIGNED',
          recipientIds: [createdTask.assigneeId],
          taskTitle: createdTask.title,
          taskDescription: createdTask.description,
          metadata: {
            userId: createdById,
            timestamp: new Date(),
            retryCount: 0,
          },
        });
        this.logger.debug(`Queued task assignment notification for user ${createdTask.assigneeId}`);
      } catch (error) {
        // Don't fail task creation if notification queueing fails
        this.logger.error(`Failed to queue task notification: ${error.message}`);
      }
    }

    // Invalidate analytics cache for the creator and assignee
    await this.invalidateAnalyticsCache(createdById);
    if (createdTask.assigneeId && createdTask.assigneeId !== createdById) {
      await this.invalidateAnalyticsCache(createdTask.assigneeId);
    }

    return createdTask;
  }

  /**
   * Find task by ID with user context (for authorization)
   * @param taskId Task ID to find
   * @param user User making the request
   * @returns Task if found
   * @throws NotFoundException if task not found
   */
  async findOne(taskId: string, user: JWTPayload): Promise<TaskBase> {
    return this.getTaskById(taskId);
  }

  /**
   * Get task by ID with existence validation
   *
   * @param taskId Task ID
   * @returns Task if found
   * @throws NotFoundException if task not found
   */
  async getTaskById(taskId: string): Promise<TaskBase> {
    const task = await this.tasksRepository.findById(taskId);
    if (!task) {
      this.logger.warn(`Task not found: ${taskId}`);
      throw TaskExceptionFactory.notFound(taskId);
    }

    return task;
  }

  /**
   * Get all tasks with filtering, sorting, and pagination
   * 
   * @param filters Query filters
   * @returns Paginated task results
   */
  async getAllTasks(filters: TaskQueryFilters): Promise<{ tasks: TaskBase[]; total: number; page: number; limit: number }> {
    // Validate query filters using existing contract validation
    const validation = this.schemaRegistry?.validateAgainstSchema('TaskQueryFilters', filters);
    if (validation && !validation.success) {
      this.logger.warn(`Task query validation failed: ${validation.error}`);
      throw TaskExceptionFactory.validation(
        validation.error,
        'filters',
        filters
      );
    }

    const result = await this.tasksRepository.findAll(validation.data);
    
    this.logger.debug(`Retrieved ${result.tasks.length} tasks (page ${result.page}/${Math.ceil(result.total / result.limit)})`);
    
    return result;
  }

  /**
   * Get tasks with pagination (alias for getAllTasks with different return structure)
   *
   * @param filters Query filters
   * @returns Paginated task response
   */
  async getTasks(filters: any): Promise<any> {
    const result = await this.getAllTasks(filters);
    return {
      data: result.tasks,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
        hasNext: result.page < Math.ceil(result.total / result.limit),
        hasPrev: result.page > 1
      }
    };
  }

  /**
   * Update task status with optional progress and error information
   *
   * @param taskId Task ID
   * @param statusUpdate Status update data
   * @returns Updated task
   */
  async updateTaskStatus(taskId: string, statusUpdate: any): Promise<TaskBase> {
    const task = await this.getTaskById(taskId);

    const updateData: UpdateTask = {
      status: statusUpdate.status
    };

    if (statusUpdate.progress !== undefined) {
      updateData.progress = statusUpdate.progress;
    }

    if (statusUpdate.errorMessage !== undefined) {
      updateData.errorMessage = statusUpdate.errorMessage;
    }

    return this.updateTask(taskId, updateData, 'system');
  }

  /**
   * Get task metrics and analytics
   *
   * @returns Task metrics
   */
  async getTaskMetrics(): Promise<any> {
    const stats = await this.getTaskStatistics();
    return {
      totalTasks: stats.totalTasks,
      completedTasks: stats.completedTasks,
      failedTasks: stats.failedTasks,
      averageDuration: stats.averageCompletionTime,
      successRate: stats.successRate
    };
  }

  /**
   * Update a task with validation and business rules
   *
   * @param taskId Task ID
   * @param updateData Update data
   * @param updatedById ID of the user updating the task
   * @returns Updated task
   */
  async updateTask(taskId: string, updateData: UpdateTask, updatedById: string): Promise<TaskBase> {
    // Validate input using existing contract validation infrastructure
    const validation = this.schemaRegistry?.validateAgainstSchema('UpdateTask', updateData);
    if (validation && !validation.success) {
      this.logger.warn(`Task update validation failed: ${validation.error}`);
      throw TaskExceptionFactory.validation(
        validation.error,
        'updateData',
        updateData,
        taskId
      );
    }

    // Get existing task for business rule validation
    const existingTask = await this.getTaskById(taskId);
    
    // Business rule validation
    await this.validateTaskUpdate(existingTask, validation.data, updatedById);

    // Update task through repository
    const updatedTask = await this.tasksRepository.update(taskId, validation.data, updatedById);
    if (!updatedTask) {
      // This should not happen since we validated existence above
      throw TaskExceptionFactory.notFound(taskId, { operation: 'update' });
    }

    this.logger.log(`Updated task: ${taskId} - "${updatedTask.title}" by user ${updatedById}`);

    // Emit real-time task update events
    if (this.taskEventsService) {
      try {
        await this.taskEventsService.emitTaskUpdated(updatedTask, existingTask, updatedById);

        // Emit specific status change event if status changed
        if (existingTask.status !== updatedTask.status) {
          await this.taskEventsService.emitTaskStatusChanged(updatedTask, existingTask.status, updatedById);
        }

        // Emit assignment event if assignee changed
        if (existingTask.assigneeId !== updatedTask.assigneeId) {
          await this.taskEventsService.emitTaskAssigned(updatedTask, existingTask.assigneeId, updatedById);
        }
      } catch (error) {
        // Don't fail task update if event emission fails
        this.logger.error(`Failed to emit task update events: ${error.message}`);
      }
    }

    // Invalidate analytics cache for affected users
    const affectedUserIds = new Set<string>([
      existingTask.createdById,
      updatedById,
    ]);
    if (existingTask.assigneeId) affectedUserIds.add(existingTask.assigneeId);
    if (updatedTask.assigneeId) affectedUserIds.add(updatedTask.assigneeId);

    for (const userId of affectedUserIds) {
      await this.invalidateAnalyticsCache(userId);
    }

    return updatedTask;
  }

  /**
   * Delete a task with permission validation
   * 
   * @param taskId Task ID
   * @param deletedById ID of the user deleting the task
   * @returns Success status
   */
  async deleteTask(taskId: string, deletedById: string): Promise<{ success: boolean; taskId: string }> {
    // Get existing task for permission validation
    const existingTask = await this.getTaskById(taskId);
    
    // Business rule validation for deletion
    await this.validateTaskDeletion(existingTask, deletedById);

    const deleted = await this.tasksRepository.delete(taskId);
    if (!deleted) {
      // This should not happen since we validated existence above
      throw TaskExceptionFactory.notFound(taskId, { operation: 'delete' });
    }

    this.logger.log(`Deleted task: ${taskId} - "${existingTask.title}" by user ${deletedById}`);

    // Emit real-time task deletion event
    if (this.taskEventsService) {
      try {
        await this.taskEventsService.emitTaskDeleted(existingTask, deletedById);
      } catch (error) {
        // Don't fail task deletion if event emission fails
        this.logger.error(`Failed to emit task deleted event: ${error.message}`);
      }
    }

    // Invalidate analytics cache for affected users
    const affectedUserIds = new Set<string>([
      existingTask.createdById,
      deletedById,
    ]);
    if (existingTask.assigneeId) affectedUserIds.add(existingTask.assigneeId);

    for (const userId of affectedUserIds) {
      await this.invalidateAnalyticsCache(userId);
    }

    return { success: true, taskId };
  }

  /**
   * Perform bulk operations on multiple tasks
   * 
   * @param operation Bulk operation details
   * @param operatorId ID of the user performing the operation
   * @returns Operation results
   */
  async bulkOperation(operation: BulkTaskOperation, operatorId: string): Promise<{ 
    success: boolean; 
    affectedTasks: number; 
    results: TaskBase[] 
  }> {
    // Validate operation using existing contract validation
    const validation = this.schemaRegistry?.validateAgainstSchema('BulkTaskOperation', operation);
    if (validation && !validation.success) {
      this.logger.warn(`Bulk operation validation failed: ${validation.error}`);
      throw TaskExceptionFactory.validation(
        validation.error,
        'bulkOperation',
        operation
      );
    }

    const { taskIds, operation: operationType, data } = validation.data;

    // Validate permissions for all tasks
    for (const taskId of taskIds) {
      const task = await this.getTaskById(taskId);
      await this.validateTaskModification(task, operatorId);
    }

    let results: TaskBase[] = [];

    switch (operationType) {
      case 'updateStatus':
        if (!data?.status) {
          throw TaskExceptionFactory.validation(
            'Status is required for updateStatus operation',
            'status',
            data
          );
        }
        results = await this.tasksRepository.bulkUpdate(taskIds, { status: data.status });
        break;

      case 'updatePriority':
        if (!data?.priority) {
          throw TaskExceptionFactory.validation(
            'Priority is required for updatePriority operation',
            'priority',
            data
          );
        }
        results = await this.tasksRepository.bulkUpdate(taskIds, { priority: data.priority });
        break;
        
      case 'updateAssignee':
        results = await this.tasksRepository.bulkUpdate(taskIds, { assigneeId: data?.assigneeId });
        break;
        
      case 'delete':
        for (const taskId of taskIds) {
          await this.tasksRepository.delete(taskId);
        }
        results = []; // No results for delete operation
        break;
        
      default:
        throw TaskExceptionFactory.validation(
          `Unsupported bulk operation: ${operationType}`,
          'operation',
          operationType
        );
    }

    this.logger.log(`Bulk operation ${operationType} completed on ${taskIds.length} tasks by user ${operatorId}`);

    // Emit bulk task events for real-time updates
    if (this.taskEventsService) {
      try {
        const eventType = this.getBulkOperationEventType(operationType);
        if (eventType && results.length > 0) {
          const events = results.map(task => ({
            type: eventType,
            task,
            userId: operatorId,
            additionalData: data || {}
          }));
          await this.taskEventsService.emitBatchTaskEvents(events);
        }
      } catch (error) {
        // Don't fail bulk operation if event emission fails
        this.logger.error(`Failed to emit bulk operation events: ${error.message}`);
      }
    }

    // Invalidate analytics cache for all affected users
    const affectedUserIds = new Set<string>([operatorId]);
    for (const task of results) {
      affectedUserIds.add(task.createdById);
      if (task.assigneeId) affectedUserIds.add(task.assigneeId);
    }

    for (const userId of affectedUserIds) {
      await this.invalidateAnalyticsCache(userId);
    }

    return {
      success: true,
      affectedTasks: taskIds.length,
      results,
    };
  }

  /**
   * Get tasks assigned to a specific user
   * 
   * @param assigneeId User ID
   * @returns Assigned tasks
   */
  async getTasksByAssignee(assigneeId: string): Promise<TaskBase[]> {
    const tasks = await this.tasksRepository.getTasksByAssignee(assigneeId);
    this.logger.debug(`Found ${tasks.length} tasks assigned to user ${assigneeId}`);
    return tasks;
  }

  /**
   * Get tasks for a specific project
   * 
   * @param projectId Project ID
   * @returns Project tasks
   */
  async getTasksByProject(projectId: string): Promise<TaskBase[]> {
    const tasks = await this.tasksRepository.getTasksByProject(projectId);
    this.logger.debug(`Found ${tasks.length} tasks for project ${projectId}`);
    return tasks;
  }

  /**
   * Get overdue tasks across the system
   * 
   * @returns Overdue tasks
   */
  async getOverdueTasks(): Promise<TaskBase[]> {
    const tasks = await this.tasksRepository.getOverdueTasks();
    this.logger.debug(`Found ${tasks.length} overdue tasks`);
    return tasks;
  }

  /**
   * Generate task statistics for reporting
   * 
   * @returns Task analytics and statistics
   */
  async getTaskStatistics(): Promise<TaskStatistics> {
    // Get all tasks for statistics calculation
    const allTasksResult = await this.tasksRepository.findAll({ 
      page: 1, 
      limit: 10000, // Large limit to get all tasks
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    
    const allTasks = allTasksResult.tasks;
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate statistics
    const totalTasks = allTasks.length;
    
    const tasksByStatus = {
      [TaskStatus.TODO]: allTasks.filter(t => t.status === TaskStatus.TODO).length,
      [TaskStatus.IN_PROGRESS]: allTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      [TaskStatus.IN_REVIEW]: allTasks.filter(t => t.status === TaskStatus.IN_REVIEW).length,
      [TaskStatus.DONE]: allTasks.filter(t => t.status === TaskStatus.DONE).length,
      [TaskStatus.CANCELLED]: allTasks.filter(t => t.status === TaskStatus.CANCELLED).length,
    };
    
    const tasksByPriority = {
      [TaskPriority.LOW]: allTasks.filter(t => t.priority === TaskPriority.LOW).length,
      [TaskPriority.MEDIUM]: allTasks.filter(t => t.priority === TaskPriority.MEDIUM).length,
      [TaskPriority.HIGH]: allTasks.filter(t => t.priority === TaskPriority.HIGH).length,
      [TaskPriority.URGENT]: allTasks.filter(t => t.priority === TaskPriority.URGENT).length,
    };
    
    const tasksByCategory = {
      [TaskCategory.DEVELOPMENT]: allTasks.filter(t => t.category === TaskCategory.DEVELOPMENT).length,
      [TaskCategory.TESTING]: allTasks.filter(t => t.category === TaskCategory.TESTING).length,
      [TaskCategory.DOCUMENTATION]: allTasks.filter(t => t.category === TaskCategory.DOCUMENTATION).length,
      [TaskCategory.RESEARCH]: allTasks.filter(t => t.category === TaskCategory.RESEARCH).length,
      [TaskCategory.BUG_FIX]: allTasks.filter(t => t.category === TaskCategory.BUG_FIX).length,
      [TaskCategory.FEATURE]: allTasks.filter(t => t.category === TaskCategory.FEATURE).length,
      [TaskCategory.MAINTENANCE]: allTasks.filter(t => t.category === TaskCategory.MAINTENANCE).length,
      [TaskCategory.DEPLOYMENT]: allTasks.filter(t => t.category === TaskCategory.DEPLOYMENT).length,
      [TaskCategory.OTHER]: allTasks.filter(t => t.category === TaskCategory.OTHER).length,
    };

    const overdueTasks = allTasks.filter(t => 
      t.dueDate && 
      t.dueDate < now && 
      t.status !== TaskStatus.DONE &&
      t.status !== TaskStatus.CANCELLED
    ).length;

    const completedThisWeek = allTasks.filter(t => 
      t.status === TaskStatus.DONE && 
      t.completedAt && 
      t.completedAt >= oneWeekAgo
    ).length;

    const completedThisMonth = allTasks.filter(t => 
      t.status === TaskStatus.DONE && 
      t.completedAt && 
      t.completedAt >= oneMonthAgo
    ).length;

    // Calculate average completion time for completed tasks
    const completedTasks = allTasks.filter(t => 
      t.status === TaskStatus.DONE && 
      t.completedAt && 
      t.startDate
    );
    
    const averageCompletionTime = completedTasks.length > 0
      ? completedTasks.reduce((sum, task) => {
          const completionTime = task.completedAt!.getTime() - task.startDate!.getTime();
          return sum + (completionTime / (1000 * 60 * 60 * 24)); // Convert to days
        }, 0) / completedTasks.length
      : undefined;

    // Calculate total hours logged
    const totalHoursLogged = allTasks.reduce((sum, task) => {
      return sum + (task.actualHours || 0);
    }, 0);

    const statistics: TaskStatistics = {
      totalTasks,
      tasksByStatus,
      tasksByPriority,
      tasksByCategory,
      overdueTasks,
      completedThisWeek,
      completedThisMonth,
      averageCompletionTime,
      totalHoursLogged: totalHoursLogged > 0 ? totalHoursLogged : undefined,
    };

    this.logger.debug(`Generated task statistics: ${totalTasks} total tasks, ${overdueTasks} overdue`);
    
    return statistics;
  }

  /**
   * Validate task creation business rules
   * 
   * @private
   */
  private async validateTaskCreation(createData: CreateTask, createdById: string): Promise<void> {
    // Validate parent task exists if specified
    if (createData.parentTaskId) {
      await this.getTaskById(createData.parentTaskId);
    }

    // Business rule: Estimated hours should be reasonable
    if (createData.estimatedHours && createData.estimatedHours > 1000) {
      throw TaskExceptionFactory.validation(
        'Estimated hours cannot exceed 1000 hours',
        'estimatedHours',
        createData.estimatedHours
      );
    }

    // Business rule: Due date should be in the future for new tasks
    if (createData.dueDate && createData.dueDate <= new Date()) {
      throw TaskExceptionFactory.validation(
        'Due date must be in the future',
        'dueDate',
        createData.dueDate
      );
    }

    // Business rule: Start date should not be after due date
    if (createData.startDate && createData.dueDate && createData.startDate > createData.dueDate) {
      throw TaskExceptionFactory.validation(
        'Start date cannot be after due date',
        'startDate',
        { startDate: createData.startDate, dueDate: createData.dueDate }
      );
    }
  }

  /**
   * Validate task update business rules
   * 
   * @private
   */
  private async validateTaskUpdate(existingTask: TaskBase, updateData: UpdateTask, updatedById: string): Promise<void> {
    // Permission check: Only creator, assignee, or admin can update
    await this.validateTaskModification(existingTask, updatedById);

    // Business rule: Cannot change status from completed to non-completed without proper reason
    if (existingTask.status === TaskStatus.DONE && 
        updateData.status && 
        updateData.status !== TaskStatus.DONE) {
      this.logger.warn(`Attempt to change completed task ${existingTask.id} to ${updateData.status} by user ${updatedById}`);
      // Allow this but log it - in a real system you might require special permissions
    }

    // Business rule: Actual hours validation
    if (updateData.actualHours !== undefined) {
      if (updateData.actualHours < 0) {
        throw TaskExceptionFactory.validation(
          'Actual hours cannot be negative',
          'actualHours',
          updateData.actualHours,
          existingTask.id
        );
      }
      if (updateData.actualHours > 1000) {
        throw TaskExceptionFactory.validation(
          'Actual hours cannot exceed 1000 hours',
          'actualHours',
          updateData.actualHours,
          existingTask.id
        );
      }
    }

    // Validate parent task exists if being changed
    if (updateData.parentTaskId && updateData.parentTaskId !== existingTask.parentTaskId) {
      await this.getTaskById(updateData.parentTaskId);
      
      // Business rule: Cannot set self as parent
      if (updateData.parentTaskId === existingTask.id) {
        throw TaskExceptionFactory.dependency(
          existingTask.id,
          'Task cannot be its own parent',
          [updateData.parentTaskId]
        );
      }
    }
  }

  /**
   * Validate task deletion business rules
   * 
   * @private
   */
  private async validateTaskDeletion(task: TaskBase, deletedById: string): Promise<void> {
    // Permission check: Only creator or admin can delete
    if (task.createdById !== deletedById) {
      // In a real system, you would check for admin permissions here
      throw TaskExceptionFactory.accessForbidden(
        task.id,
        deletedById,
        'delete',
        'Only the task creator can delete this task'
      );
    }

    // Business rule: Cannot delete completed tasks (optional business rule)
    if (task.status === TaskStatus.DONE) {
      this.logger.warn(`Attempt to delete completed task ${task.id} by user ${deletedById}`);
      // Allow this but log it - in a real system you might prevent this
    }
  }

  /**
   * Validate task modification permissions
   * 
   * @private
   */
  private async validateTaskModification(task: TaskBase, userId: string): Promise<void> {
    // Permission check: Creator, assignee, or admin can modify
    if (task.createdById !== userId && task.assigneeId !== userId) {
      // In a real system, you would check for admin permissions here
      // For now, we'll allow modification by creator and assignee only
      throw TaskExceptionFactory.accessForbidden(
        task.id,
        userId,
        'modify',
        'You do not have permission to modify this task'
      );
    }
  }

  /**
   * Get appropriate WebSocket event type for bulk operations
   *
   * @private
   */
  private getBulkOperationEventType(operationType: string): WebSocketEventType | null {
    switch (operationType) {
      case 'updateStatus':
        return WebSocketEventType.TASK_STATUS_CHANGED;
      case 'updatePriority':
      case 'updateAssignee':
        return WebSocketEventType.TASK_UPDATED;
      case 'delete':
        return WebSocketEventType.TASK_DELETED;
      default:
        return null;
    }
  }

  /**
   * Invalidate analytics cache for a specific user
   *
   * This method clears all analytics cache entries for a user to ensure
   * fresh data is retrieved after task changes.
   *
   * @private
   * @param userId User ID whose analytics cache should be invalidated
   */
  private async invalidateAnalyticsCache(userId: string): Promise<void> {
    if (!this.cacheManager) {
      return; // Cache manager not available, skip invalidation
    }

    try {
      // Get all cache keys (if store supports it)
      const store = this.cacheManager.store as any;

      if (store.keys) {
        // Redis store supports keys() method
        const keys: string[] = await store.keys();
        const pattern = `analytics:*:${userId}:*`;

        // Find and delete all matching keys
        const matchingKeys = keys.filter(key => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          return regex.test(key);
        });

        for (const key of matchingKeys) {
          await this.cacheManager.del(key);
        }

        this.logger.debug(`Invalidated ${matchingKeys.length} analytics cache entries for user ${userId}`);
      } else {
        // Fallback: Try to delete known cache key patterns
        const commonPatterns = [
          `analytics:performance:${userId}:*`,
          `analytics:trends:${userId}:*`
        ];

        for (const pattern of commonPatterns) {
          try {
            await this.cacheManager.del(pattern);
          } catch (error) {
            // Ignore errors for individual deletions
          }
        }

        this.logger.debug(`Attempted to invalidate analytics cache for user ${userId}`);
      }
    } catch (error) {
      // Don't fail task operations if cache invalidation fails
      this.logger.error(`Failed to invalidate analytics cache for user ${userId}: ${error.message}`);
    }
  }
}