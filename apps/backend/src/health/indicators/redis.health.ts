import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    @InjectQueue('task-queue') private readonly taskQueue: Queue,
    @InjectQueue('notification-queue') private readonly notificationQueue: Queue,
  ) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      const taskQueueClient = await this.taskQueue.client;
      const notificationQueueClient = await this.notificationQueue.client;

      await taskQueueClient.ping();
      await notificationQueueClient.ping();

      const responseTime = Date.now() - startTime;

      const info = await taskQueueClient.info('memory');
      const memoryInfo = this.parseRedisInfo(info);

      return this.getStatus(key, true, {
        responseTime: `${responseTime}ms`,
        connections: {
          taskQueue: taskQueueClient.status === 'ready' ? 'connected' : 'disconnected',
          notificationQueue: notificationQueueClient.status === 'ready' ? 'connected' : 'disconnected',
        },
        memory: {
          used: memoryInfo.used_memory_human || 'N/A',
          peak: memoryInfo.used_memory_peak_human || 'N/A',
        },
        status: 'connected',
      });
    } catch (error) {
      return this.getStatus(key, false, {
        message: 'Redis connection failed',
        error: error.message,
      });
    }
  }

  async checkConnection(key: string, timeout = 3000): Promise<HealthIndicatorResult> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(
          this.getStatus(key, false, {
            message: 'Redis connection timeout',
            timeout: `${timeout}ms`,
          }),
        );
      }, timeout);

      this.pingCheck(key)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          resolve(
            this.getStatus(key, false, {
              message: 'Redis connection error',
              error: error.message,
            }),
          );
        });
    });
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const lines = info.split('\r\n');
    const result: Record<string, string> = {};

    lines.forEach((line) => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    });

    return result;
  }
}