# Tasks - Queue Management Dashboard

## Task Checklist

### Phase 1: Backend API (2 tasks)

- [ ] 1. Create QueueController with status endpoint
  - File: apps/backend/src/queue/queue.controller.ts
  - GET /api/queue/status: Returns { metrics, jobs, throughput }
  - metrics: { activeCount, pendingCount, completedCount, failedCount } via BullMQ Queue.getJobCounts()
  - jobs: Array of job objects (id, name, status, progress, attemptsMade, attemptsMax, timestamp, data, failedReason)
  - throughput: Last 24 hours of job completion data (hourly buckets)
  - Protect with @UseGuards(JwtAuthGuard)
  - Rate limit: 20 req/min per user
  - Purpose: Expose BullMQ queue metrics and job status via REST API
  - _Leverage: BullMQ Queue.getJobCounts() and job methods_
  - _Requirements: 1, 2, 3_
  - _Prompt: Role: Backend developer with BullMQ expertise | Task: Create QueueController endpoint following requirements 1, 2, and 3, exposing queue metrics and job lists | Restrictions: Do not expose sensitive job data, protect with authentication | Success: Endpoint returns queue status correctly_

- [ ] 2. Add job management endpoints
  - File: apps/backend/src/queue/queue.controller.ts
  - POST /api/queue/jobs/:id/retry: Retry failed job (call job.retry())
  - POST /api/queue/jobs/:id/cancel: Cancel pending/active job (call job.remove())
  - POST /api/queue/jobs/retry-all: Retry all failed jobs (bulk operation)
  - All endpoints: Return { success: true } or throw NotFoundException
  - Protect with @UseGuards(JwtAuthGuard)
  - Purpose: Provide job management actions for queue administration
  - _Leverage: BullMQ job.retry(), job.remove() methods_
  - _Requirements: 4, 6_
  - _Prompt: Role: Backend developer with job queue expertise | Task: Add job management endpoints following requirements 4 and 6, enabling retry and cancel operations | Restrictions: Do not allow unauthenticated access, validate job IDs | Success: All job actions work correctly_

### Phase 2: Route & Components (4 tasks)

- [ ] 3. Create queue dashboard route
  - File: apps/frontend/src/app/queue/page.tsx, apps/frontend/src/app/queue/loading.tsx, apps/frontend/src/app/queue/error.tsx
  - page.tsx: Use useQueue hook with 5s polling, render QueueMetrics/ThroughputChart/JobList
  - loading.tsx: Skeleton with shimmer
  - error.tsx: Error boundary with retry button
  - Page title: "Queue Management - Task Manager"
  - Add refresh button to manually trigger refetch
  - Purpose: Create queue management dashboard page with polling
  - _Leverage: Next.js App Router, useQueue hook_
  - _Requirements: 1, 5_
  - _Prompt: Role: Frontend developer with Next.js expertise | Task: Create queue dashboard route following requirements 1 and 5, implementing 5s polling | Restrictions: Do not hardcode polling interval, use configurable value | Success: Page renders correctly and polling works_

- [ ] 4. Create QueueMetrics component (metrics cards)
  - File: apps/frontend/src/components/queue/QueueMetrics.tsx
  - 4 metric cards: Active Jobs (yellow), Pending Jobs (blue), Completed Jobs (green), Failed Jobs (red)
  - Each card: Icon, title, count, color-coded
  - Warning badge if activeCount > 50 ("High load")
  - Critical styling if failedCount > 0 (red border)
  - Grid layout: 1 column mobile, 2 columns tablet, 4 columns desktop
  - Purpose: Display queue health metrics with color-coded warnings
  - _Leverage: shadcn/ui Card, Badge components_
  - _Requirements: 1_
  - _Prompt: Role: Frontend developer with data visualization expertise | Task: Create QueueMetrics component following requirement 1, implementing color-coded metric cards | Restrictions: Do not use custom colors, follow design system | Success: Metrics display correctly with color coding_

