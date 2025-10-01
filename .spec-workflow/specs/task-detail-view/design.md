# Design Document - Task Detail View

## Architecture Overview

The Task Detail View provides a comprehensive task monitoring interface with real-time updates:

```
Route: /tasks/:id → Page Component → useTask Hook → API + WebSocket → Real-time Updates
```

### Component Structure

```typescript
TaskDetailPage (Next.js route)
├── TaskDetail (Metadata display)
│   ├── Status Badge
│   ├── Priority Badge
│   ├── Timestamps
│   └── Description
├── LogViewer (Syntax-highlighted logs)
│   ├── Virtual Scrolling
│   ├── Auto-scroll
│   └── Copy Button
├── TaskActions (Action buttons)
│   ├── Cancel Button
│   ├── Retry Button
│   └── Delete Button
└── useTask (Data fetching + WebSocket subscription)
```

## Route Design

### Next.js Dynamic Route

```
apps/frontend/src/app/tasks/[id]/
├── page.tsx         # Main page component
├── loading.tsx      # Loading skeleton
├── error.tsx        # Error boundary
└── not-found.tsx    # 404 page
```

## Component Design

### TaskDetailPage

```typescript
// apps/frontend/src/app/tasks/[id]/page.tsx
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { LogViewer } from '@/components/tasks/LogViewer';
import { TaskActions } from '@/components/tasks/TaskActions';
import { useTask } from '@/hooks/useTask';

interface PageProps {
  params: { id: string };
}

export default function TaskDetailPage({ params }: PageProps) {
  const { task, isLoading, error } = useTask(params.id);

  if (isLoading) {
    return <TaskDetailSkeleton />;
  }

  if (error) {
    if (error.response?.status === 404) {
      return <TaskNotFound id={params.id} />;
    }
    return <TaskError error={error} />;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/tasks">Tasks</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{task.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Task Metadata */}
      <TaskDetail task={task} />

      {/* Log Viewer */}
      <LogViewer taskId={task.id} logs={task.logs} />

      {/* Action Buttons */}
      <TaskActions task={task} />
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const task = await apiClient.getTaskById(params.id);
    return {
      title: `${task.title} - Task Manager`,
      description: task.description || 'Task details and execution logs'
    };
  } catch {
    return {
      title: 'Task Not Found - Task Manager'
    };
  }
}
```

### TaskDetail Component

```typescript
// apps/frontend/src/components/tasks/TaskDetail.tsx
import { Task, TaskStatus, TaskPriority } from '@cc-task-manager/schemas';
import { formatDistanceToNow } from 'date-fns';

interface TaskDetailProps {
  task: Task;
}

export function TaskDetail({ task }: TaskDetailProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl">{task.title}</CardTitle>
            <div className="flex items-center gap-2">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Description */}
        {task.description && (
          <div>
            <h3 className="text-sm font-medium mb-2">Description</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        )}

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm font-medium" title={task.createdAt.toISOString()}>
              {formatDistanceToNow(task.createdAt, { addSuffix: true })}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Updated</p>
            <p className="text-sm font-medium" title={task.updatedAt.toISOString()}>
              {formatDistanceToNow(task.updatedAt, { addSuffix: true })}
            </p>
          </div>

          {task.startedAt && (
            <div>
              <p className="text-xs text-muted-foreground">Started</p>
              <p className="text-sm font-medium" title={task.startedAt.toISOString()}>
                {formatDistanceToNow(task.startedAt, { addSuffix: true })}
              </p>
            </div>
          )}

          {task.completedAt && (
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-sm font-medium" title={task.completedAt.toISOString()}>
                {formatDistanceToNow(task.completedAt, { addSuffix: true })}
              </p>
            </div>
          )}
        </div>

        {/* Error Message (if failed) */}
        {task.status === 'FAILED' && task.errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="font-mono text-xs">
              {task.errorMessage}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Status Badge with colors and icons
function StatusBadge({ status }: { status: TaskStatus }) {
  const config = {
    PENDING: { color: 'bg-blue-500', icon: Clock, label: 'Pending' },
    RUNNING: { color: 'bg-yellow-500', icon: Loader2, label: 'Running', spin: true },
    COMPLETED: { color: 'bg-green-500', icon: CheckCircle, label: 'Completed' },
    FAILED: { color: 'bg-red-500', icon: XCircle, label: 'Failed' },
    CANCELLED: { color: 'bg-gray-500', icon: Ban, label: 'Cancelled' }
  }[status];

  const Icon = config.icon;

  return (
    <Badge className={config.color}>
      <Icon className={cn('h-3 w-3 mr-1', config.spin && 'animate-spin')} />
      {config.label}
    </Badge>
  );
}

// Priority Badge with colors
function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = {
    LOW: { color: 'bg-blue-100 text-blue-800', label: 'Low' },
    MEDIUM: { color: 'bg-yellow-100 text-yellow-800', label: 'Medium' },
    HIGH: { color: 'bg-orange-100 text-orange-800', label: 'High' },
    URGENT: { color: 'bg-red-100 text-red-800', label: 'Urgent' }
  }[priority];

  return <Badge variant="outline" className={config.color}>{config.label}</Badge>;
}
```

