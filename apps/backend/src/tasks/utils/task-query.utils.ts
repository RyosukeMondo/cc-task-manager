import { BadRequestException, Logger } from '@nestjs/common';
import {
  TaskQueryDto,
  TaskStatus,
  TaskPriority,
  validateTaskQuery,
  safeParseTaskQuery
} from '../../../../../packages/schemas/src/tasks/task-schemas';

/**
 * Task Query Utilities
 *
 * Implements SOLID principles for task filtering and pagination:
 *
 * 1. Single Responsibility Principle:
 *    - Focused solely on query processing and optimization
 *    - Separate interfaces for different query concerns
 *
 * 2. Interface Segregation Principle:
 *    - Specific interfaces for filtering, sorting, and pagination
 *    - Clients depend only on methods they use
 *
 * 3. Dependency Inversion Principle:
 *    - Depends on abstractions for query building
 *    - Extensible for different database implementations
 *
 * 4. KISS Principle:
 *    - Simple, focused utility functions
 *    - Clear, readable query logic
 *
 * 5. DRY/SSOT Principle:
 *    - Reusable query patterns
 *    - Single source of truth for query logic
 */

export interface ITaskQueryBuilder {
  buildWhereClause(filters: TaskQueryDto): any;
  buildOrderByClause(sortBy: string, sortOrder: 'asc' | 'desc'): any;
  buildPaginationClause(page: number, limit: number): { skip: number; take: number };
}

export interface ITaskFilterProcessor {
  processStatusFilter(statuses: TaskStatus[]): any;
  processPriorityFilter(priorities: TaskPriority[]): any;
  processDateRangeFilter(field: string, after?: string, before?: string): any;
  processSearchFilter(searchTerm: string): any;
  processTagsFilter(tags: string[]): any;
}

export interface ITaskQueryValidator {
  validateQuery(query: unknown): TaskQueryDto;
  validateQuerySafe(query: unknown): { success: boolean; data?: TaskQueryDto; error?: string };
}

export interface ITaskQueryOptimizer {
  optimizeQuery(filters: TaskQueryDto): TaskQueryDto;
  estimateQueryComplexity(filters: TaskQueryDto): 'low' | 'medium' | 'high';
}

/**
 * Task Query Validator Implementation
 * Provides fail-fast validation with detailed error messages
 */
export class TaskQueryValidator implements ITaskQueryValidator {
  private readonly logger = new Logger(TaskQueryValidator.name);

  /**
   * Validates task query with fail-fast error handling
   * @param query Raw query object
   * @returns Validated TaskQueryDto
   * @throws BadRequestException for invalid queries
   */
  validateQuery(query: unknown): TaskQueryDto {
    try {
      const validatedQuery = validateTaskQuery(query);
      this.logger.debug('Query validation successful', {
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        hasFilters: this.hasActiveFilters(validatedQuery)
      });
      return validatedQuery;
    } catch (error) {
      this.logger.warn('Query validation failed', { error: error.message, query });
      throw new BadRequestException({
        error: 'QueryValidationError',
        message: error.message,
        details: 'Query parameters do not meet schema requirements'
      });
    }
  }

  /**
   * Safe query validation that returns result instead of throwing
   * @param query Raw query object
   * @returns Validation result with success flag
   */
  validateQuerySafe(query: unknown): { success: boolean; data?: TaskQueryDto; error?: string } {
    const result = safeParseTaskQuery(query);
    if (result.success) {
      this.logger.debug('Safe query validation successful');
      return { success: true, data: result.data };
    } else {
      this.logger.debug('Safe query validation failed', { error: result.error.message });
      return { success: false, error: result.error.message };
    }
  }

  /**
   * Check if query has active filters (beyond defaults)
   * @param query Validated query
   * @returns True if has active filters
   */
  private hasActiveFilters(query: TaskQueryDto): boolean {
    return !!(
      query.status ||
      query.priority ||
      query.projectId ||
      query.createdAfter ||
      query.createdBefore ||
      query.search ||
      (query.sortBy && query.sortBy !== 'createdAt') ||
      (query.sortOrder && query.sortOrder !== 'desc')
    );
  }
}

/**
 * Task Filter Processor Implementation
 * Handles specific filter type processing
 */
export class TaskFilterProcessor implements ITaskFilterProcessor {
  private readonly logger = new Logger(TaskFilterProcessor.name);

  /**
   * Process status filter into database query format
   * @param statuses Array of task statuses to filter by
   * @returns Database query fragment for status filtering
   */
  processStatusFilter(statuses: TaskStatus[]): any {
    if (!statuses || statuses.length === 0) return null;

    this.logger.debug(`Processing status filter: ${statuses.join(', ')}`);
    return {
      status: {
        in: statuses
      }
    };
  }

