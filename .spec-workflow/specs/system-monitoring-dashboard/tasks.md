# Tasks - System Monitoring Dashboard

## Task Checklist

### Phase 1: Backend API (3 tasks)

- [x] 1. Create MonitoringModule
  - File: apps/backend/src/monitoring/monitoring.module.ts
  - Import PrismaModule
  - Provide: MonitoringService
  - Export: MonitoringService
  - Purpose: Set up monitoring module for system metrics collection
  - _Leverage: NestJS module system_
  - _Requirements: 1, 2, 3_
  - _Prompt: Role: Backend developer with NestJS expertise | Task: Create MonitoringModule following requirements 1, 2, and 3 | Restrictions: Do not hardcode configuration values | Success: Module compiles with no errors_

- [x] 2. Implement MonitoringService (system metrics collection)
  - File: apps/backend/src/monitoring/monitoring.service.ts
  - getMetrics(): Return { system, api, database, websocket }
  - System metrics (use Node.js os module): CPU usage (os.cpus()), memory (os.totalmem(), os.freemem()), disk (placeholder or check-disk-space library)
  - API metrics: Track in Map (path → { count, totalTime, times[] }), calculate avgResponseTime, p95ResponseTime, requestsPerSecond, endpointBreakdown
  - Database metrics: Prisma connection pool status (activeConnections, idleConnections, poolSize, queueDepth)
  - WebSocket metrics: connectedClients, messagesPerSecond, averageLatency
  - recordAPICall(path, duration): Middleware method to track API calls
  - Purpose: Implement comprehensive system metrics collection service
  - _Leverage: Node.js os module, Prisma connection pool, in-memory metrics tracking_
  - _Requirements: 1, 2, 3_
  - _Prompt: Role: Backend developer with system monitoring expertise | Task: Implement MonitoringService following requirements 1, 2, and 3, collecting CPU, memory, API, and database metrics | Restrictions: Do not use external APM services, use built-in Node.js APIs | Success: All metrics calculated correctly_

- [x] 3. Create MonitoringController
  - File: apps/backend/src/monitoring/monitoring.controller.ts
  - GET /api/monitoring/metrics: Returns system metrics (200 OK)
  - Protect with @UseGuards(JwtAuthGuard)
  - Rate limit: 20 req/min per user
  - Register MonitoringModule in backend main.ts
  - Purpose: Expose system metrics via REST endpoint
  - _Leverage: NestJS controllers, MonitoringService_
  - _Requirements: 1, 2, 3_
  - _Prompt: Role: Backend API developer with NestJS expertise | Task: Create MonitoringController endpoint following requirements 1, 2, and 3 | Restrictions: Do not expose metrics without authentication | Success: Endpoint returns metrics successfully_

### Phase 2: Route & Components (4 tasks)

- [x] 4. Create monitoring dashboard route
  - File: apps/frontend/src/app/monitoring/page.tsx, apps/frontend/src/app/monitoring/loading.tsx, apps/frontend/src/app/monitoring/error.tsx
  - page.tsx: Use useSystemMetrics hook with 5s polling, render SystemMetrics/APIPerformanceMetrics/MetricsChart/WebSocketStatus
  - loading.tsx: Skeleton with shimmer
  - error.tsx: Error boundary with retry button
  - Page title: "System Monitoring - Task Manager"
  - Show last updated timestamp
  - Purpose: Create system monitoring dashboard with real-time polling
  - _Leverage: Next.js App Router, useSystemMetrics hook_
  - _Requirements: 1, 4, 6_
  - _Prompt: Role: Frontend developer with Next.js expertise | Task: Create monitoring dashboard route following requirements 1, 4, and 6 | Restrictions: Do not hardcode polling interval, use configurable value | Success: Page renders and polling works_

