import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

@Injectable()
export class MemoryHealthIndicator extends HealthIndicator {
  async isHealthy(key: string, heapThreshold: number): Promise<HealthIndicatorResult> {
    const memoryUsage = process.memoryUsage();
    const heapUsed = memoryUsage.heapUsed;
    const heapTotal = memoryUsage.heapTotal;
    const heapPercentage = (heapUsed / heapTotal) * 100;

    const isHealthy = heapUsed < heapThreshold;

    const data = {
      heap: {
        used: this.formatBytes(heapUsed),
        total: this.formatBytes(heapTotal),
        limit: this.formatBytes(heapThreshold),
        percentage: parseFloat(heapPercentage.toFixed(2)),
      },
      rss: this.formatBytes(memoryUsage.rss),
      external: this.formatBytes(memoryUsage.external),
      arrayBuffers: this.formatBytes(memoryUsage.arrayBuffers),
    };

    if (!isHealthy) {
      return this.getStatus(key, false, {
        ...data,
        message: `Heap memory usage (${data.heap.used}) exceeds threshold (${data.heap.limit})`,
      });
    }

    return this.getStatus(key, true, data);
  }

  async checkGarbageCollection(key: string): Promise<HealthIndicatorResult> {
    if (!global.gc) {
      return this.getStatus(key, true, {
        message: 'Garbage collection metrics not available (node not started with --expose-gc)',
      });
    }

    const beforeGC = process.memoryUsage();
    global.gc();
    const afterGC = process.memoryUsage();

    const freedMemory = beforeGC.heapUsed - afterGC.heapUsed;
    const gcEfficiency = (freedMemory / beforeGC.heapUsed) * 100;

    return this.getStatus(key, true, {
      beforeGC: {
        heapUsed: this.formatBytes(beforeGC.heapUsed),
        heapTotal: this.formatBytes(beforeGC.heapTotal),
      },
      afterGC: {
        heapUsed: this.formatBytes(afterGC.heapUsed),
        heapTotal: this.formatBytes(afterGC.heapTotal),
      },
      freedMemory: this.formatBytes(freedMemory),
      efficiency: `${gcEfficiency.toFixed(2)}%`,
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}