# Requirements Document - Queue Management Dashboard

## Introduction

The Queue Management Dashboard provides visibility into BullMQ job queue status, allowing administrators to monitor queue health, view job lists, and perform queue management operations (retry, cancel). This feature exposes the underlying BullMQ infrastructure through a user-friendly interface.

**Purpose**: Implement `/queue` route with queue metrics visualization, job list, and management controls for BullMQ queues.

**Value**: Enables administrators to monitor queue health, diagnose job processing issues, and manually intervene when jobs fail - critical for maintaining system reliability.

## Alignment with Product Vision

From `product.md`:
- **"Task Queue System"**: Visibility into BullMQ background job processing
- **"Real-time Monitoring"**: Live queue metrics refreshing every 5 seconds
- **"Automatic Recovery"**: Manual retry controls for failed jobs
- **"System Health"**: Queue depth and throughput metrics

This spec addresses the gap: "Task queue management UI missing - no queue status dashboard, no job retry/cancel UI" (from IMPLEMENTATION_GAP_ANALYSIS.md)

## Requirements

### Requirement 1: Queue Metrics Dashboard

**User Story:** As an administrator, I want to see queue metrics (active, pending, completed, failed counts), so that I can monitor queue health at a glance

#### Acceptance Criteria (EARS)

1. WHEN user navigates to `/queue` THEN system SHALL display queue metrics cards
2. WHEN metrics are loaded THEN system SHALL show counts: active jobs, pending jobs, completed jobs, failed jobs
3. WHEN metrics are displayed THEN system SHALL show each count in separate card with icon and color coding
4. WHEN failed job count > 0 THEN system SHALL highlight failed card in red with warning icon
5. WHEN active job count > 50 THEN system SHALL show warning badge indicating high load
6. WHEN metrics are stale (> 10s) THEN system SHALL show "Refreshing..." indicator

### Requirement 2: Job Throughput Visualization

**User Story:** As an administrator, I want to see job throughput charts, so that I can identify performance trends

#### Acceptance Criteria (EARS)

1. WHEN queue page loads THEN system SHALL display throughput chart (jobs per hour, last 24 hours)
2. WHEN chart is rendered THEN system SHALL use line chart with X-axis=time, Y-axis=job count
3. WHEN chart shows data THEN system SHALL differentiate completed (green) and failed (red) jobs
4. WHEN no data exists THEN system SHALL show message "No job history available"
5. WHEN user hovers over chart point THEN system SHALL show tooltip with exact counts and timestamp

### Requirement 3: Job List and Details

**User Story:** As an administrator, I want to view list of jobs with status and details, so that I can investigate specific job issues

#### Acceptance Criteria (EARS)

1. WHEN queue page loads THEN system SHALL display job list table below metrics
2. WHEN job list is shown THEN system SHALL include columns: ID, name, status, progress, attempts, timestamp
3. WHEN jobs are displayed THEN system SHALL support filtering by status (all, active, pending, completed, failed)
4. WHEN jobs are displayed THEN system SHALL support pagination (20 jobs per page)
5. WHEN user clicks job row THEN system SHALL expand row to show job data (input parameters, error stack if failed)
6. WHEN job has error THEN system SHALL display stack trace in monospace font with syntax highlighting
7. WHEN job is in progress THEN system SHALL show progress bar (0-100%)

### Requirement 4: Job Management Actions

**User Story:** As an administrator, I want to retry failed jobs or cancel pending jobs, so that I can manually recover from failures

#### Acceptance Criteria (EARS)

1. WHEN job status is FAILED THEN system SHALL show "Retry" button in actions column
2. WHEN job status is PENDING or ACTIVE THEN system SHALL show "Cancel" button in actions column
3. WHEN user clicks Retry THEN system SHALL show confirmation dialog "Retry this job?"
4. WHEN retry is confirmed THEN system SHALL call POST /api/queue/jobs/:id/retry
5. WHEN user clicks Cancel THEN system SHALL show confirmation dialog "Cancel this job?"
6. WHEN cancel is confirmed THEN system SHALL call POST /api/queue/jobs/:id/cancel
7. WHEN action succeeds THEN system SHALL show success toast and refresh job list
8. WHEN action fails THEN system SHALL show error toast with reason

### Requirement 5: Real-time Queue Updates

**User Story:** As an administrator, I want queue metrics to update automatically, so that I see current queue state without manual refresh

#### Acceptance Criteria (EARS)

1. WHEN queue page loads THEN system SHALL poll GET /api/queue/status every 5 seconds
2. WHEN new metrics are received THEN system SHALL update cards without full page reload
3. WHEN job status changes THEN system SHALL update job list in real-time
4. WHEN user is scrolling job list THEN system SHALL pause auto-refresh to prevent scroll jump
5. WHEN page is in background tab THEN system SHALL reduce polling to 30 seconds
6. WHEN page unmounts THEN system SHALL stop polling to prevent memory leaks

