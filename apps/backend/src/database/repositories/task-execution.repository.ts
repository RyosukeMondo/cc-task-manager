import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';
import {
  ITaskExecutionRepository,
  TaskExecutionEntity,
  ExecutionStatus,
  ExecutionStatistics,
  ResourceUsageMetrics,
  ExecutionPerformanceMetrics,
} from '../interfaces/task-execution-repository.interface';

/**
 * Task Execution Repository Implementation
 * Extends BaseRepository with execution-specific operations
 * Following Single Responsibility Principle for focused functionality
 *
 * Implements Repository Pattern with optimized queries and error handling
 * for Claude Code task execution monitoring and management
 */
@Injectable()
export class TaskExecutionRepository extends BaseRepository<TaskExecutionEntity> implements ITaskExecutionRepository {
  constructor(prisma: PrismaService) {
    super(prisma, 'TaskExecution');
  }

  /**
   * Get the Prisma TaskExecution model delegate
   */
  protected getModel() {
    return this.prisma.taskExecution;
  }

  /**
   * Transform Prisma entity to domain entity with optimized includes
   */
  protected transformToDomain(entity: any): TaskExecutionEntity {
    return {
      ...entity,
      // Ensure proper type casting for numbers
      progress: entity.progress ? Number(entity.progress) : null,
      cpuUsage: entity.cpuUsage ? Number(entity.cpuUsage) : null,
      memoryUsage: entity.memoryUsage ? Number(entity.memoryUsage) : null,
      diskUsage: entity.diskUsage ? Number(entity.diskUsage) : null,
    } as TaskExecutionEntity;
  }

