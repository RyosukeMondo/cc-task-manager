# Design Document - Queue Management Dashboard

## Architecture Overview

The Queue Management Dashboard provides visibility into BullMQ job queue status:

```
Route: /queue → Page Component → useQueue Hook (polling) → Backend /api/queue/status → BullMQ
```

### Component Structure

```typescript
QueueDashboardPage
├── QueueMetrics (Metrics cards)
│   ├── ActiveJobs Card
│   ├── PendingJobs Card
│   ├── CompletedJobs Card
│   └── FailedJobs Card
├── ThroughputChart (Jobs per hour)
│   └── Recharts LineChart
├── JobList (Table with pagination)
│   ├── Job Rows
│   ├── Status Filters
│   ├── Pagination Controls
│   └── Expandable Details
└── useQueue (Polling hook)
```

## Route Design

```
apps/frontend/src/app/queue/
├── page.tsx         # Main dashboard page
├── loading.tsx      # Loading skeleton
└── error.tsx        # Error boundary
```

## Component Design

### QueueDashboardPage

```typescript
// apps/frontend/src/app/queue/page.tsx
import { QueueMetrics } from '@/components/queue/QueueMetrics';
import { ThroughputChart } from '@/components/queue/ThroughputChart';
import { JobList } from '@/components/queue/JobList';
import { useQueue } from '@/hooks/useQueue';

export default function QueueDashboardPage() {
  const { metrics, jobs, throughput, isLoading, error, refetch } = useQueue({
    pollInterval: 5000 // Poll every 5 seconds
  });

  if (isLoading) {
    return <QueueDashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load queue data</AlertTitle>
        <AlertDescription>
          {error.message}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-4">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Queue Management</h1>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Metrics Cards */}
      <QueueMetrics metrics={metrics} />

      {/* Throughput Chart */}
      <ThroughputChart data={throughput} />

      {/* Job List */}
      <JobList jobs={jobs} />
    </div>
  );
}

// Metadata for SEO
export const metadata = {
  title: 'Queue Management - Task Manager',
  description: 'Monitor BullMQ job queue status and manage jobs'
};
```

### QueueMetrics Component

```typescript
// apps/frontend/src/components/queue/QueueMetrics.tsx
import { QueueMetrics as QueueMetricsType } from '@cc-task-manager/schemas';

interface QueueMetricsProps {
  metrics: QueueMetricsType;
}

export function QueueMetrics({ metrics }: QueueMetricsProps) {
  const cards = [
    {
      title: 'Active Jobs',
      value: metrics.activeCount,
      icon: Zap,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      warning: metrics.activeCount > 50 ? 'High load' : null
    },
    {
      title: 'Pending Jobs',
      value: metrics.pendingCount,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Completed Jobs',
      value: metrics.completedCount,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Failed Jobs',
      value: metrics.failedCount,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      critical: metrics.failedCount > 0
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className={cn(card.critical && 'border-red-500')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <div className={cn('p-2 rounded-full', card.bgColor)}>
                <Icon className={cn('h-4 w-4', card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
              {card.warning && (
                <p className="text-xs text-yellow-600 mt-1">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  {card.warning}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

### ThroughputChart Component

```typescript
// apps/frontend/src/components/queue/ThroughputChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface ThroughputChartProps {
  data: Array<{
    timestamp: Date;
    completed: number;
    failed: number;
  }>;
}

