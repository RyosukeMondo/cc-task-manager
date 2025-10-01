# Requirements Document - Task Detail View

## Introduction

The Task Detail View provides a dedicated page for displaying comprehensive task information including metadata, execution logs, status updates, and action controls. This feature enables users to monitor task progress, debug failures, and manage task lifecycle through a rich detail interface.

**Purpose**: Implement `/tasks/:id` route with detailed task information, log viewer, and action buttons (cancel, retry, delete).

**Value**: Enables users to monitor task execution in detail, debug issues with log viewer, and manage tasks through their lifecycle - critical for the core "monitor Claude Code tasks" product vision.

## Alignment with Product Vision

From `product.md`:
- **"Real-time Monitoring"**: Live status updates via WebSocket as task executes
- **"Results Preservation"**: Display execution logs and task metadata
- **"Task Management"**: Action buttons for cancel, retry, delete operations
- **"Debugging Support"**: Syntax-highlighted logs for troubleshooting

This spec addresses the gap: "Task results & history missing - no task detail view, no execution log viewer" (from IMPLEMENTATION_GAP_ANALYSIS.md)

## Requirements

### Requirement 1: Task Detail Page Route

**User Story:** As a user, I want to click a task in the list to see its full details, so that I can monitor progress and view results

#### Acceptance Criteria (EARS)

1. WHEN user clicks task in list THEN system SHALL navigate to `/tasks/:id` route
2. WHEN page loads THEN system SHALL fetch task data via GET /api/tasks/:id
3. WHEN task exists THEN system SHALL display task metadata in card layout
4. WHEN task does not exist (404) THEN system SHALL show "Task not found" page with back button
5. WHEN network error occurs THEN system SHALL show error state with retry button
6. WHEN data is loading THEN system SHALL show skeleton loaders for task metadata

### Requirement 2: Task Metadata Display

**User Story:** As a user, I want to see task metadata (title, status, priority, timestamps), so that I understand the task context

#### Acceptance Criteria (EARS)

1. WHEN task data is loaded THEN system SHALL display fields: title, description, status, priority, createdAt, updatedAt
2. WHEN status is PENDING THEN system SHALL show badge with blue color
3. WHEN status is RUNNING THEN system SHALL show badge with yellow color and animated spinner
4. WHEN status is COMPLETED THEN system SHALL show badge with green color and checkmark icon
5. WHEN status is FAILED THEN system SHALL show badge with red color and error icon
6. WHEN priority is HIGH or URGENT THEN system SHALL show priority badge in red
7. WHEN timestamps are displayed THEN system SHALL show relative time (e.g., "2 minutes ago") with tooltip showing absolute time

### Requirement 3: Execution Log Viewer

**User Story:** As a user, I want to see execution logs with syntax highlighting, so that I can debug task failures and understand execution flow

#### Acceptance Criteria (EARS)

1. WHEN task detail page loads THEN system SHALL display log viewer section
2. WHEN task has logs THEN system SHALL display them with syntax highlighting (detect language automatically)
3. WHEN logs contain ANSI color codes THEN system SHALL render them as colored text
4. WHEN logs are empty THEN system SHALL show message "No logs available yet"
5. WHEN logs exceed 1000 lines THEN system SHALL implement virtual scrolling for performance
6. WHEN user scrolls to bottom THEN system SHALL auto-scroll as new logs arrive (sticky to bottom)
7. WHEN user scrolls up THEN system SHALL pause auto-scroll (not force user to bottom)
8. WHEN log viewer is displayed THEN system SHALL provide "Copy Logs" button to copy all text

### Requirement 4: Task Action Controls

**User Story:** As a user, I want action buttons (cancel, retry, delete), so that I can manage the task lifecycle

#### Acceptance Criteria (EARS)

1. WHEN task status is PENDING or RUNNING THEN system SHALL show "Cancel" button
2. WHEN task status is FAILED THEN system SHALL show "Retry" button
3. WHEN task status is COMPLETED or FAILED THEN system SHALL show "Delete" button
4. WHEN user clicks Cancel THEN system SHALL show confirmation dialog "Cancel this task?"
5. WHEN cancel is confirmed THEN system SHALL call PATCH /api/tasks/:id with status=CANCELLED
6. WHEN user clicks Retry THEN system SHALL create new task with same parameters
7. WHEN user clicks Delete THEN system SHALL show confirmation dialog "Permanently delete this task?"
8. WHEN delete is confirmed THEN system SHALL call DELETE /api/tasks/:id and redirect to /tasks

### Requirement 5: Real-time Updates

**User Story:** As a user, I want to see task status and logs update in real-time, so that I can monitor progress without refreshing

#### Acceptance Criteria (EARS)

