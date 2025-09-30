import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CaslAuthGuard } from '../auth/guards/casl-auth.guard';
import { RequireAbility, createRule } from '../auth/decorators/casl.decorator';
import { Actions } from '../auth/casl-ability.factory';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { QueueManagerService } from './queue-manager.service';
import { QueueMonitorService } from './queue-monitor.service';
import { JobSchedulerService } from './scheduler/job-scheduler.service';
import { JWTPayload } from '../schemas/auth.schemas';
import {
  QueueJob,
  QueueManagerOptions,
  JobPriority,
  JobStatus,
  BulkJobOperation,
  JobSearchFilters,
  DelayedJobOptions,
  JobRetryStrategy,
} from './queue.schemas';

/**
 * Queue Dashboard Controller
 *
 * Provides comprehensive REST API for queue management and job monitoring.
 * Implements administrative interface following SOLID principles and security best practices.
 *
 * Features:
 * - Job lifecycle management (create, update, cancel, retry)
 * - Queue monitoring and health analysis
 * - Performance metrics and statistics
 * - Worker management and scaling control
 * - Administrative operations (pause, resume, clean)
 * - Bulk operations for efficiency
 * - Real-time dashboard data
 *
 * Security:
 * - All endpoints require JWT authentication
 * - Administrative operations require CASL authorization
 * - Proper input validation using Zod schemas
 * - Rate limiting and access control
 */
