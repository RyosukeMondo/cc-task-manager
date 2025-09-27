import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  IBaseRepository,
  FindManyOptions,
  FindOneOptions,
  CountOptions,
} from '../interfaces/base-repository.interface';

/**
 * Base Repository Implementation using Prisma
 * Implements Repository Pattern with Dependency Inversion Principle
 * 
 * This abstract class provides common CRUD operations for all entities
 * and delegates entity-specific operations to concrete implementations
 */
@Injectable()
export abstract class BaseRepository<T, ID = string> implements IBaseRepository<T, ID> {
  protected readonly logger: Logger;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly modelName: string
  ) {
    this.logger = new Logger(`${this.constructor.name}`);
  }

  /**
   * Get the Prisma model delegate for the specific entity
   */
  protected abstract getModel(): any;

  /**
   * Transform Prisma entity to domain entity
   * Override in concrete repositories for custom transformations
   */
  protected transformToDomain(entity: any): T {
    return entity as T;
  }

  /**
   * Transform domain entity to Prisma entity
   * Override in concrete repositories for custom transformations
   */
  protected transformToPrisma(entity: Partial<T>): any {
    return entity;
  }

  /**
   * Transform find options to Prisma where clause
   */
  protected transformWhereClause(options?: FindManyOptions<T> | FindOneOptions<T> | CountOptions<T>): any {
    if (!options?.where) return {};
    
    // Simple transformation - can be extended for complex queries
    return this.transformToPrisma(options.where as Partial<T>);
  }

  /**
   * Transform order by options to Prisma orderBy clause
   */
  protected transformOrderBy(orderBy?: any): any {
    return orderBy || {};
  }

  /**
   * Create a new entity
   */
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    try {
      this.logger.debug(`Creating ${this.modelName}`, { data });
      
      const transformedData = this.transformToPrisma(data);
      const created = await this.getModel().create({
        data: transformedData,
      });
      
      this.logger.log(`${this.modelName} created successfully`, { id: created.id });
      return this.transformToDomain(created);
    } catch (error) {
      this.logger.error(`Failed to create ${this.modelName}`, {
        error: error.message,
        data,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find entity by ID
   */
  async findById(id: ID): Promise<T | null> {
    try {
      this.logger.debug(`Finding ${this.modelName} by ID`, { id });
      
      const entity = await this.getModel().findUnique({
        where: { id },
      });
      
      if (!entity) {
        this.logger.debug(`${this.modelName} not found`, { id });
        return null;
      }
      
      return this.transformToDomain(entity);
    } catch (error) {
      this.logger.error(`Failed to find ${this.modelName} by ID`, {
        error: error.message,
        id,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find multiple entities with optional filtering
   */
  async findMany(options?: FindManyOptions<T>): Promise<T[]> {
    try {
      this.logger.debug(`Finding multiple ${this.modelName}`, { options });
      
      const entities = await this.getModel().findMany({
        where: this.transformWhereClause(options),
        orderBy: this.transformOrderBy(options?.orderBy),
        skip: options?.skip,
        take: options?.take,
        include: options?.include,
      });
      
      this.logger.debug(`Found ${entities.length} ${this.modelName} entities`);
      return entities.map(entity => this.transformToDomain(entity));
    } catch (error) {
      this.logger.error(`Failed to find multiple ${this.modelName}`, {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find one entity with optional filtering
   */
  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    try {
      this.logger.debug(`Finding one ${this.modelName}`, { options });
      
      const entity = await this.getModel().findFirst({
        where: this.transformWhereClause(options),
        include: options?.include,
      });
      
      if (!entity) {
        this.logger.debug(`${this.modelName} not found`, { options });
        return null;
      }
      
      return this.transformToDomain(entity);
    } catch (error) {
      this.logger.error(`Failed to find one ${this.modelName}`, {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Update entity by ID
   */
  async update(id: ID, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T> {
    try {
      this.logger.debug(`Updating ${this.modelName}`, { id, data });
      
      const transformedData = this.transformToPrisma(data);
      const updated = await this.getModel().update({
        where: { id },
        data: transformedData,
      });
      
      this.logger.log(`${this.modelName} updated successfully`, { id });
      return this.transformToDomain(updated);
    } catch (error) {
      this.logger.error(`Failed to update ${this.modelName}`, {
        error: error.message,
        id,
        data,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Delete entity by ID
   */
  async delete(id: ID): Promise<void> {
    try {
      this.logger.debug(`Deleting ${this.modelName}`, { id });
      
      await this.getModel().delete({
        where: { id },
      });
      
      this.logger.log(`${this.modelName} deleted successfully`, { id });
    } catch (error) {
      this.logger.error(`Failed to delete ${this.modelName}`, {
        error: error.message,
        id,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Count entities with optional filtering
   */
  async count(options?: CountOptions<T>): Promise<number> {
    try {
      this.logger.debug(`Counting ${this.modelName}`, { options });
      
      const count = await this.getModel().count({
        where: this.transformWhereClause(options),
      });
      
      this.logger.debug(`Found ${count} ${this.modelName} entities`);
      return count;
    } catch (error) {
      this.logger.error(`Failed to count ${this.modelName}`, {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Check if entity exists by ID
   */
  async exists(id: ID): Promise<boolean> {
    try {
      const count = await this.getModel().count({
        where: { id },
      });
      return count > 0;
    } catch (error) {
      this.logger.error(`Failed to check if ${this.modelName} exists`, {
        error: error.message,
        id,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Handle Prisma-specific errors and transform them to domain errors
   */
  protected handlePrismaError(error: any): Error {
    // Handle Prisma-specific errors
    if (error.code === 'P2002') {
      return new Error(`${this.modelName} with this ${error.meta?.target} already exists`);
    }
    
    if (error.code === 'P2025') {
      return new Error(`${this.modelName} not found`);
    }
    
    if (error.code === 'P2003') {
      return new Error(`Foreign key constraint failed on ${this.modelName}`);
    }
    
    // Return original error if not a known Prisma error
    return error;
  }

  /**
   * Execute a transaction
   */
  protected async executeTransaction<R>(fn: (tx: any) => Promise<R>): Promise<R> {
    return await this.prisma.$transaction(fn);
  }
}