### LogViewer Component

```typescript
// apps/frontend/src/components/tasks/LogViewer.tsx
import { useRef, useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { FixedSizeList as List } from 'react-window';

interface LogViewerProps {
  taskId: string;
  logs: LogEntry[];
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export function LogViewer({ taskId, logs }: LogViewerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollToItem(logs.length - 1, 'end');
    }
  }, [logs.length, autoScroll]);

  // Detect user scroll to pause auto-scroll
  const handleScroll = ({ scrollOffset, scrollUpdateWasRequested }: any) => {
    if (!scrollUpdateWasRequested) {
      const containerHeight = containerRef.current?.clientHeight || 0;
      const maxScroll = logs.length * 24 - containerHeight;
      const isNearBottom = scrollOffset >= maxScroll - 50;

      setAutoScroll(isNearBottom);
    }
  };

  // Copy all logs to clipboard
  const handleCopyLogs = async () => {
    const allLogs = logs.map(log => `[${log.timestamp}] [${log.level}] ${log.message}`).join('\n');
    await navigator.clipboard.writeText(allLogs);
    toast.success('Logs copied to clipboard');
  };

  // Render single log line (virtualized)
  const LogRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const log = logs[index];
    const levelColor = {
      info: 'text-blue-400',
      warn: 'text-yellow-400',
      error: 'text-red-400'
    }[log.level];

    return (
      <div style={style} className="font-mono text-xs px-4 flex gap-2">
        <span className="text-muted-foreground">{log.timestamp}</span>
        <span className={levelColor}>[{log.level.toUpperCase()}]</span>
        <span>{log.message}</span>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Execution Logs</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLogs}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Logs
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoScroll(!autoScroll)}
            >
              {autoScroll ? (
                <>
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Pause Auto-scroll
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Resume Auto-scroll
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="bg-gray-950 rounded-lg overflow-hidden">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No logs available yet</p>
            </div>
          ) : logs.length > 1000 ? (
            // Virtual scrolling for large log sets
            <List
              ref={listRef}
              height={400}
              itemCount={logs.length}
              itemSize={24}
              width="100%"
              onScroll={handleScroll}
            >
              {LogRow}
            </List>
          ) : (
            // Regular rendering for small log sets
            <div className="max-h-[400px] overflow-y-auto p-4">
              {logs.map((log, index) => (
                <LogRow key={index} index={index} style={{}} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### TaskActions Component

```typescript
// apps/frontend/src/components/tasks/TaskActions.tsx
import { Task } from '@cc-task-manager/schemas';
import { useTaskActions } from '@/hooks/useTaskActions';
import { useRouter } from 'next/navigation';

interface TaskActionsProps {
  task: Task;
}