  /**
   * Process priority filter into database query format
   * @param priorities Array of task priorities to filter by
   * @returns Database query fragment for priority filtering
   */
  processPriorityFilter(priorities: TaskPriority[]): any {
    if (!priorities || priorities.length === 0) return null;

    this.logger.debug(`Processing priority filter: ${priorities.join(', ')}`);
    return {
      priority: {
        in: priorities
      }
    };
  }

  /**
   * Process date range filter for any date field
   * @param field Database field name (e.g., 'createdAt', 'updatedAt')
   * @param after ISO date string for range start
   * @param before ISO date string for range end
   * @returns Database query fragment for date range filtering
   */
  processDateRangeFilter(field: string, after?: string, before?: string): any {
    if (!after && !before) return null;

    const dateFilter: any = {};

    if (after) {
      dateFilter.gte = new Date(after);
      this.logger.debug(`Processing date filter: ${field} >= ${after}`);
    }

    if (before) {
      dateFilter.lte = new Date(before);
      this.logger.debug(`Processing date filter: ${field} <= ${before}`);
    }

    return {
      [field]: dateFilter
    };
  }

  /**
   * Process full-text search filter
   * @param searchTerm Search term for title and description
   * @returns Database query fragment for text search
   */
  processSearchFilter(searchTerm: string): any {
    if (!searchTerm || searchTerm.trim().length === 0) return null;

    const cleanTerm = searchTerm.trim().toLowerCase();
    this.logger.debug(`Processing search filter: "${cleanTerm}"`);

    return {
      OR: [
        {
          title: {
            contains: cleanTerm,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: cleanTerm,
            mode: 'insensitive'
          }
        },
        {
          prompt: {
            contains: cleanTerm,
            mode: 'insensitive'
          }
        },
        {
          tags: {
            has: cleanTerm
          }
        }
      ]
    };
  }

  /**
   * Process tags filter
   * @param tags Array of tags to filter by
   * @returns Database query fragment for tag filtering
   */
  processTagsFilter(tags: string[]): any {
    if (!tags || tags.length === 0) return null;

    this.logger.debug(`Processing tags filter: ${tags.join(', ')}`);
    return {
      tags: {
        hasAny: tags
      }
    };
  }
}

/**
 * Task Query Builder Implementation
 * Builds database-specific query clauses
 */
export class TaskQueryBuilder implements ITaskQueryBuilder {
  private readonly logger = new Logger(TaskQueryBuilder.name);
  private readonly filterProcessor = new TaskFilterProcessor();

  /**
   * Build complete WHERE clause from filters
   * @param filters Validated task query filters
   * @returns Database WHERE clause object
   */
  buildWhereClause(filters: TaskQueryDto): any {
    const whereClause: any = { AND: [] };

    // Process each filter type
    const statusFilter = this.filterProcessor.processStatusFilter(filters.status);
    if (statusFilter) whereClause.AND.push(statusFilter);

    const priorityFilter = this.filterProcessor.processPriorityFilter(filters.priority);
    if (priorityFilter) whereClause.AND.push(priorityFilter);

    // Project filter
    if (filters.projectId) {
      whereClause.AND.push({ projectId: filters.projectId });
      this.logger.debug(`Added project filter: ${filters.projectId}`);
    }

    // Date range filters
    const createdAtFilter = this.filterProcessor.processDateRangeFilter(
      'createdAt',
      filters.createdAfter,
      filters.createdBefore
    );
    if (createdAtFilter) whereClause.AND.push(createdAtFilter);

    // Search filter
    const searchFilter = this.filterProcessor.processSearchFilter(filters.search);
    if (searchFilter) whereClause.AND.push(searchFilter);

    // Return null if no filters to avoid empty AND clause
    if (whereClause.AND.length === 0) {
      this.logger.debug('No active filters, returning null WHERE clause');
      return null;
    }

    this.logger.debug(`Built WHERE clause with ${whereClause.AND.length} conditions`);
    return whereClause;
  }

  /**
   * Build ORDER BY clause for sorting
   * @param sortBy Field to sort by
   * @param sortOrder Sort direction
   * @returns Database ORDER BY clause
   */
  buildOrderByClause(sortBy: string, sortOrder: 'asc' | 'desc'): any {
    const validSortFields = ['createdAt', 'updatedAt', 'priority', 'status', 'title'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    this.logger.debug(`Built ORDER BY: ${field} ${order.toUpperCase()}`);

    // Handle priority sorting with custom priority order
    if (field === 'priority') {
      return {
        priority: {
          sort: 'asc',
          nulls: 'last'
        }
      };
    }

    return {
      [field]: order
    };
  }

  /**
   * Build pagination parameters
   * @param page Page number (1-based)
   * @param limit Items per page
   * @returns Pagination parameters for database
   */
  buildPaginationClause(page: number, limit: number): { skip: number; take: number } {
    const skip = (page - 1) * limit;
    const take = limit;

    this.logger.debug(`Built pagination: skip=${skip}, take=${take} (page ${page})`);

    return { skip, take };
  }
}

/**
 * Task Query Optimizer Implementation
 * Optimizes queries for performance
 */
export class TaskQueryOptimizer implements ITaskQueryOptimizer {
  private readonly logger = new Logger(TaskQueryOptimizer.name);

