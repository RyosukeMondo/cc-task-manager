# Tasks - Task Detail View

## Task Checklist

### Phase 1: Route & Components (4 tasks)

- [ ] 1. Create Next.js dynamic route
  - File: apps/frontend/src/app/tasks/[id]/page.tsx, apps/frontend/src/app/tasks/[id]/loading.tsx, apps/frontend/src/app/tasks/[id]/error.tsx, apps/frontend/src/app/tasks/[id]/not-found.tsx
  - page.tsx: Extract id from params, use useTask hook, render TaskDetail/LogViewer/TaskActions
  - loading.tsx: TaskDetailSkeleton with shimmer animation
  - error.tsx: Error boundary with retry button
  - not-found.tsx: 404 page with "Task not found" message and back button
  - generateMetadata: Async function to fetch task and set page title
  - Purpose: Create dynamic route for task detail pages with proper loading and error states
  - _Leverage: Next.js App Router dynamic routes, React Suspense_
  - _Requirements: 1_
  - _Prompt: Role: Frontend developer with Next.js App Router expertise | Task: Create task detail dynamic route following requirement 1, implementing all state pages (loading, error, not-found) | Restrictions: Do not use pages router, use App Router conventions | Success: Route works and handles loading/error/404 states_

- [ ] 2. Create TaskDetail component (metadata display)
  - File: apps/frontend/src/components/tasks/TaskDetail.tsx
  - Card layout with task metadata
  - Display: title, description, status badge (with icon + color), priority badge
  - Timestamps: createdAt, updatedAt, startedAt, completedAt (format with formatDistanceToNow)
  - If status=FAILED, show Alert with errorMessage in monospace font
  - StatusBadge: PENDING (blue), RUNNING (yellow with spinner), COMPLETED (green with checkmark), FAILED (red with X), CANCELLED (gray)
  - PriorityBadge: LOW (blue), MEDIUM (yellow), HIGH (orange), URGENT (red)
  - Purpose: Display comprehensive task metadata with color-coded status indicators
  - _Leverage: shadcn/ui Card, Badge, Alert components, date-fns_
  - _Requirements: 2_
  - _Prompt: Role: Frontend developer with UI component expertise | Task: Create TaskDetail component following requirement 2, displaying all metadata with proper color coding | Restrictions: Do not use custom badge styles, use shadcn/ui variants | Success: All task metadata displays correctly with proper styling_

- [ ] 3. Create LogViewer component (syntax highlighting + virtual scroll)
  - File: apps/frontend/src/components/tasks/LogViewer.tsx
  - Use react-syntax-highlighter for log highlighting
  - Virtual scrolling with react-window for > 1000 log lines
  - Auto-scroll to bottom when new logs arrive (sticky to bottom)
  - Pause auto-scroll when user scrolls up (resume when scrolled to bottom)
  - "Copy Logs" button to copy all logs to clipboard
  - Empty state: "No logs available yet" with icon
  - Log format: [timestamp] [level] message
  - Level colors: info (blue), warn (yellow), error (red)
  - Purpose: Implement performant log viewer with syntax highlighting and auto-scroll
  - _Leverage: react-syntax-highlighter, react-window for virtualization_
  - _Requirements: 3_
  - _Prompt: Role: Frontend developer with performance optimization expertise | Task: Create LogViewer component following requirement 3, implementing virtual scrolling for large log files | Restrictions: Do not render all logs at once, use virtual scrolling for > 1000 lines | Success: Logs display correctly, auto-scroll works, copy functionality works_

- [ ] 4. Create TaskActions component (action buttons)
  - File: apps/frontend/src/components/tasks/TaskActions.tsx
  - Show "Cancel" button if status = PENDING or RUNNING (confirmation dialog, PATCH status=CANCELLED)
  - Show "Retry" button if status = FAILED (create new task with same params, navigate to new task)
  - Show "Delete" button if status = COMPLETED, FAILED, or CANCELLED (confirmation dialog, DELETE, redirect to /tasks)
  - Use useTaskActions hook for mutations
  - Display loading state during actions (disable buttons)
  - Show success/error toasts
  - Purpose: Provide action buttons for task lifecycle management
  - _Leverage: useTaskActions hook, shadcn/ui AlertDialog for confirmations_
  - _Requirements: 4_
  - _Prompt: Role: Frontend developer with state management expertise | Task: Create TaskActions component following requirement 4, implementing conditional button visibility and confirmations | Restrictions: Do not allow actions without confirmation, always show dialog first | Success: All action buttons work correctly_

