import { IBaseRepository } from './base-repository.interface';

/**
 * Task Repository Interface
 * Extends base repository with task-specific operations
 * Following Interface Segregation Principle
 */
export interface ITaskRepository extends IBaseRepository<TaskEntity> {
  /**
   * Find tasks by assignee ID
   */
  findByAssigneeId(assigneeId: string): Promise<TaskEntity[]>;

  /**
   * Find tasks by creator ID
   */
  findByCreatorId(creatorId: string): Promise<TaskEntity[]>;

  /**
   * Find tasks by project ID
   */
  findByProjectId(projectId: string): Promise<TaskEntity[]>;

  /**
   * Find tasks by status
   */
  findByStatus(status: TaskStatus): Promise<TaskEntity[]>;

  /**
   * Find tasks by priority
   */
  findByPriority(priority: TaskPriority): Promise<TaskEntity[]>;

  /**
   * Find overdue tasks
   */
  findOverdue(): Promise<TaskEntity[]>;

  /**
   * Find tasks due within specified days
   */
  findDueSoon(days: number): Promise<TaskEntity[]>;

  /**
   * Update task status
   */
  updateStatus(id: string, status: TaskStatus): Promise<TaskEntity>;

  /**
   * Assign task to user
   */
  assignTask(id: string, assigneeId: string): Promise<TaskEntity>;

  /**
   * Unassign task
   */
  unassignTask(id: string): Promise<TaskEntity>;

  /**
   * Complete task
   */
  completeTask(id: string): Promise<TaskEntity>;

  /**
   * Get task statistics by user
   */
  getTaskStatsByUser(userId: string): Promise<TaskStatistics>;

  /**
   * Get task statistics by project
   */
  getTaskStatsByProject(projectId: string): Promise<TaskStatistics>;
}

/**
 * Task Entity interface aligned with Prisma model
 */
export interface TaskEntity {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  createdById: string;
  assigneeId: string | null;
  projectId: string | null;
  tags: string[];
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task Status enumeration matching Prisma schema
 */
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

/**
 * Task Priority enumeration matching Prisma schema
 */
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * Task Statistics interface
 */
export interface TaskStatistics {
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
  cancelled: number;
  overdue: number;
}