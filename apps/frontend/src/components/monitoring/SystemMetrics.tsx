import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Cpu, MemoryStick, HardDrive, Database, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemMetricsProps {
  metrics: {
    system: {
      cpu: {
        usage: number;
      };
      memory: {
        total: number;
        used: number;
        free: number;
      };
      disk: {
        total: number;
        used: number;
        free: number;
      };
    };
    database: {
      activeConnections: number;
      idleConnections: number;
      poolSize: number;
      queueDepth: number;
    };
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getWarningLevel(percentage: number): 'normal' | 'warning' | 'critical' {
  if (percentage > 90) return 'critical';
  if (percentage > 80) return 'warning';
  return 'normal';
}

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  warningLevel: 'normal' | 'warning' | 'critical';
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function MetricCard({ icon, title, value, subtitle, warningLevel, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400',
    orange: 'text-orange-600 dark:text-orange-400',
  };

  const borderClasses = {
    normal: '',
    warning: 'border-yellow-500 dark:border-yellow-600 border-2',
    critical: 'border-red-500 dark:border-red-600 border-2',
  };

  return (
    <div className="space-y-2">
      <Card className={cn(borderClasses[warningLevel])}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className={colorClasses[color]}>{icon}</div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </CardContent>
      </Card>
      {warningLevel === 'critical' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Critical: {title} exceeds 90%
          </AlertDescription>
        </Alert>
      )}
      {warningLevel === 'warning' && (
        <Alert className="border-yellow-500 dark:border-yellow-600">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            Warning: {title} exceeds 80%
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function SystemMetrics({ metrics }: SystemMetricsProps) {
  const cpuUsage = metrics.system.cpu.usage;
  const memoryUsage = (metrics.system.memory.used / metrics.system.memory.total) * 100;
  const diskUsage = (metrics.system.disk.used / metrics.system.disk.total) * 100;
  const poolUsage = (metrics.database.activeConnections / metrics.database.poolSize) * 100;

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={<Cpu className="h-4 w-4" />}
        title="CPU Usage"
        value={`${cpuUsage.toFixed(1)}%`}
        subtitle="Average CPU utilization"
        warningLevel={getWarningLevel(cpuUsage)}
        color="blue"
      />
      <MetricCard
        icon={<MemoryStick className="h-4 w-4" />}
        title="Memory Usage"
        value={`${memoryUsage.toFixed(1)}%`}
        subtitle={`${formatBytes(metrics.system.memory.used)} / ${formatBytes(metrics.system.memory.total)}`}
        warningLevel={getWarningLevel(memoryUsage)}
        color="green"
      />
      <MetricCard
        icon={<HardDrive className="h-4 w-4" />}
        title="Disk Usage"
        value={`${diskUsage.toFixed(1)}%`}
        subtitle={`${formatBytes(metrics.system.disk.used)} / ${formatBytes(metrics.system.disk.total)}`}
        warningLevel={getWarningLevel(diskUsage)}
        color="purple"
      />
      <MetricCard
        icon={<Database className="h-4 w-4" />}
        title="Database Pool"
        value={`${poolUsage.toFixed(1)}%`}
        subtitle={`${metrics.database.activeConnections} / ${metrics.database.poolSize} connections`}
        warningLevel={getWarningLevel(poolUsage)}
        color="orange"
      />
    </div>
  );
}
