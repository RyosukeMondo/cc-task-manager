import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface APIPerformanceMetricsProps {
  metrics?: {
    api: {
      averageResponseTime: number;
      p95ResponseTime: number;
      requestsPerSecond: number;
      endpointBreakdown: Array<{
        path: string;
        count: number;
        avgTime: number;
      }>;
    };
  };
  isLoading?: boolean;
}

function getPerformanceLevel(p95Time: number): 'normal' | 'warning' | 'critical' {
  if (p95Time > 1000) return 'critical';
  if (p95Time > 500) return 'warning';
  return 'normal';
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(num));
}

function formatResponseTime(ms: number): string {
  return `${ms.toFixed(0)}ms`;
}

export function APIPerformanceMetrics({ metrics, isLoading }: APIPerformanceMetricsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <p className="text-sm text-muted-foreground">No API metrics available</p>
        </CardContent>
      </Card>
    );
  }

  const { averageResponseTime, p95ResponseTime, requestsPerSecond, endpointBreakdown } = metrics.api;
  const performanceLevel = getPerformanceLevel(p95ResponseTime);

  // Show top 5 slowest endpoints
  const slowestEndpoints = endpointBreakdown.slice(0, 5);

  const borderClasses = {
    normal: '',
    warning: 'border-yellow-500 dark:border-yellow-600 border-2',
    critical: 'border-red-500 dark:border-red-600 border-2',
  };

  return (
    <div className="space-y-2">
      <Card className={cn(borderClasses[performanceLevel])}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">API Performance</CardTitle>
          <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Avg Response</div>
              <div className="text-xl font-bold">{formatResponseTime(averageResponseTime)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">P95 Response</div>
              <div className={cn(
                "text-xl font-bold",
                performanceLevel === 'critical' && "text-red-600 dark:text-red-400",
                performanceLevel === 'warning' && "text-yellow-600 dark:text-yellow-400"
              )}>
                {formatResponseTime(p95ResponseTime)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Requests/sec</div>
              <div className="text-xl font-bold">{requestsPerSecond.toFixed(2)}</div>
            </div>
          </div>

          {/* Endpoint Breakdown Table */}
          {slowestEndpoints.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Slowest Endpoints
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint</TableHead>
                    <TableHead className="text-right">Avg Time</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slowestEndpoints.map((endpoint, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-xs">
                        {endpoint.path}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatResponseTime(endpoint.avgTime)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatNumber(endpoint.count)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warning/Critical Alerts */}
      {performanceLevel === 'critical' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Critical: P95 response time exceeds 1000ms
          </AlertDescription>
        </Alert>
      )}
      {performanceLevel === 'warning' && (
        <Alert className="border-yellow-500 dark:border-yellow-600">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            Warning: P95 response time exceeds 500ms
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
