import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ApiTask, Prisma } from '@prisma/client';
import {
  CreateApiTaskDto,
  UpdateApiTaskDto,
  ApiTaskFilterDto,
  ApiTaskDto,
  PaginatedTasksDto,
} from '@repo/schemas';

/**
 * TasksRepository - Data access layer for API tasks
 *
 * Implements repository pattern to isolate database operations from business logic.
 * Uses Prisma ORM for type-safe database access with proper error handling.
 *
 * Responsibilities:
 * - CRUD operations for ApiTask model
 * - Query filtering and pagination
 * - Soft delete support
 * - Data transformation between Prisma and DTO types
 */
@Injectable()
export class TasksRepository {
  private readonly logger = new Logger(TasksRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new task
   *
   * @param data Task creation data
   * @param userId User ID who owns the task
   * @returns Created task
   */
  async create(data: CreateApiTaskDto, userId: string): Promise<ApiTask> {
    try {
      this.logger.debug('Creating API task', { userId, title: data.title });

      const task = await this.prisma.apiTask.create({
        data: {
          title: data.title,
          description: data.description ?? null,
          priority: data.priority,
          userId,
        },
      });

      this.logger.log('API task created successfully', { id: task.id });
      return task;
    } catch (error) {
      this.logger.error('Failed to create API task', {
        error: error.message,
        userId,
        data,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find task by ID (excluding soft-deleted)
   *
   * @param id Task ID
   * @returns Task if found and not deleted, null otherwise
   */
  async findUnique(where: { id: string; userId?: string }): Promise<ApiTask | null> {
    try {
      this.logger.debug('Finding API task', { where });

      const task = await this.prisma.apiTask.findFirst({
        where: {
          id: where.id,
          userId: where.userId,
          deletedAt: null, // Exclude soft-deleted tasks
        },
      });

      if (!task) {
        this.logger.debug('API task not found', { where });
        return null;
      }

      return task;
    } catch (error) {
      this.logger.error('Failed to find API task', {
        error: error.message,
        where,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find tasks with filtering and pagination
   *
   * @param params Filter and pagination parameters
   * @param userId User ID for ownership filtering
   * @returns Paginated tasks with total count
   */
  async findAndCount(
    params: ApiTaskFilterDto,
    userId: string,
  ): Promise<PaginatedTasksDto> {
    try {
      this.logger.debug('Finding API tasks with filters', { params, userId });

      // Build where clause
      const where: Prisma.ApiTaskWhereInput = {
        userId,
        deletedAt: null, // Exclude soft-deleted tasks
      };

      if (params.status) {
        where.status = params.status;
      }

      if (params.priority) {
        where.priority = params.priority;
      }

      // Execute queries in parallel
      const [tasks, total] = await Promise.all([
        this.prisma.apiTask.findMany({
          where,
          skip: params.offset,
          take: params.limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.apiTask.count({ where }),
      ]);

      this.logger.debug(`Found ${total} API tasks, returning ${tasks.length} items`);

      return {
        data: tasks as ApiTaskDto[],
        total,
        limit: params.limit,
        offset: params.offset,
      };
    } catch (error) {
      this.logger.error('Failed to find API tasks', {
        error: error.message,
        params,
        userId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Update task by ID
   *
   * @param id Task ID
   * @param data Update data
   * @param userId User ID for ownership verification
   * @returns Updated task
   */
  async update(
    id: string,
    data: UpdateApiTaskDto,
    userId: string,
  ): Promise<ApiTask> {
    try {
      this.logger.debug('Updating API task', { id, userId, data });

      const updateData: Prisma.ApiTaskUpdateInput = {};

      if (data.status !== undefined) {
        updateData.status = data.status;

        // Set completion/failure timestamps based on status
        if (data.status === 'COMPLETED') {
          updateData.completedAt = new Date();
        } else if (data.status === 'FAILED') {
          updateData.failedAt = new Date();
        } else if (data.status === 'RUNNING') {
          updateData.startedAt = new Date();
        }
      }

      if (data.priority !== undefined) {
        updateData.priority = data.priority;
      }

      if (data.errorMessage !== undefined) {
        updateData.errorMessage = data.errorMessage;
      }

      const task = await this.prisma.apiTask.update({
        where: {
          id,
          userId, // Ensure user owns the task
          deletedAt: null, // Prevent updating deleted tasks
        },
        data: updateData,
      });

      this.logger.log('API task updated successfully', { id });
      return task;
    } catch (error) {
      this.logger.error('Failed to update API task', {
        error: error.message,
        id,
        userId,
        data,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Soft delete task by ID
   *
   * @param id Task ID
   * @param userId User ID for ownership verification
   */
  async softDelete(id: string, userId: string): Promise<void> {
    try {
      this.logger.debug('Soft deleting API task', { id, userId });

      await this.prisma.apiTask.update({
        where: {
          id,
          userId, // Ensure user owns the task
          deletedAt: null, // Prevent double deletion
        },
        data: {
          deletedAt: new Date(),
        },
      });

      this.logger.log('API task soft deleted successfully', { id });
    } catch (error) {
      this.logger.error('Failed to soft delete API task', {
        error: error.message,
        id,
        userId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Handle Prisma-specific errors and transform them to domain errors
   *
   * @param error Prisma error
   * @returns Transformed error
   */
  private handlePrismaError(error: any): Error {
    // Handle Prisma-specific error codes
    if (error.code === 'P2002') {
      return new Error('Task with this identifier already exists');
    }

    if (error.code === 'P2025') {
      return new Error('Task not found or access denied');
    }

    if (error.code === 'P2003') {
      return new Error('Foreign key constraint failed');
    }

    // Return original error if not a known Prisma error
    return error;
  }
}