### Requirement 6: Bulk Actions

**User Story:** As an administrator, I want to retry all failed jobs at once, so that I can recover from system-wide failures efficiently

#### Acceptance Criteria (EARS)

1. WHEN failed job count > 0 THEN system SHALL show "Retry All Failed" button above job list
2. WHEN user clicks "Retry All Failed" THEN system SHALL show confirmation dialog with count
3. WHEN retry all is confirmed THEN system SHALL call POST /api/queue/jobs/retry-all
4. WHEN bulk action is in progress THEN system SHALL show progress bar with "Retrying X of Y jobs..."
5. WHEN bulk action completes THEN system SHALL show success toast and refresh metrics

## Non-Functional Requirements

### Code Architecture and Modularity
- **Single Responsibility Principle**: Separate QueueMetrics (cards), JobList (table), JobActions (buttons), useQueue (data fetching)
- **Modular Design**: Components isolated in `src/components/queue/` and `src/app/queue/`
- **Dependency Management**: Use TanStack Query for polling, Recharts for visualization, shadcn/ui for table
- **Clear Interfaces**: Props typed with TypeScript, queue schemas from shared package
- **File Ownership**: This spec owns `app/queue/**/*`, `components/queue/**/*`, `hooks/useQueue.ts`

### Contract-Driven Development
- **Schema First**: Define Zod schemas in `@cc-task-manager/schemas/src/queue.schema.ts`
- **SSOT**: Queue types generated from Zod schema
- **API Contract**: GET /api/queue/status matches contract-client.ts method
- **Backend Integration**: Backend endpoint wraps BullMQ Queue.getJobCounts()

### Performance
- **Polling Optimization**: Use TanStack Query's refetchInterval with smart backoff
- **Virtualization**: Use react-window for job list if > 100 jobs
- **Chart Performance**: Use Recharts with data sampling (max 100 points)
- **Memoization**: Memoize chart data transformations

### Security
- **Authorization**: Queue dashboard requires admin role (check backend)
- **Rate Limiting**: Backend enforces stricter rate limit (10 req/min) for queue endpoints
- **Input Validation**: Validate job IDs before retry/cancel actions

### Reliability
- **Error Boundaries**: Catch component errors and show fallback UI
- **Retry Logic**: Auto-retry failed API requests (max 3 attempts)
- **Offline Support**: Show cached metrics when offline with warning banner
- **Graceful Degradation**: If chart fails to render, still show metrics cards

### Usability
- **Loading States**: Show skeletons during initial load
- **Error Messages**: Clear, actionable error messages
- **Keyboard Shortcuts**: "R" to retry selected job, "C" to cancel
- **Mobile Responsive**: Cards stack vertically, table scrolls horizontally
- **Toast Notifications**: Success/error toasts for all actions

### Accessibility
- **ARIA Labels**: All buttons have descriptive labels
- **Focus Management**: Focus on Retry button when confirmation dialog opens
- **Keyboard Navigation**: Table supports arrow key navigation
- **Screen Reader Support**: Metrics cards announce updates (aria-live)
- **Color Contrast**: Status badges meet WCAG AA standards

### Testing
- **E2E Tests**: `apps/frontend/e2e/queue-dashboard.spec.ts` validates full user flow
- **Test Coverage**: Metrics display, job list, retry/cancel actions, polling, bulk actions
- **Visual Regression**: Screenshots for different queue states

### Environment-Driven Configuration
- **Feature Flag**: `NEXT_PUBLIC_QUEUE_DASHBOARD_ENABLED=true` to enable/disable route
- **Polling Interval**: `NEXT_PUBLIC_QUEUE_POLL_INTERVAL=5000` (milliseconds)
- **Admin Access**: `NEXT_PUBLIC_REQUIRE_ADMIN_ROLE=true` for queue dashboard

## Success Criteria

- ✅ Administrators can view real-time queue metrics
- ✅ Failed jobs are clearly visible with retry controls
- ✅ Job throughput charts show performance trends
- ✅ Retry/cancel actions work reliably
- ✅ Bulk retry handles system-wide failures
- ✅ Dashboard updates automatically without page refresh
- ✅ E2E tests validate complete admin workflow

## Dependencies

**Blocked By**: None (BullMQ already integrated in backend)

**Blocks**: None (independent feature)

**Shared Files** (Minimal edits):
- `apps/frontend/src/lib/api/contract-client.ts` - Add queue methods (getQueueStatus, retryJob, cancelJob)
- `apps/frontend/src/components/layout/Sidebar.tsx` - Add "Queue" navigation link
- `apps/backend/src/queue/queue.controller.ts` - Add GET /api/queue/status endpoint (may already exist, just enhance)
