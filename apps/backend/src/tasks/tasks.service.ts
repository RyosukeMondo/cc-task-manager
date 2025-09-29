import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JWTPayload } from '../schemas/auth.schemas';
import { BackendSchemaRegistry } from '../schemas/schema-registry';
import { TasksRepository, ITasksRepository } from './tasks.repository';
import { QueueService } from '../queue/queue.service';
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
    private readonly tasksRepository: ITasksRepository,
    private readonly schemaRegistry: BackendSchemaRegistry,
    private readonly queueService: QueueService,
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
    const validation = this.schemaRegistry.validateAgainstSchema('CreateTask', createTaskData);
    if (!validation.success) {
      this.logger.warn(`Task creation validation failed: ${validation.error}`);
      throw new BadRequestException({
        error: 'TaskValidationError',
        message: validation.error,
        details: 'Task creation data does not meet schema requirements',
      });
    }

    // Business rule validation
    await this.validateTaskCreation(createTaskData, createdById);

    // Create task through repository
    const createdTask = await this.tasksRepository.create(validation.data, createdById);

    this.logger.log(`Created task: ${createdTask.id} - "${createdTask.title}" by user ${createdById}`);

    // Queue task notification job for assignee if assigned
    if (createdTask.assigneeId) {
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
      throw new NotFoundException({
        error: 'TaskNotFound',
        message: `Task with ID ${taskId} not found`,
        taskId,
      });
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
    const validation = this.schemaRegistry.validateAgainstSchema('TaskQueryFilters', filters);
    if (!validation.success) {
      this.logger.warn(`Task query validation failed: ${validation.error}`);
      throw new BadRequestException({
        error: 'QueryValidationError',
        message: validation.error,
        details: 'Query filters do not meet schema requirements',
      });
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
    const validation = this.schemaRegistry.validateAgainstSchema('UpdateTask', updateData);
    if (!validation.success) {
      this.logger.warn(`Task update validation failed: ${validation.error}`);
      throw new BadRequestException({
        error: 'TaskValidationError',
        message: validation.error,
        details: 'Task update data does not meet schema requirements',
      });
    }

    // Get existing task for business rule validation
    const existingTask = await this.getTaskById(taskId);
    
    // Business rule validation
    await this.validateTaskUpdate(existingTask, validation.data, updatedById);

    // Update task through repository
    const updatedTask = await this.tasksRepository.update(taskId, validation.data, updatedById);
    if (!updatedTask) {
      // This should not happen since we validated existence above
      throw new NotFoundException({
        error: 'TaskNotFound',
        message: `Task with ID ${taskId} not found`,
        taskId,
      });
    }
    
    this.logger.log(`Updated task: ${taskId} - "${updatedTask.title}" by user ${updatedById}`);
    
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
      throw new NotFoundException({
        error: 'TaskNotFound',
        message: `Task with ID ${taskId} not found`,
        taskId,
      });
    }
    
    this.logger.log(`Deleted task: ${taskId} - "${existingTask.title}" by user ${deletedById}`);
    
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
    const validation = this.schemaRegistry.validateAgainstSchema('BulkTaskOperation', operation);
    if (!validation.success) {
      this.logger.warn(`Bulk operation validation failed: ${validation.error}`);
      throw new BadRequestException({
        error: 'BulkOperationValidationError',
        message: validation.error,
        details: 'Bulk operation data does not meet schema requirements',
      });
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
          throw new BadRequestException('Status is required for updateStatus operation');
        }
        results = await this.tasksRepository.bulkUpdate(taskIds, { status: data.status });
        break;
        
      case 'updatePriority':
        if (!data?.priority) {
          throw new BadRequestException('Priority is required for updatePriority operation');
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
        throw new BadRequestException(`Unsupported bulk operation: ${operationType}`);
    }

    this.logger.log(`Bulk operation ${operationType} completed on ${taskIds.length} tasks by user ${operatorId}`);
    
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
      [TaskStatus.PENDING]: allTasks.filter(t => t.status === TaskStatus.PENDING).length,
      [TaskStatus.IN_PROGRESS]: allTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      [TaskStatus.COMPLETED]: allTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      [TaskStatus.CANCELLED]: allTasks.filter(t => t.status === TaskStatus.CANCELLED).length,
      [TaskStatus.ON_HOLD]: allTasks.filter(t => t.status === TaskStatus.ON_HOLD).length,
      [TaskStatus.REVIEW]: allTasks.filter(t => t.status === TaskStatus.REVIEW).length,
      [TaskStatus.APPROVED]: allTasks.filter(t => t.status === TaskStatus.APPROVED).length,
      [TaskStatus.REJECTED]: allTasks.filter(t => t.status === TaskStatus.REJECTED).length,
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
      t.status !== TaskStatus.COMPLETED &&
      t.status !== TaskStatus.CANCELLED
    ).length;

    const completedThisWeek = allTasks.filter(t => 
      t.status === TaskStatus.COMPLETED && 
      t.completedAt && 
      t.completedAt >= oneWeekAgo
    ).length;

    const completedThisMonth = allTasks.filter(t => 
      t.status === TaskStatus.COMPLETED && 
      t.completedAt && 
      t.completedAt >= oneMonthAgo
    ).length;

    // Calculate average completion time for completed tasks
    const completedTasks = allTasks.filter(t => 
      t.status === TaskStatus.COMPLETED && 
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
      throw new BadRequestException('Estimated hours cannot exceed 1000 hours');
    }

    // Business rule: Due date should be in the future for new tasks
    if (createData.dueDate && createData.dueDate <= new Date()) {
      throw new BadRequestException('Due date must be in the future');
    }

    // Business rule: Start date should not be after due date
    if (createData.startDate && createData.dueDate && createData.startDate > createData.dueDate) {
      throw new BadRequestException('Start date cannot be after due date');
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
    if (existingTask.status === TaskStatus.COMPLETED && 
        updateData.status && 
        updateData.status !== TaskStatus.COMPLETED) {
      this.logger.warn(`Attempt to change completed task ${existingTask.id} to ${updateData.status} by user ${updatedById}`);
      // Allow this but log it - in a real system you might require special permissions
    }

    // Business rule: Actual hours validation
    if (updateData.actualHours !== undefined) {
      if (updateData.actualHours < 0) {
        throw new BadRequestException('Actual hours cannot be negative');
      }
      if (updateData.actualHours > 1000) {
        throw new BadRequestException('Actual hours cannot exceed 1000 hours');
      }
    }

    // Validate parent task exists if being changed
    if (updateData.parentTaskId && updateData.parentTaskId !== existingTask.parentTaskId) {
      await this.getTaskById(updateData.parentTaskId);
      
      // Business rule: Cannot set self as parent
      if (updateData.parentTaskId === existingTask.id) {
        throw new BadRequestException('Task cannot be its own parent');
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
      throw new ForbiddenException('Only the task creator can delete this task');
    }

    // Business rule: Cannot delete completed tasks (optional business rule)
    if (task.status === TaskStatus.COMPLETED) {
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
      throw new ForbiddenException('You do not have permission to modify this task');
    }
  }
}