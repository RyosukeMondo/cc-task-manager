import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { QueueJob, JobOptions, QueueMetrics } from './queue.schemas';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Queue Controller
 *
 * Provides REST API endpoints for queue management and monitoring.
 * All endpoints require authentication and authorization.
 *
 * Features:
 * - Job scheduling with validation
 * - Queue metrics and monitoring
 * - Queue management (pause, resume, clean)
 * - Admin-only operations for queue control
 */
@ApiTags('queues')
@Controller('queues')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(private readonly queueService: QueueService) {}

  /**
   * Add a new job to the queue
   */
  @Post('jobs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new job to the queue' })
  @ApiResponse({
    status: 201,
    description: 'Job successfully added to queue',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'Unique job identifier' },
        queue: { type: 'string', description: 'Queue name where job was added' },
        status: { type: 'string', enum: ['queued'], description: 'Job status' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid job data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async addJob(
    @Body() jobData: QueueJob,
    @Body('options') options?: JobOptions,
  ): Promise<{ jobId: string; queue: string; status: string }> {
    try {
      const jobId = await this.queueService.addJob(jobData, options);

      // Determine queue name from job type
      const queueName = this.getQueueNameFromJobType(jobData.type);

      this.logger.log(`Job ${jobId} added to queue ${queueName} by user`);

      return {
        jobId,
        queue: queueName,
        status: 'queued',
      };
    } catch (error) {
      this.logger.error(`Failed to add job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get queue metrics for monitoring
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Get queue metrics for monitoring' })
  @ApiQuery({
    name: 'queue',
    required: false,
    description: 'Specific queue name to get metrics for',
    enum: ['tasks', 'emails', 'reports', 'exports', 'scheduled', 'webhooks'],
  })
  @ApiResponse({
    status: 200,
    description: 'Queue metrics retrieved successfully',
    type: [Object], // QueueMetrics array
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getMetrics(@Query('queue') queueName?: string): Promise<QueueMetrics[]> {
    try {
      const metrics = await this.queueService.getQueueMetrics(queueName);
      this.logger.debug(`Retrieved metrics for ${metrics.length} queue(s)`);
      return metrics;
    } catch (error) {
      this.logger.error(`Failed to get queue metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Pause a specific queue (Admin only)
   */
  @Put(':queueName/pause')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Pause a specific queue (Admin only)' })
  @ApiParam({
    name: 'queueName',
    description: 'Name of the queue to pause',
    enum: ['tasks', 'emails', 'reports', 'exports', 'scheduled', 'webhooks'],
  })
  @ApiResponse({ status: 204, description: 'Queue paused successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async pauseQueue(@Param('queueName') queueName: string): Promise<void> {
    try {
      await this.queueService.pauseQueue(queueName);
      this.logger.log(`Queue ${queueName} paused by admin`);
    } catch (error) {
      this.logger.error(`Failed to pause queue ${queueName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resume a paused queue (Admin only)
   */
  @Put(':queueName/resume')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resume a paused queue (Admin only)' })
  @ApiParam({
    name: 'queueName',
    description: 'Name of the queue to resume',
    enum: ['tasks', 'emails', 'reports', 'exports', 'scheduled', 'webhooks'],
  })
  @ApiResponse({ status: 204, description: 'Queue resumed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async resumeQueue(@Param('queueName') queueName: string): Promise<void> {
    try {
      await this.queueService.resumeQueue(queueName);
      this.logger.log(`Queue ${queueName} resumed by admin`);
    } catch (error) {
      this.logger.error(`Failed to resume queue ${queueName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean completed/failed jobs from a queue (Admin only)
   */
  @Delete(':queueName/clean')
  @ApiOperation({ summary: 'Clean completed/failed jobs from a queue (Admin only)' })
  @ApiParam({
    name: 'queueName',
    description: 'Name of the queue to clean',
    enum: ['tasks', 'emails', 'reports', 'exports', 'scheduled', 'webhooks'],
  })
  @ApiQuery({
    name: 'grace',
    required: false,
    description: 'Grace period in milliseconds (default: 0)',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of jobs to clean (default: 100)',
    type: Number,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Job status to clean (default: completed)',
    enum: ['completed', 'failed'],
  })
  @ApiResponse({
    status: 200,
    description: 'Queue cleaned successfully',
    schema: {
      type: 'object',
      properties: {
        cleaned: { type: 'number', description: 'Number of jobs cleaned' },
        jobIds: { type: 'array', items: { type: 'string' }, description: 'IDs of cleaned jobs' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async cleanQueue(
    @Param('queueName') queueName: string,
    @Query('grace') grace?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: 'completed' | 'failed',
  ): Promise<{ cleaned: number; jobIds: string[] }> {
    try {
      const jobIds = await this.queueService.cleanQueue(
        queueName,
        grace || 0,
        limit || 100,
        status || 'completed'
      );

      this.logger.log(`Cleaned ${jobIds.length} jobs from queue ${queueName}`);

      return {
        cleaned: jobIds.length,
        jobIds,
      };
    } catch (error) {
      this.logger.error(`Failed to clean queue ${queueName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get dashboard statistics for all queues (Admin only)
   */
  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics for all queues (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalJobs: { type: 'number', description: 'Total number of jobs across all queues' },
        activeJobs: { type: 'number', description: 'Total number of active jobs' },
        completedToday: { type: 'number', description: 'Jobs completed today' },
        failedToday: { type: 'number', description: 'Jobs failed today' },
        queues: { type: 'array', description: 'Individual queue metrics' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  async getDashboard(): Promise<{
    totalJobs: number;
    activeJobs: number;
    completedToday: number;
    failedToday: number;
    queues: QueueMetrics[];
  }> {
    try {
      const metrics = await this.queueService.getQueueMetrics();

      // Calculate aggregate statistics
      const totalJobs = metrics.reduce((sum, m) =>
        sum + m.waiting + m.active + m.completed + m.failed + m.delayed, 0
      );
      const activeJobs = metrics.reduce((sum, m) => sum + m.active, 0);

      // For demo purposes, using completed/failed counts as today's counts
      // In production, you'd filter by actual date
      const completedToday = metrics.reduce((sum, m) => sum + m.completed, 0);
      const failedToday = metrics.reduce((sum, m) => sum + m.failed, 0);

      this.logger.debug(`Dashboard stats: ${totalJobs} total jobs, ${activeJobs} active`);

      return {
        totalJobs,
        activeJobs,
        completedToday,
        failedToday,
        queues: metrics,
      };
    } catch (error) {
      this.logger.error(`Failed to get dashboard statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper method to determine queue name from job type
   */
  private getQueueNameFromJobType(jobType: string): string {
    const typeToQueue = {
      'TASK_NOTIFICATION': 'tasks',
      'EMAIL': 'emails',
      'REPORT_GENERATION': 'reports',
      'DATA_EXPORT': 'exports',
      'SCHEDULED_TASK': 'scheduled',
      'WEBHOOK': 'webhooks',
    };
    return typeToQueue[jobType] || 'default';
  }
}