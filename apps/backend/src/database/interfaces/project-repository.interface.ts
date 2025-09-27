import { IBaseRepository } from './base-repository.interface';

/**
 * Project Repository Interface
 * Extends base repository with project-specific operations
 * Following Interface Segregation Principle
 */
export interface IProjectRepository extends IBaseRepository<ProjectEntity> {
  /**
   * Find projects with task counts
   */
  findWithTaskCounts(): Promise<ProjectWithStats[]>;

  /**
   * Find project with all tasks
   */
  findWithTasks(id: string): Promise<ProjectWithTasks | null>;

  /**
   * Get project statistics
   */
  getProjectStats(id: string): Promise<ProjectStatistics>;

  /**
   * Find projects by name (partial match)
   */
  findByNameLike(name: string): Promise<ProjectEntity[]>;
}

/**
 * Project Entity interface aligned with Prisma model
 */
export interface ProjectEntity {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Project with task statistics
 */
export interface ProjectWithStats extends ProjectEntity {
  taskCount: number;
  completedTaskCount: number;
  progressPercentage: number;
}

/**
 * Project with tasks
 */
export interface ProjectWithTasks extends ProjectEntity {
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assigneeId: string | null;
    dueDate: Date | null;
  }>;
}

/**
 * Project Statistics interface
 */
export interface ProjectStatistics {
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
}