import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      await (this.prisma as any).$queryRaw`SELECT 1`;

      const responseTime = Date.now() - startTime;

      let connectionInfo = {
        active: 'N/A',
        idle: 'N/A',
      };

      try {
        const metrics = await (this.prisma as any).$metrics.json();
        connectionInfo = {
          active: metrics.counters?.find((c) => c.key === 'prisma_pool_connections_open')?.value || 0,
          idle: metrics.counters?.find((c) => c.key === 'prisma_pool_connections_idle')?.value || 0,
        };
      } catch {
        // Metrics might not be available in all configurations
      }

      return this.getStatus(key, true, {
        responseTime: `${responseTime}ms`,
        connections: connectionInfo,
        status: 'connected',
      });
    } catch (error) {
      return this.getStatus(key, false, {
        message: 'Database connection failed',
        error: error.message,
      });
    }
  }

  async checkConnection(key: string, timeout = 3000): Promise<HealthIndicatorResult> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(
          this.getStatus(key, false, {
            message: 'Database connection timeout',
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
              message: 'Database connection error',
              error: error.message,
            }),
          );
        });
    });
  }
}