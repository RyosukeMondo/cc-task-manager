import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsCacheService } from './analytics-cache.service';
import {
  AnalyticsFilterDto,
  TrendFilterDto,
  PerformanceMetricsDto,
  TrendDataResponseDto,
  GroupByPeriod,
} from '@task-manager/schemas/analytics';

/**
 * Analytics Service
 *
 * Provides business logic for analytics data with intelligent caching.
 * Implements default date ranges and auto-optimization of grouping parameters.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly cacheService: AnalyticsCacheService,
  ) {}

  /**
   * Get performance metrics for a user
   * @param filter Analytics filter parameters
   * @param userId User ID
   * @returns Performance metrics
   */
  async getPerformanceMetrics(
    filter: AnalyticsFilterDto,
    userId: string,
  ): Promise<PerformanceMetricsDto> {
    this.logger.debug(`Getting performance metrics for user ${userId}`);

    // Calculate date range with defaults
    const { startDate, endDate } = this.calculateDateRange(filter);

    // Generate cache key
    const cacheKey = this.cacheService.generateCacheKey(userId, 'performance', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Check cache first
    const cached = await this.cacheService.get<PerformanceMetricsDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for performance metrics: ${cacheKey}`);
      return cached;
    }

    // Query repository on cache miss
    this.logger.debug(`Cache miss for performance metrics: ${cacheKey}`);
    const metrics = await this.repository.calculatePerformanceMetrics(
      userId,
      startDate,
      endDate,
    );

    // Cache results with 5 min TTL
    await this.cacheService.set(cacheKey, metrics, 300);

    return metrics;
  }

  /**
   * Get trend data for a user
   * @param filter Trend filter parameters
   * @param userId User ID
   * @returns Trend data
   */
  async getTrendData(
    filter: TrendFilterDto,
    userId: string,
  ): Promise<TrendDataResponseDto> {
    this.logger.debug(`Getting trend data for user ${userId}`);

    // Calculate date range with defaults
    const { startDate, endDate } = this.calculateDateRange(filter);

    // Auto-optimize groupBy parameter
    const optimizedGroupBy = this.selectOptimalGrouping(
      startDate,
      endDate,
      filter.groupBy,
    );

    if (optimizedGroupBy !== filter.groupBy) {
      this.logger.debug(
        `Auto-optimized groupBy from ${filter.groupBy} to ${optimizedGroupBy} for date range ${startDate.toISOString()} to ${endDate.toISOString()}`,
      );
    }

    // Generate cache key
    const cacheKey = this.cacheService.generateCacheKey(userId, 'trends', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      groupBy: optimizedGroupBy,
    });

    // Check cache first
    const cached = await this.cacheService.get<TrendDataResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for trend data: ${cacheKey}`);
      return cached;
    }

    // Query repository on cache miss
    this.logger.debug(`Cache miss for trend data: ${cacheKey}`);
    const trends = await this.repository.calculateTrends(
      userId,
      optimizedGroupBy,
      startDate,
      endDate,
    );

    // Cache results with 5 min TTL
    await this.cacheService.set(cacheKey, trends, 300);

    return trends;
  }

  /**
   * Get date 30 days ago from now
   * @private
   * @returns Date 30 days ago
   */
  private get30DaysAgo(): Date {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    // Set to start of day
    date.setHours(0, 0, 0, 0);
    return date;
  }

  /**
   * Auto-optimize groupBy parameter based on date range
   * If range > 90 days and groupBy is 'day', switch to 'week'
   * @private
   * @param startDate Start date
   * @param endDate End date
   * @param groupBy Original groupBy parameter
   * @returns Optimized groupBy parameter
   */
  private selectOptimalGrouping(
    startDate: Date,
    endDate: Date,
    groupBy: GroupByPeriod,
  ): GroupByPeriod {
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = durationMs / (1000 * 60 * 60 * 24);

    // If range > 90 days and groupBy is 'day', switch to 'week'
    if (durationDays > 90 && groupBy === GroupByPeriod.DAY) {
      return GroupByPeriod.WEEK;
    }

    return groupBy;
  }

  /**
   * Calculate date range with default fallbacks
   * Default: last 30 days if not specified
   * @private
   * @param filter Filter with optional date range
   * @returns Date range with start and end dates
   */
  private calculateDateRange(filter: AnalyticsFilterDto | TrendFilterDto): {
    startDate: Date;
    endDate: Date;
  } {
    let startDate: Date;
    let endDate: Date;

    if (filter.endDate) {
      endDate = new Date(filter.endDate);
      // Set to end of day
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = new Date();
      // Set to end of day
      endDate.setHours(23, 59, 59, 999);
    }

    if (filter.startDate) {
      startDate = new Date(filter.startDate);
      // Set to start of day
      startDate.setHours(0, 0, 0, 0);
    } else {
      // Default to 30 days ago if not specified
      startDate = this.get30DaysAgo();
    }

    return { startDate, endDate };
  }
}
