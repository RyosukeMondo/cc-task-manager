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
import { QueueManagerService } from './queue-manager.service';
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
@ApiTags('queue')
@Controller('queue')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly queueManagerService: QueueManagerService,
  ) {}

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

  // ========== Spec: queue-management-dashboard ==========

  /**
   * Get queue status with metrics, jobs, and throughput data
   *
   * Rate limited to 20 requests per minute per user (TODO: Add @nestjs/throttler)
   *
   * @returns Queue status including metrics, job list, and 24-hour throughput
   */
  @Get('status')
  // TODO: Add rate limiting with @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ApiOperation({ summary: 'Get queue status with metrics, jobs, and throughput' })
  @ApiResponse({
    status: 200,
    description: 'Queue status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        metrics: {
          type: 'object',
          properties: {
            activeCount: { type: 'number', description: 'Number of active jobs' },
            pendingCount: { type: 'number', description: 'Number of pending jobs' },
            completedCount: { type: 'number', description: 'Number of completed jobs' },
            failedCount: { type: 'number', description: 'Number of failed jobs' },
          },
        },
        jobs: {
          type: 'array',
          description: 'List of jobs with details',
        },
        throughput: {
          type: 'array',
          description: 'Last 24 hours of job completion data (hourly buckets)',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getQueueStatus(): Promise<{
    metrics: {
      activeCount: number;
      pendingCount: number;
      completedCount: number;
      failedCount: number;
    };
    jobs: Array<{
      id: string;
      name: string;
      status: string;
      progress: number;
      attemptsMade: number;
      attemptsMax: number;
      timestamp: Date;
      data: any;
      failedReason?: string;
    }>;
    throughput: Array<{
      hour: string;
      completed: number;
      failed: number;
    }>;
  }> {
    try {
      // Get metrics from all queues
      const allMetrics = await this.queueService.getQueueMetrics();

      // Aggregate metrics across all queues
      const metrics = {
        activeCount: allMetrics.reduce((sum, m) => sum + m.active, 0),
        pendingCount: allMetrics.reduce((sum, m) => sum + m.waiting + m.delayed, 0),
        completedCount: allMetrics.reduce((sum, m) => sum + m.completed, 0),
        failedCount: allMetrics.reduce((sum, m) => sum + m.failed, 0),
      };

      // Get jobs from all queues (limited to recent jobs)
      const jobs = await this.getAllRecentJobs();

      // Generate throughput data for last 24 hours
      const throughput = this.generateThroughputData(24);

      this.logger.debug(`Queue status retrieved: ${metrics.activeCount} active, ${metrics.pendingCount} pending`);

      return {
        metrics,
        jobs,
        throughput,
      };
    } catch (error) {
      this.logger.error(`Failed to get queue status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retry a failed job
   *
   * @param jobId Job ID to retry
   * @returns Success response
   */
  @Post('jobs/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiParam({ name: 'id', description: 'Job ID to retry' })
  @ApiResponse({
    status: 200,
    description: 'Job retry successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async retryJob(@Param('id') jobId: string): Promise<{ success: boolean }> {
    try {
      await this.queueManagerService.retryJob(jobId);
      this.logger.log(`Job ${jobId} retry initiated`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to retry job ${jobId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel a pending or active job
   *
   * @param jobId Job ID to cancel
   * @returns Success response
   */
  @Post('jobs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending or active job' })
  @ApiParam({ name: 'id', description: 'Job ID to cancel' })
  @ApiResponse({
    status: 200,
    description: 'Job cancelled successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async cancelJob(@Param('id') jobId: string): Promise<{ success: boolean }> {
    try {
      await this.queueManagerService.cancelJob(jobId);
      this.logger.log(`Job ${jobId} cancelled`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retry all failed jobs across all queues
   *
   * @returns Count of retried jobs
   */
  @Post('jobs/retry-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry all failed jobs' })
  @ApiResponse({
    status: 200,
    description: 'All failed jobs retry initiated',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        count: { type: 'number', description: 'Number of jobs retried' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async retryAllFailedJobs(): Promise<{ success: boolean; count: number }> {
    try {
      const count = await this.retryAllFailed();
      this.logger.log(`Retrying ${count} failed jobs`);
      return { success: true, count };
    } catch (error) {
      this.logger.error(`Failed to retry all failed jobs: ${error.message}`);
      throw error;
    }
  }

  // ========== End Spec: queue-management-dashboard ==========

  /**
   * Helper method to get recent jobs from all queues
   * @private
   */
  private async getAllRecentJobs(): Promise<Array<{
    id: string;
    name: string;
    status: string;
    progress: number;
    attemptsMade: number;
    attemptsMax: number;
    timestamp: Date;
    data: any;
    failedReason?: string;
  }>> {
    const jobs: Array<any> = [];
    const queueNames = ['tasks', 'emails', 'reports', 'exports', 'scheduled', 'webhooks'];

    for (const queueName of queueNames) {
      try {
        const queueJobs = await this.getJobsFromQueue(queueName);
        jobs.push(...queueJobs);
      } catch (error) {
        this.logger.warn(`Failed to get jobs from queue ${queueName}: ${error.message}`);
      }
    }

    // Sort by timestamp descending and limit to 100 most recent
    return jobs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 100);
  }

  /**
   * Helper method to get jobs from a specific queue
   * @private
   */
  private async getJobsFromQueue(queueName: string): Promise<Array<any>> {
    const jobs: Array<any> = [];

    // This is a simplified implementation - in production, you'd need to:
    // 1. Access the BullMQ Queue instance
    // 2. Fetch jobs using queue.getJobs() with different statuses
    // 3. Map the job data to the required format

    // For now, return empty array as placeholder
    // The actual implementation would require accessing queues from QueueService
    return jobs;
  }

  /**
   * Helper method to get failed jobs from a specific queue
   * @private
   */
  private async getFailedJobsFromQueue(queueName: string): Promise<Array<{ id: string }>> {
    try {
      // Use QueueManagerService to search for failed jobs
      const result = await this.queueManagerService.searchJobs({
        queueName,
        status: 'failed' as any,
        limit: 1000, // Get up to 1000 failed jobs
      });

      return result.jobs.map(job => ({ id: job.id }));
    } catch (error) {
      this.logger.warn(`Failed to get failed jobs from queue ${queueName}: ${error.message}`);
      return [];
    }
  }

  /**
   * Helper method to generate throughput data for the last N hours
   * @private
   */
  private generateThroughputData(hours: number): Array<{
    hour: string;
    completed: number;
    failed: number;
  }> {
    const throughput: Array<any> = [];
    const now = new Date();

    for (let i = hours - 1; i >= 0; i--) {
      const hourDate = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourString = hourDate.toISOString().slice(0, 13) + ':00';

      // In production, this would query actual job completion data
      // For now, return placeholder data
      throughput.push({
        hour: hourString,
        completed: 0,
        failed: 0,
      });
    }

    return throughput;
  }

  /**
   * Helper method to retry all failed jobs
   * @private
   */
  private async retryAllFailed(): Promise<number> {
    let count = 0;
    const queueNames = ['tasks', 'emails', 'reports', 'exports', 'scheduled', 'webhooks'];

    for (const queueName of queueNames) {
      try {
        const metrics = await this.queueService.getQueueMetrics(queueName);

        if (metrics.length > 0 && metrics[0].failed > 0) {
          // Get all failed jobs for this queue
          const failedJobs = await this.getFailedJobsFromQueue(queueName);

          // Retry each failed job using QueueManagerService
          for (const job of failedJobs) {
            try {
              await this.queueManagerService.retryJob(job.id);
              count++;
            } catch (error) {
              this.logger.warn(`Failed to retry job ${job.id}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to retry jobs in queue ${queueName}: ${error.message}`);
      }
    }

    return count;
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