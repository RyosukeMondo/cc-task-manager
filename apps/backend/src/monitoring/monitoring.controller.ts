import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SystemMetricsResponse } from './monitoring.service';

/**
 * Monitoring API Controller
 *
 * Provides REST endpoints for system monitoring metrics:
 * - System resource metrics (CPU, memory, disk)
 * - API performance metrics (response times, throughput)
 * - Database connection pool status
 * - WebSocket metrics (connections, latency)
 *
 * Protected by JWT authentication
 * TODO: Add rate limiting (20 req/min per user) when @nestjs/throttler is configured
 */
@ApiTags('Monitoring')
@Controller('monitoring')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  /**
   * Get system metrics
   *
   * Returns comprehensive system monitoring metrics including:
   * - System resources (CPU, memory, disk usage)
   * - API performance (avg response time, p95, RPS, endpoint breakdown)
   * - Database connection pool status
   * - WebSocket metrics (connected clients, message throughput)
   *
   * Requires JWT authentication.
   * TODO: Rate limit: 20 requests per minute per user
   */
  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get system metrics',
    description: `Returns comprehensive system monitoring metrics.

    **Metrics Included:**
    - System: CPU usage, memory usage, disk usage
    - API: Average response time, p95 response time, requests per second, endpoint breakdown
    - Database: Connection pool status (active, idle, queue depth)
    - WebSocket: Connected clients, messages per second, average latency

    **Authentication:** Requires valid JWT token

    **Rate Limit:** 20 requests per minute per user (TODO: implement)`,
  })
  @ApiOkResponse({
    description: 'System metrics retrieved successfully',
    type: Object, // SystemMetricsResponse
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getMetrics(): Promise<SystemMetricsResponse> {
    return this.monitoringService.getMetrics();
  }
}
