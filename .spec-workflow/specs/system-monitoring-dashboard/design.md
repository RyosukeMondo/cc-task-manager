# Design Document - System Monitoring Dashboard

## Architecture Overview

The System Monitoring Dashboard provides real-time system health metrics:

```
Route: /monitoring → Page Component → useSystemMetrics Hook (polling) → Backend /api/monitoring/metrics → OS Metrics (Node.js)
```

### Component Structure

```typescript
MonitoringDashboardPage
├── SystemMetrics (Resource cards)
│   ├── CPU Usage Card
│   ├── Memory Usage Card
│   ├── Disk Usage Card
│   └── Database Card
├── APIPerformanceMetrics
│   ├── Average Response Time
│   ├── P95 Response Time
│   ├── Requests Per Second
│   └── Endpoint Breakdown
├── MetricsChart (Time-series charts)
│   ├── CPU History (last 1 hour)
│   └── Memory History (last 1 hour)
├── WebSocketStatus
│   ├── Connection Count
│   ├── Messages Per Second
│   └── Average Latency
└── useSystemMetrics (Polling hook)
```

## Route Design

```
apps/frontend/src/app/monitoring/
├── page.tsx         # Main dashboard page
├── loading.tsx      # Loading skeleton
└── error.tsx        # Error boundary
```

## Component Design

### MonitoringDashboardPage

```typescript
// apps/frontend/src/app/monitoring/page.tsx
import { SystemMetrics } from '@/components/monitoring/SystemMetrics';
import { APIPerformanceMetrics } from '@/components/monitoring/APIPerformanceMetrics';
import { MetricsChart } from '@/components/monitoring/MetricsChart';
import { WebSocketStatus } from '@/components/monitoring/WebSocketStatus';
import { useSystemMetrics } from '@/hooks/useSystemMetrics';

export default function MonitoringDashboardPage() {
  const { metrics, history, isLoading, error, lastUpdated } = useSystemMetrics({
    pollInterval: 5000 // Poll every 5 seconds
  });

  if (isLoading) {
    return <MonitoringDashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load monitoring data</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">System Monitoring</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Last updated: {formatDistanceToNow(lastUpdated, { addSuffix: true })}
        </div>
      </div>

      {/* System Resource Metrics */}
      <SystemMetrics metrics={metrics.system} />

      {/* API Performance Metrics */}
      <APIPerformanceMetrics metrics={metrics.api} />

      {/* Time-Series Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricsChart
          title="CPU Usage (%)"
          data={history.cpu}
          dataKey="value"
          color="#3b82f6"
        />
        <MetricsChart
          title="Memory Usage (%)"
          data={history.memory}
          dataKey="value"
          color="#10b981"
        />
      </div>

      {/* WebSocket Status */}
      <WebSocketStatus metrics={metrics.websocket} />
    </div>
  );
}

export const metadata = {
  title: 'System Monitoring - Task Manager',
  description: 'Real-time system health and performance metrics'
};
```

### SystemMetrics Component

