import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { 
  TaskBase, 
  CreateTask, 
  UpdateTask, 
  TaskQueryFilters,
  TaskStatus,
  TaskPriority,
  TaskCategory 
} from '../schemas/task.schemas';

/**
 * Task Repository Interface
 * 
 * Defines the contract for task data access operations.
 * Follows Dependency Inversion Principle by providing an abstraction
 * that can be implemented with different database technologies.
 */
export interface ITasksRepository {
  create(task: CreateTask, createdById: string): Promise<TaskBase>;
  findById(id: string): Promise<TaskBase | null>;
  findAll(filters: TaskQueryFilters): Promise<{ tasks: TaskBase[]; total: number; page: number; limit: number }>;
  update(id: string, updateData: UpdateTask, updatedById: string): Promise<TaskBase | null>;
  delete(id: string): Promise<boolean>;
  bulkUpdate(taskIds: string[], updateData: Partial<UpdateTask>): Promise<TaskBase[]>;
  getTasksByAssignee(assigneeId: string): Promise<TaskBase[]>;
  getTasksByProject(projectId: string): Promise<TaskBase[]>;
  getOverdueTasks(): Promise<TaskBase[]>;
}

/**
 * In-Memory Task Repository Implementation
 * 
 * Demonstrates Single Responsibility Principle by focusing solely on data access.
 * This implementation uses in-memory storage for demonstration purposes.
 * In production, this would be replaced with a Prisma-based implementation
 * that integrates with the existing database schemas.
 * 
 * Key Features:
 * - Type-safe operations using Zod schemas
 * - Comprehensive filtering and sorting capabilities
 * - Optimized queries for common task operations
 * - Transaction-safe bulk operations
 */
@Injectable()
export class TasksRepository implements ITasksRepository {
  private readonly logger = new Logger(TasksRepository.name);
  private tasks: Map<string, TaskBase> = new Map();

  constructor() {
    // Initialize with some sample data for demonstration
    this.initializeSampleData();
  }

  /**
   * Create a new task
   * 
   * @param task Task creation data
   * @param createdById ID of the user creating the task
   * @returns Created task with generated ID and timestamps
   */
  async create(task: CreateTask, createdById: string): Promise<TaskBase> {
    const now = new Date();
    const taskId = uuidv4();

    const newTask: TaskBase = {
      id: taskId,
      title: task.title,
      description: task.description,
      status: TaskStatus.TODO,
      priority: task.priority,
      category: task.category,
      assigneeId: task.assigneeId,
      createdById,
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      estimatedHours: task.estimatedHours,
      actualHours: undefined,
      dueDate: task.dueDate,
      startDate: task.startDate,
      completedAt: undefined,
      createdAt: now,
      updatedAt: now,
      tags: task.tags || [],
      metadata: task.metadata,
    };

    this.tasks.set(taskId, newTask);
    this.logger.log(`Created task: ${taskId} - "${task.title}"`);
    
    return newTask;
  }

  /**
   * Find task by ID
   * 
   * @param id Task ID
   * @returns Task if found, null otherwise
   */
  async findById(id: string): Promise<TaskBase | null> {
    const task = this.tasks.get(id);
    return task || null;
  }