  /**
   * Optimize query for better performance
   * @param filters Original query filters
   * @returns Optimized query filters
   */
  optimizeQuery(filters: TaskQueryDto): TaskQueryDto {
    const optimized = { ...filters };

    // Optimize limit to prevent large result sets
    if (optimized.limit > 50) {
      this.logger.warn(`Large limit requested (${optimized.limit}), capping at 50 for performance`);
      optimized.limit = 50;
    }

    // Optimize search terms
    if (optimized.search && optimized.search.length < 2) {
      this.logger.debug('Search term too short, removing search filter');
      delete optimized.search;
    }

    // Add default sorting if none specified
    if (!optimized.sortBy) {
      optimized.sortBy = 'createdAt';
      optimized.sortOrder = 'desc';
    }

    this.logger.debug('Query optimization completed');
    return optimized;
  }

  /**
   * Estimate query complexity for monitoring
   * @param filters Query filters
   * @returns Complexity estimate
   */
  estimateQueryComplexity(filters: TaskQueryDto): 'low' | 'medium' | 'high' {
    let complexityScore = 0;

    // Base pagination complexity
    if (filters.limit > 20) complexityScore += 1;
    if (filters.page > 10) complexityScore += 1;

    // Filter complexity
    if (filters.status && filters.status.length > 1) complexityScore += 1;
    if (filters.priority && filters.priority.length > 1) complexityScore += 1;
    if (filters.search) complexityScore += 2; // Text search is expensive
    if (filters.createdAfter || filters.createdBefore) complexityScore += 1;

    const complexity = complexityScore <= 2 ? 'low' :
                      complexityScore <= 4 ? 'medium' : 'high';

    this.logger.debug(`Query complexity: ${complexity} (score: ${complexityScore})`);
    return complexity;
  }
}

/**
 * Unified Task Query Utilities
 * Main entry point for task query processing
 */
export class TaskQueryUtils {
  private readonly logger = new Logger(TaskQueryUtils.name);
  private readonly validator = new TaskQueryValidator();
  private readonly builder = new TaskQueryBuilder();
  private readonly optimizer = new TaskQueryOptimizer();

  constructor() {
    this.logger.log('TaskQueryUtils initialized');
  }

  /**
   * Process raw query into validated and optimized database query
   * @param rawQuery Raw query parameters
   * @returns Processed query components
   */
  processQuery(rawQuery: unknown) {
    const startTime = Date.now();

    try {
      // Step 1: Validate query (fail-fast)
      const validatedQuery = this.validator.validateQuery(rawQuery);

      // Step 2: Optimize query for performance
      const optimizedQuery = this.optimizer.optimizeQuery(validatedQuery);

      // Step 3: Build database query components
      const whereClause = this.builder.buildWhereClause(optimizedQuery);
      const orderBy = this.builder.buildOrderByClause(optimizedQuery.sortBy, optimizedQuery.sortOrder);
      const pagination = this.builder.buildPaginationClause(optimizedQuery.page, optimizedQuery.limit);

      // Step 4: Estimate complexity for monitoring
      const complexity = this.optimizer.estimateQueryComplexity(optimizedQuery);

      const processingTime = Date.now() - startTime;
      this.logger.debug(`Query processed in ${processingTime}ms`, { complexity });

      return {
        filters: optimizedQuery,
        whereClause,
        orderBy,
        pagination,
        complexity,
        processingTime
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Query processing failed in ${processingTime}ms`, { error: error.message });
      throw error;
    }
  }

  /**
   * Validate query safely without throwing
   * @param rawQuery Raw query parameters
   * @returns Validation result
   */
  validateQuerySafe(rawQuery: unknown) {
    return this.validator.validateQuerySafe(rawQuery);
  }

  /**
   * Build pagination metadata for responses
   * @param page Current page
   * @param limit Items per page
   * @param total Total items count
   * @returns Pagination metadata
   */
  buildPaginationMetadata(page: number, limit: number, total: number) {
    const totalPages = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }
}

// Export singleton instance for consistent usage
export const taskQueryUtils = new TaskQueryUtils();

// Individual components are already exported above as classes