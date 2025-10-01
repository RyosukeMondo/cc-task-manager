import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JWTPayload } from '@schemas/auth';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { TrendFilterDto } from './dto/trend-filter.dto';
import {
  PerformanceMetricsDto,
  TrendDataResponseDto,
} from '@schemas/analytics';

/**
 * Analytics API Controller
 *
 * Provides REST endpoints for analytics data with:
 * - Performance metrics aggregation
 * - Time-series trend analysis
 * - Intelligent caching for performance
 * - JWT authentication
 * - Rate limiting (20 req/min per user)
 *
 * Follows contract-driven design with Zod validation
 */
@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Get performance metrics
   *
   * Returns aggregated performance metrics for the authenticated user
   * including completion rate, average execution time, and throughput.
   *
   * Results are cached for 5 minutes to improve performance.
   */
  @Get('performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get performance metrics',
    description: `Returns aggregated performance metrics for the authenticated user.

    **Metrics Included:**
    - Completion rate: Percentage of completed tasks
    - Average execution time: Mean time to complete tasks
    - Throughput: Tasks completed per hour
    - Total tasks, completed tasks, failed tasks

    **Default Date Range:** Last 30 days if not specified

    **Cache:** Results are cached for 5 minutes`,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO 8601 format)',
    example: '2024-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO 8601 format)',
    example: '2024-12-31T23:59:59Z',
  })
  @ApiOkResponse({
    description: 'Performance metrics retrieved successfully',
    type: Object, // PerformanceMetricsDto
  })
  @ApiBadRequestResponse({
    description: 'Invalid date range (startDate > endDate)',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getPerformanceMetrics(
    @Query() filter: AnalyticsFilterDto,
    @CurrentUser() user: JWTPayload,
  ): Promise<PerformanceMetricsDto> {
    return this.analyticsService.getPerformanceMetrics(filter, user.userId);
  }

  /**
   * Get trend data
   *
   * Returns time-series trend data for the authenticated user
   * grouped by day, week, or month.
   *
   * Auto-optimizes groupBy parameter for large date ranges:
   * - If range > 90 days and groupBy=day, switches to week
   *
   * Results are cached for 5 minutes to improve performance.
   */
  @Get('trends')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get trend data',
    description: `Returns time-series trend data grouped by specified period.

    **Grouping Options:**
    - day: Daily aggregation
    - week: Weekly aggregation
    - month: Monthly aggregation

    **Auto-Optimization:** If date range > 90 days and groupBy=day, switches to week to prevent excessive data points

    **Default Date Range:** Last 30 days if not specified

    **Cache:** Results are cached for 5 minutes`,
  })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['day', 'week', 'month'],
    description: 'Time period for grouping (default: day)',
    example: 'day',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO 8601 format)',
    example: '2024-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO 8601 format)',
    example: '2024-12-31T23:59:59Z',
  })
  @ApiOkResponse({
    description: 'Trend data retrieved successfully',
    type: Array, // TrendDataResponseDto (array of trend points)
  })
  @ApiBadRequestResponse({
    description: 'Invalid date range (startDate > endDate) or invalid groupBy',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getTrendData(
    @Query() filter: TrendFilterDto,
    @CurrentUser() user: JWTPayload,
  ): Promise<TrendDataResponseDto> {
    return this.analyticsService.getTrendData(filter, user.userId);
  }
}