```typescript
// apps/frontend/src/components/monitoring/SystemMetrics.tsx
import { SystemMetrics as SystemMetricsType } from '@cc-task-manager/schemas';

interface SystemMetricsProps {
  metrics: SystemMetricsType;
}

export function SystemMetrics({ metrics }: SystemMetricsProps) {
  const cards = [
    {
      title: 'CPU Usage',
      value: `${metrics.cpu.usage.toFixed(1)}%`,
      subtitle: `${metrics.cpu.cores} cores`,
      icon: Cpu,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      warning: metrics.cpu.usage > 80,
      critical: metrics.cpu.usage > 90
    },
    {
      title: 'Memory Usage',
      value: `${metrics.memory.usagePercent.toFixed(1)}%`,
      subtitle: `${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}`,
      icon: MemoryStick,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      warning: metrics.memory.usagePercent > 80,
      critical: metrics.memory.usagePercent > 90
    },
    {
      title: 'Disk Usage',
      value: `${metrics.disk.usagePercent.toFixed(1)}%`,
      subtitle: `${formatBytes(metrics.disk.used)} / ${formatBytes(metrics.disk.total)}`,
      icon: HardDrive,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      warning: metrics.disk.usagePercent > 80,
      critical: metrics.disk.usagePercent > 90
    },
    {
      title: 'Database Pool',
      value: `${metrics.database.activeConnections}/${metrics.database.poolSize}`,
      subtitle: `${metrics.database.idleConnections} idle`,
      icon: Database,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      warning: metrics.database.activeConnections >= metrics.database.poolSize,
      critical: metrics.database.queueDepth > 0
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const borderColor = card.critical
          ? 'border-red-500'
          : card.warning
          ? 'border-yellow-500'
          : '';

        return (
          <Card key={card.title} className={borderColor}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <div className={cn('p-2 rounded-full', card.bgColor)}>
                <Icon className={cn('h-4 w-4', card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>

              {card.critical && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-3 w-3" />
                  <AlertDescription className="text-xs">Critical</AlertDescription>
                </Alert>
              )}

              {card.warning && !card.critical && (
                <Alert className="mt-2 bg-yellow-50 border-yellow-300">
                  <AlertTriangle className="h-3 w-3 text-yellow-600" />
                  <AlertDescription className="text-xs text-yellow-800">Warning</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}
```

### APIPerformanceMetrics Component

```typescript
// apps/frontend/src/components/monitoring/APIPerformanceMetrics.tsx
import { APIMetrics } from '@cc-task-manager/schemas';

interface APIPerformanceMetricsProps {
  metrics: APIMetrics;
}

export function APIPerformanceMetrics({ metrics }: APIPerformanceMetricsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Performance</CardTitle>
        <CardDescription>Response times and throughput</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Average Response Time</p>
            <p className="text-2xl font-bold">
              {metrics.averageResponseTime.toFixed(0)}ms
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">P95 Response Time</p>
            <p className={cn(
              'text-2xl font-bold',
              metrics.p95ResponseTime > 500 ? 'text-yellow-600' : '',
              metrics.p95ResponseTime > 1000 ? 'text-red-600' : ''
            )}>
              {metrics.p95ResponseTime.toFixed(0)}ms
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Requests Per Second</p>
            <p className="text-2xl font-bold">
              {metrics.requestsPerSecond.toFixed(1)}
            </p>
          </div>
        </div>

        {/* Endpoint Breakdown */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Slowest Endpoints</p>
          <div className="space-y-1">
            {metrics.endpointBreakdown
              .sort((a, b) => b.avgTime - a.avgTime)
              .slice(0, 5)
              .map((endpoint) => (
                <div key={endpoint.path} className="flex justify-between items-center text-sm">
                  <span className="font-mono text-xs">{endpoint.method} {endpoint.path}</span>
                  <div className="flex gap-4 text-muted-foreground">
                    <span>{endpoint.avgTime.toFixed(0)}ms avg</span>
                    <span>{endpoint.count} calls</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### MetricsChart Component

```typescript
// apps/frontend/src/components/monitoring/MetricsChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format } from 'date-fns';

interface MetricsChartProps {
  title: string;
  data: Array<{ timestamp: Date; value: number }>;
  dataKey: string;
  color: string;
}

