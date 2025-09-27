import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';
import {
  IProjectRepository,
  ProjectEntity,
  ProjectWithStats,
  ProjectWithTasks,
  ProjectStatistics,
} from '../interfaces/project-repository.interface';

/**
 * Project Repository Implementation
 * Extends BaseRepository with project-specific operations
 * Following Single Responsibility Principle and Repository Pattern
 */
@Injectable()
export class ProjectRepository extends BaseRepository<ProjectEntity> implements IProjectRepository {
  constructor(prisma: PrismaService) {
    super(prisma, 'Project');
  }

  /**
   * Get the Prisma Project model delegate
   */
  protected getModel() {
    return this.prisma.project;
  }

  /**
   * Find projects with task counts
   */
  async findWithTaskCounts(): Promise<ProjectWithStats[]> {
    try {
      this.logger.debug('Finding projects with task counts');
      
      const projects = await this.getModel().findMany({
        include: {
          tasks: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      
      const projectsWithStats: ProjectWithStats[] = projects.map(project => {
        const taskCount = project.tasks.length;
        const completedTaskCount = project.tasks.filter(task => task.status === 'DONE').length;
        const progressPercentage = taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0;
        
        return {
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          taskCount,
          completedTaskCount,
          progressPercentage,
        };
      });
      
      this.logger.debug(`Found ${projectsWithStats.length} projects with task counts`);
      return projectsWithStats;
    } catch (error) {
      this.logger.error('Failed to find projects with task counts', {
        error: error.message,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find project with all tasks
   */
  async findWithTasks(id: string): Promise<ProjectWithTasks | null> {
    try {
      this.logger.debug('Finding project with tasks', { id });
      
      const project = await this.getModel().findUnique({
        where: { id },
        include: {
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              assigneeId: true,
              dueDate: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      
      if (!project) {
        this.logger.debug('Project not found', { id });
        return null;
      }
      
      const result: ProjectWithTasks = {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        tasks: project.tasks.map(task => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          assigneeId: task.assigneeId,
          dueDate: task.dueDate,
        })),
      };
      
      this.logger.debug('Project with tasks found', { id, taskCount: result.tasks.length });
      return result;
    } catch (error) {
      this.logger.error('Failed to find project with tasks', {
        error: error.message,
        id,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get project statistics
   */
  async getProjectStats(id: string): Promise<ProjectStatistics> {
    try {
      this.logger.debug('Getting project statistics', { id });
      
      // Get task counts by status
      const tasksByStatus = await this.prisma.task.groupBy({
        by: ['status'],
        where: { projectId: id },
        _count: {
          status: true,
        },
      });
      
      // Get task counts by priority
      const tasksByPriority = await this.prisma.task.groupBy({
        by: ['priority'],
        where: { projectId: id },
        _count: {
          priority: true,
        },
      });
      
      const totalTasks = tasksByStatus.reduce((sum, stat) => sum + stat._count.status, 0);
      const completedTasks = tasksByStatus.find(stat => stat.status === 'DONE')?._count.status || 0;
      const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      // Convert arrays to objects for easier access
      const statusCounts = tasksByStatus.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {} as Record<string, number>);
      
      const priorityCounts = tasksByPriority.reduce((acc, stat) => {
        acc[stat.priority] = stat._count.priority;
        return acc;
      }, {} as Record<string, number>);
      
      const result: ProjectStatistics = {
        totalTasks,
        completedTasks,
        progressPercentage,
        tasksByStatus: statusCounts,
        tasksByPriority: priorityCounts,
      };
      
      this.logger.debug('Project statistics calculated', { id, stats: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get project statistics', {
        error: error.message,
        id,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find projects by name (partial match)
   */
  async findByNameLike(name: string): Promise<ProjectEntity[]> {
    try {
      this.logger.debug('Finding projects by name like', { name });
      
      const projects = await this.getModel().findMany({
        where: {
          name: {
            contains: name,
            mode: 'insensitive',
          },
        },
        orderBy: { name: 'asc' },
      });
      
      this.logger.debug(`Found ${projects.length} projects matching name "${name}"`);
      return projects.map(project => this.transformToDomain(project));
    } catch (error) {
      this.logger.error('Failed to find projects by name like', {
        error: error.message,
        name,
      });
      throw this.handlePrismaError(error);
    }
  }
}