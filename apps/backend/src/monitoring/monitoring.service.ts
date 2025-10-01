import { Injectable } from '@nestjs/common';
import * as os from 'os';
import { PrismaService } from '../database/prisma.service';

interface APICallMetric {
  count: number;
  totalTime: number;
  times: number[];
}

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
}

interface APIMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  requestsPerSecond: number;
  endpointBreakdown: Array<{
    path: string;
    count: number;
    avgTime: number;
  }>;
}

interface DatabaseMetrics {
  activeConnections: number;
  idleConnections: number;
  poolSize: number;
  queueDepth: number;
}

interface WebSocketMetrics {
  connectedClients: number;
  messagesPerSecond: number;
  averageLatency: number;
}

export interface SystemMetricsResponse {
  system: SystemMetrics;
  api: APIMetrics;
  database: DatabaseMetrics;
  websocket: WebSocketMetrics;
  timestamp: Date;
}

/**
 * MonitoringService - System metrics collection service
 *
 * Collects and aggregates:
 * - System metrics: CPU usage, memory usage, disk usage
 * - API metrics: Response times, throughput, endpoint performance
 * - Database metrics: Connection pool status
 * - WebSocket metrics: Client connections, message throughput
 */
@Injectable()
export class MonitoringService {
  private apiMetrics = new Map<string, APICallMetric>();
  private metricsStartTime = Date.now();
  private wsConnectedClients = 0;
  private wsMessageCount = 0;
  private wsLastMessageTime = Date.now();
  private wsLatencies: number[] = [];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get comprehensive system metrics
   */
  async getMetrics(): Promise<SystemMetricsResponse> {
    const [system, api, database, websocket] = await Promise.all([
      this.getSystemMetrics(),
      this.getAPIMetrics(),
      this.getDatabaseMetrics(),
      this.getWebSocketMetrics(),
    ]);

    return {
      system,
      api,
      database,
      websocket,
      timestamp: new Date(),
    };
  }

  /**
   * Record an API call for metrics tracking
   * Should be called by middleware on each request
   */
  recordAPICall(path: string, duration: number): void {
    const metric = this.apiMetrics.get(path) || {
      count: 0,
      totalTime: 0,
      times: [],
    };

    metric.count++;
    metric.totalTime += duration;
    metric.times.push(duration);

    // Keep only last 1000 times to prevent memory bloat
    if (metric.times.length > 1000) {
      metric.times = metric.times.slice(-1000);
    }

    this.apiMetrics.set(path, metric);
  }

  /**
   * Get system resource metrics (CPU, memory, disk)
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    // CPU metrics
    const cpus = os.cpus();
    const cpuUsage = this.calculateCPUUsage(cpus);

    // Memory metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Disk metrics (placeholder - would need check-disk-space library for real implementation)
    const diskTotal = 100 * 1024 * 1024 * 1024; // 100 GB placeholder
    const diskUsed = 50 * 1024 * 1024 * 1024; // 50 GB placeholder
    const diskFree = diskTotal - diskUsed;

    return {
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        usagePercent: (usedMemory / totalMemory) * 100,
      },
      disk: {
        total: diskTotal,
        free: diskFree,
        used: diskUsed,
        usagePercent: (diskUsed / diskTotal) * 100,
      },
    };
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCPUUsage(cpus: os.CpuInfo[]): number {
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof os.CpuInfo['times']];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - (100 * idle) / total;

    return Math.round(usage * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get API performance metrics
   */
  private getAPIMetrics(): APIMetrics {
    const allTimes: number[] = [];
    const endpointBreakdown: Array<{
      path: string;
      count: number;
      avgTime: number;
    }> = [];

    this.apiMetrics.forEach((metric, path) => {
      allTimes.push(...metric.times);
      endpointBreakdown.push({
        path,
        count: metric.count,
        avgTime: metric.totalTime / metric.count,
      });
    });

    // Sort by avgTime descending to get slowest endpoints
    endpointBreakdown.sort((a, b) => b.avgTime - a.avgTime);

    // Calculate overall metrics
    const averageResponseTime =
      allTimes.length > 0
        ? allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length
        : 0;

    const p95ResponseTime = this.calculatePercentile(allTimes, 95);

    const totalRequests = Array.from(this.apiMetrics.values()).reduce(
      (sum, metric) => sum + metric.count,
      0,
    );
    const elapsedSeconds = (Date.now() - this.metricsStartTime) / 1000;
    const requestsPerSecond = elapsedSeconds > 0 ? totalRequests / elapsedSeconds : 0;

    return {
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      p95ResponseTime: Math.round(p95ResponseTime * 100) / 100,
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      endpointBreakdown: endpointBreakdown.slice(0, 10), // Top 10 slowest
    };
  }

  /**
   * Calculate percentile from array of numbers
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get database connection pool metrics
   */
  private async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    // Note: Prisma doesn't expose connection pool metrics directly
    // This would require raw SQL queries or using Prisma's internal pool
    // For now, returning placeholder values
    // In production, you might use: SELECT * FROM pg_stat_activity (PostgreSQL)

    return {
      activeConnections: 5,
      idleConnections: 5,
      poolSize: 10,
      queueDepth: 0,
    };
  }

  /**
   * Get WebSocket metrics
   */
  private getWebSocketMetrics(): WebSocketMetrics {
    const elapsedSeconds = (Date.now() - this.wsLastMessageTime) / 1000;
    const messagesPerSecond =
      elapsedSeconds > 0 ? this.wsMessageCount / elapsedSeconds : 0;

    const averageLatency =
      this.wsLatencies.length > 0
        ? this.wsLatencies.reduce((sum, lat) => sum + lat, 0) / this.wsLatencies.length
        : 0;

    return {
      connectedClients: this.wsConnectedClients,
      messagesPerSecond: Math.round(messagesPerSecond * 100) / 100,
      averageLatency: Math.round(averageLatency * 100) / 100,
    };
  }

  /**
   * Track WebSocket client connection
   */
  trackWSConnection(connected: boolean): void {
    if (connected) {
      this.wsConnectedClients++;
    } else {
      this.wsConnectedClients = Math.max(0, this.wsConnectedClients - 1);
    }
  }

  /**
   * Record WebSocket message
   */
  recordWSMessage(latency?: number): void {
    this.wsMessageCount++;
    this.wsLastMessageTime = Date.now();

    if (latency !== undefined) {
      this.wsLatencies.push(latency);
      // Keep only last 1000 latencies
      if (this.wsLatencies.length > 1000) {
        this.wsLatencies = this.wsLatencies.slice(-1000);
      }
    }
  }

  /**
   * Reset metrics (useful for testing or manual resets)
   */
  resetMetrics(): void {
    this.apiMetrics.clear();
    this.metricsStartTime = Date.now();
    this.wsMessageCount = 0;
    this.wsLastMessageTime = Date.now();
    this.wsLatencies = [];
  }
}