### Phase 2: Data Fetching & Real-time Updates (3 tasks)

- [ ] 5. Implement useTask hook (data fetching)
  - File: apps/frontend/src/hooks/useTask.ts
  - Use useQuery with queryKey: ['task', taskId]
  - queryFn: apiClient.getTaskById(taskId)
  - refetchInterval: 10000 (10s fallback polling)
  - Return: { task, isLoading, error }
  - Purpose: Implement data fetching hook for task details with polling fallback
  - _Leverage: TanStack Query useQuery_
  - _Requirements: 1, 5_
  - _Prompt: Role: Frontend developer with TanStack Query expertise | Task: Implement useTask hook following requirements 1 and 5, with 10s polling for real-time updates | Restrictions: Do not skip error handling, return proper loading states | Success: Hook fetches task data correctly_

- [ ] 6. Add WebSocket real-time subscription
  - File: apps/frontend/src/hooks/useTask.ts
  - Use useEffect to subscribe to socket events on mount
  - socket.on('task:updated', handler): Update query cache when task updates
  - socket.on('task:log', handler): Append new log entry to task.logs
  - Show animations on status changes (confetti for COMPLETED, toast for FAILED)
  - Unsubscribe on unmount to prevent memory leaks
  - Connect socket on mount, disconnect on unmount
  - Purpose: Implement WebSocket subscriptions for real-time task updates
  - _Leverage: Socket.IO client, TanStack Query cache updates_
  - _Requirements: 5_
  - _Prompt: Role: Frontend developer with WebSocket expertise | Task: Add WebSocket subscription to useTask hook following requirement 5, updating cache in real-time | Restrictions: Do not forget to unsubscribe on unmount, prevent memory leaks | Success: Real-time updates work without page refresh_

- [ ] 7. Implement useTaskActions hook (mutations)
  - File: apps/frontend/src/hooks/useTaskActions.ts
  - cancelTask: useMutation with PATCH /api/tasks/:id (status=CANCELLED)
  - retryTask: useMutation with POST /api/tasks (same params as failed task)
  - deleteTask: useMutation with DELETE /api/tasks/:id
  - All mutations: onSuccess invalidate ['tasks'] and ['task', taskId] queries
  - Return: { cancelTask, retryTask, deleteTask, isPending }
  - Purpose: Implement mutation hook for task lifecycle actions
  - _Leverage: TanStack Query useMutation_
  - _Requirements: 4_
  - _Prompt: Role: Frontend developer with mutations expertise | Task: Implement useTaskActions hook following requirement 4, invalidating cache on success | Restrictions: Do not skip cache invalidation, always update query cache | Success: All actions work and query cache updates_

### Phase 3: Navigation & Integration (2 tasks)

- [ ] 8. Add breadcrumbs and navigation
  - File: apps/frontend/src/app/tasks/[id]/page.tsx
  - Add Breadcrumb component: "Tasks > [Task Title]"
  - "Tasks" link navigates to /tasks
  - Set page title: "[Task Title] - Task Manager"
  - Browser back button works correctly
  - Purpose: Implement navigation aids for better user experience
  - _Leverage: Next.js Link component, shadcn/ui Breadcrumb_
  - _Requirements: 6_
  - _Prompt: Role: Frontend developer with navigation expertise | Task: Add breadcrumbs to task detail page following requirement 6 | Restrictions: Do not hardcode breadcrumb items, use task title dynamically | Success: Breadcrumbs display and navigation works_

- [ ] 9. Update TaskList to link to detail page
  - File: apps/frontend/src/components/tasks/TaskList.tsx
  - Make task rows clickable (onClick navigates to /tasks/:id)
  - Add cursor-pointer and hover:bg-muted/50 classes
  - Alternatively: Add "View" button in actions column
  - Purpose: Enable navigation from task list to detail view
  - _Leverage: Next.js router, TaskList component_
  - _Requirements: 1_
  - _Prompt: Role: Frontend developer with React expertise | Task: Update TaskList to link to detail page following requirement 1 | Restrictions: Do not break existing functionality, add navigation only | Success: Clicking task opens detail page_

