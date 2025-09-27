import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult } from '@nestjs/terminus';
import * as os from 'os';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class HealthService {
  private readonly startupTime: Date;

  constructor(private readonly queueService: QueueService) {
    this.startupTime = new Date();
  }

  async checkStartup(key: string): Promise<HealthIndicatorResult> {
    const uptime = process.uptime();
    const minStartupTime = 5;

    if (uptime < minStartupTime) {
      return {
        [key]: {
          status: 'down',
          message: `Application is still starting (${uptime.toFixed(1)}s / ${minStartupTime}s)`,
        },
      };
    }

    return {
      [key]: {
        status: 'up',
        startupTime: this.startupTime.toISOString(),
        uptime: `${uptime.toFixed(0)}s`,
      },
    };
  }

  async checkQueueHealth(key: string): Promise<HealthIndicatorResult> {
    try {
      const queues = await this.queueService.getQueuesHealth();
      const allHealthy = queues.every((q) => q.status === 'healthy');

      if (!allHealthy) {
        const unhealthyQueues = queues
          .filter((q) => q.status !== 'healthy')
          .map((q) => q.name);

        return {
          [key]: {
            status: 'down',
            unhealthyQueues,
            details: queues,
          },
        };
      }

      const aggregatedStats = queues.reduce(
        (acc, queue) => ({
          activeJobs: acc.activeJobs + queue.activeJobs,
          waitingJobs: acc.waitingJobs + queue.waitingJobs,
          completedJobs: acc.completedJobs + queue.completedJobs,
          failedJobs: acc.failedJobs + queue.failedJobs,
        }),
        { activeJobs: 0, waitingJobs: 0, completedJobs: 0, failedJobs: 0 },
      );

      return {
        [key]: {
          status: 'up',
          ...aggregatedStats,
          queuesCount: queues.length,
        },
      };
    } catch (error) {
      return {
        [key]: {
          status: 'down',
          message: error.message,
        },
      };
    }
  }

  async getSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;

    return {
      cpu: {
        usage: parseFloat(cpuUsage.toFixed(2)),
        count: cpus.length,
        model: cpus[0]?.model || 'unknown',
      },
      memory: {
        total: this.formatBytes(totalMemory),
        free: this.formatBytes(freeMemory),
        used: this.formatBytes(usedMemory),
        percentage: parseFloat(((usedMemory / totalMemory) * 100).toFixed(2)),
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: {
          rss: this.formatBytes(memoryUsage.rss),
          heapTotal: this.formatBytes(memoryUsage.heapTotal),
          heapUsed: this.formatBytes(memoryUsage.heapUsed),
          external: this.formatBytes(memoryUsage.external),
          arrayBuffers: this.formatBytes(memoryUsage.arrayBuffers),
        },
        versions: {
          node: process.version,
          v8: process.versions.v8,
        },
      },
      system: {
        loadAverage: os.loadavg().map((load) => parseFloat(load.toFixed(2))),
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 3001,
      },
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}