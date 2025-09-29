import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';
import {
  IClaudeTaskRepository,
  ClaudeTaskEntity,
  ClaudeTaskStatus,
  TaskPriority,
  ClaudeTaskStatistics,
  ExecutionMetrics,
} from '../interfaces/claude-task-repository.interface';

/**
 * Claude Task Repository Implementation
 * Extends BaseRepository with Claude-specific task operations
 * Following Single Responsibility Principle for focused functionality
 *
 * Implements Repository Pattern with optimized queries and error handling
 * for Claude Code AI task execution and monitoring
 */
@Injectable()
export class ClaudeTaskRepository extends BaseRepository<ClaudeTaskEntity> implements IClaudeTaskRepository {
  constructor(prisma: PrismaService) {
    super(prisma, 'ClaudeTask');
  }

  /**
   * Get the Prisma ClaudeTask model delegate
   */
  protected getModel() {
    return this.prisma.claudeTask;
  }

  /**
   * Transform Prisma entity to domain entity with optimized includes
   */
  protected transformToDomain(entity: any): ClaudeTaskEntity {
    return {
      ...entity,
      // Ensure arrays are properly handled
      tags: entity.tags || [],
      // Transform JSON config if needed
      config: entity.config || null,
    } as ClaudeTaskEntity;
  }