  /**
   * Find all tasks with filtering, sorting, and pagination
   * 
   * @param filters Query filters and pagination options
   * @returns Paginated task results with metadata
   */
  async findAll(filters: TaskQueryFilters): Promise<{ tasks: TaskBase[]; total: number; page: number; limit: number }> {
    let filteredTasks = Array.from(this.tasks.values());

    // Apply filters
    if (filters.status) {
      filteredTasks = filteredTasks.filter(task => task.status === filters.status);
    }
    
    if (filters.priority) {
      filteredTasks = filteredTasks.filter(task => task.priority === filters.priority);
    }
    
    if (filters.category) {
      filteredTasks = filteredTasks.filter(task => task.category === filters.category);
    }
    
    if (filters.assigneeId) {
      filteredTasks = filteredTasks.filter(task => task.assigneeId === filters.assigneeId);
    }
    
    if (filters.createdById) {
      filteredTasks = filteredTasks.filter(task => task.createdById === filters.createdById);
    }
    
    if (filters.projectId) {
      filteredTasks = filteredTasks.filter(task => task.projectId === filters.projectId);
    }
    
    if (filters.parentTaskId) {
      filteredTasks = filteredTasks.filter(task => task.parentTaskId === filters.parentTaskId);
    }

    // Date range filters
    if (filters.dueDateFrom || filters.dueDateTo) {
      filteredTasks = filteredTasks.filter(task => {
        if (!task.dueDate) return false;
        if (filters.dueDateFrom && task.dueDate < filters.dueDateFrom) return false;
        if (filters.dueDateTo && task.dueDate > filters.dueDateTo) return false;
        return true;
      });
    }

    if (filters.createdFrom || filters.createdTo) {
      filteredTasks = filteredTasks.filter(task => {
        if (filters.createdFrom && task.createdAt < filters.createdFrom) return false;
        if (filters.createdTo && task.createdAt > filters.createdTo) return false;
        return true;
      });
    }

    // Tag filters
    if (filters.tags && filters.tags.length > 0) {
      filteredTasks = filteredTasks.filter(task => 
        filters.tags!.some(tag => task.tags.includes(tag))
      );
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredTasks = filteredTasks.filter(task => 
        task.title.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower)) ||
        task.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    
    filteredTasks.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'createdAt':
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        case 'updatedAt':
          aValue = a.updatedAt.getTime();
          bValue = b.updatedAt.getTime();
          break;
        case 'dueDate':
          aValue = a.dueDate ? a.dueDate.getTime() : 0;
          bValue = b.dueDate ? b.dueDate.getTime() : 0;
          break;
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority] || 0;
          bValue = priorityOrder[b.priority] || 0;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        default:
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    // Apply pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex);
    
    this.logger.debug(`Found ${filteredTasks.length} tasks, returning page ${page} with ${paginatedTasks.length} items`);