- [ ] 5. Create ThroughputChart component (Recharts)
  - File: apps/frontend/src/components/queue/ThroughputChart.tsx
  - Use Recharts LineChart
  - Data: Last 24 hours, hourly buckets
  - Two lines: Completed (green), Failed (red)
  - X-axis: Time (HH:mm format)
  - Y-axis: Job count
  - Tooltip on hover with exact counts
  - Empty state: "No job history available" with icon
  - Responsive: 300px height
  - Purpose: Visualize job throughput trends over time
  - _Leverage: Recharts LineChart_
  - _Requirements: 2_
  - _Prompt: Role: Frontend developer with charting expertise | Task: Create ThroughputChart component following requirement 2, showing completed and failed job trends | Restrictions: Do not exceed 100 data points, sample if necessary | Success: Chart displays throughput correctly_

- [ ] 6. Create JobList component (table with pagination)
  - File: apps/frontend/src/components/queue/JobList.tsx
  - Table columns: ID (truncated), Name, Status (badge), Progress (progress bar), Attempts, Timestamp, Actions
  - Status filter: All, Active, Pending, Completed, Failed
  - Pagination: 20 jobs per page, prev/next buttons
  - Expandable rows: Click row to show job data (JSON) and error stack trace
  - Action buttons: Retry (failed jobs), Cancel (pending/active jobs)
  - Bulk action: "Retry All Failed" button if failedCount > 0
  - Use useJobActions hook for mutations
  - Purpose: Display job list with filtering, pagination, and actions
  - _Leverage: shadcn/ui Table, useJobActions hook_
  - _Requirements: 3, 4_
  - _Prompt: Role: Frontend developer with table components expertise | Task: Create JobList component following requirements 3 and 4, implementing pagination and actions | Restrictions: Do not load all jobs at once, use pagination | Success: Job list works, actions functional, pagination works_

### Phase 3: Data Fetching & Actions (2 tasks)

- [ ] 7. Implement useQueue hook (polling)
  - File: apps/frontend/src/hooks/useQueue.ts
  - Use useQuery with queryKey: ['queue', 'status']
  - queryFn: apiClient.getQueueStatus()
  - refetchInterval: 5000 (5s) if page visible, 30000 (30s) if inactive
  - Use usePageVisibility hook to detect tab active/inactive
  - Return: { metrics, jobs, throughput, isLoading, error, refetch }
  - Purpose: Implement queue data fetching with smart polling based on page visibility
  - _Leverage: TanStack Query, usePageVisibility hook_
  - _Requirements: 5_
  - _Prompt: Role: Frontend developer with polling optimization expertise | Task: Implement useQueue hook following requirement 5, reducing polling frequency when tab inactive | Restrictions: Do not poll when tab hidden, use visibility API | Success: Polling works and reduces frequency when tab inactive_

- [ ] 8. Implement useJobActions hook (mutations)
  - File: apps/frontend/src/hooks/useJobActions.ts
  - retryJob: useMutation with POST /api/queue/jobs/:id/retry
  - cancelJob: useMutation with POST /api/queue/jobs/:id/cancel
  - retryAllFailed: useMutation with POST /api/queue/jobs/retry-all
  - All mutations: onSuccess invalidate ['queue'] query, show success toast
  - Return: { retryJob, cancelJob, retryAllFailed, isPending }
  - Purpose: Implement job action mutations with cache invalidation
  - _Leverage: TanStack Query useMutation_
  - _Requirements: 4, 6_
  - _Prompt: Role: Frontend developer with mutations expertise | Task: Implement useJobActions hook following requirements 4 and 6, invalidating cache on success | Restrictions: Do not skip cache invalidation, always update query cache | Success: All actions work and query cache updates_

### Phase 4: Integration & Testing (3 tasks)

- [ ] 9. Add queue methods to contract-client.ts
  - File: apps/frontend/src/lib/api/contract-client.ts
  - Add section comment: `// ========== Spec: queue-management-dashboard ==========`
  - getQueueStatus(): Promise<QueueStatusResponse>
  - retryJob(jobId: string): Promise<{ success: boolean }>
  - cancelJob(jobId: string): Promise<{ success: boolean }>
  - retryAllFailedJobs(): Promise<{ count: number }>
  - Purpose: Provide type-safe API client methods for queue management
  - _Leverage: Existing contract-client.ts structure_
  - _Requirements: 1, 4_
  - _Prompt: Role: Frontend developer with TypeScript expertise | Task: Add queue methods to contract-client.ts following requirements 1 and 4 | Restrictions: Do not duplicate patterns, follow conventions | Success: Methods exist and are type-safe_