### Phase 4: Testing & Configuration (2 tasks)

- [ ] 10. Add getTaskById to contract-client.ts
  - File: apps/frontend/src/lib/api/contract-client.ts
  - Add to existing backend-tasks-api section (or create if missing)
  - getTaskById(id: string): Promise<Task>
  - GET /api/tasks/:id
  - Purpose: Provide type-safe API client method for fetching task details
  - _Leverage: Existing contract-client.ts structure_
  - _Requirements: 1_
  - _Prompt: Role: Frontend developer with TypeScript expertise | Task: Add getTaskById method to contract-client.ts following requirement 1 | Restrictions: Do not duplicate existing patterns | Success: Method exists and is type-safe_

- [ ] 11. Create E2E test for task detail view
  - File: apps/frontend/e2e/task-detail.spec.ts
  - Test: Navigate to /tasks/:id displays task metadata
  - Test: Navigate to /tasks/invalid-uuid shows 404 page
  - Test: Logs display with syntax highlighting
  - Test: Action buttons appear based on status (cancel for PENDING, retry for FAILED, delete for COMPLETED)
  - Test: Click "Cancel" button cancels task (status updates to CANCELLED)
  - Test: Click "Delete" button deletes task (redirects to /tasks)
  - Test: Real-time updates via WebSocket (mock event, verify UI updates)
  - Test: Breadcrumbs work (click "Tasks" navigates to /tasks)
  - Purpose: Validate complete task detail user flow with E2E tests
  - _Leverage: Playwright for E2E testing_
  - _Requirements: 1, 2, 3, 4, 5, 6_
  - _Prompt: Role: QA engineer with E2E testing expertise | Task: Create comprehensive E2E tests for task detail view following requirements 1-6 | Restrictions: Do not skip WebSocket tests, validate real-time updates | Success: All tests pass with 0 failures_

## Task Dependencies

```
Task 1 (Route) → Task 2 (TaskDetail) + Task 3 (LogViewer) + Task 4 (TaskActions)
                          ↓
Task 5 (useTask hook) → Task 6 (WebSocket) + Task 7 (useTaskActions)
                                    ↓
Task 8 (Breadcrumbs) + Task 9 (TaskList links)
                                    ↓
Task 10 (contract-client) → Task 11 (E2E tests)
```

## Validation Checklist

Before marking this spec as complete, verify:

- [ ] All 11 tasks marked as `[x]`
- [ ] All E2E tests passing (0 failures)
- [ ] Can navigate to task detail page by clicking task in list
- [ ] Task metadata displays correctly (title, status, priority, timestamps)
- [ ] Logs display with syntax highlighting
- [ ] Empty state shows when no logs
- [ ] Copy logs button works
- [ ] Action buttons work (cancel, retry, delete)
- [ ] Real-time updates work via WebSocket (task status updates without refresh)
- [ ] 404 page shows for non-existent tasks
- [ ] Breadcrumbs work correctly
- [ ] Loading skeleton shows during initial load
- [ ] Mobile responsive (logs scroll horizontally if needed)

## Estimated Effort

- **Total Tasks**: 11
- **Estimated Time**: 7-9 hours
- **Complexity**: Medium-High (dynamic routes, WebSocket, virtual scroll)
- **Dependencies**: backend-tasks-api (requires GET /api/tasks/:id endpoint)

## Notes

- Real-time updates are critical for monitoring running tasks
- Virtual scrolling is essential for performance with large log files (> 1000 lines)
- Auto-scroll UX: Stick to bottom when new logs arrive, but respect user scroll position
- WebSocket event handling must unsubscribe on unmount to prevent memory leaks
- Consider lazy loading SyntaxHighlighter (code splitting)
- Status badge animations (spinner for RUNNING, checkmark for COMPLETED) improve UX
- Breadcrumbs improve navigation (especially on mobile)
- Task actions should use confirmation dialogs to prevent accidental deletes
