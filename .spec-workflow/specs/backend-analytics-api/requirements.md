# Requirements Document - Backend Analytics API

## Introduction

The Backend Analytics API provides performance metrics and trend analysis endpoints that aggregate task execution data. This API enables the frontend analytics dashboard to display completion rates, average execution times, and historical trends without implementing custom aggregation logic.

**Purpose**: Implement `/api/analytics` endpoints that return performance metrics and time-series trend data.

**Value**: Enables users to monitor system performance, identify bottlenecks, and track productivity trends over time.

## Alignment with Product Vision

From `product.md`:
- **"Historical Trend Analysis"**: This API provides time-series data grouped by day/week/month
- **"Performance Metrics"**: Completion rates, average execution times, throughput calculations
- **"Real-time Monitoring"**: Cached metrics with 5-minute TTL for efficient dashboard updates

This spec addresses the gap: "Analytics APIs return 404 - `/api/analytics/performance` and `/api/analytics/trends` not implemented" (from IMPLEMENTATION_GAP_ANALYSIS.md)

## Requirements

### Requirement 1: Performance Metrics

**User Story:** As a user, I want to view performance metrics (completion rate, average time, throughput), so that I can assess system efficiency

#### Acceptance Criteria (EARS)

1. WHEN client GETs `/api/analytics/performance` THEN system SHALL return 200 OK with metrics object
2. WHEN performance metrics are calculated THEN system SHALL include completionRate (percentage of successful tasks)
3. WHEN performance metrics are calculated THEN system SHALL include averageExecutionTime (mean duration in milliseconds)
4. WHEN performance metrics are calculated THEN system SHALL include throughput (tasks completed per hour)
5. WHEN query includes date range params THEN system SHALL filter tasks by createdAt timestamp
6. WHEN metrics are requested multiple times THEN system SHALL cache results for 5 minutes

### Requirement 2: Trend Analysis

**User Story:** As a user, I want to view trend data over time, so that I can identify patterns and performance changes

#### Acceptance Criteria (EARS)

1. WHEN client GETs `/api/analytics/trends` THEN system SHALL return 200 OK with time-series data array
2. WHEN query includes `?groupBy=day` THEN system SHALL group results by calendar day
3. WHEN query includes `?groupBy=week` THEN system SHALL group results by ISO week
4. WHEN query includes `?groupBy=month` THEN system SHALL group results by calendar month
5. WHEN trend data is calculated THEN system SHALL include counts (total, completed, failed) per period
6. WHEN date range is specified THEN system SHALL filter trends within start/end dates
7. WHEN trends are requested THEN system SHALL return data sorted chronologically (oldest first)

### Requirement 3: Data Aggregation Optimization

**User Story:** As a system, I want efficient aggregation queries, so that analytics endpoints respond quickly under load

#### Acceptance Criteria (EARS)

1. WHEN aggregating task data THEN system SHALL use Prisma groupBy and aggregate functions
2. WHEN calculating metrics THEN system SHALL avoid loading full task objects into memory
3. WHEN date ranges exceed 90 days THEN system SHALL automatically group by week (not day)
4. WHEN cache is stale THEN system SHALL refresh asynchronously without blocking response
5. WHEN query execution exceeds 5 seconds THEN system SHALL return 503 Service Unavailable with retry-after header

## Non-Functional Requirements

### Code Architecture and Modularity
- **Single Responsibility Principle**: Separate controller (HTTP), service (aggregation logic), caching layer
- **Modular Design**: NestJS module isolated in `apps/backend/src/analytics/` with clear boundaries
- **Dependency Management**: Use NestJS DI for AnalyticsService, PrismaService, CacheManager
- **Clear Interfaces**: DTOs define query parameters, response types define analytics data structure
- **File Ownership**: This spec owns all files in `apps/backend/src/analytics/**/*` (zero conflicts)

### Contract-Driven Development
- **Schema First**: Define Zod schemas in `@cc-task-manager/schemas/src/analytics.schema.ts`
- **SSOT**: Zod schemas generate TypeScript types AND validate query parameters
- **API Contract**: All endpoints match contract-client.ts expectations
- **Versioning**: API routes prefixed with `/api/` for future versioning

### Performance
- **Response Time**: < 500ms for 95th percentile requests (aggregations are slower than CRUD)
- **Caching**: Redis cache with 5-minute TTL (300 seconds)
- **Query Optimization**: Use database-level aggregation (not in-memory)
- **Pagination**: Support limit/offset for large trend datasets

### Security
- **Authentication**: All endpoints protected with JwtAuthGuard (require valid JWT)
- **Authorization**: Users can only view their own analytics (userId filter)
- **Input Validation**: Zod schemas validate date ranges and groupBy parameters
- **Rate Limiting**: Apply stricter rate limiter (20 req/min per user) due to expensive queries

### Reliability
- **Error Handling**: Return proper HTTP status codes (200, 400, 503)
- **Cache Fallback**: If cache fails, execute query directly (degraded performance, not failure)
- **Query Timeout**: 5-second timeout on aggregation queries
- **Logging**: Log slow queries (>1s) with parameters for optimization

### Usability
- **Error Messages**: Return clear messages for invalid date ranges
- **Consistent Format**: All responses follow standard ApiResponse<T> format
- **Documentation**: OpenAPI spec auto-generated from Zod schemas
- **Testing**: E2E tests in `apps/frontend/e2e/analytics-api.spec.ts` validate all endpoints

### Environment-Driven Configuration
- **Feature Flags**: `ANALYTICS_API_ENABLED=true` to enable/disable API
- **Cache TTL**: `ANALYTICS_CACHE_TTL=300` (seconds)
- **Query Timeout**: `ANALYTICS_QUERY_TIMEOUT=5000` (milliseconds)

## Success Criteria

- ✅ `/api/analytics/performance` returns 200 with valid metrics (no 404)
- ✅ `/api/analytics/trends` returns time-series data with correct grouping
- ✅ Cache reduces database load (hit rate > 80% for repeated queries)
- ✅ Dashboard displays real analytics data (replaces empty states)
- ✅ Query performance meets SLA (< 500ms p95)
- ✅ E2E tests validate API contract compliance

## Dependencies

**Blocked By**:
- `backend-tasks-api` - Requires Task model and data to aggregate

**Blocks**:
- `analytics-performance-page` - Frontend needs `/api/analytics/performance` endpoint
- `analytics-trends-page` - Frontend needs `/api/analytics/trends` endpoint

**Shared Files** (Append-only, no conflicts):
- `apps/frontend/src/lib/api/contract-client.ts` - Add analytics methods
