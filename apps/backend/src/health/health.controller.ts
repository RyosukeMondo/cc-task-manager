import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator as NestMemoryHealthIndicator,
  DiskHealthIndicator as NestDiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService } from './health.service';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { MemoryHealthIndicator } from './indicators/memory.health';
import { DiskHealthIndicator } from './indicators/disk.health';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthService: HealthService,
    private readonly http: HttpHealthIndicator,
    private readonly database: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly nestMemory: NestMemoryHealthIndicator,
    private readonly nestDisk: NestDiskHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Basic health check',
    description: 'Returns simple health status of the service',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      example: {
        status: 'ok',
        info: {
          app: { status: 'up' },
        },
        error: {},
        details: {
          app: { status: 'up' },
        },
      },
    },
  })
  check() {
    return this.health.check([
      () => ({ app: { status: 'up' } }),
    ]);
  }

  @Get('live')
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Kubernetes liveness probe - checks if application is running',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
  })
  @ApiResponse({
    status: 503,
    description: 'Application is not responding',
  })
  liveness() {
    return this.health.check([
      () => this.memory.isHealthy('memory_heap', 150 * 1024 * 1024),
      () => this.nestMemory.checkRSS('memory_rss', 300 * 1024 * 1024),
    ]);
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Kubernetes readiness probe - checks if application is ready to receive traffic',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready',
    schema: {
      example: {
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up', connections: 1 },
        },
        error: {},
        details: {},
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Application is not ready',
  })
  readiness() {
    return this.health.check([
      () => this.database.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }

  @Get('startup')
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Startup probe',
    description: 'Kubernetes startup probe - checks if application has started successfully',
  })
  @ApiResponse({
    status: 200,
    description: 'Application has started successfully',
  })
  @ApiResponse({
    status: 503,
    description: 'Application is still starting',
  })
  startup() {
    return this.health.check([
      () => this.healthService.checkStartup('startup'),
      () => this.database.pingCheck('database'),
    ]);
  }

  @Get('detailed')
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Detailed health check',
    description: 'Comprehensive health check including all system components',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed health status',
    schema: {
      example: {
        status: 'ok',
        info: {
          database: {
            status: 'up',
            responseTime: 5,
            connections: {
              active: 2,
              idle: 8,
            },
          },
          redis: {
            status: 'up',
            responseTime: 1,
            memory: {
              used: '10MB',
              peak: '12MB',
            },
          },
          memory: {
            status: 'up',
            heap: {
              used: '45MB',
              limit: '150MB',
              percentage: 30,
            },
            rss: '120MB',
          },
          disk: {
            status: 'up',
            used: '45%',
            free: '55GB',
          },
          queue: {
            status: 'up',
            activeJobs: 0,
            waitingJobs: 0,
            completedJobs: 150,
            failedJobs: 2,
          },
        },
        uptime: 3600,
        timestamp: '2025-01-01T12:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'One or more components are unhealthy',
  })
  async detailed() {
    const checks = await this.health.check([
      () => this.database.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
      () => this.memory.isHealthy('memory_heap', 150 * 1024 * 1024),
      () => this.nestMemory.checkRSS('memory_rss', 300 * 1024 * 1024),
      () => this.disk.isHealthy('disk_storage', '/', 80),
      () => this.healthService.checkQueueHealth('queue'),
    ]);

    return {
      ...checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  @Get('metrics')
  @Public()
  @ApiOperation({
    summary: 'System metrics',
    description: 'Returns system performance metrics for monitoring',
  })
  @ApiResponse({
    status: 200,
    description: 'System metrics',
    schema: {
      example: {
        cpu: {
          usage: 25.5,
          count: 4,
        },
        memory: {
          total: '8GB',
          free: '3.2GB',
          used: '4.8GB',
          percentage: 60,
        },
        process: {
          pid: 12345,
          uptime: 3600,
          memory: {
            rss: '120MB',
            heapTotal: '70MB',
            heapUsed: '45MB',
            external: '2MB',
            arrayBuffers: '1MB',
          },
        },
        system: {
          loadAverage: [1.2, 1.5, 1.3],
          platform: 'linux',
          arch: 'x64',
          nodeVersion: '18.17.0',
        },
      },
    },
  })
  async metrics() {
    return this.healthService.getSystemMetrics();
  }

  @Get('dependencies')
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'External dependencies health check',
    description: 'Checks health of all external service dependencies',
  })
  @ApiResponse({
    status: 200,
    description: 'All dependencies are healthy',
  })
  @ApiResponse({
    status: 503,
    description: 'One or more dependencies are unhealthy',
  })
  async dependencies() {
    const externalServices = [];

    if (process.env.EXTERNAL_API_URL) {
      externalServices.push(
        () => this.http.pingCheck('external_api', process.env.EXTERNAL_API_URL),
      );
    }

    if (process.env.AUTH_SERVICE_URL) {
      externalServices.push(
        () => this.http.pingCheck('auth_service', process.env.AUTH_SERVICE_URL),
      );
    }

    const baseChecks = [
      () => this.database.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ];

    return this.health.check([...baseChecks, ...externalServices]);
  }
}