export function TaskActions({ task }: TaskActionsProps) {
  const router = useRouter();
  const { cancelTask, retryTask, deleteTask, isPending } = useTaskActions();

  const handleCancel = async () => {
    const confirmed = await confirm('Are you sure you want to cancel this task?');
    if (!confirmed) return;

    cancelTask({ taskId: task.id }, {
      onSuccess: () => {
        toast.success('Task cancelled');
      }
    });
  };

  const handleRetry = async () => {
    retryTask({ taskId: task.id }, {
      onSuccess: (newTask) => {
        toast.success('Task retry initiated');
        router.push(`/tasks/${newTask.id}`); // Navigate to new task
      }
    });
  };

  const handleDelete = async () => {
    const confirmed = await confirm('Permanently delete this task? This cannot be undone.');
    if (!confirmed) return;

    deleteTask({ taskId: task.id }, {
      onSuccess: () => {
        toast.success('Task deleted');
        router.push('/tasks'); // Back to list
      }
    });
  };

  const showCancel = ['PENDING', 'RUNNING'].includes(task.status);
  const showRetry = task.status === 'FAILED';
  const showDelete = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {showCancel && (
            <Button variant="outline" onClick={handleCancel} disabled={isPending}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Task
            </Button>
          )}

          {showRetry && (
            <Button onClick={handleRetry} disabled={isPending}>
              <RotateCw className="h-4 w-4 mr-2" />
              Retry Task
            </Button>
          )}

          {showDelete && (
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Task
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### useTask Hook (with WebSocket)

```typescript
// apps/frontend/src/hooks/useTask.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { socket } from '@/lib/socket';
import { type Task } from '@cc-task-manager/schemas';

export function useTask(taskId: string) {
  const queryClient = useQueryClient();

  // Fetch task data
  const query = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => apiClient.getTaskById(taskId),
    refetchInterval: 10000 // Poll every 10s as fallback
  });

  // Subscribe to WebSocket updates
  useEffect(() => {
    socket.connect();

    const handleTaskUpdated = (updatedTask: Task) => {
      if (updatedTask.id === taskId) {
        queryClient.setQueryData(['task', taskId], updatedTask);

        // Show animation for status changes
        if (updatedTask.status === 'COMPLETED') {
          confetti(); // Celebration animation
          toast.success('Task completed successfully!');
        } else if (updatedTask.status === 'FAILED') {
          toast.error('Task failed');
        }
      }
    };

    const handleTaskLog = (data: { taskId: string; log: LogEntry }) => {
      if (data.taskId === taskId) {
        queryClient.setQueryData<Task>(['task', taskId], (old) => {
          if (!old) return old;
          return {
            ...old,
            logs: [...old.logs, data.log]
          };
        });
      }
    };

    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:log', handleTaskLog);

    return () => {
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:log', handleTaskLog);
    };
  }, [taskId, queryClient]);

  return query;
}
```

## File Structure

```
apps/frontend/src/
├── app/tasks/[id]/
│   ├── page.tsx                  # Main detail page
│   ├── loading.tsx               # Loading skeleton
│   ├── error.tsx                 # Error boundary
│   └── not-found.tsx             # 404 page
├── components/tasks/
│   ├── TaskDetail.tsx            # Metadata display
│   ├── LogViewer.tsx             # Log rendering with virtual scroll
│   ├── TaskActions.tsx           # Action buttons
│   └── TaskDetailSkeleton.tsx   # Loading state
├── hooks/
│   ├── useTask.ts                # Data fetching + WebSocket
│   └── useTaskActions.ts         # Cancel/retry/delete mutations
└── lib/
    └── socket.ts                 # Socket.IO client instance
```

## WebSocket Integration

```typescript
// apps/frontend/src/lib/socket.ts
import { io } from 'socket.io-client';

export const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
  autoConnect: false,
  auth: {
    token: () => localStorage.getItem('accessToken')
  }
});

// Connection status handling
socket.on('connect', () => {
  console.log('WebSocket connected');
});

socket.on('disconnect', () => {
  console.log('WebSocket disconnected');
  toast.error('Lost connection. Reconnecting...');
});

socket.on('connect_error', (error) => {
  console.error('WebSocket error:', error);
  if (error.message.includes('Unauthorized')) {
    // Token expired, redirect to login
    window.location.href = '/login';
  }
});
```

## Testing Strategy

```typescript
// apps/frontend/e2e/task-detail.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Task Detail View', () => {
  test('should display task metadata', async ({ page }) => {
    await page.goto('/tasks/some-task-id');

    await expect(page.locator('h1')).toContainText('Example Task');
    await expect(page.locator('text=PENDING')).toBeVisible();
    await expect(page.locator('text=Created')).toBeVisible();
  });

  test('should show 404 for non-existent task', async ({ page }) => {
    await page.goto('/tasks/00000000-0000-0000-0000-000000000000');

    await expect(page.locator('text=Task Not Found')).toBeVisible();
  });

  test('should display logs with syntax highlighting', async ({ page }) => {
    await page.goto('/tasks/task-with-logs');

    await expect(page.locator('text=Execution Logs')).toBeVisible();
    await expect(page.locator('.log-line')).toHaveCount(10);
  });

  test('should update in real-time via WebSocket', async ({ page }) => {
    await page.goto('/tasks/running-task');

    // Simulate WebSocket event from backend
    await page.evaluate(() => {
      window.socket.emit('task:updated', {
        id: 'running-task',
        status: 'COMPLETED'
      });
    });

    await expect(page.locator('text=COMPLETED')).toBeVisible();
  });

  test('should cancel task', async ({ page }) => {
    await page.goto('/tasks/pending-task');

    await page.click('button:has-text("Cancel Task")');
    await page.click('button:has-text("Confirm")'); // Confirmation dialog

    await expect(page.locator('text=Task cancelled')).toBeVisible();
  });
});
```

## Performance Optimizations

1. **Virtual Scrolling**: Only render visible log lines (react-window)
2. **Code Splitting**: Lazy load SyntaxHighlighter
3. **WebSocket**: Real-time updates without polling
4. **Query Caching**: TanStack Query caches task data

## Accessibility Features

- Breadcrumbs for navigation
- ARIA labels on action buttons
- Keyboard shortcuts (Escape to go back)
- Screen reader announcements for status changes

This design provides a comprehensive task monitoring experience with real-time updates!