- [ ] 5. Create SystemMetrics component (resource cards)
  - File: apps/frontend/src/components/monitoring/SystemMetrics.tsx
  - 4 metric cards: CPU Usage (blue), Memory Usage (green), Disk Usage (purple), Database Pool (orange)
  - Each card: Icon, title, value (percentage or fraction), subtitle
  - Warning styling if usage > 80% (yellow border)
  - Critical styling if usage > 90% (red border + alert)
  - Format bytes helper function for memory/disk (e.g., "4.2 GB / 16 GB")
  - Grid layout: 1 column mobile, 2 columns tablet, 4 columns desktop
  - Purpose: Display system resource metrics with warning indicators
  - _Leverage: shadcn/ui Card, Alert components_
  - _Requirements: 1_
  - _Prompt: Role: Frontend developer with data visualization expertise | Task: Create SystemMetrics component following requirement 1, implementing color-coded warning states | Restrictions: Do not use hardcoded thresholds, make configurable | Success: Metrics display with color-coded warnings_

- [ ] 6. Create MetricsChart component (Recharts time-series)
  - File: apps/frontend/src/components/monitoring/MetricsChart.tsx
  - Use Recharts AreaChart
  - Props: title, data (array of { timestamp, value }), dataKey, color
  - X-axis: Time (HH:mm:ss format)
  - Y-axis: Percentage (0-100)
  - Gradient fill under line
  - Tooltip on hover with exact value
  - Empty state: "Collecting metrics..." with icon
  - Responsive: 200px height
  - Purpose: Visualize metric trends over time with area chart
  - _Leverage: Recharts AreaChart_
  - _Requirements: 4_
  - _Prompt: Role: Frontend developer with charting expertise | Task: Create MetricsChart component following requirement 4, implementing time-series visualization | Restrictions: Do not exceed 720 data points, implement sliding window | Success: Chart displays correctly_

- [ ] 7. Create APIPerformanceMetrics component
  - File: apps/frontend/src/components/monitoring/APIPerformanceMetrics.tsx
  - Card with API metrics: averageResponseTime, p95ResponseTime, requestsPerSecond
  - Warning if p95 > 500ms (yellow), critical if > 1000ms (red)
  - Endpoint breakdown table: Show 5 slowest endpoints with avg time and call count
  - Format: "GET /api/tasks" - "124ms avg" - "1,234 calls"
  - Purpose: Display API performance metrics with bottleneck identification
  - _Leverage: shadcn/ui Card, Table components_
  - _Requirements: 2_
  - _Prompt: Role: Frontend developer with performance monitoring expertise | Task: Create APIPerformanceMetrics component following requirement 2, highlighting slow endpoints | Restrictions: Do not show all endpoints, limit to top 5 slowest | Success: API metrics display correctly_

### Phase 3: Data Fetching (1 task)

- [ ] 8. Implement useSystemMetrics hook (polling + history)
  - File: apps/frontend/src/hooks/useSystemMetrics.ts
  - Use useQuery with queryKey: ['system', 'metrics']
  - queryFn: apiClient.getSystemMetrics()
  - refetchInterval: 5000 (5s) if page visible, 60000 (60s) if inactive
  - Maintain sliding window history (last 1 hour = 720 data points at 5s intervals)
  - State: history = { cpu: [], memory: [] }
  - useEffect: On data update, append to history, slice to max 720 points
  - Return: { metrics, history, isLoading, error, lastUpdated }
  - Purpose: Implement metrics fetching with smart polling and historical data retention
  - _Leverage: TanStack Query, useState for history management_
  - _Requirements: 4, 6_
  - _Prompt: Role: Frontend developer with state management expertise | Task: Implement useSystemMetrics hook following requirements 4 and 6, maintaining sliding window history | Restrictions: Do not exceed 720 data points, implement sliding window properly | Success: Polling works and history maintained correctly_

### Phase 4: Integration & Testing (3 tasks)

- [ ] 9. Add monitoring methods to contract-client.ts
  - File: apps/frontend/src/lib/api/contract-client.ts
  - Add section comment: `// ========== Spec: system-monitoring-dashboard ==========`
  - getSystemMetrics(): Promise<SystemMetricsResponse>
  - Purpose: Provide type-safe API client method for system metrics
  - _Leverage: Existing contract-client.ts structure_
  - _Requirements: 1_
  - _Prompt: Role: Frontend developer with TypeScript expertise | Task: Add getSystemMetrics method to contract-client.ts following requirement 1 | Restrictions: Do not duplicate patterns | Success: Method exists and is type-safe_