- [ ] 10. Add "Queue" link to Sidebar
  - File: apps/frontend/src/components/layout/Sidebar.tsx
  - Add section comment: `// ========== Spec: queue-management-dashboard ==========`
  - Add navigation item: { name: 'Queue', href: '/queue', icon: QueueIcon }
  - Use Layers or Server icon from lucide-react
  - Purpose: Add navigation link to queue dashboard
  - _Leverage: Existing Sidebar component, lucide-react icons_
  - _Requirements: 1_
  - _Prompt: Role: Frontend developer with navigation expertise | Task: Add Queue link to Sidebar following requirement 1 | Restrictions: Do not modify other navigation items | Success: Queue link appears in sidebar and navigates correctly_

- [ ] 11. Create E2E test for queue dashboard
  - File: apps/frontend/e2e/queue-dashboard.spec.ts
  - Test: Navigate to /queue displays metrics cards
  - Test: Throughput chart renders
  - Test: Job list displays with correct columns
  - Test: Filter jobs by status (select "failed" shows only failed jobs)
  - Test: Click "Retry" button on failed job retries successfully
  - Test: Click "Cancel" button on pending job cancels successfully
  - Test: "Retry All Failed" button retries all failed jobs
  - Test: Pagination works (20 jobs per page)
  - Test: Polling updates data every 5 seconds (check network activity)
  - Purpose: Validate complete queue management user flow
  - _Leverage: Playwright for E2E testing_
  - _Requirements: 1, 2, 3, 4, 5, 6_
  - _Prompt: Role: QA engineer with E2E testing expertise | Task: Create comprehensive E2E tests for queue dashboard following requirements 1-6 | Restrictions: Do not skip polling tests, validate all actions | Success: All tests pass with 0 failures_

## Task Dependencies

```
Task 1 (Backend endpoint) + Task 2 (Job actions) → Task 3 (Route)
                                                         ↓
Task 4 (Metrics cards) + Task 5 (Chart) + Task 6 (Job list)
                                                         ↓
Task 7 (useQueue hook) + Task 8 (useJobActions hook)
                                                         ↓
Task 9 (contract-client) + Task 10 (Sidebar link)
                                                         ↓
Task 11 (E2E tests)
```

## Validation Checklist

Before marking this spec as complete, verify:

- [ ] All 11 tasks marked as `[x]`
- [ ] All E2E tests passing (0 failures)
- [ ] Can navigate to /queue via sidebar
- [ ] Queue metrics display correctly (active, pending, completed, failed)
- [ ] Throughput chart shows last 24 hours
- [ ] Job list displays with pagination
- [ ] Can filter jobs by status
- [ ] Can retry failed jobs
- [ ] Can cancel pending/active jobs
- [ ] "Retry All Failed" works
- [ ] Polling updates data every 5 seconds
- [ ] Polling slows down when tab inactive (30s)
- [ ] Expandable rows show job data and errors

## Estimated Effort

- **Total Tasks**: 11
- **Estimated Time**: 7-9 hours
- **Complexity**: Medium-High (BullMQ integration, Recharts, polling)
- **Dependencies**: None (BullMQ already integrated in backend)

## Notes

- BullMQ is already integrated - just need to expose via API
- Polling is essential for near-real-time updates (WebSocket optional enhancement)
- Reduce polling frequency when tab inactive to save resources
- Virtual scrolling not needed (pagination limits to 20 jobs per page)
- Retry all failed jobs is critical for recovery from system-wide failures
- Throughput chart helps identify performance patterns
- Queue dashboard should be admin-only (consider adding role check)
- Monitor BullMQ memory usage in production (large job queues can consume RAM)