    return {
      tasks: paginatedTasks,
      total: filteredTasks.length,
      page,
      limit,
    };
  }

  /**
   * Update a task
   * 
   * @param id Task ID
   * @param updateData Update data
   * @param updatedById ID of the user updating the task
   * @returns Updated task if found, null otherwise
   */
  async update(id: string, updateData: UpdateTask, updatedById: string): Promise<TaskBase | null> {
    const existingTask = this.tasks.get(id);
    if (!existingTask) {
      return null;
    }

    const now = new Date();
    
    // Handle status change to completed
    const completedAt = updateData.status === TaskStatus.DONE && existingTask.status !== TaskStatus.DONE
      ? now
      : existingTask.completedAt;

    const updatedTask: TaskBase = {
      ...existingTask,
      ...updateData,
      id, // Ensure ID cannot be changed
      createdById: existingTask.createdById, // Ensure creator cannot be changed
      createdAt: existingTask.createdAt, // Ensure creation date cannot be changed
      completedAt,
      updatedAt: now,
    };

    this.tasks.set(id, updatedTask);
    this.logger.log(`Updated task: ${id} - "${updatedTask.title}"`);
    
    return updatedTask;
  }

  /**
   * Delete a task
   * 
   * @param id Task ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const existed = this.tasks.has(id);
    if (existed) {
      this.tasks.delete(id);
      this.logger.log(`Deleted task: ${id}`);
    }
    return existed;
  }

  /**
   * Bulk update multiple tasks
   * 
   * @param taskIds Array of task IDs
   * @param updateData Update data to apply to all tasks
   * @returns Array of updated tasks
   */
  async bulkUpdate(taskIds: string[], updateData: Partial<UpdateTask>): Promise<TaskBase[]> {
    const updatedTasks: TaskBase[] = [];
    const now = new Date();

    for (const taskId of taskIds) {
      const existingTask = this.tasks.get(taskId);
      if (existingTask) {
        const updatedTask: TaskBase = {
          ...existingTask,
          ...updateData,
          id: taskId, // Ensure ID cannot be changed
          updatedAt: now,
        };
        
        this.tasks.set(taskId, updatedTask);
        updatedTasks.push(updatedTask);
      }
    }

    this.logger.log(`Bulk updated ${updatedTasks.length} tasks`);
    return updatedTasks;
  }

  /**
   * Get tasks assigned to a specific user
   * 
   * @param assigneeId User ID
   * @returns Array of assigned tasks
   */
  async getTasksByAssignee(assigneeId: string): Promise<TaskBase[]> {
    const tasks = Array.from(this.tasks.values())
      .filter(task => task.assigneeId === assigneeId);
    
    return tasks;
  }

  /**
   * Get tasks belonging to a specific project
   * 
   * @param projectId Project ID
   * @returns Array of project tasks
   */
  async getTasksByProject(projectId: string): Promise<TaskBase[]> {
    const tasks = Array.from(this.tasks.values())
      .filter(task => task.projectId === projectId);
    
    return tasks;
  }

  /**
   * Get overdue tasks
   * 
   * @returns Array of overdue tasks
   */
  async getOverdueTasks(): Promise<TaskBase[]> {
    const now = new Date();
    const tasks = Array.from(this.tasks.values())
      .filter(task => 
        task.dueDate && 
        task.dueDate < now && 
        task.status !== TaskStatus.DONE &&
        task.status !== TaskStatus.CANCELLED
      );
    
    return tasks;
  }

  /**
   * Initialize sample data for demonstration
   * 
   * @private
   */
  private initializeSampleData(): void {
    const sampleTasks: Omit<TaskBase, 'id'>[] = [
      {
        title: 'Implement User Authentication',
        description: 'Set up JWT-based authentication system with passport.js',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        category: TaskCategory.DEVELOPMENT,
        assigneeId: '550e8400-e29b-41d4-a716-446655440001',
        createdById: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440100',
        parentTaskId: undefined,
        estimatedHours: 16,
        actualHours: 8,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        completedAt: undefined,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        updatedAt: new Date(),
        tags: ['authentication', 'security', 'backend'],
        metadata: { complexity: 'high', reviewRequired: true },
      },
      {
        title: 'Design Database Schema',
        description: 'Create comprehensive database schema for task management system',
        status: TaskStatus.DONE,
        priority: TaskPriority.MEDIUM,
        category: TaskCategory.DEVELOPMENT,
        assigneeId: '550e8400-e29b-41d4-a716-446655440002',
        createdById: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440100',
        parentTaskId: undefined,
        estimatedHours: 12,
        actualHours: 14,
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        tags: ['database', 'schema', 'planning'],
        metadata: { approved: true, reviewedBy: '550e8400-e29b-41d4-a716-446655440003' },
      },
      {
        title: 'Write API Documentation',
        description: 'Create comprehensive API documentation using OpenAPI/Swagger',
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        category: TaskCategory.DOCUMENTATION,
        assigneeId: '550e8400-e29b-41d4-a716-446655440003',
        createdById: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440100',
        parentTaskId: undefined,
        estimatedHours: 8,
        actualHours: undefined,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        startDate: undefined,
        completedAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['documentation', 'api', 'openapi'],
        metadata: { template: 'swagger', autoGenerate: true },
      },
    ];

    // Add sample tasks with generated IDs
    sampleTasks.forEach(taskData => {
      const taskId = uuidv4();
      const task: TaskBase = {
        id: taskId,
        ...taskData,
      };
      this.tasks.set(taskId, task);
    });

    this.logger.log(`Initialized repository with ${sampleTasks.length} sample tasks`);
  }
}