- [ ] 10. Add "Monitoring" link to Sidebar
  - File: apps/frontend/src/components/layout/Sidebar.tsx
  - Add section comment: `// ========== Spec: system-monitoring-dashboard ==========`
  - Add navigation item: { name: 'Monitoring', href: '/monitoring', icon: ActivityIcon }
  - Use Activity or Monitor icon from lucide-react
  - Purpose: Add navigation link to monitoring dashboard
  - _Leverage: Existing Sidebar component, lucide-react icons_
  - _Requirements: 1_
  - _Prompt: Role: Frontend developer with navigation expertise | Task: Add Monitoring link to Sidebar following requirement 1 | Restrictions: Do not modify other navigation items | Success: Monitoring link appears in sidebar_

- [ ] 11. Create E2E test for monitoring dashboard
  - File: apps/frontend/e2e/monitoring.spec.ts
  - Test: Navigate to /monitoring displays system metrics cards
  - Test: CPU/Memory/Disk usage display with percentages
  - Test: Warning styling appears when usage > 80% (mock high usage)
  - Test: Time-series charts render (CPU and Memory)
  - Test: API performance metrics display
  - Test: Polling updates data every 5 seconds (verify timestamp changes)
  - Test: Chart history grows over time (multiple poll cycles)
  - Test: Database connection pool status displays
  - Purpose: Validate complete monitoring dashboard user flow
  - _Leverage: Playwright for E2E testing_
  - _Requirements: 1, 2, 3, 4, 5, 6_
  - _Prompt: Role: QA engineer with E2E testing expertise | Task: Create comprehensive E2E tests for monitoring dashboard following requirements 1-6 | Restrictions: Do not skip polling tests, validate all metrics | Success: All tests pass with 0 failures_

## Task Dependencies

```
Task 1 (Module) → Task 2 (MonitoringService) → Task 3 (Controller)
                                                      ↓
Task 4 (Route) → Task 5 (SystemMetrics) + Task 6 (Chart) + Task 7 (API metrics)
                                                      ↓
Task 8 (useSystemMetrics hook)
                                                      ↓
Task 9 (contract-client) + Task 10 (Sidebar link)
                                                      ↓
Task 11 (E2E tests)
```

## Validation Checklist

Before marking this spec as complete, verify:

- [ ] All 11 tasks marked as `[x]`
- [ ] All E2E tests passing (0 failures)
- [ ] Can navigate to /monitoring via sidebar
- [ ] System resource cards display (CPU, Memory, Disk, Database)
- [ ] Warning/critical styling works (> 80%, > 90%)
- [ ] Time-series charts show CPU and Memory history (last 1 hour)
- [ ] API performance metrics display (avg time, p95, RPS)
- [ ] Endpoint breakdown shows slowest endpoints
- [ ] WebSocket status displays (if applicable)
- [ ] Polling updates data every 5 seconds
- [ ] Chart history maintains sliding window (max 720 points)
- [ ] Polling slows down when tab inactive (60s)

## Estimated Effort

- **Total Tasks**: 11
- **Estimated Time**: 6-8 hours
- **Complexity**: Medium (OS metrics, Recharts, time-series)
- **Dependencies**: None (uses Node.js os module)

## Notes

- Use Node.js os module for CPU/memory metrics (built-in, no dependencies)
- For production disk metrics, consider using check-disk-space npm package
- API performance tracking requires middleware to record request durations
- Database pool metrics may require raw SQL queries (Prisma doesn't expose pool directly)
- WebSocket metrics should be tracked in the WebSocket gateway (separate module)
- Sliding window history prevents memory leaks (cap at 720 data points)
- Monitoring dashboard should be admin-only (consider adding role check)
- Consider adding alerts/notifications when metrics exceed thresholds
- Chart performance: AreaChart is lightweight, suitable for real-time updates