@ApiTags('Queue Dashboard')
@Controller('queue/dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QueueDashboardController {
  private readonly logger = new Logger(QueueDashboardController.name);

  constructor(
    private readonly queueManagerService: QueueManagerService,
    private readonly queueMonitorService: QueueMonitorService,
    private readonly jobSchedulerService: JobSchedulerService,
  ) {}

  // ========================================
  // Dashboard Overview Endpoints
  // ========================================

  /**
   * Get comprehensive dashboard overview with all queue statistics
   */
  @Get('overview')
  @ApiOperation({ summary: 'Get comprehensive dashboard overview' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'object',
          properties: {
            totalJobs: { type: 'number' },
            activeJobs: { type: 'number' },
            completedJobs: { type: 'number' },
            failedJobs: { type: 'number' },
            queueCount: { type: 'number' },
            overallHealthScore: { type: 'number' },
          },
        },
        queueMetrics: { type: 'array', description: 'Metrics for all queues' },
        systemHealth: { type: 'object', description: 'System health status' },
        recentActivity: { type: 'array', description: 'Recent job activity' },
      },
    },
  })
  async getDashboardOverview(@CurrentUser() user: JWTPayload) {
    try {
      const [queueMetrics, queueHealth, resourceUtilization] = await Promise.all([
        this.queueMonitorService.getCurrentMetrics(),
        this.queueMonitorService.getQueueHealth(),
        this.queueMonitorService.getResourceUtilization(),
      ]);

      // Calculate summary statistics
      const summary = {
        totalJobs: queueMetrics.reduce(
          (sum, m) => sum + m.waiting + m.active + m.completed + m.failed + m.delayed,
          0
        ),
        activeJobs: queueMetrics.reduce((sum, m) => sum + m.active, 0),
        completedJobs: queueMetrics.reduce((sum, m) => sum + m.completed, 0),
        failedJobs: queueMetrics.reduce((sum, m) => sum + m.failed, 0),
        queueCount: queueMetrics.length,
        overallHealthScore: queueHealth.reduce((sum, q) => sum + q.healthScore, 0) / queueHealth.length,
      };

      this.logger.log(`Dashboard overview requested by user ${user.username}`);

      return {
        summary,
        queueMetrics,
        systemHealth: {
          queues: queueHealth,
          resources: resourceUtilization,
        },
        recentActivity: [], // Would implement with job history
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get dashboard overview: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get real-time queue metrics
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Get real-time queue metrics' })
  @ApiQuery({
    name: 'queue',
    required: false,
    description: 'Specific queue name to get metrics for',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue metrics retrieved successfully',
  })
  async getQueueMetrics(
    @Query('queue') queueName?: string,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      const metrics = await this.queueMonitorService.getCurrentMetrics(queueName);
      this.logger.debug(`Queue metrics requested by user ${user.username} for ${queueName || 'all queues'}`);
      return {
        metrics,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get queue metrics: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get queue health analysis
   */
  @Get('health')
  @ApiOperation({ summary: 'Get queue health analysis with recommendations' })
  @ApiQuery({
    name: 'queue',
    required: false,
    description: 'Specific queue name to analyze',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue health analysis retrieved successfully',
  })
  async getQueueHealth(
    @Query('queue') queueName?: string,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      const health = await this.queueMonitorService.getQueueHealth(queueName);
      this.logger.debug(`Queue health analysis requested by user ${user.username}`);
      return {
        health,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get queue health: ${error.message}`, error);
      throw error;
    }
  }

  // ========================================
  // Job Management Endpoints
  // ========================================

  /**
   * Create a new job
   */
  @Post('jobs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new job to the queue' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        jobData: { type: 'object', description: 'Job data to process' },
        options: { type: 'object', description: 'Job options including priority and delay' },
      },
      required: ['jobData'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Job created successfully',
  })
  async createJob(
    @Body('jobData') jobData: QueueJob,
    @Body('options') options?: QueueManagerOptions,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      const result = await this.queueManagerService.addJob(jobData, options);
      this.logger.log(`Job created by user ${user.username}: ${result.jobId}`);
      return {
        success: true,
        ...result,
        createdBy: user.username,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to create job: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get job details
   */
  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Get detailed job information' })
  @ApiParam({ name: 'jobId', description: 'Job ID to retrieve' })
  @ApiQuery({
    name: 'queue',
    required: false,
    description: 'Queue name for optimization',
  })
  @ApiResponse({
    status: 200,
    description: 'Job details retrieved successfully',
  })
  async getJob(
    @Param('jobId') jobId: string,
    @Query('queue') queueName?: string,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      const job = await this.queueManagerService.getJob(jobId, queueName);
      this.logger.debug(`Job details requested by user ${user.username}: ${jobId}`);
      return {
        job,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get job ${jobId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Search and filter jobs
   */
  @Get('jobs')
  @ApiOperation({ summary: 'Search and filter jobs with pagination' })
  @ApiQuery({ name: 'queue', required: false, description: 'Filter by queue name' })
  @ApiQuery({ name: 'status', required: false, enum: Object.values(JobStatus) })
  @ApiQuery({ name: 'priority', required: false, enum: Object.values(JobPriority) })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiResponse({
    status: 200,
    description: 'Jobs retrieved successfully',
  })
  async searchJobs(
    @Query() filters: any,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      // Parse and validate filters
      const searchFilters: JobSearchFilters = {
        queueName: filters.queue,
        status: filters.status,
        priority: filters.priority,
        page: filters.page ? parseInt(filters.page) : 1,
        limit: filters.limit ? Math.min(parseInt(filters.limit), 100) : 50,
      };

      const results = await this.queueManagerService.searchJobs(searchFilters);
      this.logger.debug(`Job search requested by user ${user.username}`);
      return {
        ...results,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to search jobs: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Retry a failed job
   */
  @Post('jobs/:jobId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiParam({ name: 'jobId', description: 'Job ID to retry' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        retryStrategy: { type: 'object', description: 'Custom retry strategy' },
        queueName: { type: 'string', description: 'Queue name for optimization' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Job retry initiated successfully',
  })
  async retryJob(
    @Param('jobId') jobId: string,
    @Body('retryStrategy') retryStrategy?: JobRetryStrategy,
    @Body('queueName') queueName?: string,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      await this.queueManagerService.retryJob(jobId, retryStrategy, queueName);
      this.logger.log(`Job retry initiated by user ${user.username}: ${jobId}`);
      return {
        success: true,
        jobId,
        message: 'Job retry initiated successfully',
        retriedBy: user.username,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to retry job ${jobId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Cancel a job
   */
  @Delete('jobs/:jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending job' })
  @ApiParam({ name: 'jobId', description: 'Job ID to cancel' })
  @ApiQuery({
    name: 'queue',
    required: false,
    description: 'Queue name for optimization',
  })
  @ApiResponse({
    status: 200,
    description: 'Job cancelled successfully',
  })
  async cancelJob(
    @Param('jobId') jobId: string,
    @Query('queue') queueName?: string,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      await this.queueManagerService.cancelJob(jobId, queueName);
      this.logger.log(`Job cancelled by user ${user.username}: ${jobId}`);
      return {
        success: true,
        jobId,
        message: 'Job cancelled successfully',
        cancelledBy: user.username,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update job priority
   */
  @Put('jobs/:jobId/priority')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update job priority' })
  @ApiParam({ name: 'jobId', description: 'Job ID to update' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        priority: { enum: Object.values(JobPriority) },
        queueName: { type: 'string', description: 'Queue name for optimization' },
      },
      required: ['priority'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Job priority updated successfully',
  })
  async updateJobPriority(
    @Param('jobId') jobId: string,
    @Body('priority') priority: JobPriority,
    @Body('queueName') queueName?: string,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      await this.queueManagerService.updateJobPriority(jobId, priority, queueName);
      this.logger.log(`Job priority updated by user ${user.username}: ${jobId} to ${priority}`);
      return {
        success: true,
        jobId,
        priority,
        message: 'Job priority updated successfully',
        updatedBy: user.username,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to update job priority ${jobId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Bulk job operations
   */
  @Post('jobs/bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perform bulk operations on multiple jobs' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        jobIds: { type: 'array', items: { type: 'string' } },
        operation: { enum: ['retry', 'cancel', 'updatePriority'] },
        options: { type: 'object', description: 'Operation-specific options' },
      },
      required: ['jobIds', 'operation'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk operation completed',
  })
  async bulkJobOperation(
    @Body() operation: BulkJobOperation,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      const results = await this.queueManagerService.bulkJobOperation(operation);
      this.logger.log(
        `Bulk operation ${operation.operation} performed by user ${user.username} on ${operation.jobIds.length} jobs`
      );
      return {
        ...results,
        operation: operation.operation,
        performedBy: user.username,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to perform bulk operation: ${error.message}`, error);
      throw error;
    }
  }

  // ========================================
  // Queue Management Endpoints (Admin)
  // ========================================

  /**
   * Pause a queue (Admin only)
   */
  @Put('queues/:queueName/pause')
  @UseGuards(CaslAuthGuard)
  @RequireAbility(createRule(Actions.Manage, 'queue'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Pause queue processing (Admin only)' })
  @ApiParam({ name: 'queueName', description: 'Queue name to pause' })
  @ApiResponse({
    status: 204,
    description: 'Queue paused successfully',
  })
  async pauseQueue(
    @Param('queueName') queueName: string,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      await this.queueManagerService.pauseQueue(queueName);
      this.logger.log(`Queue ${queueName} paused by admin ${user.username}`);
    } catch (error) {
      this.logger.error(`Failed to pause queue ${queueName}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Resume a queue (Admin only)
   */
  @Put('queues/:queueName/resume')
  @UseGuards(CaslAuthGuard)
  @RequireAbility(createRule(Actions.Manage, 'queue'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resume queue processing (Admin only)' })
  @ApiParam({ name: 'queueName', description: 'Queue name to resume' })
  @ApiResponse({
    status: 204,
    description: 'Queue resumed successfully',
  })
  async resumeQueue(
    @Param('queueName') queueName: string,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      await this.queueManagerService.resumeQueue(queueName);
      this.logger.log(`Queue ${queueName} resumed by admin ${user.username}`);
    } catch (error) {
      this.logger.error(`Failed to resume queue ${queueName}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Clean queue (Admin only)
   */
  @Delete('queues/:queueName/clean')
  @UseGuards(CaslAuthGuard)
  @RequireAbility(createRule(Actions.Manage, 'queue'))
  @ApiOperation({ summary: 'Clean completed/failed jobs from queue (Admin only)' })
  @ApiParam({ name: 'queueName', description: 'Queue name to clean' })
  @ApiQuery({
    name: 'grace',
    required: false,
    type: Number,
    description: 'Grace period in milliseconds',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum jobs to clean',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['completed', 'failed'],
    description: 'Job status to clean',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue cleaned successfully',
  })
  async cleanQueue(
    @Param('queueName') queueName: string,
    @Query('grace') grace?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: 'completed' | 'failed',
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      const cleanedJobIds = await this.queueManagerService.cleanQueue(
        queueName,
        grace || 0,
        limit || 100,
        status || 'completed'
      );

      this.logger.log(
        `Queue ${queueName} cleaned by admin ${user.username}: ${cleanedJobIds.length} jobs removed`
      );

      return {
        success: true,
        queueName,
        cleaned: cleanedJobIds.length,
        jobIds: cleanedJobIds,
        cleanedBy: user.username,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to clean queue ${queueName}: ${error.message}`, error);
      throw error;
    }
  }

  // ========================================
  // Statistics and Analytics Endpoints
  // ========================================

  /**
   * Get job processing statistics
   */
  @Get('statistics/jobs')
  @ApiOperation({ summary: 'Get detailed job processing statistics' })
  @ApiQuery({
    name: 'queue',
    required: false,
    description: 'Specific queue name',
  })
  @ApiQuery({
    name: 'timeWindow',
    required: false,
    type: Number,
    description: 'Time window in milliseconds (default: 1 hour)',
  })
  @ApiResponse({
    status: 200,
    description: 'Job statistics retrieved successfully',
  })
  async getJobStatistics(
    @Query('queue') queueName?: string,
    @Query('timeWindow') timeWindow?: number,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      const statistics = await this.queueMonitorService.getJobStatistics(
        queueName,
        timeWindow || 3600000 // 1 hour default
      );

      this.logger.debug(`Job statistics requested by user ${user.username}`);

      return {
        statistics,
        timeWindow: timeWindow || 3600000,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get job statistics: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get performance trends
   */
  @Get('statistics/trends/:queueName')
  @ApiOperation({ summary: 'Get performance trends for a specific queue' })
  @ApiParam({ name: 'queueName', description: 'Queue name for trend analysis' })
  @ApiQuery({
    name: 'timeWindow',
    required: false,
    type: Number,
    description: 'Time window in milliseconds (default: 1 hour)',
  })
  @ApiResponse({
    status: 200,
    description: 'Performance trends retrieved successfully',
  })
  async getPerformanceTrends(
    @Param('queueName') queueName: string,
    @Query('timeWindow') timeWindow?: number,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      const trends = this.queueMonitorService.getPerformanceTrends(
        queueName,
        timeWindow || 3600000 // 1 hour default
      );

      this.logger.debug(`Performance trends requested by user ${user.username} for queue ${queueName}`);

      return {
        queueName,
        trends,
        timeWindow: timeWindow || 3600000,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get performance trends: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get failure analysis
   */
  @Get('statistics/failures/:queueName')
  @ApiOperation({ summary: 'Get detailed failure analysis for a queue' })
  @ApiParam({ name: 'queueName', description: 'Queue name for failure analysis' })
  @ApiQuery({
    name: 'timeWindow',
    required: false,
    type: Number,
    description: 'Time window in milliseconds (default: 1 hour)',
  })
  @ApiResponse({
    status: 200,
    description: 'Failure analysis retrieved successfully',
  })
  async getFailureAnalysis(
    @Param('queueName') queueName: string,
    @Query('timeWindow') timeWindow?: number,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      const analysis = await this.queueMonitorService.getFailureAnalysis(
        queueName,
        timeWindow || 3600000 // 1 hour default
      );

      this.logger.debug(`Failure analysis requested by user ${user.username} for queue ${queueName}`);

      return {
        queueName,
        analysis,
        timeWindow: timeWindow || 3600000,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get failure analysis: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get resource utilization
   */
  @Get('statistics/resources')
  @ApiOperation({ summary: 'Get system resource utilization metrics' })
  @ApiResponse({
    status: 200,
    description: 'Resource utilization retrieved successfully',
  })
  async getResourceUtilization(@CurrentUser() user: JWTPayload) {
    try {
      const utilization = await this.queueMonitorService.getResourceUtilization();
      this.logger.debug(`Resource utilization requested by user ${user.username}`);

      return {
        utilization,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get resource utilization: ${error.message}`, error);
      throw error;
    }
  }

  // ========================================
  // Scheduling Endpoints
  // ========================================

  /**
   * Schedule a delayed job
   */
  @Post('schedule/delayed')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a job for delayed execution' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        jobData: { type: 'object', description: 'Job data to process' },
        delayOptions: { type: 'object', description: 'Delay configuration' },
      },
      required: ['jobData', 'delayOptions'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Delayed job scheduled successfully',
  })
  async scheduleDelayedJob(
    @Body('jobData') jobData: QueueJob,
    @Body('delayOptions') delayOptions: DelayedJobOptions,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      const result = await this.queueManagerService.scheduleDelayedJob(jobData, delayOptions);
      this.logger.log(`Delayed job scheduled by user ${user.username}: ${result.jobId}`);

      return {
        success: true,
        ...result,
        scheduledBy: user.username,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to schedule delayed job: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Schedule a recurring job
   */
  @Post('schedule/recurring')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a recurring job with cron expression' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        jobData: { type: 'object', description: 'Job data to process' },
        cronExpression: { type: 'string', description: 'Cron expression for scheduling' },
        options: { type: 'object', description: 'Additional job options' },
      },
      required: ['jobData', 'cronExpression'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Recurring job scheduled successfully',
  })
  async scheduleRecurringJob(
    @Body('jobData') jobData: QueueJob,
    @Body('cronExpression') cronExpression: string,
    @Body('options') options?: QueueManagerOptions,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      const result = await this.queueManagerService.scheduleRecurringJob(
        jobData,
        cronExpression,
        options
      );

      this.logger.log(`Recurring job scheduled by user ${user.username}: ${result.jobId}`);

      return {
        success: true,
        ...result,
        cronExpression,
        scheduledBy: user.username,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to schedule recurring job: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get all repeatable jobs
   */
  @Get('schedule/repeatable')
  @ApiOperation({ summary: 'Get all repeatable/recurring jobs' })
  @ApiQuery({
    name: 'queue',
    required: false,
    description: 'Filter by queue name',
  })
  @ApiResponse({
    status: 200,
    description: 'Repeatable jobs retrieved successfully',
  })
  async getRepeatableJobs(
    @Query('queue') queueName?: string,
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      const repeatableJobs = await this.queueManagerService.getRepeatableJobs(queueName);
      this.logger.debug(`Repeatable jobs requested by user ${user.username}`);

      return {
        jobs: repeatableJobs,
        count: repeatableJobs.length,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get repeatable jobs: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Remove a repeatable job (Admin only)
   */
  @Delete('schedule/repeatable/:queueName/:jobId')
  @UseGuards(CaslAuthGuard)
  @RequireAbility(createRule(Actions.Manage, 'queue'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a repeatable job (Admin only)' })
  @ApiParam({ name: 'queueName', description: 'Queue name' })
  @ApiParam({ name: 'jobId', description: 'Job ID or key' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        repeatOptions: {
          type: 'object',
          description: 'Repeat options used when creating the job',
        },
      },
      required: ['repeatOptions'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Repeatable job removed successfully',
  })
  async removeRepeatableJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
    @Body('repeatOptions') repeatOptions: { cron?: string; every?: number },
    @CurrentUser() user?: JWTPayload,
  ) {
    try {
      await this.queueManagerService.removeRepeatableJob(queueName, jobId, repeatOptions);
      this.logger.log(`Repeatable job removed by admin ${user.username}: ${jobId} from ${queueName}`);

      return {
        success: true,
        queueName,
        jobId,
        message: 'Repeatable job removed successfully',
        removedBy: user.username,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to remove repeatable job: ${error.message}`, error);
      throw error;
    }
  }
}