1. WHEN task detail page loads THEN system SHALL subscribe to WebSocket events for this taskId
2. WHEN `task:updated` event is received THEN system SHALL update task metadata without page reload
3. WHEN `task:log` event is received THEN system SHALL append new log lines to viewer
4. WHEN task status changes from RUNNING to COMPLETED THEN system SHALL show success animation
5. WHEN task status changes to FAILED THEN system SHALL show error animation and highlight relevant logs
6. WHEN page unmounts THEN system SHALL unsubscribe from WebSocket to prevent memory leaks

### Requirement 6: Navigation and Breadcrumbs

**User Story:** As a user, I want breadcrumbs and back navigation, so that I can easily return to the task list

#### Acceptance Criteria (EARS)

1. WHEN task detail page loads THEN system SHALL show breadcrumb: "Tasks > [Task Title]"
2. WHEN user clicks "Tasks" in breadcrumb THEN system SHALL navigate to /tasks
3. WHEN user clicks browser back button THEN system SHALL return to previous page
4. WHEN page title is set THEN system SHALL use format: "[Task Title] - Task Manager"

## Non-Functional Requirements

### Code Architecture and Modularity
- **Single Responsibility Principle**: Separate TaskDetail (layout/metadata), LogViewer (logs), TaskActions (buttons), useTask (data fetching)
- **Modular Design**: Components isolated in `src/components/tasks/` and `src/app/tasks/[id]/`
- **Dependency Management**: Use TanStack Query for data fetching, react-syntax-highlighter for logs, Socket.IO client for WebSocket
- **Clear Interfaces**: Props typed with TypeScript, task schema from shared package
- **File Ownership**: This spec owns `app/tasks/[id]/**/*`, `TaskDetail.tsx`, `LogViewer.tsx`, `TaskActions.tsx`, `useTask.ts`

### Contract-Driven Development
- **Schema First**: Use Task schema from `@cc-task-manager/schemas/src/task.schema.ts`
- **SSOT**: Task types generated from Zod schema
- **API Contract**: GET /api/tasks/:id matches contract-client.ts method
- **WebSocket Events**: Use shared event types from schemas package

### Performance
- **Code Splitting**: Use Next.js dynamic import for LogViewer (heavy dependency)
- **Virtual Scrolling**: Use react-window for logs exceeding 1000 lines
- **Debounce Log Updates**: Batch log events within 100ms to prevent excessive re-renders
- **Memoization**: Use React.memo for expensive components
- **Image Optimization**: Use Next.js Image for any task-related images

### Security
- **Authorization**: Verify user owns task before displaying (backend enforces via JWT)
- **XSS Prevention**: Sanitize logs before rendering (escape HTML entities)
- **Log Truncation**: Limit log size to prevent DoS (max 10MB client-side)

### Reliability
- **Error Boundaries**: Catch component errors and show fallback UI
- **Retry Logic**: Auto-retry failed GET /api/tasks/:id requests (max 3 attempts)
- **WebSocket Reconnection**: Automatically reconnect on disconnect
- **Offline Support**: Show cached task data when offline (with warning banner)

### Usability
- **Loading States**: Show skeletons during initial load, spinners for actions
- **Error Messages**: Clear, actionable error messages
- **Keyboard Shortcuts**: "Esc" to go back, "C" to copy logs
- **Mobile Responsive**: Logs scroll horizontally on small screens, action buttons stack
- **Toast Notifications**: Success/error toasts for actions (cancel, retry, delete)

### Accessibility
- **ARIA Labels**: All buttons have descriptive labels
- **Focus Management**: Focus on Cancel button when confirmation dialog opens
- **Keyboard Navigation**: All actions accessible via keyboard
- **Screen Reader Support**: Log viewer announces new logs as they arrive (aria-live)
- **Color Contrast**: Status badges meet WCAG AA standards

### Testing
- **E2E Tests**: `apps/frontend/e2e/task-detail.spec.ts` validates full user flow
- **Test Coverage**: Page load, log viewer, action buttons, WebSocket updates, error states, 404 handling
- **Visual Regression**: Screenshots for different task statuses

### Environment-Driven Configuration
- **Feature Flag**: `NEXT_PUBLIC_TASK_DETAIL_ENABLED=true` to enable/disable route
- **Log Viewer**: `NEXT_PUBLIC_MAX_LOG_LINES=10000` for client-side limit

## Success Criteria

- ✅ Users can view detailed task information by clicking tasks in list
- ✅ Logs display with syntax highlighting and auto-scroll
- ✅ Action buttons (cancel, retry, delete) work correctly
- ✅ Real-time updates show task progress without refresh
- ✅ 404 handling shows clear "Task not found" page
- ✅ Mobile users can view and manage tasks effectively
- ✅ E2E tests validate complete user journey

## Dependencies

**Blocked By**:
- `backend-tasks-api` - Requires GET /api/tasks/:id endpoint

**Blocks**: None (independent feature)

**Shared Files** (Minimal edits):
- `apps/frontend/src/lib/api/contract-client.ts` - Add getTaskById method
- `apps/frontend/src/components/tasks/TaskList.tsx` - Add onClick handler to navigate to detail (if not already present)
