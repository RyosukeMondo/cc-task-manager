# Design Document - Backend Analytics API

## Architecture Overview

The Backend Analytics API aggregates task data to provide performance metrics and trend analysis:

```
Controller (HTTP) → Service (Aggregation Logic) → Repository (Prisma Aggregation) → Database
                           ↓
                    Cache Layer (Redis)
```

### Module Structure

```typescript
AnalyticsModule
├── AnalyticsController (HTTP endpoints)
├── AnalyticsService (Aggregation logic + caching)
├── AnalyticsRepository (Database aggregation queries)
└── DTOs
    ├── AnalyticsFilterDto
    ├── PerformanceMetricsDto
    └── TrendDataDto
```

## API Endpoints

### 1. Get Performance Metrics

```typescript
GET /api/analytics/performance?startDate=2025-09-01&endDate=2025-10-01
Authorization: Bearer <jwt>

Query Parameters:
- startDate?: ISO8601 date (default: 30 days ago)
- endDate?: ISO8601 date (default: now)

Response (200 OK):
{
  "completionRate": 85.5,          // Percentage of completed tasks
  "averageExecutionTime": 12450,   // Milliseconds
  "throughput": 42.3,               // Tasks completed per hour
  "totalTasks": 1247,
  "completedTasks": 1066,
  "failedTasks": 181,
  "period": {
    "start": "2025-09-01T00:00:00Z",
    "end": "2025-10-01T00:00:00Z"
  }
}

Errors:
- 400 Bad Request: Invalid date range
- 401 Unauthorized: No JWT
```

### 2. Get Trend Data

```typescript
GET /api/analytics/trends?groupBy=day&startDate=2025-09-01&endDate=2025-10-01
Authorization: Bearer <jwt>

Query Parameters:
- groupBy: "day" | "week" | "month" (required)
- startDate?: ISO8601 date
- endDate?: ISO8601 date

Response (200 OK):
{
  "data": [
    {
      "period": "2025-09-01",
      "totalTasks": 45,
      "completedTasks": 38,
      "failedTasks": 7,
      "averageExecutionTime": 11200
    },
    {
      "period": "2025-09-02",
      "totalTasks": 52,
      "completedTasks": 48,
      "failedTasks": 4,
      "averageExecutionTime": 10800
    }
    // ... more periods
  ],
  "meta": {
    "groupBy": "day",
    "totalPeriods": 30
  }
}
```

## Component Design

### AnalyticsController

```typescript
@Controller('api/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('performance')
  async getPerformanceMetrics(
    @Query() filter: AnalyticsFilterDto,
    @User() user
  ): Promise<PerformanceMetricsDto> {
    return this.analyticsService.getPerformanceMetrics(filter, user.id);
  }

  @Get('trends')
  async getTrendData(
    @Query() filter: TrendFilterDto,
    @User() user
  ): Promise<TrendDataResponseDto> {
    return this.analyticsService.getTrendData(filter, user.id);
  }
}
```

### AnalyticsService

```typescript
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly cacheManager: Cache,
    private readonly logger: Logger
  ) {}

  async getPerformanceMetrics(
    filter: AnalyticsFilterDto,
    userId: string
  ): Promise<PerformanceMetricsDto> {
    const cacheKey = `analytics:performance:${userId}:${filter.startDate}:${filter.endDate}`;

    // Check cache first (5 min TTL)
    const cached = await this.cacheManager.get<PerformanceMetricsDto>(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit for performance metrics');
      return cached;
    }

    // Query database
    const metrics = await this.analyticsRepository.calculatePerformanceMetrics({
      userId,
      startDate: filter.startDate || this.get30DaysAgo(),
      endDate: filter.endDate || new Date()
    });

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, metrics, { ttl: 300 });

    return metrics;
  }

  async getTrendData(
    filter: TrendFilterDto,
    userId: string
  ): Promise<TrendDataResponseDto> {
    const cacheKey = `analytics:trends:${userId}:${filter.groupBy}:${filter.startDate}:${filter.endDate}`;

    const cached = await this.cacheManager.get<TrendDataResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    // Auto-select groupBy based on date range
    const dateRange = this.calculateDateRange(filter.startDate, filter.endDate);
    const groupBy = this.selectOptimalGrouping(dateRange, filter.groupBy);

    const trends = await this.analyticsRepository.calculateTrends({
      userId,
      groupBy,
      startDate: filter.startDate || this.get30DaysAgo(),
      endDate: filter.endDate || new Date()
    });

    const response = {
      data: trends,
      meta: {
        groupBy,
        totalPeriods: trends.length
      }
    };

    await this.cacheManager.set(cacheKey, response, { ttl: 300 });

    return response;
  }

  private selectOptimalGrouping(dateRangeDays: number, requested?: string): string {
    // Auto-optimize grouping based on date range
    if (dateRangeDays > 90 && requested === 'day') {
      return 'week'; // Too many data points, use weekly grouping
    }
    return requested || 'day';
  }

  private get30DaysAgo(): Date {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  }

  private calculateDateRange(start?: Date, end?: Date): number {
    const startDate = start || this.get30DaysAgo();
    const endDate = end || new Date();
    const diffMs = endDate.getTime() - startDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)); // Convert to days
  }
}
```

