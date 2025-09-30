import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';
import {
  ITaskRepository,
  TaskEntity,
  TaskStatus,
  TaskPriority,
  TaskStatistics,
} from '../interfaces/task-repository.interface';

/**
 * Task Repository Implementation
 * Extends BaseRepository with task-specific operations
 * Following Single Responsibility Principle and Repository Pattern
 */
@Injectable()
export class TaskRepository extends BaseRepository<TaskEntity> implements ITaskRepository {
  constructor(prisma: PrismaService) {
    super(prisma, 'Task');
  }

  /**
   * Get the Prisma Task model delegate
   */
  protected getModel() {
    return this.prisma.task;
  }

  /**
   * Find tasks by assignee ID
   */
  async findByAssigneeId(assigneeId: string): Promise<TaskEntity[]> {
    try {
      this.logger.debug('Finding tasks by assignee ID', { assigneeId });
      
      const tasks = await this.getModel().findMany({
        where: { assigneeId },
        orderBy: { createdAt: 'desc' },
      });
      
      this.logger.debug(`Found ${tasks.length} tasks for assignee ${assigneeId}`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find tasks by assignee ID', {
        error: error.message,
        assigneeId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find tasks by creator ID
   */
  async findByCreatorId(creatorId: string): Promise<TaskEntity[]> {
    try {
      this.logger.debug('Finding tasks by creator ID', { creatorId });
      
      const tasks = await this.getModel().findMany({
        where: { createdById: creatorId },
        orderBy: { createdAt: 'desc' },
      });
      
      this.logger.debug(`Found ${tasks.length} tasks created by ${creatorId}`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find tasks by creator ID', {
        error: error.message,
        creatorId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find tasks by project ID
   */
  async findByProjectId(projectId: string): Promise<TaskEntity[]> {
    try {
      this.logger.debug('Finding tasks by project ID', { projectId });
      
      const tasks = await this.getModel().findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });
      
      this.logger.debug(`Found ${tasks.length} tasks for project ${projectId}`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find tasks by project ID', {
        error: error.message,
        projectId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find tasks by status
   */
  async findByStatus(status: TaskStatus): Promise<TaskEntity[]> {
    try {
      this.logger.debug('Finding tasks by status', { status });
      
      const tasks = await this.getModel().findMany({
        where: { status },
        orderBy: { createdAt: 'desc' },
      });
      
      this.logger.debug(`Found ${tasks.length} tasks with status ${status}`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find tasks by status', {
        error: error.message,
        status,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find tasks by priority
   */
  async findByPriority(priority: TaskPriority): Promise<TaskEntity[]> {
    try {
      this.logger.debug('Finding tasks by priority', { priority });
      
      const tasks = await this.getModel().findMany({
        where: { priority },
        orderBy: { createdAt: 'desc' },
      });
      
      this.logger.debug(`Found ${tasks.length} tasks with priority ${priority}`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find tasks by priority', {
        error: error.message,
        priority,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find overdue tasks
   */
  async findOverdue(): Promise<TaskEntity[]> {
    try {
      this.logger.debug('Finding overdue tasks');
      
      const tasks = await this.getModel().findMany({
        where: {
          dueDate: {
            lt: new Date(),
          },
          status: {
            notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
          },
        },
        orderBy: { dueDate: 'asc' },
      });
      
      this.logger.debug(`Found ${tasks.length} overdue tasks`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find overdue tasks', {
        error: error.message,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find tasks due within specified days
   */
  async findDueSoon(days: number): Promise<TaskEntity[]> {
    try {
      this.logger.debug('Finding tasks due soon', { days });
      
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + days);
      
      const tasks = await this.getModel().findMany({
        where: {
          dueDate: {
            lte: dueDate,
            gte: new Date(),
          },
          status: {
            notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
          },
        },
        orderBy: { dueDate: 'asc' },
      });
      
      this.logger.debug(`Found ${tasks.length} tasks due within ${days} days`);
      return tasks.map(task => this.transformToDomain(task));
    } catch (error) {
      this.logger.error('Failed to find tasks due soon', {
        error: error.message,
        days,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Update task status
   */
  async updateStatus(id: string, status: TaskStatus): Promise<TaskEntity> {
    try {
      this.logger.debug('Updating task status', { id, status });
      
      const updateData: any = { status };

      // Set completedAt timestamp when marking as done
      if (status === TaskStatus.DONE) {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
      
      const updated = await this.getModel().update({
        where: { id },
        data: updateData,
      });
      
      this.logger.log('Task status updated successfully', { id, status });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to update task status', {
        error: error.message,
        id,
        status,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Assign task to user
   */
  async assignTask(id: string, assigneeId: string): Promise<TaskEntity> {
    try {
      this.logger.debug('Assigning task to user', { id, assigneeId });
      
      const updated = await this.getModel().update({
        where: { id },
        data: { assigneeId },
      });
      
      this.logger.log('Task assigned successfully', { id, assigneeId });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to assign task', {
        error: error.message,
        id,
        assigneeId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Unassign task
   */
  async unassignTask(id: string): Promise<TaskEntity> {
    try {
      this.logger.debug('Unassigning task', { id });
      
      const updated = await this.getModel().update({
        where: { id },
        data: { assigneeId: null },
      });
      
      this.logger.log('Task unassigned successfully', { id });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to unassign task', {
        error: error.message,
        id,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Complete task
   */
  async completeTask(id: string): Promise<TaskEntity> {
    return this.updateStatus(id, TaskStatus.DONE);
  }

  /**
   * Get task statistics by user
   */
  async getTaskStatsByUser(userId: string): Promise<TaskStatistics> {
    try {
      this.logger.debug('Getting task statistics by user', { userId });
      
      const stats = await this.getModel().groupBy({
        by: ['status'],
        where: {
          OR: [
            { createdById: userId },
            { assigneeId: userId },
          ],
        },
        _count: {
          status: true,
        },
      });
      
      const overdue = await this.getModel().count({
        where: {
          OR: [
            { createdById: userId },
            { assigneeId: userId },
          ],
          dueDate: {
            lt: new Date(),
          },
          status: {
            notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
          },
        },
      });
      
      const total = stats.reduce((sum, stat) => sum + stat._count.status, 0);
      
      const result: TaskStatistics = {
        total,
        todo: stats.find(s => s.status === TaskStatus.TODO)?._count.status || 0,
        inProgress: stats.find(s => s.status === TaskStatus.IN_PROGRESS)?._count.status || 0,
        inReview: stats.find(s => s.status === TaskStatus.IN_REVIEW)?._count.status || 0,
        done: stats.find(s => s.status === TaskStatus.DONE)?._count.status || 0,
        cancelled: stats.find(s => s.status === TaskStatus.CANCELLED)?._count.status || 0,
        overdue,
      };
      
      this.logger.debug('Task statistics calculated', { userId, stats: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get task statistics by user', {
        error: error.message,
        userId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get task statistics by project
   */
  async getTaskStatsByProject(projectId: string): Promise<TaskStatistics> {
    try {
      this.logger.debug('Getting task statistics by project', { projectId });
      
      const stats = await this.getModel().groupBy({
        by: ['status'],
        where: { projectId },
        _count: {
          status: true,
        },
      });
      
      const overdue = await this.getModel().count({
        where: {
          projectId,
          dueDate: {
            lt: new Date(),
          },
          status: {
            notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
          },
        },
      });
      
      const total = stats.reduce((sum, stat) => sum + stat._count.status, 0);
      
      const result: TaskStatistics = {
        total,
        todo: stats.find(s => s.status === TaskStatus.TODO)?._count.status || 0,
        inProgress: stats.find(s => s.status === TaskStatus.IN_PROGRESS)?._count.status || 0,
        inReview: stats.find(s => s.status === TaskStatus.IN_REVIEW)?._count.status || 0,
        done: stats.find(s => s.status === TaskStatus.DONE)?._count.status || 0,
        cancelled: stats.find(s => s.status === TaskStatus.CANCELLED)?._count.status || 0,
        overdue,
      };
      
      this.logger.debug('Task statistics calculated', { projectId, stats: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get task statistics by project', {
        error: error.message,
        projectId,
      });
      throw this.handlePrismaError(error);
    }
  }
}