  /**
   * Find task executions by Claude task ID
   */
  async findByTaskId(taskId: string): Promise<TaskExecutionEntity[]> {
    try {
      this.logger.debug('Finding task executions by task ID', { taskId });

      const executions = await this.getModel().findMany({
        where: { taskId },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${executions.length} executions for task ${taskId}`);
      return executions.map(execution => this.transformToDomain(execution));
    } catch (error) {
      this.logger.error('Failed to find task executions by task ID', {
        error: error.message,
        taskId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find task executions by status
   */
  async findByStatus(status: ExecutionStatus): Promise<TaskExecutionEntity[]> {
    try {
      this.logger.debug('Finding task executions by status', { status });

      const executions = await this.getModel().findMany({
        where: { status },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${executions.length} executions with status ${status}`);
      return executions.map(execution => this.transformToDomain(execution));
    } catch (error) {
      this.logger.error('Failed to find task executions by status', {
        error: error.message,
        status,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find task executions by multiple statuses
   */
  async findByStatuses(statuses: ExecutionStatus[]): Promise<TaskExecutionEntity[]> {
    try {
      this.logger.debug('Finding task executions by multiple statuses', { statuses });

      const executions = await this.getModel().findMany({
        where: {
          status: {
            in: statuses,
          },
        },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${executions.length} executions with statuses ${statuses.join(', ')}`);
      return executions.map(execution => this.transformToDomain(execution));
    } catch (error) {
      this.logger.error('Failed to find task executions by statuses', {
        error: error.message,
        statuses,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find active executions (running or initializing)
   */
  async findActiveExecutions(): Promise<TaskExecutionEntity[]> {
    return this.findByStatuses([
      ExecutionStatus.INITIALIZING,
      ExecutionStatus.STARTING,
      ExecutionStatus.RUNNING,
    ]);
  }

  /**
   * Find executions by worker ID
   */
  async findByWorkerId(workerId: string): Promise<TaskExecutionEntity[]> {
    try {
      this.logger.debug('Finding task executions by worker ID', { workerId });

      const executions = await this.getModel().findMany({
        where: { workerId },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${executions.length} executions for worker ${workerId}`);
      return executions.map(execution => this.transformToDomain(execution));
    } catch (error) {
      this.logger.error('Failed to find task executions by worker ID', {
        error: error.message,
        workerId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find executions by session ID
   */
  async findBySessionId(sessionId: string): Promise<TaskExecutionEntity[]> {
    try {
      this.logger.debug('Finding task executions by session ID', { sessionId });

      const executions = await this.getModel().findMany({
        where: { sessionId },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${executions.length} executions for session ${sessionId}`);
      return executions.map(execution => this.transformToDomain(execution));
    } catch (error) {
      this.logger.error('Failed to find task executions by session ID', {
        error: error.message,
        sessionId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find executions requiring heartbeat check
   */
  async findStaleExecutions(heartbeatThreshold: Date): Promise<TaskExecutionEntity[]> {
    try {
      this.logger.debug('Finding stale executions', { heartbeatThreshold });

      const executions = await this.getModel().findMany({
        where: {
          status: {
            in: [ExecutionStatus.RUNNING, ExecutionStatus.STARTING],
          },
          lastHeartbeat: {
            lt: heartbeatThreshold,
          },
        },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
        orderBy: { lastHeartbeat: 'asc' },
      });

      this.logger.debug(`Found ${executions.length} stale executions`);
      return executions.map(execution => this.transformToDomain(execution));
    } catch (error) {
      this.logger.error('Failed to find stale executions', {
        error: error.message,
        heartbeatThreshold,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find executions with logs included
   */
  async findWithLogs(options: { taskId?: string; status?: ExecutionStatus } = {}): Promise<TaskExecutionEntity[]> {
    try {
      this.logger.debug('Finding executions with logs', options);

      const whereClause: any = {};
      if (options.taskId) {
        whereClause.taskId = options.taskId;
      }
      if (options.status) {
        whereClause.status = options.status;
      }

      const executions = await this.getModel().findMany({
        where: whereClause,
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
          logs: {
            orderBy: { timestamp: 'desc' },
            take: 50, // Limit logs to prevent memory issues
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${executions.length} executions with logs`);
      return executions.map(execution => this.transformToDomain(execution));
    } catch (error) {
      this.logger.error('Failed to find executions with logs', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find executions with metrics included
   */
  async findWithMetrics(options: { taskId?: string; status?: ExecutionStatus } = {}): Promise<TaskExecutionEntity[]> {
    try {
      this.logger.debug('Finding executions with metrics', options);

      const whereClause: any = {};
      if (options.taskId) {
        whereClause.taskId = options.taskId;
      }
      if (options.status) {
        whereClause.status = options.status;
      }

      const executions = await this.getModel().findMany({
        where: whereClause,
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
          metrics: {
            orderBy: { timestamp: 'desc' },
            take: 100, // Limit metrics to prevent memory issues
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug(`Found ${executions.length} executions with metrics`);
      return executions.map(execution => this.transformToDomain(execution));
    } catch (error) {
      this.logger.error('Failed to find executions with metrics', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Update execution status with timestamp management
   */
  async updateStatus(id: string, status: ExecutionStatus): Promise<TaskExecutionEntity> {
    try {
      this.logger.debug('Updating execution status', { id, status });

      const updateData: any = { status };
      const now = new Date();

      // Manage timestamps based on status transitions
      switch (status) {
        case ExecutionStatus.STARTING:
        case ExecutionStatus.RUNNING:
          updateData.startedAt = now;
          updateData.lastHeartbeat = now;
          break;
        case ExecutionStatus.COMPLETED:
        case ExecutionStatus.FAILED:
        case ExecutionStatus.CANCELLED:
        case ExecutionStatus.TIMEOUT:
          updateData.completedAt = now;
          break;
        case ExecutionStatus.PAUSED:
          updateData.lastHeartbeat = now;
          break;
      }

      const updated = await this.getModel().update({
        where: { id },
        data: updateData,
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
      });

      this.logger.log('Execution status updated successfully', { id, status });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to update execution status', {
        error: error.message,
        id,
        status,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Update execution progress
   */
  async updateProgress(id: string, progress: number): Promise<TaskExecutionEntity> {
    try {
      this.logger.debug('Updating execution progress', { id, progress });

      // Validate progress is between 0 and 1
      const validProgress = Math.max(0, Math.min(1, progress));

      const updated = await this.getModel().update({
        where: { id },
        data: {
          progress: validProgress,
          lastHeartbeat: new Date(),
        },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
      });

      this.logger.debug('Execution progress updated successfully', { id, progress: validProgress });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to update execution progress', {
        error: error.message,
        id,
        progress,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Update execution heartbeat
   */
  async updateHeartbeat(id: string): Promise<TaskExecutionEntity> {
    try {
      this.logger.debug('Updating execution heartbeat', { id });

      const updated = await this.getModel().update({
        where: { id },
        data: {
          lastHeartbeat: new Date(),
        },
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
      });

      this.logger.debug('Execution heartbeat updated successfully', { id });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to update execution heartbeat', {
        error: error.message,
        id,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Start execution (set status to RUNNING with timestamp)
   */
  async startExecution(id: string, workerId?: string, processId?: string): Promise<TaskExecutionEntity> {
    try {
      this.logger.debug('Starting execution', { id, workerId, processId });

      const updateData: any = {
        status: ExecutionStatus.RUNNING,
        startedAt: new Date(),
        lastHeartbeat: new Date(),
      };

      if (workerId) {
        updateData.workerId = workerId;
      }
      if (processId) {
        updateData.processId = processId;
      }

      const updated = await this.getModel().update({
        where: { id },
        data: updateData,
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
      });

      this.logger.log('Execution started successfully', { id, workerId, processId });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to start execution', {
        error: error.message,
        id,
        workerId,
        processId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Complete execution (set status to COMPLETED with timestamp)
   */
  async completeExecution(id: string): Promise<TaskExecutionEntity> {
    return this.updateStatus(id, ExecutionStatus.COMPLETED);
  }

  /**
   * Fail execution (set status to FAILED with error details)
   */
  async failExecution(id: string, errorMessage?: string, errorCode?: string, stackTrace?: string): Promise<TaskExecutionEntity> {
    try {
      this.logger.debug('Failing execution', { id, errorMessage, errorCode });

      const updateData: any = {
        status: ExecutionStatus.FAILED,
        completedAt: new Date(),
      };

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }
      if (errorCode) {
        updateData.errorCode = errorCode;
      }
      if (stackTrace) {
        updateData.stackTrace = stackTrace;
      }

      const updated = await this.getModel().update({
        where: { id },
        data: updateData,
        include: {
          task: {
            select: { id: true, title: true, status: true }
          },
        },
      });

      this.logger.log('Execution failed', { id, errorMessage, errorCode });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error('Failed to fail execution', {
        error: error.message,
        id,
        errorMessage,
        errorCode,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Cancel execution (set status to CANCELLED)
   */
  async cancelExecution(id: string): Promise<TaskExecutionEntity> {
    return this.updateStatus(id, ExecutionStatus.CANCELLED);
  }

  /**
   * Pause execution (set status to PAUSED)
   */
  async pauseExecution(id: string): Promise<TaskExecutionEntity> {
    return this.updateStatus(id, ExecutionStatus.PAUSED);
  }

  /**
   * Resume execution (set status to RUNNING)
   */
  async resumeExecution(id: string): Promise<TaskExecutionEntity> {
    return this.updateStatus(id, ExecutionStatus.RUNNING);
  }

  /**
   * Get execution statistics by task
   */
  async getExecutionStatsByTask(taskId: string): Promise<ExecutionStatistics> {
    try {
      this.logger.debug('Getting execution statistics by task', { taskId });

      const stats = await this.getModel().groupBy({
        by: ['status'],
        where: { taskId },
        _count: {
          status: true,
        },
        _avg: {
          retryCount: true,
        },
      });

      const total = stats.reduce((sum, stat) => sum + stat._count.status, 0);
      const completed = stats.find(s => s.status === ExecutionStatus.COMPLETED)?._count.status || 0;
      const successRate = total > 0 ? (completed / total) * 100 : 0;

      const result: ExecutionStatistics = {
        total,
        initializing: stats.find(s => s.status === ExecutionStatus.INITIALIZING)?._count.status || 0,
        starting: stats.find(s => s.status === ExecutionStatus.STARTING)?._count.status || 0,
        running: stats.find(s => s.status === ExecutionStatus.RUNNING)?._count.status || 0,
        paused: stats.find(s => s.status === ExecutionStatus.PAUSED)?._count.status || 0,
        completed: completed,
        failed: stats.find(s => s.status === ExecutionStatus.FAILED)?._count.status || 0,
        cancelled: stats.find(s => s.status === ExecutionStatus.CANCELLED)?._count.status || 0,
        timeout: stats.find(s => s.status === ExecutionStatus.TIMEOUT)?._count.status || 0,
        averageRetryCount: stats[0]?._avg.retryCount || 0,
        successRate,
      };

      this.logger.debug('Execution statistics calculated', { taskId, stats: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get execution statistics by task', {
        error: error.message,
        taskId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get execution statistics by worker
   */
  async getExecutionStatsByWorker(workerId: string): Promise<ExecutionStatistics> {
    try {
      this.logger.debug('Getting execution statistics by worker', { workerId });

      const stats = await this.getModel().groupBy({
        by: ['status'],
        where: { workerId },
        _count: {
          status: true,
        },
        _avg: {
          retryCount: true,
        },
      });

      const total = stats.reduce((sum, stat) => sum + stat._count.status, 0);
      const completed = stats.find(s => s.status === ExecutionStatus.COMPLETED)?._count.status || 0;
      const successRate = total > 0 ? (completed / total) * 100 : 0;

      const result: ExecutionStatistics = {
        total,
        initializing: stats.find(s => s.status === ExecutionStatus.INITIALIZING)?._count.status || 0,
        starting: stats.find(s => s.status === ExecutionStatus.STARTING)?._count.status || 0,
        running: stats.find(s => s.status === ExecutionStatus.RUNNING)?._count.status || 0,
        paused: stats.find(s => s.status === ExecutionStatus.PAUSED)?._count.status || 0,
        completed: completed,
        failed: stats.find(s => s.status === ExecutionStatus.FAILED)?._count.status || 0,
        cancelled: stats.find(s => s.status === ExecutionStatus.CANCELLED)?._count.status || 0,
        timeout: stats.find(s => s.status === ExecutionStatus.TIMEOUT)?._count.status || 0,
        averageRetryCount: stats[0]?._avg.retryCount || 0,
        successRate,
      };

      this.logger.debug('Execution statistics calculated', { workerId, stats: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get execution statistics by worker', {
        error: error.message,
        workerId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get resource usage metrics
   */
  async getResourceUsageMetrics(options: { taskId?: string; workerId?: string; fromDate?: Date; toDate?: Date } = {}): Promise<ResourceUsageMetrics> {
    try {
      this.logger.debug('Getting resource usage metrics', options);

      const whereClause: any = {};
      if (options.taskId) {
        whereClause.taskId = options.taskId;
      }
      if (options.workerId) {
        whereClause.workerId = options.workerId;
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

      const [totalExecutions, resourceMetrics] = await Promise.all([
        this.getModel().count({ where: whereClause }),
        this.getModel().aggregate({
          where: whereClause,
          _avg: {
            cpuUsage: true,
            memoryUsage: true,
            diskUsage: true,
          },
          _max: {
            cpuUsage: true,
            memoryUsage: true,
            diskUsage: true,
          },
        }),
      ]);

      const result: ResourceUsageMetrics = {
        averageCpuUsage: resourceMetrics._avg.cpuUsage,
        peakCpuUsage: resourceMetrics._max.cpuUsage,
        averageMemoryUsage: resourceMetrics._avg.memoryUsage,
        peakMemoryUsage: resourceMetrics._max.memoryUsage,
        averageDiskUsage: resourceMetrics._avg.diskUsage,
        peakDiskUsage: resourceMetrics._max.diskUsage,
        totalExecutions,
      };

      this.logger.debug('Resource usage metrics calculated', { options, metrics: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get resource usage metrics', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get performance metrics for monitoring
   */
  async getPerformanceMetrics(options: { fromDate?: Date; toDate?: Date } = {}): Promise<ExecutionPerformanceMetrics> {
    try {
      this.logger.debug('Getting execution performance metrics', options);

      const whereClause: any = {};
      if (options.fromDate || options.toDate) {
        whereClause.createdAt = {};
        if (options.fromDate) {
          whereClause.createdAt.gte = options.fromDate;
        }
        if (options.toDate) {
          whereClause.createdAt.lte = options.toDate;
        }
      }

      // Get all executions for duration calculations
      const executions = await this.getModel().findMany({
        where: {
          ...whereClause,
          startedAt: { not: null },
          completedAt: { not: null },
        },
        select: {
          status: true,
          retryCount: true,
          cpuUsage: true,
          memoryUsage: true,
          diskUsage: true,
          errorMessage: true,
          startedAt: true,
          completedAt: true,
        },
      });

      const totalExecutions = executions.length;
      const successfulExecutions = executions.filter(e => e.status === ExecutionStatus.COMPLETED).length;
      const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

      // Calculate duration metrics
      const durations = executions
        .filter(e => e.startedAt && e.completedAt)
        .map(e => (e.completedAt!.getTime() - e.startedAt!.getTime()) / 1000) // Convert to seconds
        .sort((a, b) => a - b);

      const averageDuration = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : null;
      const medianDuration = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : null;
      const shortestDuration = durations.length > 0 ? durations[0] : null;
      const longestDuration = durations.length > 0 ? durations[durations.length - 1] : null;

      // Calculate retry metrics
      const averageRetryCount = executions.length > 0 ? executions.reduce((sum, e) => sum + e.retryCount, 0) / executions.length : 0;

      // Calculate failure reasons
      const failureReasons: { [reason: string]: number } = {};
      executions
        .filter(e => e.status === ExecutionStatus.FAILED && e.errorMessage)
        .forEach(e => {
          const reason = e.errorMessage!.split(':')[0] || 'unknown';
          failureReasons[reason] = (failureReasons[reason] || 0) + 1;
        });

      // Calculate resource efficiency
      const resourceMetrics = executions.filter(e => e.cpuUsage !== null || e.memoryUsage !== null || e.diskUsage !== null);
      const avgCpuUtilization = resourceMetrics.length > 0
        ? resourceMetrics.reduce((sum, e) => sum + (e.cpuUsage || 0), 0) / resourceMetrics.length
        : null;
      const avgMemoryUtilization = resourceMetrics.length > 0
        ? resourceMetrics.reduce((sum, e) => sum + (e.memoryUsage || 0), 0) / resourceMetrics.length
        : null;
      const avgDiskUtilization = resourceMetrics.length > 0
        ? resourceMetrics.reduce((sum, e) => sum + (e.diskUsage || 0), 0) / resourceMetrics.length
        : null;

      const result: ExecutionPerformanceMetrics = {
        totalExecutions,
        successRate,
        averageDuration,
        medianDuration,
        shortestDuration,
        longestDuration,
        averageRetryCount,
        failureReasons,
        resourceEfficiency: {
          avgCpuUtilization,
          avgMemoryUtilization,
          avgDiskUtilization,
        },
      };

      this.logger.debug('Performance metrics calculated', { options, metrics: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get performance metrics', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }
}