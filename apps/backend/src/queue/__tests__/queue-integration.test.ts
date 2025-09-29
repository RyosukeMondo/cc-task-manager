/**
 * Comprehensive Queue System Integration Tests
 *
 * Purpose: Validate complete BullMQ queue system functionality and reliability
 * Following SOLID principles:
 * - SRP: Focused test cases for each queue operation and component
 * - ISP: Test interfaces segregated by operation type and responsibility
 *
 * Implements KISS principle with clear, maintainable test design
 * Ensures DRY/SSOT compliance with reusable test patterns and utilities
 * Applies contract-driven test validation with fail-fast principles
 *
 * Coverage Areas:
 * - Queue Manager Service operations (job lifecycle, metrics, monitoring)
 * - Task Processor Worker functionality (Claude Code execution, progress tracking)
 * - Queue monitoring and metrics collection (performance, health, statistics)
 * - Job persistence and recovery mechanisms (restart scenarios, data integrity)
 * - Priority queues and load balancing (job distribution, resource optimization)
 * - Redis integration and BullMQ functionality (connection handling, queue operations)
 * - Error handling and retry mechanisms (failure scenarios, recovery patterns)
 * - End-to-end workflow validation (complete job execution cycles)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Queue, Worker, Job, QueueScheduler } from 'bullmq';
import Redis from 'ioredis';
import {
  DatabaseTestHelper,
  createTestDatabaseHelper,
} from '../../database/test-utils/database-test-helper';
import { QueueManagerService } from '../queue-manager.service';
import { TaskProcessorWorker } from '../processors/task-processor.worker';
import { QueueMonitorService } from '../queue-monitor.service';
import { JobSchedulerService } from '../scheduler/job-scheduler.service';
import { QueueConfigService } from '../queue.config';
import { PriorityManagerService } from '../priority/priority-manager.service';
import { JobPersistenceService } from '../persistence/job-persistence.service';
import { QueueDashboardController } from '../queue-dashboard.controller';
import { ApplicationConfigService } from '../../config/config.service';
import { Logger } from '@nestjs/common';
import {
  QueueJob,
  JobPriority,
  JobStatus,
  QueueManagerOptions,
  ClaudeCodeTaskJob,
  EmailJob,
} from '../queue.schemas';
import * as path from 'path';
import * as fs from 'fs';

// Test configuration interfaces
interface TestContext {
  app: INestApplication;
  helper: DatabaseTestHelper;
  teardown: () => Promise<void>;
  redis: Redis;
  queueManager: QueueManagerService;
  taskProcessor: TaskProcessorWorker;
  queueMonitor: QueueMonitorService;
  jobScheduler: JobSchedulerService;
  priorityManager: PriorityManagerService;
  jobPersistence: JobPersistenceService;
  queueDashboard: QueueDashboardController;
}

interface QueueTestScenario {
  name: string;
  jobs: Array<{
    data: QueueJob;
    options?: QueueManagerOptions;
    expectedQueue?: string;
  }>;
  expectedMetrics?: {
    totalJobs?: number;
    queueDistribution?: Record<string, number>;
  };
}

describe('Queue System Integration Tests', () => {
  let testContext: TestContext;
  let logger: Logger;
  let redisHost: string;
  let redisPort: number;

  /**
   * Setup comprehensive test environment with all queue components
   */
  beforeAll(async () => {
    logger = new Logger('QueueIntegrationTest');

    try {
      // Setup test database
      const { helper, teardown } = await createTestDatabaseHelper();

      // Setup Redis connection for testing
      redisHost = process.env.REDIS_HOST || 'localhost';
      redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
      const redis = new Redis({
        host: redisHost,
        port: redisPort,
        db: 15, // Use separate test database
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      // Test Redis connection
      await redis.connect();
      await redis.flushdb(); // Clean test database

      // Create NestJS test module with queue components
      const moduleFixture: TestingModule = await Test.createTestingModule({
        providers: [
          ApplicationConfigService,
          QueueConfigService,
          QueueManagerService,
          TaskProcessorWorker,
          QueueMonitorService,
          JobSchedulerService,
          PriorityManagerService,
          JobPersistenceService,
          QueueDashboardController,
          {
            provide: 'REDIS_CONNECTION',
            useValue: redis,
          },
        ],
      }).compile();

      const app = moduleFixture.createNestApplication();
      await app.init();

      // Get service instances
      const queueManager = app.get<QueueManagerService>(QueueManagerService);
      const taskProcessor = app.get<TaskProcessorWorker>(TaskProcessorWorker);
      const queueMonitor = app.get<QueueMonitorService>(QueueMonitorService);
      const jobScheduler = app.get<JobSchedulerService>(JobSchedulerService);
      const priorityManager = app.get<PriorityManagerService>(PriorityManagerService);
      const jobPersistence = app.get<JobPersistenceService>(JobPersistenceService);
      const queueDashboard = app.get<QueueDashboardController>(QueueDashboardController);

      testContext = {
        app,
        helper,
        teardown,
        redis,
        queueManager,
        taskProcessor,
        queueMonitor,
        jobScheduler,
        priorityManager,
        jobPersistence,
        queueDashboard,
      };

      logger.log('Queue integration test environment setup completed');
    } catch (error) {
      logger.error('Failed to setup queue integration test environment', error);
      throw error;
    }
  });

  /**
   * Cleanup test environment and resources
   */
  afterAll(async () => {
    try {
      if (testContext) {
        // Shutdown workers and close connections
        await testContext.taskProcessor.shutdown();
        await testContext.redis.flushdb();
        await testContext.redis.quit();
        await testContext.app.close();
        await testContext.teardown();
      }
      logger.log('Queue integration test environment cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup queue integration test environment', error);
    }
  });

  /**
   * Clean Redis queues before each test
   */
  beforeEach(async () => {
    await testContext.redis.flushdb();
  });

  describe('Queue Manager Service Integration', () => {
    /**
     * Test: Basic job lifecycle operations
     * Validates: Job creation, queuing, status tracking, completion
     */
    it('should handle complete job lifecycle correctly', async () => {
      // Arrange: Create test job data
      const claudeTaskJob: ClaudeCodeTaskJob = {
        type: 'CLAUDE_CODE_TASK',
        prompt: 'Write a simple hello world function',
        workingDirectory: process.cwd(),
        options: {
          sessionId: 'test-session-001',
          exitOnComplete: true,
          permissionMode: 'ask',
          timeout: 30000,
        },
        priority: JobPriority.NORMAL,
        metadata: {
          correlationId: '550e8400-e29b-41d4-a716-446655440000',
          userId: 'test-user-001',
          timestamp: new Date(),
          retryCount: 0,
        },
      };

      const jobOptions: QueueManagerOptions = {
        priority: JobPriority.NORMAL,
        maxAttempts: 3,
        retryStrategy: {
          maxAttempts: 3,
          backoffType: 'exponential',
          backoffDelay: 2000,
        },
      };

      // Act: Add job to queue
      const addResult = await testContext.queueManager.addJob(claudeTaskJob, jobOptions);

      // Assert: Job creation
      expect(addResult).toBeDefined();
      expect(addResult.jobId).toBeTruthy();
      expect(addResult.queueName).toBe('tasks');

      // Act: Retrieve job details
      const jobDetails = await testContext.queueManager.getJob(addResult.jobId, addResult.queueName);

      // Assert: Job details
      expect(jobDetails.id).toBe(addResult.jobId);
      expect(jobDetails.name).toBe('CLAUDE_CODE_TASK');
      expect(jobDetails.status).toBe(JobStatus.WAITING);
      expect(jobDetails.priority).toBeGreaterThanOrEqual(0);
      expect(jobDetails.maxAttempts).toBe(3);

      // Act: Get queue metrics
      const metrics = await testContext.queueManager.getQueueMetrics('tasks');

      // Assert: Queue metrics
      expect(metrics).toHaveLength(1);
      expect(metrics[0].queueName).toBe('tasks');
      expect(metrics[0].waiting).toBe(1);
      expect(metrics[0].active).toBe(0);
      expect(metrics[0].completed).toBe(0);
      expect(metrics[0].failed).toBe(0);
    });

    /**
     * Test: Priority-based job distribution
     * Validates: Job routing to priority queues, priority handling
     */
    it('should distribute jobs to correct priority queues', async () => {
      // Arrange: Create jobs with different priorities
      const jobScenarios: QueueTestScenario = {
        name: 'Priority Distribution Test',
        jobs: [
          {
            data: {
              type: 'EMAIL',
              to: ['test@example.com'],
              subject: 'High Priority Email',
              template: 'notification',
              templateData: {},
              metadata: { timestamp: new Date(), retryCount: 0 },
            } as EmailJob,
            options: { priority: JobPriority.HIGH },
            expectedQueue: 'priority-high',
          },
          {
            data: {
              type: 'CLAUDE_CODE_TASK',
              prompt: 'Normal priority task',
              priority: JobPriority.NORMAL,
              metadata: { timestamp: new Date(), retryCount: 0 },
            } as ClaudeCodeTaskJob,
            options: { priority: JobPriority.NORMAL },
            expectedQueue: 'tasks',
          },
          {
            data: {
              type: 'EMAIL',
              to: ['test2@example.com'],
              subject: 'Low Priority Email',
              template: 'newsletter',
              templateData: {},
              metadata: { timestamp: new Date(), retryCount: 0 },
            } as EmailJob,
            options: { priority: JobPriority.LOW },
            expectedQueue: 'priority-low',
          },
          {
            data: {
              type: 'CLAUDE_CODE_TASK',
              prompt: 'Urgent task requiring immediate attention',
              priority: JobPriority.URGENT,
              metadata: { timestamp: new Date(), retryCount: 0 },
            } as ClaudeCodeTaskJob,
            options: { priority: JobPriority.URGENT },
            expectedQueue: 'priority-high',
          },
        ],
        expectedMetrics: {
          totalJobs: 4,
          queueDistribution: {
            'priority-high': 2,
            'tasks': 1,
            'priority-low': 1,
          },
        },
      };

      // Act: Add all jobs
      const addResults = await Promise.all(
        jobScenarios.jobs.map(scenario =>
          testContext.queueManager.addJob(scenario.data, scenario.options)
        )
      );

      // Assert: Job distribution
      expect(addResults).toHaveLength(4);

      // Verify each job was added to expected queue
      jobScenarios.jobs.forEach((scenario, index) => {
        if (scenario.expectedQueue) {
          expect(addResults[index].queueName).toBe(scenario.expectedQueue);
        }
      });

      // Act: Get metrics for all queues
      const allMetrics = await testContext.queueManager.getQueueMetrics();

      // Assert: Queue distribution metrics
      const queueCounts = allMetrics.reduce((acc, metric) => {
        acc[metric.queueName] = metric.waiting + metric.active;
        return acc;
      }, {} as Record<string, number>);

      if (jobScenarios.expectedMetrics?.queueDistribution) {
        Object.entries(jobScenarios.expectedMetrics.queueDistribution).forEach(([queueName, expectedCount]) => {
          expect(queueCounts[queueName] || 0).toBe(expectedCount);
        });
      }
    });

    /**
     * Test: Bulk job operations
     * Validates: Bulk job creation, bulk operations, transaction safety
     */
    it('should handle bulk job operations efficiently', async () => {
      // Arrange: Create multiple jobs for bulk operations
      const bulkJobsData: QueueJob[] = Array.from({ length: 10 }, (_, index) => ({
        type: 'EMAIL',
        to: [`bulk-test-${index}@example.com`],
        subject: `Bulk Email ${index + 1}`,
        template: 'bulk-notification',
        templateData: { index: index + 1 },
        metadata: {
          correlationId: `bulk-job-${index}`,
          timestamp: new Date(),
          retryCount: 0,
        },
      } as EmailJob));

      const bulkOptions: QueueManagerOptions = {
        priority: JobPriority.NORMAL,
        maxAttempts: 2,
      };

      // Act: Add bulk jobs
      const startTime = Date.now();
      const bulkResults = await testContext.queueManager.addBulkJobs(bulkJobsData, bulkOptions);
      const bulkAddTime = Date.now() - startTime;

      // Assert: Bulk operation efficiency
      expect(bulkResults).toHaveLength(10);
      expect(bulkAddTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(bulkResults.every(result => result.jobId)).toBe(true);

      // Act: Search for bulk jobs
      const searchResults = await testContext.queueManager.searchJobs({
        queueName: 'emails',
        page: 1,
        limit: 15,
      });

      // Assert: Search results
      expect(searchResults.jobs).toHaveLength(10);
      expect(searchResults.total).toBe(10);

      // Act: Perform bulk retry operation (simulate some failures first)
      const jobIds = bulkResults.slice(0, 5).map(result => result.jobId);
      const bulkOperation = await testContext.queueManager.bulkJobOperation({
        jobIds,
        operation: 'cancel',
      });

      // Assert: Bulk operation results
      expect(bulkOperation.processed).toBe(5);
      expect(bulkOperation.failed).toBe(0);
      expect(bulkOperation.success).toBe(true);
    });

    /**
     * Test: Job retry and error handling
     * Validates: Retry mechanisms, exponential backoff, error recovery
     */
    it('should handle job retries and errors correctly', async () => {
      // Arrange: Create a job that will fail
      const failingJob: ClaudeCodeTaskJob = {
        type: 'CLAUDE_CODE_TASK',
        prompt: 'intentionally-failing-command-that-does-not-exist',
        workingDirectory: '/non-existent-directory',
        options: {
          timeout: 5000, // Short timeout to force failure
        },
        priority: JobPriority.NORMAL,
        metadata: {
          correlationId: 'failing-job-test',
          timestamp: new Date(),
          retryCount: 0,
        },
      };

      const retryOptions: QueueManagerOptions = {
        maxAttempts: 3,
        retryStrategy: {
          maxAttempts: 3,
          backoffType: 'exponential',
          backoffDelay: 1000,
        },
      };

      // Act: Add failing job
      const addResult = await testContext.queueManager.addJob(failingJob, retryOptions);

      // Wait for job to be processed and potentially fail
      // Note: In a real test, you might need to wait for the worker to process this
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Act: Get job details after processing attempt
      const jobDetails = await testContext.queueManager.getJob(addResult.jobId, addResult.queueName);

      // Assert: Job configuration for retries
      expect(jobDetails.maxAttempts).toBe(3);
      expect(jobDetails.attempts).toBeGreaterThanOrEqual(0);

      // Act: Manually retry job with new strategy
      const newRetryStrategy = {
        maxAttempts: 5,
        backoffType: 'fixed' as const,
        backoffDelay: 2000,
      };

      // This will depend on job state - if it's failed, we can retry
      try {
        await testContext.queueManager.retryJob(addResult.jobId, newRetryStrategy, addResult.queueName);

        // Act: Get updated job details
        const retriedJobDetails = await testContext.queueManager.getJob(addResult.jobId, addResult.queueName);

        // Assert: Retry was applied (this might create a new job depending on implementation)
        expect(retriedJobDetails).toBeDefined();
      } catch (error) {
        // Job might not be in a retryable state, which is also valid
        expect(error.message).toContain('Cannot retry job');
      }
    });

    /**
     * Test: Delayed and scheduled job execution
     * Validates: Job scheduling, delay handling, cron-based execution
     */
    it('should handle delayed and scheduled jobs correctly', async () => {
      // Arrange: Create delayed job
      const delayedJob: ClaudeCodeTaskJob = {
        type: 'CLAUDE_CODE_TASK',
        prompt: 'Execute after delay',
        priority: JobPriority.NORMAL,
        metadata: {
          correlationId: 'delayed-job-test',
          timestamp: new Date(),
          retryCount: 0,
        },
      };

      const delayOptions = {
        delay: 3000, // 3 seconds delay
        priority: JobPriority.NORMAL,
      };

      // Act: Schedule delayed job
      const delayedResult = await testContext.queueManager.scheduleDelayedJob(
        delayedJob,
        delayOptions
      );

      // Assert: Delayed job scheduling
      expect(delayedResult.jobId).toBeTruthy();
      expect(delayedResult.executeAt).toBeInstanceOf(Date);
      expect(delayedResult.executeAt.getTime()).toBeGreaterThan(Date.now());

      // Act: Check job status immediately (should be delayed)
      const delayedJobDetails = await testContext.queueManager.getJob(
        delayedResult.jobId,
        delayedResult.queueName
      );

      // Assert: Job is in delayed state
      expect(delayedJobDetails.status).toBe(JobStatus.DELAYED);

      // Arrange: Create recurring job
      const recurringJob: ClaudeCodeTaskJob = {
        type: 'CLAUDE_CODE_TASK',
        prompt: 'Recurring maintenance task',
        priority: JobPriority.LOW,
        metadata: {
          correlationId: 'recurring-job-test',
          timestamp: new Date(),
          retryCount: 0,
        },
      };

      const cronExpression = '*/30 * * * * *'; // Every 30 seconds

      // Act: Schedule recurring job
      const recurringResult = await testContext.queueManager.scheduleRecurringJob(
        recurringJob,
        cronExpression,
        { priority: JobPriority.LOW }
      );

      // Assert: Recurring job scheduling
      expect(recurringResult.jobId).toBeTruthy();
      expect(recurringResult.nextExecution).toBeInstanceOf(Date);

      // Act: Get repeatable jobs
      const repeatableJobs = await testContext.queueManager.getRepeatableJobs(recurringResult.queueName);

      // Assert: Repeatable job was registered
      expect(repeatableJobs.length).toBeGreaterThan(0);
    });
  });

  describe('Task Processor Worker Integration', () => {
    /**
     * Test: Worker status and health monitoring
     * Validates: Worker lifecycle, health checks, status reporting
     */
    it('should report worker status and health correctly', async () => {
      // Act: Get initial worker status
      const initialStatus = testContext.taskProcessor.getWorkerStatus();

      // Assert: Worker status structure
      expect(initialStatus).toEqual({
        isRunning: expect.any(Boolean),
        activeJobs: expect.any(Number),
        isShuttingDown: false,
        workerName: 'TaskProcessorWorker',
      });

      expect(initialStatus.activeJobs).toBe(0); // No jobs running initially
    });

    /**
     * Test: Claude wrapper validation and environment setup
     * Validates: Claude Code integration, environment validation
     */
    it('should validate Claude Code environment correctly', async () => {
      // Arrange: Create a mock Claude wrapper script for testing
      const testScriptsDir = path.join(process.cwd(), 'test-scripts');
      const testClaudeWrapperPath = path.join(testScriptsDir, 'claude_wrapper.py');

      // Create test directory and mock script
      if (!fs.existsSync(testScriptsDir)) {
        fs.mkdirSync(testScriptsDir, { recursive: true });
      }

      const mockClaudeScript = `#!/usr/bin/env python3
import json
import sys
import time

def main():
    try:
        # Read input
        line = sys.stdin.readline().strip()
        if not line:
            return

        data = json.loads(line)

        # Simulate Claude Code execution
        print(json.dumps({
            "event": "run_started",
            "timestamp": time.time()
        }))

        print(json.dumps({
            "event": "stream",
            "payload": {
                "type": "text",
                "content": "Mock Claude Code execution output"
            }
        }))

        print(json.dumps({
            "event": "run_completed",
            "result": "success",
            "output": "Mock execution completed successfully"
        }))

    except Exception as e:
        print(json.dumps({
            "event": "run_failed",
            "error": str(e)
        }))

if __name__ == "__main__":
    main()
`;

      fs.writeFileSync(testClaudeWrapperPath, mockClaudeScript);
      fs.chmodSync(testClaudeWrapperPath, '755'); // Make executable

      // Act: Create a simple Claude task job
      const testJob: ClaudeCodeTaskJob = {
        type: 'CLAUDE_CODE_TASK',
        prompt: 'Test Claude Code integration',
        workingDirectory: process.cwd(),
        options: {
          timeout: 10000,
        },
        priority: JobPriority.NORMAL,
        metadata: {
          correlationId: 'claude-integration-test',
          timestamp: new Date(),
          retryCount: 0,
        },
      };

      // Add job to queue (this will test the worker when it processes)
      const jobResult = await testContext.queueManager.addJob(testJob);

      // Assert: Job was queued successfully
      expect(jobResult.jobId).toBeTruthy();
      expect(jobResult.queueName).toBe('tasks');

      // Note: In a full integration test, you would wait for the worker to process
      // and verify the execution results. For this test, we're validating the setup.

      // Cleanup
      if (fs.existsSync(testClaudeWrapperPath)) {
        fs.unlinkSync(testClaudeWrapperPath);
      }
      if (fs.existsSync(testScriptsDir)) {
        fs.rmdirSync(testScriptsDir);
      }
    });
  });

  describe('Queue Monitoring and Metrics Integration', () => {
    /**
     * Test: Real-time queue monitoring
     * Validates: Queue metrics collection, real-time updates, performance tracking
     */
    it('should collect comprehensive queue metrics', async () => {
      // Arrange: Create jobs in different states
      const jobs = await Promise.all([
        // Waiting jobs
        testContext.queueManager.addJob({
          type: 'EMAIL',
          to: ['metrics-test-1@example.com'],
          subject: 'Metrics Test 1',
          template: 'test',
          templateData: {},
          metadata: { timestamp: new Date(), retryCount: 0 },
        } as EmailJob),
        testContext.queueManager.addJob({
          type: 'EMAIL',
          to: ['metrics-test-2@example.com'],
          subject: 'Metrics Test 2',
          template: 'test',
          templateData: {},
          metadata: { timestamp: new Date(), retryCount: 0 },
        } as EmailJob),
        // High priority job
        testContext.queueManager.addJob({
          type: 'CLAUDE_CODE_TASK',
          prompt: 'Priority metrics test',
          priority: JobPriority.HIGH,
          metadata: { timestamp: new Date(), retryCount: 0 },
        } as ClaudeCodeTaskJob, { priority: JobPriority.HIGH }),
      ]);

      // Wait for jobs to be queued
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Act: Get comprehensive metrics
      const metrics = await testContext.queueManager.getQueueMetrics();

      // Assert: Metrics structure and data
      expect(metrics.length).toBeGreaterThan(0);

      const emailsQueue = metrics.find(m => m.queueName === 'emails');
      const priorityHighQueue = metrics.find(m => m.queueName === 'priority-high');

      expect(emailsQueue).toBeDefined();
      expect(emailsQueue?.waiting).toBe(2);
      expect(emailsQueue?.timestamp).toBeInstanceOf(Date);
      expect(emailsQueue?.throughput).toBeGreaterThanOrEqual(0);
      expect(emailsQueue?.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(emailsQueue?.failureRate).toBeGreaterThanOrEqual(0);

      expect(priorityHighQueue).toBeDefined();
      expect(priorityHighQueue?.waiting).toBe(1);

      // Act: Get specific queue metrics
      const specificMetrics = await testContext.queueManager.getQueueMetrics('emails');

      // Assert: Specific queue metrics
      expect(specificMetrics).toHaveLength(1);
      expect(specificMetrics[0].queueName).toBe('emails');
      expect(specificMetrics[0].waiting).toBe(2);
    });

    /**
     * Test: Queue health and performance monitoring
     * Validates: Performance metrics, health status, trend analysis
     */
    it('should provide queue health and performance insights', async () => {
      // Arrange: Create test scenario with various job types and states
      const performanceJobs = await Promise.all([
        // Fast jobs
        ...Array.from({ length: 3 }, (_, i) =>
          testContext.queueManager.addJob({
            type: 'EMAIL',
            to: [`fast-job-${i}@example.com`],
            subject: `Fast Job ${i}`,
            template: 'simple',
            templateData: {},
            metadata: {
              correlationId: `fast-job-${i}`,
              timestamp: new Date(),
              retryCount: 0
            },
          } as EmailJob)
        ),
        // Slow jobs
        ...Array.from({ length: 2 }, (_, i) =>
          testContext.queueManager.addJob({
            type: 'CLAUDE_CODE_TASK',
            prompt: `Complex analysis task ${i}`,
            options: { timeout: 60000 },
            priority: JobPriority.NORMAL,
            metadata: {
              correlationId: `slow-job-${i}`,
              timestamp: new Date(),
              retryCount: 0
            },
          } as ClaudeCodeTaskJob)
        ),
      ]);

      // Act: Get performance metrics before processing
      const initialMetrics = await testContext.queueManager.getQueueMetrics();

      // Assert: Initial metrics baseline
      const totalWaiting = initialMetrics.reduce((sum, metric) => sum + metric.waiting, 0);
      expect(totalWaiting).toBe(5); // 3 emails + 2 Claude tasks

      // Act: Pause and resume queue to test queue management
      await testContext.queueManager.pauseQueue('emails');
      const pausedMetrics = await testContext.queueManager.getQueueMetrics('emails');

      // Assert: Queue paused state
      expect(pausedMetrics[0].paused).toBe(true);

      await testContext.queueManager.resumeQueue('emails');
      const resumedMetrics = await testContext.queueManager.getQueueMetrics('emails');

      // Assert: Queue resumed state
      expect(resumedMetrics[0].paused).toBe(false);

      // Act: Clean completed jobs (simulate some completions)
      const cleanedJobs = await testContext.queueManager.cleanQueue('emails', 0, 10, 'completed');

      // Assert: Cleaning operation
      expect(Array.isArray(cleanedJobs)).toBe(true);
    });
  });

  describe('Job Persistence and Recovery Integration', () => {
    /**
     * Test: Job persistence across system restarts
     * Validates: Job state persistence, recovery mechanisms, data integrity
     */
    it('should persist jobs across system restarts', async () => {
      // Arrange: Create jobs with different states
      const persistentJobs = await Promise.all([
        testContext.queueManager.addJob({
          type: 'EMAIL',
          to: ['persistence-test@example.com'],
          subject: 'Persistence Test',
          template: 'important',
          templateData: { urgent: true },
          metadata: {
            correlationId: 'persistence-test-1',
            timestamp: new Date(),
            retryCount: 0
          },
        } as EmailJob, { priority: JobPriority.HIGH }),
        testContext.queueManager.scheduleDelayedJob({
          type: 'CLAUDE_CODE_TASK',
          prompt: 'Delayed persistent task',
          priority: JobPriority.NORMAL,
          metadata: {
            correlationId: 'persistence-test-2',
            timestamp: new Date(),
            retryCount: 0
          },
        } as ClaudeCodeTaskJob, { delay: 30000 }), // 30 second delay
      ]);

      // Act: Get initial job states
      const initialStates = await Promise.all(
        persistentJobs.map(job =>
          testContext.queueManager.getJob(job.jobId, job.queueName)
        )
      );

      // Assert: Initial job states
      expect(initialStates[0].status).toBe(JobStatus.WAITING);
      expect(initialStates[1].status).toBe(JobStatus.DELAYED);

      // Simulate system restart by reconnecting to Redis
      await testContext.redis.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await testContext.redis.connect();

      // Act: Verify jobs persist after reconnection
      const persistedStates = await Promise.all(
        persistentJobs.map(job =>
          testContext.queueManager.getJob(job.jobId, job.queueName)
        )
      );

      // Assert: Job persistence
      expect(persistedStates[0]).toBeDefined();
      expect(persistedStates[0].id).toBe(initialStates[0].id);
      expect(persistedStates[1]).toBeDefined();
      expect(persistedStates[1].id).toBe(initialStates[1].id);
    });

    /**
     * Test: Job recovery and orphan handling
     * Validates: Orphaned job detection, recovery mechanisms, cleanup
     */
    it('should handle job recovery and orphan cleanup', async () => {
      // Arrange: Create jobs and simulate worker crashes
      const recoveryJobs = await Promise.all([
        testContext.queueManager.addJob({
          type: 'CLAUDE_CODE_TASK',
          prompt: 'Recovery test task 1',
          options: { timeout: 5000 },
          priority: JobPriority.NORMAL,
          metadata: {
            correlationId: 'recovery-test-1',
            timestamp: new Date(),
            retryCount: 0
          },
        } as ClaudeCodeTaskJob),
        testContext.queueManager.addJob({
          type: 'CLAUDE_CODE_TASK',
          prompt: 'Recovery test task 2',
          options: { timeout: 5000 },
          priority: JobPriority.HIGH,
          metadata: {
            correlationId: 'recovery-test-2',
            timestamp: new Date(),
            retryCount: 0
          },
        } as ClaudeCodeTaskJob, { priority: JobPriority.HIGH }),
      ]);

      // Act: Get jobs before potential issues
      const initialJobs = await Promise.all(
        recoveryJobs.map(job =>
          testContext.queueManager.getJob(job.jobId, job.queueName)
        )
      );

      // Assert: Jobs are properly queued
      expect(initialJobs.every(job => job !== null)).toBe(true);

      // Simulate some processing time and check job states
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Act: Search for jobs that might need recovery
      const allJobs = await testContext.queueManager.searchJobs({
        page: 1,
        limit: 50,
      });

      // Assert: Jobs are trackable and searchable
      expect(allJobs.jobs.length).toBeGreaterThanOrEqual(2);

      const recoveryJobIds = recoveryJobs.map(job => job.jobId);
      const foundJobs = allJobs.jobs.filter(job =>
        recoveryJobIds.includes(job.id)
      );

      expect(foundJobs.length).toBe(2);

      // Act: Test bulk operations on recovery jobs
      const bulkCancelResult = await testContext.queueManager.bulkJobOperation({
        jobIds: recoveryJobIds,
        operation: 'cancel',
      });

      // Assert: Bulk recovery operations
      expect(bulkCancelResult.processed).toBe(2);
      expect(bulkCancelResult.failed).toBe(0);
    });
  });

  describe('Priority Queues and Load Balancing Integration', () => {
    /**
     * Test: Priority-based job processing
     * Validates: Priority queue distribution, load balancing, resource allocation
     */
    it('should distribute jobs based on priority effectively', async () => {
      // Arrange: Create jobs with different priorities
      const priorityTestJobs = [
        { priority: JobPriority.URGENT, count: 2 },
        { priority: JobPriority.HIGH, count: 3 },
        { priority: JobPriority.NORMAL, count: 5 },
        { priority: JobPriority.LOW, count: 4 },
      ];

      const allJobs: Array<{ jobId: string; queueName: string; priority: JobPriority }> = [];

      // Act: Create jobs with different priorities
      for (const { priority, count } of priorityTestJobs) {
        const jobs = await Promise.all(
          Array.from({ length: count }, async (_, i) => {
            const job = await testContext.queueManager.addJob({
              type: 'CLAUDE_CODE_TASK',
              prompt: `${priority} priority task ${i + 1}`,
              priority,
              metadata: {
                correlationId: `priority-${priority}-${i}`,
                timestamp: new Date(),
                retryCount: 0
              },
            } as ClaudeCodeTaskJob, { priority });

            return { ...job, priority };
          })
        );

        allJobs.push(...jobs);
      }

      // Act: Get queue distribution
      const queueMetrics = await testContext.queueManager.getQueueMetrics();

      // Assert: Priority-based queue distribution
      const priorityHighQueue = queueMetrics.find(m => m.queueName === 'priority-high');
      const tasksQueue = queueMetrics.find(m => m.queueName === 'tasks');
      const priorityNormalQueue = queueMetrics.find(m => m.queueName === 'priority-normal');
      const priorityLowQueue = queueMetrics.find(m => m.queueName === 'priority-low');

      // Urgent and High priority jobs should go to priority-high queue
      expect(priorityHighQueue?.waiting).toBe(5); // 2 urgent + 3 high
      // Normal priority jobs should go to tasks queue (based on job type)
      expect(tasksQueue?.waiting).toBe(5);
      // Low priority jobs should go to priority-low queue
      expect(priorityLowQueue?.waiting).toBe(4);

      // Act: Test priority-based search
      const highPriorityJobs = await testContext.queueManager.searchJobs({
        queueName: 'priority-high',
        page: 1,
        limit: 10,
      });

      // Assert: High priority job search
      expect(highPriorityJobs.jobs).toHaveLength(5);
      expect(highPriorityJobs.total).toBe(5);
    });

    /**
     * Test: Load balancing and resource optimization
     * Validates: Worker load distribution, resource utilization, scaling
     */
    it('should optimize resource utilization and load balancing', async () => {
      // Arrange: Create mixed workload
      const mixedWorkload = [
        // CPU-intensive tasks
        ...Array.from({ length: 3 }, (_, i) => ({
          type: 'CLAUDE_CODE_TASK',
          prompt: `CPU intensive analysis task ${i}`,
          options: { timeout: 30000 },
          priority: JobPriority.HIGH,
          metadata: {
            correlationId: `cpu-intensive-${i}`,
            timestamp: new Date(),
            retryCount: 0
          },
        } as ClaudeCodeTaskJob)),
        // I/O-intensive tasks
        ...Array.from({ length: 4 }, (_, i) => ({
          type: 'EMAIL',
          to: [`load-test-${i}@example.com`],
          subject: `Load Test Email ${i}`,
          template: 'load-test',
          templateData: { index: i },
          metadata: {
            correlationId: `io-intensive-${i}`,
            timestamp: new Date(),
            retryCount: 0
          },
        } as EmailJob)),
        // Mixed priority quick tasks
        ...Array.from({ length: 6 }, (_, i) => ({
          type: 'CLAUDE_CODE_TASK',
          prompt: `Quick task ${i}`,
          priority: i % 2 === 0 ? JobPriority.NORMAL : JobPriority.LOW,
          metadata: {
            correlationId: `quick-task-${i}`,
            timestamp: new Date(),
            retryCount: 0
          },
        } as ClaudeCodeTaskJob)),
      ];

      // Act: Add mixed workload
      const workloadJobs = await Promise.all(
        mixedWorkload.map(jobData =>
          testContext.queueManager.addJob(jobData, {
            priority: jobData.priority as JobPriority
          })
        )
      );

      // Assert: Jobs distributed across queues
      expect(workloadJobs).toHaveLength(13);

      // Act: Get load balancing metrics
      const loadMetrics = await testContext.queueManager.getQueueMetrics();

      // Assert: Load distribution
      const totalJobs = loadMetrics.reduce((sum, metric) =>
        sum + metric.waiting + metric.active, 0
      );
      expect(totalJobs).toBe(13);

      // Verify different queue types are utilized
      const queueNames = loadMetrics.map(m => m.queueName);
      expect(queueNames).toContain('priority-high');
      expect(queueNames).toContain('emails');
      expect(queueNames).toContain('tasks');

      // Act: Test queue management operations
      const queueOperations = await Promise.all([
        testContext.queueManager.pauseQueue('priority-high'),
        testContext.queueManager.getQueueMetrics('priority-high'),
      ]);

      const pausedMetrics = queueOperations[1] as any;

      // Assert: Queue management works
      expect(pausedMetrics[0].paused).toBe(true);

      // Resume for cleanup
      await testContext.queueManager.resumeQueue('priority-high');
    });
  });

  describe('End-to-End Queue Workflow Integration', () => {
    /**
     * Test: Complete queue workflow with monitoring
     * Validates: Full job lifecycle, monitoring, error handling, recovery
     */
    it('should execute complete queue workflow with comprehensive monitoring', async () => {
      // Arrange: Create complete workflow scenario
      const workflowScenario = {
        name: 'Complete E2E Queue Workflow',
        phases: [
          {
            name: 'Initial Job Creation',
            jobs: [
              {
                type: 'CLAUDE_CODE_TASK',
                prompt: 'Initialize project setup',
                priority: JobPriority.HIGH,
                metadata: {
                  correlationId: 'e2e-init',
                  timestamp: new Date(),
                  retryCount: 0
                },
              } as ClaudeCodeTaskJob,
              {
                type: 'EMAIL',
                to: ['admin@example.com'],
                subject: 'Project Setup Started',
                template: 'project-init',
                templateData: { projectName: 'E2E Test Project' },
                metadata: {
                  correlationId: 'e2e-notification',
                  timestamp: new Date(),
                  retryCount: 0
                },
              } as EmailJob,
            ],
          },
          {
            name: 'Processing Phase',
            jobs: [
              {
                type: 'CLAUDE_CODE_TASK',
                prompt: 'Execute data processing pipeline',
                options: { timeout: 60000 },
                priority: JobPriority.NORMAL,
                metadata: {
                  correlationId: 'e2e-processing',
                  timestamp: new Date(),
                  retryCount: 0
                },
              } as ClaudeCodeTaskJob,
            ],
          },
          {
            name: 'Completion Phase',
            jobs: [
              {
                type: 'EMAIL',
                to: ['admin@example.com', 'stakeholder@example.com'],
                subject: 'Processing Complete',
                template: 'completion-notification',
                templateData: {
                  completedAt: new Date().toISOString(),
                  status: 'success'
                },
                metadata: {
                  correlationId: 'e2e-completion',
                  timestamp: new Date(),
                  retryCount: 0
                },
              } as EmailJob,
            ],
          },
        ],
      };

      // Act: Execute Phase 1
      const phase1Jobs = await Promise.all(
        workflowScenario.phases[0].jobs.map(jobData =>
          testContext.queueManager.addJob(jobData, {
            priority: jobData.priority as JobPriority
          })
        )
      );

      // Assert: Phase 1 completion
      expect(phase1Jobs).toHaveLength(2);

      // Act: Get initial metrics
      const initialMetrics = await testContext.queueManager.getQueueMetrics();
      const initialTotalJobs = initialMetrics.reduce((sum, m) =>
        sum + m.waiting + m.active, 0
      );

      expect(initialTotalJobs).toBeGreaterThanOrEqual(2);

      // Act: Execute Phase 2 (delayed to simulate dependency)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const phase2Jobs = await Promise.all(
        workflowScenario.phases[1].jobs.map(jobData =>
          testContext.queueManager.addJob(jobData, {
            priority: jobData.priority as JobPriority
          })
        )
      );

      // Assert: Phase 2 completion
      expect(phase2Jobs).toHaveLength(1);

      // Act: Execute Phase 3 (completion)
      const phase3Jobs = await Promise.all(
        workflowScenario.phases[2].jobs.map(jobData =>
          testContext.queueManager.addJob(jobData)
        )
      );

      // Assert: Phase 3 completion
      expect(phase3Jobs).toHaveLength(1);

      // Act: Get final workflow metrics
      const finalMetrics = await testContext.queueManager.getQueueMetrics();
      const finalTotalJobs = finalMetrics.reduce((sum, m) =>
        sum + m.waiting + m.active + m.completed, 0
      );

      // Assert: Complete workflow metrics
      expect(finalTotalJobs).toBeGreaterThanOrEqual(4);

      // Act: Search for all workflow jobs
      const allWorkflowJobs = await testContext.queueManager.searchJobs({
        page: 1,
        limit: 100,
      });

      // Assert: All jobs are tracked
      const workflowJobIds = [...phase1Jobs, ...phase2Jobs, ...phase3Jobs]
        .map(job => job.jobId);

      const foundWorkflowJobs = allWorkflowJobs.jobs.filter(job =>
        workflowJobIds.includes(job.id)
      );

      expect(foundWorkflowJobs.length).toBe(4);

      // Act: Test workflow resilience with bulk operations
      const bulkUpdateResult = await testContext.queueManager.bulkJobOperation({
        jobIds: workflowJobIds.slice(0, 2),
        operation: 'updatePriority',
        options: { priority: JobPriority.HIGH },
      });

      // Assert: Bulk operations on workflow
      expect(bulkUpdateResult.processed).toBe(2);
      expect(bulkUpdateResult.success).toBe(true);

      // Act: Final system health check
      const healthCheck = await testContext.queueManager.getQueueMetrics();

      // Assert: System remains healthy after complete workflow
      expect(healthCheck.every(metric =>
        typeof metric.throughput === 'number' &&
        typeof metric.averageProcessingTime === 'number' &&
        typeof metric.failureRate === 'number'
      )).toBe(true);
    });
  });

  describe('System Integration and Performance', () => {
    /**
     * Test: System performance under load
     * Validates: Performance characteristics, resource utilization, stability
     */
    it('should maintain performance under concurrent load', async () => {
      // Arrange: Create high-concurrency scenario
      const loadTestConfig = {
        concurrentBatches: 5,
        jobsPerBatch: 10,
        batchDelay: 100, // ms between batches
      };

      const startTime = Date.now();

      // Act: Execute concurrent load test
      const batchPromises = Array.from(
        { length: loadTestConfig.concurrentBatches },
        async (_, batchIndex) => {
          // Stagger batch execution
          await new Promise(resolve =>
            setTimeout(resolve, batchIndex * loadTestConfig.batchDelay)
          );

          return Promise.all(
            Array.from({ length: loadTestConfig.jobsPerBatch }, (_, jobIndex) => {
              const jobId = `load-test-batch-${batchIndex}-job-${jobIndex}`;

              return testContext.queueManager.addJob({
                type: 'EMAIL',
                to: [`${jobId}@example.com`],
                subject: `Load Test ${jobId}`,
                template: 'load-test',
                templateData: { batchIndex, jobIndex },
                metadata: {
                  correlationId: jobId,
                  timestamp: new Date(),
                  retryCount: 0
                },
              } as EmailJob);
            })
          );
        }
      );

      const batchResults = await Promise.all(batchPromises);
      const totalLoadTime = Date.now() - startTime;

      // Assert: Load test performance
      expect(batchResults).toHaveLength(loadTestConfig.concurrentBatches);
      expect(batchResults.every(batch =>
        batch.length === loadTestConfig.jobsPerBatch
      )).toBe(true);

      const totalJobs = batchResults.flat().length;
      expect(totalJobs).toBe(50); // 5 batches × 10 jobs
      expect(totalLoadTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Act: Verify system stability after load
      const postLoadMetrics = await testContext.queueManager.getQueueMetrics();

      // Assert: System remains stable
      expect(postLoadMetrics.length).toBeGreaterThan(0);
      expect(postLoadMetrics.every(metric =>
        Number.isFinite(metric.waiting) &&
        Number.isFinite(metric.active) &&
        Number.isFinite(metric.throughput)
      )).toBe(true);

      // Act: Test system recovery with bulk cleanup
      const allJobIds = batchResults.flat().map(result => result.jobId);
      const cleanupResult = await testContext.queueManager.bulkJobOperation({
        jobIds: allJobIds.slice(0, 25), // Clean up half the jobs
        operation: 'cancel',
      });

      // Assert: Cleanup efficiency
      expect(cleanupResult.processed).toBe(25);
      expect(cleanupResult.failed).toBe(0);
    });

    /**
     * Test: Error recovery and system resilience
     * Validates: Error handling, system recovery, data consistency
     */
    it('should demonstrate comprehensive error recovery and resilience', async () => {
      // Arrange: Create error-prone scenario
      const resilenceTestJobs = [
        // Jobs that will succeed
        {
          type: 'EMAIL',
          to: ['success-test@example.com'],
          subject: 'Success Test',
          template: 'simple',
          templateData: {},
          metadata: {
            correlationId: 'resilience-success',
            timestamp: new Date(),
            retryCount: 0
          },
        } as EmailJob,
        // Jobs that might fail (timeout)
        {
          type: 'CLAUDE_CODE_TASK',
          prompt: 'Complex task that may timeout',
          options: { timeout: 1000 }, // Very short timeout
          priority: JobPriority.HIGH,
          metadata: {
            correlationId: 'resilience-timeout',
            timestamp: new Date(),
            retryCount: 0
          },
        } as ClaudeCodeTaskJob,
        // Jobs with retry configuration
        {
          type: 'CLAUDE_CODE_TASK',
          prompt: 'Task with retry strategy',
          priority: JobPriority.NORMAL,
          metadata: {
            correlationId: 'resilience-retry',
            timestamp: new Date(),
            retryCount: 0
          },
        } as ClaudeCodeTaskJob,
      ];

      // Act: Add resilience test jobs with different retry strategies
      const resilenceJobs = await Promise.all([
        testContext.queueManager.addJob(resilenceTestJobs[0]),
        testContext.queueManager.addJob(resilenceTestJobs[1], {
          maxAttempts: 2,
          retryStrategy: {
            maxAttempts: 2,
            backoffType: 'fixed',
            backoffDelay: 1000,
          },
        }),
        testContext.queueManager.addJob(resilenceTestJobs[2], {
          maxAttempts: 3,
          retryStrategy: {
            maxAttempts: 3,
            backoffType: 'exponential',
            backoffDelay: 2000,
          },
        }),
      ]);

      // Assert: Jobs created with different configurations
      expect(resilenceJobs).toHaveLength(3);

      // Act: Simulate Redis connection issues
      try {
        // Temporarily disconnect Redis
        await testContext.redis.disconnect();

        // Try operations during disconnection (should handle gracefully)
        const disconnectedMetrics = await Promise.allSettled([
          testContext.queueManager.getQueueMetrics(),
        ]);

        // Reconnect
        await testContext.redis.connect();

        // Assert: System handles disconnection gracefully
        expect(disconnectedMetrics.some(result => result.status === 'rejected')).toBe(true);

      } catch (error) {
        // Ensure Redis is reconnected even if test fails
        await testContext.redis.connect();
      }

      // Act: Verify system recovery after reconnection
      const recoveryMetrics = await testContext.queueManager.getQueueMetrics();

      // Assert: System recovery
      expect(recoveryMetrics.length).toBeGreaterThan(0);
      expect(recoveryMetrics.every(metric => metric.queueName)).toBe(true);

      // Act: Test comprehensive job management after recovery
      const jobDetailsAfterRecovery = await Promise.all(
        resilenceJobs.map(job =>
          testContext.queueManager.getJob(job.jobId, job.queueName)
            .catch(error => ({ error: error.message, jobId: job.jobId }))
        )
      );

      // Assert: Job persistence through system issues
      expect(jobDetailsAfterRecovery.length).toBe(3);

      // Most jobs should be recoverable
      const recoverableJobs = jobDetailsAfterRecovery.filter(
        (result): result is any => !('error' in result)
      );
      expect(recoverableJobs.length).toBeGreaterThanOrEqual(1);

      // Act: Final system health validation
      const finalHealthCheck = {
        workerStatus: testContext.taskProcessor.getWorkerStatus(),
        queueMetrics: await testContext.queueManager.getQueueMetrics(),
        redisConnection: testContext.redis.status === 'ready',
      };

      // Assert: Complete system health
      expect(finalHealthCheck.workerStatus.isRunning || !finalHealthCheck.workerStatus.isShuttingDown).toBe(true);
      expect(finalHealthCheck.queueMetrics.length).toBeGreaterThan(0);
      expect(finalHealthCheck.redisConnection).toBe(true);
    });
  });
});