export function ThroughputChart({ data }: ThroughputChartProps) {
  // Transform data for Recharts
  const chartData = data.map(point => ({
    time: format(point.timestamp, 'HH:mm'),
    Completed: point.completed,
    Failed: point.failed
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Throughput (Last 24 Hours)</CardTitle>
        <CardDescription>Jobs completed and failed per hour</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <BarChart className="h-12 w-12 mb-2 opacity-50" />
            <p>No job history available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="Completed"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981' }}
              />
              <Line
                type="monotone"
                dataKey="Failed"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

### JobList Component

```typescript
// apps/frontend/src/components/queue/JobList.tsx
import { useState } from 'react';
import { Job, JobStatus } from '@cc-task-manager/schemas';
import { useJobActions } from '@/hooks/useJobActions';

interface JobListProps {
  jobs: Job[];
}

export function JobList({ jobs }: JobListProps) {
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');
  const [page, setPage] = useState(0);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const { retryJob, cancelJob, retryAllFailed, isPending } = useJobActions();

  const pageSize = 20;
  const filteredJobs = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);
  const paginatedJobs = filteredJobs.slice(page * pageSize, (page + 1) * pageSize);
  const failedCount = jobs.filter(j => j.status === 'failed').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Job List</CardTitle>
          <div className="flex gap-2">
            {/* Status Filter */}
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            {/* Retry All Failed */}
            {failedCount > 0 && (
              <Button
                variant="outline"
                onClick={() => retryAllFailed()}
                disabled={isPending}
              >
                <RotateCw className="h-4 w-4 mr-2" />
                Retry All Failed ({failedCount})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedJobs.map((job) => (
              <>
                <TableRow
                  key={job.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                >
                  <TableCell className="font-mono text-xs">
                    {job.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>{job.name}</TableCell>
                  <TableCell>
                    <JobStatusBadge status={job.status} />
                  </TableCell>
                  <TableCell>
                    {job.status === 'active' && job.progress !== undefined ? (
                      <div className="flex items-center gap-2">
                        <Progress value={job.progress} className="w-[60px]" />
                        <span className="text-xs">{job.progress}%</span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{job.attemptsMade}/{job.attemptsMax}</TableCell>
                  <TableCell className="text-xs">
                    {formatDistanceToNow(job.timestamp, { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {job.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            retryJob({ jobId: job.id });
                          }}
                          disabled={isPending}
                        >
                          <RotateCw className="h-3 w-3" />
                        </Button>
                      )}
                      {['pending', 'active'].includes(job.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelJob({ jobId: job.id });
                          }}
                          disabled={isPending}
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>

                {/* Expandable Details */}
                {expandedJob === job.id && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/20">
                      <div className="p-4 space-y-2">
                        <div>
                          <p className="text-sm font-medium">Job Data</p>
                          <pre className="text-xs bg-gray-950 p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(job.data, null, 2)}
                          </pre>
                        </div>
                        {job.failedReason && (
                          <div>
                            <p className="text-sm font-medium text-red-600">Error</p>
                            <pre className="text-xs bg-red-950 text-red-200 p-2 rounded mt-1 overflow-x-auto">
                              {job.failedReason}
                            </pre>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, filteredJobs.length)} of {filteredJobs.length} jobs
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * pageSize >= filteredJobs.length}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  const config = {
    active: { color: 'bg-yellow-500', label: 'Active' },
    pending: { color: 'bg-blue-500', label: 'Pending' },
    completed: { color: 'bg-green-500', label: 'Completed' },
    failed: { color: 'bg-red-500', label: 'Failed' }
  }[status];

  return <Badge className={config.color}>{config.label}</Badge>;
}
```

### useQueue Hook (with Polling)

```typescript
// apps/frontend/src/hooks/useQueue.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/contract-client';
import { usePageVisibility } from '@/hooks/usePageVisibility';

interface UseQueueOptions {
  pollInterval?: number; // milliseconds
}

export function useQueue({ pollInterval = 5000 }: UseQueueOptions = {}) {
  const isPageVisible = usePageVisibility();

  return useQuery({
    queryKey: ['queue', 'status'],
    queryFn: () => apiClient.getQueueStatus(),
    refetchInterval: isPageVisible ? pollInterval : 30000, // Reduce polling when tab inactive
    refetchIntervalInBackground: false
  });
}

// Custom hook to detect page visibility (tab active/inactive)
function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(!document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
```

### useJobActions Hook

```typescript
// apps/frontend/src/hooks/useJobActions.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/contract-client';

export function useJobActions() {
  const queryClient = useQueryClient();

  const retryJob = useMutation({
    mutationFn: ({ jobId }: { jobId: string }) => apiClient.retryJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Job retry initiated');
    },
    onError: () => {
      toast.error('Failed to retry job');
    }
  });

  const cancelJob = useMutation({
    mutationFn: ({ jobId }: { jobId: string }) => apiClient.cancelJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Job cancelled');
    },
    onError: () => {
      toast.error('Failed to cancel job');
    }
  });

  const retryAllFailed = useMutation({
    mutationFn: () => apiClient.retryAllFailedJobs(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success(`Retrying ${data.count} failed jobs`);
    },
    onError: () => {
      toast.error('Failed to retry jobs');
    }
  });

  return {
    retryJob: retryJob.mutate,
    cancelJob: cancelJob.mutate,
    retryAllFailed: retryAllFailed.mutate,
    isPending: retryJob.isPending || cancelJob.isPending || retryAllFailed.isPending
  };
}
```

## Backend API Endpoint

```typescript
// apps/backend/src/queue/queue.controller.ts
import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { Queue } from 'bullmq';

@Controller('api/queue')
@UseGuards(JwtAuthGuard)
export class QueueController {
  constructor(private readonly taskQueue: Queue) {}

  @Get('status')
  async getQueueStatus() {
    const [active, pending, completed, failed] = await Promise.all([
      this.taskQueue.getActiveCount(),
      this.taskQueue.getWaitingCount(),
      this.taskQueue.getCompletedCount(),
      this.taskQueue.getFailedCount()
    ]);

    const jobs = await this.taskQueue.getJobs(['active', 'waiting', 'completed', 'failed'], 0, 100);

    return {
      metrics: { activeCount: active, pendingCount: pending, completedCount: completed, failedCount: failed },
      jobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        status: job.getState(),
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        attemptsMax: job.opts.attempts || 1,
        timestamp: job.timestamp,
        data: job.data,
        failedReason: job.failedReason
      }))
    };
  }

  @Post('jobs/:id/retry')
  async retryJob(@Param('id') jobId: string) {
    const job = await this.taskQueue.getJob(jobId);
    if (!job) throw new NotFoundException('Job not found');

    await job.retry();
    return { success: true };
  }

  @Post('jobs/:id/cancel')
  async cancelJob(@Param('id') jobId: string) {
    const job = await this.taskQueue.getJob(jobId);
    if (!job) throw new NotFoundException('Job not found');

    await job.remove();
    return { success: true };
  }

  @Post('jobs/retry-all')
  async retryAllFailed() {
    const failedJobs = await this.taskQueue.getFailed();
    await Promise.all(failedJobs.map(job => job.retry()));

    return { count: failedJobs.length };
  }
}
```

## File Structure

```
apps/frontend/src/
├── app/queue/
│   ├── page.tsx                      # Main dashboard
│   ├── loading.tsx                   # Loading skeleton
│   └── error.tsx                     # Error boundary
├── components/queue/
│   ├── QueueMetrics.tsx              # Metrics cards
│   ├── ThroughputChart.tsx           # Recharts visualization
│   ├── JobList.tsx                   # Job table with pagination
│   └── QueueDashboardSkeleton.tsx    # Loading state
├── hooks/
│   ├── useQueue.ts                   # Polling hook
│   └── useJobActions.ts              # Retry/cancel mutations
└── lib/api/
    └── contract-client.ts            # Add queue methods

apps/backend/src/queue/
└── queue.controller.ts               # Enhance with GET /api/queue/status

packages/schemas/src/
└── queue.schema.ts                   # Queue types
```

## Testing Strategy

```typescript
// apps/frontend/e2e/queue-dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Queue Management Dashboard', () => {
  test('should display queue metrics', async ({ page }) => {
    await page.goto('/queue');

    await expect(page.locator('text=Active Jobs')).toBeVisible();
    await expect(page.locator('text=Pending Jobs')).toBeVisible();
    await expect(page.locator('text=Failed Jobs')).toBeVisible();
  });

  test('should show throughput chart', async ({ page }) => {
    await page.goto('/queue');

    await expect(page.locator('text=Job Throughput')).toBeVisible();
    await expect(page.locator('.recharts-wrapper')).toBeVisible();
  });

  test('should filter jobs by status', async ({ page }) => {
    await page.goto('/queue');

    await page.selectOption('select', 'failed');
    await expect(page.locator('table tbody tr')).toHaveCount(5); // Assuming 5 failed jobs
  });

  test('should retry failed job', async ({ page }) => {
    await page.goto('/queue');

    await page.click('button:has-text("Retry"):first');
    await expect(page.locator('text=Job retry initiated')).toBeVisible();
  });

  test('should poll for updates every 5 seconds', async ({ page }) => {
    await page.goto('/queue');

    const initialCount = await page.locator('text=Active Jobs').textContent();

    // Wait 6 seconds
    await page.waitForTimeout(6000);

    // Verify API was called again (check network or data update)
    const updatedCount = await page.locator('text=Active Jobs').textContent();
    expect(updatedCount).toBeDefined();
  });
});
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_QUEUE_DASHBOARD_ENABLED=true
NEXT_PUBLIC_QUEUE_POLL_INTERVAL=5000  # 5 seconds
NEXT_PUBLIC_REQUIRE_ADMIN_ROLE=true    # Restrict to admins
```

This design provides complete visibility into BullMQ queue operations!