  /**
   * Find Claude tasks by user (creator) ID
   */
  async findByUserId(userId: string): Promise<ClaudeTaskEntity[]> {
    try {
      this.logger.debug('Finding Claude tasks by user ID', { userId });

      const tasks = await this.getModel().findMany({
        where: { createdById: userId },
        include: {
          createdBy: {
            select: { id: true, username: true, email: true }
          },
          project: {
            select: { id: true, name: true }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${tasks.length} Claude tasks for user ${userId}`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find Claude tasks by user ID', {
        error: error.message,
        userId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find Claude tasks by project ID
   */
  async findByProjectId(projectId: string): Promise<ClaudeTaskEntity[]> {
    try {
      this.logger.debug('Finding Claude tasks by project ID', { projectId });

      const tasks = await this.getModel().findMany({
        where: { projectId },
        include: {
          createdBy: {
            select: { id: true, username: true, email: true }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${tasks.length} Claude tasks for project ${projectId}`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find Claude tasks by project ID', {
        error: error.message,
        projectId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find Claude tasks by status
   */
  async findByStatus(status: ClaudeTaskStatus): Promise<ClaudeTaskEntity[]> {
    try {
      this.logger.debug('Finding Claude tasks by status', { status });

      const tasks = await this.getModel().findMany({
        where: { status },
        include: {
          createdBy: {
            select: { id: true, username: true, email: true }
          },
          project: {
            select: { id: true, name: true }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${tasks.length} Claude tasks with status ${status}`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find Claude tasks by status', {
        error: error.message,
        status,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find Claude tasks by multiple statuses
   */
  async findByStatuses(statuses: ClaudeTaskStatus[]): Promise<ClaudeTaskEntity[]> {
    try {
      this.logger.debug('Finding Claude tasks by multiple statuses', { statuses });

      const tasks = await this.getModel().findMany({
        where: {
          status: {
            in: statuses,
          },
        },
        include: {
          createdBy: {
            select: { id: true, username: true, email: true }
          },
          project: {
            select: { id: true, name: true }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${tasks.length} Claude tasks with statuses ${statuses.join(', ')}`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find Claude tasks by statuses', {
        error: error.message,
        statuses,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find active or running Claude tasks
   */
  async findActiveOrRunning(): Promise<ClaudeTaskEntity[]> {
    return this.findByStatuses([
      ClaudeTaskStatus.QUEUED,
      ClaudeTaskStatus.RUNNING,
    ]);
  }

  /**
   * Find Claude tasks by priority
   */
  async findByPriority(priority: TaskPriority): Promise<ClaudeTaskEntity[]> {
    try {
      this.logger.debug('Finding Claude tasks by priority', { priority });

      const tasks = await this.getModel().findMany({
        where: { priority },
        include: {
          createdBy: {
            select: { id: true, username: true, email: true }
          },
          project: {
            select: { id: true, name: true }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${tasks.length} Claude tasks with priority ${priority}`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find Claude tasks by priority', {
        error: error.message,
        priority,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find scheduled Claude tasks ready to run
   */
  async findScheduledForExecution(beforeDate: Date = new Date()): Promise<ClaudeTaskEntity[]> {
    try {
      this.logger.debug('Finding scheduled Claude tasks ready for execution', { beforeDate });

      const tasks = await this.getModel().findMany({
        where: {
          status: ClaudeTaskStatus.PENDING,
          scheduledAt: {
            lte: beforeDate,
          },
        },
        include: {
          createdBy: {
            select: { id: true, username: true, email: true }
          },
          project: {
            select: { id: true, name: true }
          },
        },
        orderBy: [
          { priority: 'desc' },
          { scheduledAt: 'asc' },
        ],
      });

      this.logger.debug(`Found ${tasks.length} scheduled Claude tasks ready for execution`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find scheduled Claude tasks', {
        error: error.message,
        beforeDate,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find Claude tasks with executions included
   */
  async findWithExecutions(options: { userId?: string; status?: ClaudeTaskStatus } = {}): Promise<ClaudeTaskEntity[]> {
    try {
      this.logger.debug('Finding Claude tasks with executions', options);

      const whereClause: any = {};
      if (options.userId) {
        whereClause.createdById = options.userId;
      }
      if (options.status) {
        whereClause.status = options.status;
      }

      const tasks = await this.getModel().findMany({
        where: whereClause,
        include: {
          createdBy: {
            select: { id: true, username: true, email: true }
          },
          project: {
            select: { id: true, name: true }
          },
          executions: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${tasks.length} Claude tasks with executions`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find Claude tasks with executions', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find Claude tasks with results included
   */
  async findWithResults(options: { userId?: string; status?: ClaudeTaskStatus } = {}): Promise<ClaudeTaskEntity[]> {
    try {
      this.logger.debug('Finding Claude tasks with results', options);

      const whereClause: any = {};
      if (options.userId) {
        whereClause.createdById = options.userId;
      }
      if (options.status) {
        whereClause.status = options.status;
      }

      const tasks = await this.getModel().findMany({
        where: whereClause,
        include: {
          createdBy: {
            select: { id: true, username: true, email: true }
          },
          project: {
            select: { id: true, name: true }
          },
          results: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${tasks.length} Claude tasks with results`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find Claude tasks with results', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Update Claude task status with timestamp management
   */
  async updateStatus(id: string, status: ClaudeTaskStatus): Promise<ClaudeTaskEntity> {
    try {
      this.logger.debug('Updating Claude task status', { id, status });

      const updateData: any = { status };
      const now = new Date();

      // Manage timestamps based on status transitions
      switch (status) {
        case ClaudeTaskStatus.RUNNING:
          updateData.startedAt = now;
          break;
        case ClaudeTaskStatus.COMPLETED:
        case ClaudeTaskStatus.FAILED:
        case ClaudeTaskStatus.CANCELLED:
          updateData.completedAt = now;
          break;
        case ClaudeTaskStatus.PENDING:
        case ClaudeTaskStatus.QUEUED:
        case ClaudeTaskStatus.PAUSED:
          // Reset completion timestamp if returning to non-terminal state
          updateData.completedAt = null;
          break;
      }

      const updated = await this.getModel().update({
        where: { id },
        data: updateData,
        include: {
          createdBy: {
            select: { id: true, username: true, email: true }
          },
          project: {
            select: { id: true, name: true }
          },
        },
      });

      this.logger.log('Claude task status updated successfully', { id, status });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to update Claude task status', {
        error: error.message,
        id,
        status,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Start Claude task execution
   */
  async startExecution(id: string): Promise<ClaudeTaskEntity> {
    return this.updateStatus(id, ClaudeTaskStatus.RUNNING);
  }

  /**
   * Complete Claude task execution with duration tracking
   */
  async completeExecution(id: string, actualDuration?: number): Promise<ClaudeTaskEntity> {
    try {
      this.logger.debug('Completing Claude task execution', { id, actualDuration });

      const updateData: any = {
        status: ClaudeTaskStatus.COMPLETED,
        completedAt: new Date(),
      };

      if (actualDuration !== undefined) {
        updateData.actualDuration = actualDuration;
      }

      const updated = await this.getModel().update({
        where: { id },
        data: updateData,
        include: {
          createdBy: {
            select: { id: true, username: true, email: true }
          },
          project: {
            select: { id: true, name: true }
          },
        },
      });

      this.logger.log('Claude task execution completed successfully', { id, actualDuration });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to complete Claude task execution', {
        error: error.message,
        id,
        actualDuration,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Fail Claude task execution
   */
  async failExecution(id: string): Promise<ClaudeTaskEntity> {
    return this.updateStatus(id, ClaudeTaskStatus.FAILED);
  }

  /**
   * Cancel Claude task execution
   */
  async cancelExecution(id: string): Promise<ClaudeTaskEntity> {
    return this.updateStatus(id, ClaudeTaskStatus.CANCELLED);
  }

  /**
   * Get Claude task statistics by user
   */
  async getTaskStatsByUser(userId: string): Promise<ClaudeTaskStatistics> {
    try {
      this.logger.debug('Getting Claude task statistics by user', { userId });

      const stats = await this.getModel().groupBy({
        by: ['status'],
        where: { createdById: userId },
        _count: {
          status: true,
        },
      });

      const durations = await this.getModel().aggregate({
        where: {
          createdById: userId,
          actualDuration: { not: null },
        },
        _avg: { actualDuration: true },
        _sum: { actualDuration: true },
      });

      const total = stats.reduce((sum, stat) => sum + stat._count.status, 0);

      const result: ClaudeTaskStatistics = {
        total,
        pending: stats.find(s => s.status === ClaudeTaskStatus.PENDING)?._count.status || 0,
        queued: stats.find(s => s.status === ClaudeTaskStatus.QUEUED)?._count.status || 0,
        running: stats.find(s => s.status === ClaudeTaskStatus.RUNNING)?._count.status || 0,
        completed: stats.find(s => s.status === ClaudeTaskStatus.COMPLETED)?._count.status || 0,
        failed: stats.find(s => s.status === ClaudeTaskStatus.FAILED)?._count.status || 0,
        cancelled: stats.find(s => s.status === ClaudeTaskStatus.CANCELLED)?._count.status || 0,
        paused: stats.find(s => s.status === ClaudeTaskStatus.PAUSED)?._count.status || 0,
        averageDuration: durations._avg.actualDuration || null,
        totalDuration: durations._sum.actualDuration || 0,
      };

      this.logger.debug('Claude task statistics calculated', { userId, stats: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get Claude task statistics by user', {
        error: error.message,
        userId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get Claude task statistics by project
   */
  async getTaskStatsByProject(projectId: string): Promise<ClaudeTaskStatistics> {
    try {
      this.logger.debug('Getting Claude task statistics by project', { projectId });

      const stats = await this.getModel().groupBy({
        by: ['status'],
        where: { projectId },
        _count: {
          status: true,
        },
      });

      const durations = await this.getModel().aggregate({
        where: {
          projectId,
          actualDuration: { not: null },
        },
        _avg: { actualDuration: true },
        _sum: { actualDuration: true },
      });

      const total = stats.reduce((sum, stat) => sum + stat._count.status, 0);

      const result: ClaudeTaskStatistics = {
        total,
        pending: stats.find(s => s.status === ClaudeTaskStatus.PENDING)?._count.status || 0,
        queued: stats.find(s => s.status === ClaudeTaskStatus.QUEUED)?._count.status || 0,
        running: stats.find(s => s.status === ClaudeTaskStatus.RUNNING)?._count.status || 0,
        completed: stats.find(s => s.status === ClaudeTaskStatus.COMPLETED)?._count.status || 0,
        failed: stats.find(s => s.status === ClaudeTaskStatus.FAILED)?._count.status || 0,
        cancelled: stats.find(s => s.status === ClaudeTaskStatus.CANCELLED)?._count.status || 0,
        paused: stats.find(s => s.status === ClaudeTaskStatus.PAUSED)?._count.status || 0,
        averageDuration: durations._avg.actualDuration || null,
        totalDuration: durations._sum.actualDuration || 0,
      };

      this.logger.debug('Claude task statistics calculated', { projectId, stats: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get Claude task statistics by project', {
        error: error.message,
        projectId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get execution performance metrics
   */
  async getExecutionMetrics(options: { userId?: string; fromDate?: Date; toDate?: Date } = {}): Promise<ExecutionMetrics> {
    try {
      this.logger.debug('Getting execution performance metrics', options);

      const whereClause: any = {};
      if (options.userId) {
        whereClause.createdById = options.userId;
      }
      if (options.fromDate || options.toDate) {
        whereClause.createdAt = {};
        if (options.fromDate) {
          whereClause.createdAt.gte = options.fromDate;
        }
        if (options.toDate) {
          whereClause.createdAt.lte = options.toDate;
        }
      }

      const [totalTasks, completedTasks, durations] = await Promise.all([
        // Total tasks count
        this.getModel().count({ where: whereClause }),

        // Completed tasks count
        this.getModel().count({
          where: {
            ...whereClause,
            status: ClaudeTaskStatus.COMPLETED,
          },
        }),

        // Duration statistics
        this.getModel().findMany({
          where: {
            ...whereClause,
            actualDuration: { not: null },
            status: { in: [ClaudeTaskStatus.COMPLETED, ClaudeTaskStatus.FAILED] },
          },
          select: { actualDuration: true },
        }),
      ]);

      // Calculate metrics
      const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      const durationValues = durations
        .map(d => d.actualDuration)
        .filter(d => d !== null)
        .sort((a, b) => a - b);

      const averageDuration = durationValues.length > 0
        ? durationValues.reduce((sum, d) => sum + d, 0) / durationValues.length
        : null;

      const medianDuration = durationValues.length > 0
        ? durationValues[Math.floor(durationValues.length / 2)]
        : null;

      const shortestDuration = durationValues.length > 0 ? durationValues[0] : null;
      const longestDuration = durationValues.length > 0 ? durationValues[durationValues.length - 1] : null;

      // Calculate tasks per hour (simplified - assumes 24h period if no date range)
      const timeSpanHours = options.fromDate && options.toDate
        ? Math.abs(options.toDate.getTime() - options.fromDate.getTime()) / (1000 * 60 * 60)
        : 24;
      const tasksPerHour = totalTasks / timeSpanHours;

      // Get failure reasons (simplified - would need to join with executions for detailed analysis)
      const failedTasks = await this.getModel().count({
        where: {
          ...whereClause,
          status: ClaudeTaskStatus.FAILED,
        },
      });

      const result: ExecutionMetrics = {
        totalTasks,
        successRate,
        averageDuration,
        medianDuration,
        shortestDuration,
        longestDuration,
        tasksPerHour,
        failureReasons: {
          'task_failed': failedTasks,
        },
      };

      this.logger.debug('Execution metrics calculated', { options, metrics: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get execution metrics', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }
}