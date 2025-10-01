# Tasks - Backend Analytics API

## Task Checklist

### Phase 1: Module Setup & Schemas (2 tasks)

- [x] 1. Create AnalyticsModule with Redis cache
  - File: apps/backend/src/analytics/analytics.module.ts
  - Import CacheModule.register with redisStore
  - Configure Redis: host from env (default: localhost), port (default: 6379), ttl: 300 seconds (5 min)
  - Import PrismaModule
  - Provide: AnalyticsService, AnalyticsRepository
  - Purpose: Set up the analytics module with Redis caching to improve query performance
  - _Leverage: PrismaModule, CacheModule from @nestjs/cache-manager_
  - _Requirements: 1, 3_
  - _Prompt: Role: Backend developer with NestJS and Redis expertise | Task: Create AnalyticsModule with Redis cache configuration following requirements 1 and 3, ensuring proper DI setup for AnalyticsService and AnalyticsRepository | Restrictions: Do not hardcode Redis credentials, use environment variables | Success: Module compiles successfully and Redis connection is established_

- [x] 2. Define Zod schemas for analytics
  - File: packages/schemas/src/analytics.schema.ts, packages/schemas/src/index.ts, apps/backend/src/analytics/dto/analytics-filter.dto.ts, apps/backend/src/analytics/dto/trend-filter.dto.ts
  - Create analyticsFilterSchema: startDate (date, optional), endDate (date, optional), validate startDate <= endDate
  - Create trendFilterSchema: extends analyticsFilterSchema, add groupBy (enum: day/week/month, default: day)
  - Create performanceMetricsSchema: completionRate, averageExecutionTime, throughput, totalTasks, completedTasks, failedTasks, period
  - Create trendDataSchema: array of { period, totalTasks, completedTasks, failedTasks, averageExecutionTime }
  - Export schemas from index.ts
  - Purpose: Define contract-driven validation schemas for analytics API requests and responses
  - _Leverage: Zod library for schema validation_
  - _Requirements: 1, 2, 3_
  - _Prompt: Role: TypeScript developer with expertise in Zod schemas | Task: Define comprehensive Zod schemas for analytics following requirements 1, 2, and 3, ensuring date validation and enum constraints | Restrictions: Do not use any types, only Zod schema definitions | Success: TypeScript types generate correctly and validation works for all edge cases_

### Phase 2: Data Aggregation Layer (2 tasks)

- [x] 3. Implement AnalyticsRepository (aggregation queries)
  - File: apps/backend/src/analytics/analytics.repository.ts
  - Implement calculatePerformanceMetrics(userId, startDate, endDate): Use Prisma aggregate to count tasks by status, use raw SQL to calculate avg execution time
  - Calculate completion rate: (completedTasks / totalTasks) * 100
  - Calculate throughput: completedTasks / durationHours
  - Implement calculateTrends(userId, groupBy, startDate, endDate): Use raw SQL with DATE_TRUNC for time-series grouping
  - Group by day/week/month based on groupBy parameter, return sorted chronologically
  - Purpose: Implement efficient database-level aggregation queries to calculate analytics metrics
  - _Leverage: Prisma ORM for type-safe queries, raw SQL for DATE_TRUNC functionality_
  - _Requirements: 1, 2, 3_
  - _Prompt: Role: Database specialist with Prisma and PostgreSQL expertise | Task: Implement AnalyticsRepository with optimized aggregation queries following requirements 1, 2, and 3, using database-level calculations to avoid loading full task objects into memory | Restrictions: Do not load all tasks into memory, use Prisma aggregate and raw SQL | Success: Queries return correct aggregated data efficiently with < 500ms p95 response time_

- [x] 4. Implement AnalyticsService (caching logic)
  - File: apps/backend/src/analytics/analytics.service.ts
  - Implement getPerformanceMetrics(filter, userId): Generate cache key, check cache first (5 min TTL), query repository on cache miss
  - Default date range: last 30 days if not specified
  - Implement getTrendData(filter, userId): Generate cache key, auto-optimize groupBy (if range > 90 days and groupBy=day, switch to week)
  - Cache results with 5 min TTL
  - Create private methods: get30DaysAgo(), selectOptimalGrouping(), calculateDateRange()
  - Purpose: Implement business logic layer with intelligent caching to reduce database load
  - _Leverage: CacheManager from NestJS, AnalyticsRepository_
  - _Requirements: 1, 2, 3_
  - _Prompt: Role: Backend developer with caching expertise | Task: Implement AnalyticsService with Redis caching logic following requirements 1, 2, and 3, ensuring cache hit rate > 80% for repeated queries | Restrictions: Do not skip cache validation, always generate unique cache keys per user | Success: Cache hit rate > 80% and service handles cache failures gracefully_

### Phase 3: HTTP API (1 task)

- [x] 5. Implement AnalyticsController (REST endpoints)
  - File: apps/backend/src/analytics/analytics.controller.ts
  - Implement GET /api/analytics/performance?startDate=&endDate=: Use AnalyticsFilterDto query params, return PerformanceMetricsDto
  - Implement GET /api/analytics/trends?groupBy=day&startDate=&endDate=: Use TrendFilterDto query params, return TrendDataResponseDto
  - Protect both endpoints with @UseGuards(JwtAuthGuard)
  - Apply rate limiter: 20 req/min per user
  - Purpose: Expose analytics data via REST endpoints with proper authentication and rate limiting
  - _Leverage: NestJS controllers, JwtAuthGuard, rate limiting middleware_
  - _Requirements: 1, 2_
  - _Prompt: Role: Backend API developer with NestJS expertise | Task: Implement AnalyticsController REST endpoints following requirements 1 and 2, ensuring proper status codes and JWT authentication | Restrictions: Do not expose endpoints without authentication, enforce strict rate limiting | Success: Endpoints return correct data with 200 OK status and respect rate limits_