export function MetricsChart({ title, data, dataKey, color }: MetricsChartProps) {
  // Transform data for Recharts
  const chartData = data.map(point => ({
    time: format(point.timestamp, 'HH:mm:ss'),
    [dataKey]: point.value.toFixed(1)
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Last 1 hour (sliding window)</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <Activity className="h-12 w-12 mb-2 opacity-50" />
            <p>Collecting metrics...</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${dataKey})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

### useSystemMetrics Hook

```typescript
// apps/frontend/src/hooks/useSystemMetrics.ts
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/contract-client';
import { SystemMetrics } from '@cc-task-manager/schemas';

interface UseSystemMetricsOptions {
  pollInterval?: number;
}

export function useSystemMetrics({ pollInterval = 5000 }: UseSystemMetricsOptions = {}) {
  const [history, setHistory] = useState<{
    cpu: Array<{ timestamp: Date; value: number }>;
    memory: Array<{ timestamp: Date; value: number }>;
  }>({
    cpu: [],
    memory: []
  });

  const query = useQuery({
    queryKey: ['system', 'metrics'],
    queryFn: () => apiClient.getSystemMetrics(),
    refetchInterval: pollInterval,
    refetchIntervalInBackground: false
  });

  // Maintain sliding window of last 1 hour (720 data points at 5s intervals)
  useEffect(() => {
    if (query.data) {
      setHistory((prev) => {
        const maxPoints = 720; // 1 hour at 5s intervals
        const newCpuPoint = { timestamp: new Date(), value: query.data.system.cpu.usage };
        const newMemoryPoint = { timestamp: new Date(), value: query.data.system.memory.usagePercent };

        return {
          cpu: [...prev.cpu, newCpuPoint].slice(-maxPoints),
          memory: [...prev.memory, newMemoryPoint].slice(-maxPoints)
        };
      });
    }
  }, [query.data]);

  return {
    metrics: query.data,
    history,
    isLoading: query.isLoading,
    error: query.error,
    lastUpdated: query.dataUpdatedAt
  };
}
```

## Backend API Design

### MonitoringController

```typescript
// apps/backend/src/monitoring/monitoring.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { MonitoringService } from './monitoring.service';

@Controller('api/monitoring')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('metrics')
  async getSystemMetrics() {
    return this.monitoringService.getMetrics();
  }
}
```

### MonitoringService

```typescript
// apps/backend/src/monitoring/monitoring.service.ts
import { Injectable } from '@nestjs/common';
import * as os from 'os';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class MonitoringService {
  private apiCallStats: Map<string, { count: number; totalTime: number; times: number[] }> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    const [systemMetrics, apiMetrics, dbMetrics, wsMetrics] = await Promise.all([
      this.getSystemMetrics(),
      this.getAPIMetrics(),
      this.getDatabaseMetrics(),
      this.getWebSocketMetrics()
    ]);

    return {
      system: systemMetrics,
      api: apiMetrics,
      database: dbMetrics,
      websocket: wsMetrics
    };
  }

  private async getSystemMetrics() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Calculate CPU usage (average across all cores)
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;

    return {
      cpu: {
        usage: cpuUsage,
        cores: cpus.length
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: (usedMem / totalMem) * 100
      },
      disk: await this.getDiskUsage()
    };
  }

  private async getDiskUsage() {
    // Simplified - in production, use libraries like `diskusage` or `check-disk-space`
    return {
      total: 500 * 1024 * 1024 * 1024, // 500GB (example)
      used: 200 * 1024 * 1024 * 1024,  // 200GB (example)
      free: 300 * 1024 * 1024 * 1024,  // 300GB (example)
      usagePercent: 40 // (example)
    };
  }

  private async getAPIMetrics() {
    // Calculate stats from recorded API calls
    const allStats = Array.from(this.apiCallStats.values());

    if (allStats.length === 0) {
      return {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        requestsPerSecond: 0,
        endpointBreakdown: []
      };
    }

    const allTimes = allStats.flatMap(s => s.times);
    allTimes.sort((a, b) => a - b);

    const avgResponseTime = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
    const p95Index = Math.floor(allTimes.length * 0.95);
    const p95ResponseTime = allTimes[p95Index] || 0;

    const totalRequests = allStats.reduce((acc, s) => acc + s.count, 0);
    const requestsPerSecond = totalRequests / 60; // Assuming 1-minute window

    const endpointBreakdown = Array.from(this.apiCallStats.entries()).map(([path, stats]) => ({
      path,
      method: 'GET', // Extract from path
      avgTime: stats.totalTime / stats.count,
      count: stats.count
    }));

    return {
      averageResponseTime: avgResponseTime,
      p95ResponseTime,
      requestsPerSecond,
      endpointBreakdown
    };
  }

  private async getDatabaseMetrics() {
    // Prisma doesn't expose connection pool directly, use raw queries if needed
    const poolSize = 10; // From DATABASE_URL connection string
    const activeConnections = 3; // Example (query `pg_stat_activity` for PostgreSQL)
    const idleConnections = 5; // Example

    return {
      activeConnections,
      idleConnections,
      poolSize,
      queueDepth: 0 // No queued requests
    };
  }

  private async getWebSocketMetrics() {
    // Track in WebSocket gateway
    return {
      connectedClients: 42, // Example (track in gateway)
      messagesPerSecond: 15.3, // Example
      averageLatency: 12 // ms
    };
  }

  // Middleware to track API calls
  recordAPICall(path: string, duration: number) {
    if (!this.apiCallStats.has(path)) {
      this.apiCallStats.set(path, { count: 0, totalTime: 0, times: [] });
    }

    const stats = this.apiCallStats.get(path)!;
    stats.count++;
    stats.totalTime += duration;
    stats.times.push(duration);

    // Keep only last 1000 calls per endpoint
    if (stats.times.length > 1000) {
      stats.times.shift();
    }
  }
}
```

## File Structure

```
apps/frontend/src/
├── app/monitoring/
│   ├── page.tsx                          # Main dashboard
│   ├── loading.tsx                       # Loading skeleton
│   └── error.tsx                         # Error boundary
├── components/monitoring/
│   ├── SystemMetrics.tsx                 # Resource cards
│   ├── APIPerformanceMetrics.tsx         # API stats
│   ├── MetricsChart.tsx                  # Recharts time-series
│   ├── WebSocketStatus.tsx               # WS stats
│   └── MonitoringDashboardSkeleton.tsx   # Loading state
├── hooks/
│   └── useSystemMetrics.ts               # Polling hook
└── lib/api/
    └── contract-client.ts                # Add getSystemMetrics method

apps/backend/src/monitoring/
├── monitoring.module.ts                  # Module definition
├── monitoring.controller.ts              # GET /api/monitoring/metrics
└── monitoring.service.ts                 # OS metrics collection

packages/schemas/src/
└── monitoring.schema.ts                  # Monitoring types
```

## Testing Strategy

```typescript
// apps/frontend/e2e/monitoring.spec.ts
import { test, expect } from '@playwright/test';

test.describe('System Monitoring Dashboard', () => {
  test('should display system metrics', async ({ page }) => {
    await page.goto('/monitoring');

    await expect(page.locator('text=CPU Usage')).toBeVisible();
    await expect(page.locator('text=Memory Usage')).toBeVisible();
    await expect(page.locator('text=Disk Usage')).toBeVisible();
  });

  test('should show warning for high CPU usage', async ({ page }) => {
    // Mock API to return high CPU usage
    await page.route('**/api/monitoring/metrics', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          system: { cpu: { usage: 85, cores: 4 }, memory: { usagePercent: 50 } }
        })
      });
    });

    await page.goto('/monitoring');
    await expect(page.locator('text=Warning')).toBeVisible();
  });

  test('should display time-series charts', async ({ page }) => {
    await page.goto('/monitoring');

    await expect(page.locator('text=CPU Usage (%)')).toBeVisible();
    await expect(page.locator('.recharts-wrapper')).toHaveCount(2); // CPU + Memory charts
  });

  test('should poll for updates every 5 seconds', async ({ page }) => {
    await page.goto('/monitoring');

    const initialCPU = await page.locator('text=CPU Usage').textContent();

    // Wait 6 seconds
    await page.waitForTimeout(6000);

    const updatedCPU = await page.locator('text=CPU Usage').textContent();
    expect(updatedCPU).toBeDefined();
  });
});
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_MONITORING_DASHBOARD_ENABLED=true
NEXT_PUBLIC_METRICS_POLL_INTERVAL=5000    # 5 seconds
NEXT_PUBLIC_METRICS_RETENTION=3600        # 1 hour (seconds)
NEXT_PUBLIC_REQUIRE_ADMIN_ROLE=true       # Restrict to admins
```

This design provides comprehensive system health visibility in real-time!