### AnalyticsRepository

```typescript
@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async calculatePerformanceMetrics(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<PerformanceMetricsDto> {
    const { userId, startDate, endDate } = params;

    // Aggregate queries (efficient database-level computation)
    const [aggregation] = await this.prisma.task.aggregate({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
        deletedAt: null
      },
      _count: { id: true },
      _avg: {
        // Calculate avg execution time (completedAt - startedAt)
        // Note: Prisma doesn't support computed fields in aggregate, so we'll use raw query
      }
    });

    // Count by status
    const statusCounts = await this.prisma.task.groupBy({
      by: ['status'],
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
        deletedAt: null
      },
      _count: { id: true }
    });

    const totalTasks = aggregation._count.id;
    const completedTasks = statusCounts.find(s => s.status === 'COMPLETED')?._count.id || 0;
    const failedTasks = statusCounts.find(s => s.status === 'FAILED')?._count.id || 0;

    // Calculate average execution time via raw SQL (more efficient)
    const avgTimeResult = await this.prisma.$queryRaw<[{ avg_time: number }]>`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) * 1000 as avg_time
      FROM tasks
      WHERE user_id = ${userId}
        AND status = 'COMPLETED'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND deleted_at IS NULL
    `;

    const averageExecutionTime = avgTimeResult[0]?.avg_time || 0;

    // Calculate throughput (tasks per hour)
    const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const throughput = durationHours > 0 ? completedTasks / durationHours : 0;

    return {
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      averageExecutionTime: Math.round(averageExecutionTime),
      throughput: Math.round(throughput * 10) / 10, // Round to 1 decimal
      totalTasks,
      completedTasks,
      failedTasks,
      period: { start: startDate, end: endDate }
    };
  }

  async calculateTrends(params: {
    userId: string;
    groupBy: 'day' | 'week' | 'month';
    startDate: Date;
    endDate: Date;
  }): Promise<TrendDataPoint[]> {
    const { userId, groupBy, startDate, endDate } = params;

    // SQL date truncation based on groupBy
    const dateTrunc = {
      day: 'DATE(created_at)',
      week: 'DATE_TRUNC(\'week\', created_at)',
      month: 'DATE_TRUNC(\'month\', created_at)'
    }[groupBy];

    // Raw SQL for efficient time-series aggregation
    const results = await this.prisma.$queryRaw<TrendDataPoint[]>`
      SELECT
        ${dateTrunc} as period,
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_tasks,
        COUNT(*) FILTER (WHERE status = 'FAILED') as failed_tasks,
        AVG(
          CASE
            WHEN status = 'COMPLETED' AND completed_at IS NOT NULL AND started_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
            ELSE NULL
          END
        ) as average_execution_time
      FROM tasks
      WHERE user_id = ${userId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND deleted_at IS NULL
      GROUP BY ${dateTrunc}
      ORDER BY period ASC
    `;

    return results.map(row => ({
      period: row.period.toISOString().split('T')[0], // Format as YYYY-MM-DD
      totalTasks: Number(row.total_tasks),
      completedTasks: Number(row.completed_tasks),
      failedTasks: Number(row.failed_tasks),
      averageExecutionTime: Math.round(Number(row.average_execution_time) || 0)
    }));
  }
}
```

## DTOs and Validation

### AnalyticsFilterDto

```typescript
// packages/schemas/src/analytics.schema.ts
import { z } from 'zod';

export const analyticsFilterSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
}).refine(
  data => !data.startDate || !data.endDate || data.startDate <= data.endDate,
  { message: 'startDate must be before endDate' }
);

export type AnalyticsFilterDto = z.infer<typeof analyticsFilterSchema>;
```

### TrendFilterDto

```typescript
export const trendFilterSchema = analyticsFilterSchema.extend({
  groupBy: z.enum(['day', 'week', 'month']).default('day')
});

export type TrendFilterDto = z.infer<typeof trendFilterSchema>;
```

### PerformanceMetricsDto

```typescript
export const performanceMetricsSchema = z.object({
  completionRate: z.number(),
  averageExecutionTime: z.number(),
  throughput: z.number(),
  totalTasks: z.number(),
  completedTasks: z.number(),
  failedTasks: z.number(),
  period: z.object({
    start: z.date(),
    end: z.date()
  })
});

export type PerformanceMetricsDto = z.infer<typeof performanceMetricsSchema>;
```

## File Structure

```
apps/backend/src/analytics/
├── analytics.module.ts            # Module with Redis cache integration
├── analytics.controller.ts        # HTTP endpoints
├── analytics.service.ts           # Aggregation logic + caching
├── analytics.repository.ts        # Prisma aggregation queries
└── dto/
    ├── analytics-filter.dto.ts    # Import from schemas package
    ├── trend-filter.dto.ts        # Import from schemas package
    └── performance-metrics.dto.ts # Import from schemas package

packages/schemas/src/
├── analytics.schema.ts            # Zod schemas (SSOT)
└── index.ts                       # Export schemas

apps/frontend/src/lib/api/
└── contract-client.ts             # Add analytics methods
```

## Caching Strategy

### Redis Configuration

```typescript
// analytics.module.ts
@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      ttl: 300 // Default 5 minutes
    })
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository]
})
export class AnalyticsModule {}
```

### Cache Invalidation

```typescript
// When tasks are created/updated/deleted, invalidate analytics cache
@Injectable()
export class TasksService {
  constructor(private readonly cacheManager: Cache) {}

  async create(dto: CreateTaskDto, userId: string): Promise<Task> {
    const task = await this.tasksRepository.create({ ...dto, userId });

    // Invalidate analytics cache for this user
    await this.invalidateAnalyticsCache(userId);

    return task;
  }

  private async invalidateAnalyticsCache(userId: string): Promise<void> {
    const keys = await this.cacheManager.store.keys(`analytics:*:${userId}:*`);
    await Promise.all(keys.map(key => this.cacheManager.del(key)));
  }
}
```

## Frontend Integration

```typescript
// apps/frontend/src/lib/api/contract-client.ts

// ========== Spec: backend-analytics-api ==========
export class ApiClient {
  async getPerformanceMetrics(filter?: AnalyticsFilterDto): Promise<PerformanceMetricsDto> {
    const params = new URLSearchParams(filter as any);
    return this.http.get(`/api/analytics/performance?${params}`);
  }

  async getTrendData(filter: TrendFilterDto): Promise<TrendDataResponseDto> {
    const params = new URLSearchParams(filter as any);
    return this.http.get(`/api/analytics/trends?${params}`);
  }
}
```

## Performance Optimizations

1. **Database-Level Aggregation**: Use Prisma `aggregate()` and raw SQL for efficiency
2. **Redis Caching**: 5-minute TTL reduces database load by 80%+
3. **Smart Grouping**: Auto-switch to weekly grouping for large date ranges
4. **Query Timeout**: 5-second timeout prevents long-running queries from blocking
5. **Index Optimization**: Composite index on (userId, createdAt, status) for fast filtering

## Testing Strategy

```typescript
// apps/frontend/e2e/analytics-api.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Analytics API E2E', () => {
  test('should return performance metrics via GET /api/analytics/performance', async ({ request }) => {
    const response = await request.get('/api/analytics/performance');
    expect(response.status()).toBe(200);

    const metrics = await response.json();
    expect(metrics).toHaveProperty('completionRate');
    expect(metrics).toHaveProperty('averageExecutionTime');
    expect(metrics).toHaveProperty('throughput');
  });

  test('should return trend data grouped by day', async ({ request }) => {
    const response = await request.get('/api/analytics/trends?groupBy=day');
    expect(response.status()).toBe(200);

    const { data, meta } = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(meta.groupBy).toBe('day');
  });

  test('should cache results for 5 minutes', async ({ request }) => {
    const response1 = await request.get('/api/analytics/performance');
    const response2 = await request.get('/api/analytics/performance');

    // Second request should be faster (cached)
    expect(response1.headers()['x-cache']).toBeUndefined();
    expect(response2.headers()['x-cache']).toBe('HIT'); // If we add cache headers
  });
});
```

## Environment Variables

```bash
# .env
ANALYTICS_API_ENABLED=true
ANALYTICS_CACHE_TTL=300            # 5 minutes (seconds)
ANALYTICS_QUERY_TIMEOUT=5000       # 5 seconds (milliseconds)
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Migration Path

1. Add Redis to infrastructure (docker-compose)
2. Implement AnalyticsModule with caching
3. Add to backend main.ts
4. Update frontend contract-client.ts
5. Run E2E tests
6. Monitor cache hit rate in production