### Phase 4: Frontend Integration (1 task)

- [x] 6. Add analytics methods to contract-client.ts
  - File: apps/frontend/src/lib/api/contract-client.ts
  - Add section comment: `// ========== Spec: backend-analytics-api ==========`
  - Add getPerformanceMetrics(filter?: AnalyticsFilterDto): Promise<PerformanceMetricsDto>
  - Add getTrendData(filter: TrendFilterDto): Promise<TrendDataResponseDto>
  - Both methods construct query params from filter object
  - Purpose: Provide type-safe frontend API client methods for analytics endpoints
  - _Leverage: Existing contract-client.ts structure, Zod-generated types_
  - _Requirements: 1, 2_
  - _Prompt: Role: Frontend developer with TypeScript expertise | Task: Add analytics API methods to contract-client.ts following requirements 1 and 2, ensuring type safety and proper query param construction | Restrictions: Do not duplicate existing patterns, follow contract-client.ts conventions | Success: Frontend can call methods without type errors and query params are correctly formatted_

### Phase 5: Testing & Configuration (3 tasks)

- [x] 7. Create E2E tests for analytics endpoints
  - File: apps/frontend/e2e/analytics-api.spec.ts
  - Test: GET /api/analytics/performance returns metrics (expect 200, has completionRate/averageExecutionTime/throughput)
  - Test: GET /api/analytics/trends?groupBy=day returns time-series data (expect 200, array of data points)
  - Test: GET /api/analytics/trends?groupBy=week returns weekly data
  - Test: Date range validation (startDate > endDate returns 400)
  - Test: Cache behavior (second identical request faster than first)
  - Test: Authentication required (401 without JWT)
  - Purpose: Validate analytics API contract compliance and error handling
  - _Leverage: Playwright for E2E testing, test fixtures for authentication_
  - _Requirements: 1, 2, 3_
  - _Prompt: Role: QA engineer with E2E testing expertise | Task: Create comprehensive E2E tests for analytics API following requirements 1, 2, and 3, validating all success and error scenarios | Restrictions: Do not skip authentication tests, validate cache behavior | Success: All tests pass with 0 failures and cover all acceptance criteria_

- [ ] 8. Add environment variables and register module
  - File: .env.example, apps/backend/src/main.ts, docker-compose.yml
  - Add to .env.example: ANALYTICS_API_ENABLED=true, ANALYTICS_CACHE_TTL=300, ANALYTICS_QUERY_TIMEOUT=5000, REDIS_HOST=localhost, REDIS_PORT=6379
  - Import AnalyticsModule in backend main.ts
  - Add Redis service to docker-compose.yml if not present
  - Purpose: Configure environment variables and register analytics module in the application
  - _Leverage: NestJS module system, Docker Compose for Redis_
  - _Requirements: 3_
  - _Prompt: Role: DevOps engineer with NestJS configuration expertise | Task: Document environment variables and register AnalyticsModule following requirement 3, ensuring Redis is available | Restrictions: Do not hardcode any configuration values | Success: Backend starts successfully, Redis connects, and /api/analytics/performance responds_

- [ ] 9. Implement cache invalidation in TasksService
  - File: apps/backend/src/tasks/tasks.service.ts
  - Inject CacheManager in constructor
  - After create/update/delete task operations, invalidate analytics cache for userId
  - Use pattern: `analytics:*:${userId}:*` to clear all analytics cache for user
  - Purpose: Ensure analytics data stays fresh when tasks change by invalidating cached data
  - _Leverage: CacheManager, existing TasksService_
  - _Requirements: 3_
  - _Prompt: Role: Backend developer with cache invalidation expertise | Task: Add cache invalidation to TasksService following requirement 3, ensuring analytics data reflects task changes immediately | Restrictions: Do not invalidate cache for other users, only target specific userId | Success: After creating a task, the next analytics query reflects new data without stale cache_

## Task Dependencies

```
Task 1 (Module + Redis) → Task 2 (Schemas)
                               ↓
Task 3 (Repository aggregations) → Task 4 (Service + caching)
                                          ↓
Task 5 (Controller endpoints)
                                          ↓
Task 6 (Frontend integration)
                                          ↓
Task 7 (E2E tests) → Task 8 (Config) → Task 9 (Cache invalidation)
```

## Validation Checklist

Before marking this spec as complete, verify:

- [ ] All 9 tasks marked as `[x]`
- [ ] All E2E tests passing (0 failures)
- [ ] Redis running and connected
- [ ] Can get performance metrics via GET /api/analytics/performance
- [ ] Can get trend data via GET /api/analytics/trends
- [ ] Cache hit rate > 80% for repeated queries (check logs)
- [ ] Date range filters work correctly
- [ ] groupBy parameter works (day, week, month)
- [ ] Analytics data updates after task creation (cache invalidation works)
- [ ] Frontend contract-client has all methods
- [ ] No hardcoded values (use environment variables)

## Estimated Effort

- **Total Tasks**: 9
- **Estimated Time**: 5-7 hours
- **Complexity**: Medium-High (aggregation queries + Redis caching)
- **Dependencies**: backend-tasks-api (requires Task model and data)

## Notes

- Database-level aggregation is critical for performance (don't load all tasks into memory)
- Use raw SQL for time-series grouping (Prisma doesn't support DATE_TRUNC)
- Cache is essential - analytics queries are expensive
- Monitor cache hit rate in production (should be > 80%)
- Auto-optimize groupBy to prevent returning 1000+ data points for large date ranges
