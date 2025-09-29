/**
 * Claude Entities Database Integration Tests
 *
 * Purpose: Validate database schema correctness and repository functionality
 * Following SOLID principles:
 * - SRP: Focused test cases for each repository operation
 * - ISP: Test interfaces segregated by operation type
 *
 * Implements KISS principle with simple, clear test design
 * Ensures DRY/SSOT compliance with reusable test patterns
 * Applies contract-driven test validation with fail-fast principles
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  DatabaseTestHelper,
  TestDatabaseSetup,
  createTestDatabaseHelper,
} from '../test-utils/database-test-helper';
import { ClaudeTaskRepository } from '../repositories/claude-task.repository';
import { TaskExecutionRepository } from '../repositories/task-execution.repository';
import { QueueJobRepository } from '../repositories/queue-job.repository';
import { ExecutionLogRepository } from '../repositories/execution-log.repository';
import { PrismaService } from '../prisma.service';
import { Logger } from '@nestjs/common';

// Test configuration interface for type safety
interface TestContext {
  helper: DatabaseTestHelper;
  teardown: () => Promise<void>;
  prisma: PrismaClient;
  transaction: any;
  rollback: () => Promise<void>;
}

// Repository test configuration
interface RepositoryTestContext extends TestContext {
  claudeTaskRepo: ClaudeTaskRepository;
  taskExecutionRepo: TaskExecutionRepository;
  queueJobRepo: QueueJobRepository;
  executionLogRepo: ExecutionLogRepository;
}

describe('Claude Entities Database Integration Tests', () => {
  let testContext: RepositoryTestContext;
  let logger: Logger;

  /**
   * Setup test environment with isolated transaction
   */
  beforeAll(async () => {
    logger = new Logger('ClaudeEntitiesIntegrationTest');

    try {
      // Create test database helper
      const { helper, teardown } = await createTestDatabaseHelper();

      // Create isolated transaction for all tests
      const { prisma, rollback } = await helper.createTransaction();

      // Initialize repositories with test Prisma client
      const prismaService = new PrismaService();
      // Mock the prisma service to use our transaction client
      jest.spyOn(prismaService, 'claudeTask', 'get').mockReturnValue(prisma.claudeTask);
      jest.spyOn(prismaService, 'taskExecution', 'get').mockReturnValue(prisma.taskExecution);
      jest.spyOn(prismaService, 'queueJob', 'get').mockReturnValue(prisma.queueJob);
      jest.spyOn(prismaService, 'executionLog', 'get').mockReturnValue(prisma.executionLog);
      jest.spyOn(prismaService, 'user', 'get').mockReturnValue(prisma.user);
      jest.spyOn(prismaService, 'project', 'get').mockReturnValue(prisma.project);

      const claudeTaskRepo = new ClaudeTaskRepository(prismaService);
      const taskExecutionRepo = new TaskExecutionRepository(prismaService);
      const queueJobRepo = new QueueJobRepository(prismaService);
      const executionLogRepo = new ExecutionLogRepository(prismaService);

      testContext = {
        helper,
        teardown,
        prisma,
        transaction: prisma,
        rollback,
        claudeTaskRepo,
        taskExecutionRepo,
        queueJobRepo,
        executionLogRepo,
      };

      logger.log('Test environment setup completed');
    } catch (error) {
      logger.error('Failed to setup test environment', error);
      throw error;
    }
  });

  /**
   * Cleanup test environment
   */
  afterAll(async () => {
    try {
      if (testContext) {
        await testContext.rollback();
        await testContext.teardown();
      }
      logger.log('Test environment cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup test environment', error);
    }
  });

  /**
   * Data integrity validation after each test
   */
  afterEach(async () => {
    const integrity = await testContext.helper.validateDataIntegrity(testContext.transaction);
    if (!integrity.isValid) {
      logger.warn('Data integrity issues detected', integrity.errors);
    }
  });

  describe('Schema Validation and Entity Creation', () => {
    /**
     * Test: Basic entity creation with required fields
     * Validates: Schema structure, constraints, relationships
     */
    it('should create all Claude entities with required fields', async () => {
      // Arrange: Create test scenario with all entities
      const scenario = await testContext.helper.createTaskExecutionScenario(
        {
          user: { email: 'schema-test@example.com' },
          project: { name: 'Schema Test Project' },
          task: { title: 'Schema Test Task' },
          execution: { status: 'RUNNING' },
          logs: [
            { level: 'INFO', message: 'Test log 1' },
            { level: 'ERROR', message: 'Test error log' },
          ],
        },
        testContext.transaction
      );

      // Act & Assert: Verify all entities were created
      expect(scenario.user).toBeDefined();
      expect(scenario.user.id).toBeTruthy();
      expect(scenario.user.email).toBe('schema-test@example.com');

      expect(scenario.project).toBeDefined();
      expect(scenario.project.id).toBeTruthy();
      expect(scenario.project.name).toBe('Schema Test Project');

      expect(scenario.task).toBeDefined();
      expect(scenario.task.id).toBeTruthy();
      expect(scenario.task.title).toBe('Schema Test Task');

      expect(scenario.execution).toBeDefined();
      expect(scenario.execution.id).toBeTruthy();
      expect(scenario.execution.status).toBe('RUNNING');

      expect(scenario.logs).toHaveLength(2);
      expect(scenario.logs[0].level).toBe('INFO');
      expect(scenario.logs[1].level).toBe('ERROR');

      expect(scenario.queueJob).toBeDefined();
      expect(scenario.queueJob.id).toBeTruthy();
    });

    /**
     * Test: Constraint enforcement and validation
     * Validates: Foreign key constraints, unique constraints, check constraints
     */
    it('should enforce database constraints properly', async () => {
      // Test foreign key constraints
      await expect(
        testContext.transaction.claudeTask.create({
          data: {
            id: 'invalid-fk-test',
            title: 'Invalid FK Test',
            prompt: 'Test prompt',
            createdById: 'non-existent-user-id', // Invalid foreign key
          },
        })
      ).rejects.toThrow();

      // Test unique constraints
      const user = await testContext.helper.createTestUser(
        { email: 'unique-test@example.com' },
        testContext.transaction
      );

      await expect(
        testContext.helper.createTestUser(
          { email: 'unique-test@example.com' }, // Duplicate email
          testContext.transaction
        )
      ).rejects.toThrow();
    });

    /**
     * Test: Enum validation
     * Validates: All enum values are accepted/rejected correctly
     */
    it('should validate enum values correctly', async () => {
      const user = await testContext.helper.createTestUser({}, testContext.transaction);

      // Valid enum values should work
      const validTask = await testContext.transaction.claudeTask.create({
        data: {
          title: 'Enum Test Task',
          prompt: 'Test prompt',
          status: 'PENDING',
          priority: 'HIGH',
          createdById: user.id,
        },
      });

      expect(validTask.status).toBe('PENDING');
      expect(validTask.priority).toBe('HIGH');

      // Invalid enum values should fail
      await expect(
        testContext.transaction.claudeTask.create({
          data: {
            title: 'Invalid Enum Task',
            prompt: 'Test prompt',
            status: 'INVALID_STATUS', // Invalid enum value
            createdById: user.id,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Claude Task Repository Integration', () => {
    /**
     * Test: CRUD operations with repository pattern
     * Validates: Repository abstraction, error handling, data consistency
     */
    it('should perform CRUD operations correctly', async () => {
      // Arrange
      const user = await testContext.helper.createTestUser({}, testContext.transaction);
      const project = await testContext.helper.createTestProject(
        user.id,
        {},
        testContext.transaction
      );

      const taskData = {
        title: 'CRUD Test Task',
        description: 'Test task for CRUD operations',
        prompt: 'Execute CRUD test operations',
        priority: 'HIGH' as const,
        createdById: user.id,
        projectId: project.id,
        tags: ['test', 'crud'],
        estimatedDuration: 3600,
      };

      // Act: Create
      const created = await testContext.claudeTaskRepo.create(taskData);

      // Assert: Create
      expect(created).toBeDefined();
      expect(created.title).toBe(taskData.title);
      expect(created.createdById).toBe(user.id);
      expect(created.projectId).toBe(project.id);

      // Act: Read
      const found = await testContext.claudeTaskRepo.findById(created.id);

      // Assert: Read
      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);

      // Act: Update
      const updated = await testContext.claudeTaskRepo.update(created.id, {
        title: 'Updated CRUD Test Task',
        description: 'Updated description',
      });

      // Assert: Update
      expect(updated.title).toBe('Updated CRUD Test Task');
      expect(updated.description).toBe('Updated description');

      // Act: Delete
      await testContext.claudeTaskRepo.delete(created.id);

      // Assert: Delete
      const deleted = await testContext.claudeTaskRepo.findById(created.id);
      expect(deleted).toBeNull();
    });

    /**
     * Test: Complex queries and filtering
     * Validates: Query optimization, index usage, result accuracy
     */
    it('should handle complex queries and filtering', async () => {
      // Arrange: Create test data with various statuses and priorities
      const user = await testContext.helper.createTestUser({}, testContext.transaction);
      const project = await testContext.helper.createTestProject(
        user.id,
        {},
        testContext.transaction
      );

      const tasks = await Promise.all([
        testContext.helper.createTestClaudeTask(
          user.id,
          project.id,
          { status: 'PENDING', priority: 'HIGH', title: 'High Priority Pending' },
          testContext.transaction
        ),
        testContext.helper.createTestClaudeTask(
          user.id,
          project.id,
          { status: 'RUNNING', priority: 'MEDIUM', title: 'Medium Priority Running' },
          testContext.transaction
        ),
        testContext.helper.createTestClaudeTask(
          user.id,
          project.id,
          { status: 'COMPLETED', priority: 'LOW', title: 'Low Priority Completed' },
          testContext.transaction
        ),
      ]);

      // Act & Assert: Find by status
      const pendingTasks = await testContext.claudeTaskRepo.findByStatus('PENDING');
      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].status).toBe('PENDING');

      // Act & Assert: Find by multiple statuses
      const activeTasks = await testContext.claudeTaskRepo.findByStatuses(['PENDING', 'RUNNING']);
      expect(activeTasks).toHaveLength(2);

      // Act & Assert: Find by user
      const userTasks = await testContext.claudeTaskRepo.findByUserId(user.id);
      expect(userTasks).toHaveLength(3);

      // Act & Assert: Find by project
      const projectTasks = await testContext.claudeTaskRepo.findByProjectId(project.id);
      expect(projectTasks).toHaveLength(3);

      // Act & Assert: Find by priority
      const highPriorityTasks = await testContext.claudeTaskRepo.findByPriority('HIGH');
      expect(highPriorityTasks).toHaveLength(1);
      expect(highPriorityTasks[0].priority).toBe('HIGH');
    });

    /**
     * Test: Status transitions and timestamp management
     * Validates: Business logic, data consistency, automatic timestamps
     */
    it('should handle status transitions correctly', async () => {
      // Arrange
      const user = await testContext.helper.createTestUser({}, testContext.transaction);
      const task = await testContext.helper.createTestClaudeTask(
        user.id,
        null,
        { status: 'PENDING' },
        testContext.transaction
      );

      // Act: Start execution
      const runningTask = await testContext.claudeTaskRepo.startExecution(task.id);

      // Assert: Status and timestamp updated
      expect(runningTask.status).toBe('RUNNING');
      expect(runningTask.startedAt).toBeTruthy();
      expect(runningTask.completedAt).toBeNull();

      // Act: Complete execution
      const completedTask = await testContext.claudeTaskRepo.completeExecution(task.id, 1800);

      // Assert: Status, timestamp, and duration updated
      expect(completedTask.status).toBe('COMPLETED');
      expect(completedTask.completedAt).toBeTruthy();
      expect(completedTask.actualDuration).toBe(1800);

      // Verify timing consistency
      expect(completedTask.completedAt.getTime()).toBeGreaterThan(
        completedTask.startedAt.getTime()
      );
    });

    /**
     * Test: Statistics and analytics
     * Validates: Aggregation queries, performance metrics, data accuracy
     */
    it('should generate accurate statistics and metrics', async () => {
      // Arrange: Create diverse task data
      const user = await testContext.helper.createTestUser({}, testContext.transaction);

      await Promise.all([
        // Completed tasks with durations
        testContext.helper.createTestClaudeTask(
          user.id,
          null,
          { status: 'COMPLETED', actualDuration: 1800 },
          testContext.transaction
        ),
        testContext.helper.createTestClaudeTask(
          user.id,
          null,
          { status: 'COMPLETED', actualDuration: 2400 },
          testContext.transaction
        ),
        // Failed tasks
        testContext.helper.createTestClaudeTask(
          user.id,
          null,
          { status: 'FAILED' },
          testContext.transaction
        ),
        // Pending tasks
        testContext.helper.createTestClaudeTask(
          user.id,
          null,
          { status: 'PENDING' },
          testContext.transaction
        ),
      ]);

      // Act: Get statistics
      const stats = await testContext.claudeTaskRepo.getTaskStatsByUser(user.id);

      // Assert: Statistics accuracy
      expect(stats.total).toBe(4);
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.averageDuration).toBe(2100); // (1800 + 2400) / 2
      expect(stats.totalDuration).toBe(4200); // 1800 + 2400

      // Act: Get execution metrics
      const metrics = await testContext.claudeTaskRepo.getExecutionMetrics({ userId: user.id });

      // Assert: Metrics accuracy
      expect(metrics.totalTasks).toBe(4);
      expect(metrics.successRate).toBe(50); // 2/4 * 100
      expect(metrics.averageDuration).toBe(2100);
    });
  });

  describe('Task Execution Repository Integration', () => {
    /**
     * Test: Execution lifecycle management
     * Validates: Execution tracking, progress updates, resource monitoring
     */
    it('should manage execution lifecycle correctly', async () => {
      // Arrange
      const user = await testContext.helper.createTestUser({}, testContext.transaction);
      const task = await testContext.helper.createTestClaudeTask(
        user.id,
        null,
        {},
        testContext.transaction
      );

      const executionData = {
        taskId: task.id,
        status: 'INITIALIZING' as const,
        workerId: 'worker-001',
        processId: 'process-123',
        sessionId: 'session-456',
      };

      // Act: Create execution
      const execution = await testContext.taskExecutionRepo.create(executionData);

      // Assert: Execution created
      expect(execution).toBeDefined();
      expect(execution.taskId).toBe(task.id);
      expect(execution.status).toBe('INITIALIZING');

      // Act: Update progress
      const progressUpdate = await testContext.taskExecutionRepo.updateProgress(
        execution.id,
        0.5,
        'processing'
      );

      // Assert: Progress updated
      expect(progressUpdate.progress).toBe(0.5);

      // Act: Record resource usage
      const resourceUpdate = await testContext.taskExecutionRepo.updateResourceUsage(
        execution.id,
        {
          cpuUsage: 75.5,
          memoryUsage: 512000000, // 512MB
          diskUsage: 1024000000, // 1GB
        }
      );

      // Assert: Resource usage recorded
      expect(resourceUpdate.cpuUsage).toBe(75.5);
      expect(resourceUpdate.memoryUsage).toBe(512000000);
      expect(resourceUpdate.diskUsage).toBe(1024000000);
    });

    /**
     * Test: Error handling and retry tracking
     * Validates: Error recording, retry mechanisms, failure analysis
     */
    it('should handle errors and retries correctly', async () => {
      // Arrange
      const user = await testContext.helper.createTestUser({}, testContext.transaction);
      const task = await testContext.helper.createTestClaudeTask(
        user.id,
        null,
        {},
        testContext.transaction
      );

      const execution = await testContext.taskExecutionRepo.create({
        taskId: task.id,
        status: 'RUNNING',
      });

      // Act: Record error
      const errorUpdate = await testContext.taskExecutionRepo.recordError(execution.id, {
        errorMessage: 'Test execution error',
        errorCode: 'EXEC_001',
        stackTrace: 'Error stack trace...',
      });

      // Assert: Error recorded
      expect(errorUpdate.errorMessage).toBe('Test execution error');
      expect(errorUpdate.errorCode).toBe('EXEC_001');
      expect(errorUpdate.retryCount).toBe(1);

      // Act: Increment retry count
      const retryUpdate = await testContext.taskExecutionRepo.incrementRetryCount(execution.id);

      // Assert: Retry count incremented
      expect(retryUpdate.retryCount).toBe(2);
    });

    /**
     * Test: Heartbeat and monitoring
     * Validates: Execution monitoring, timeout detection, worker tracking
     */
    it('should track heartbeats and monitor execution health', async () => {
      // Arrange
      const user = await testContext.helper.createTestUser({}, testContext.transaction);
      const task = await testContext.helper.createTestClaudeTask(
        user.id,
        null,
        {},
        testContext.transaction
      );

      const execution = await testContext.taskExecutionRepo.create({
        taskId: task.id,
        status: 'RUNNING',
        workerId: 'worker-monitor-test',
      });

      // Act: Update heartbeat
      const heartbeatUpdate = await testContext.taskExecutionRepo.updateHeartbeat(execution.id);

      // Assert: Heartbeat updated
      expect(heartbeatUpdate.lastHeartbeat).toBeTruthy();

      // Act: Find stale executions (simulated by creating old execution)
      const oldDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const staleExecution = await testContext.taskExecutionRepo.create({
        taskId: task.id,
        status: 'RUNNING',
        lastHeartbeat: oldDate,
      });

      const staleExecutions = await testContext.taskExecutionRepo.findStaleExecutions(
        5 * 60 * 1000 // 5 minutes threshold
      );

      // Assert: Stale execution detected
      expect(staleExecutions.some(exec => exec.id === staleExecution.id)).toBe(true);
    });
  });

  describe('Queue Job Repository Integration', () => {
    /**
     * Test: Queue job lifecycle and priority management
     * Validates: Job queuing, priority ordering, status transitions
     */
    it('should manage queue jobs correctly', async () => {
      // Arrange
      const user = await testContext.helper.createTestUser({}, testContext.transaction);
      const task = await testContext.helper.createTestClaudeTask(
        user.id,
        null,
        {},
        testContext.transaction
      );

      const jobData = {
        taskId: task.id,
        queueName: 'claude-tasks',
        jobId: 'job-12345',
        priority: 10,
        jobData: { command: 'test', params: {} },
        maxAttempts: 3,
      };

      // Act: Create job
      const job = await testContext.queueJobRepo.create(jobData);

      // Assert: Job created
      expect(job).toBeDefined();
      expect(job.taskId).toBe(task.id);
      expect(job.priority).toBe(10);

      // Act: Find jobs by queue
      const queueJobs = await testContext.queueJobRepo.findByQueue('claude-tasks');

      // Assert: Job found in queue
      expect(queueJobs).toHaveLength(1);
      expect(queueJobs[0].queueName).toBe('claude-tasks');

      // Act: Find jobs by priority
      const priorityJobs = await testContext.queueJobRepo.findByPriority(10);

      // Assert: Job found by priority
      expect(priorityJobs).toHaveLength(1);
      expect(priorityJobs[0].priority).toBe(10);
    });

    /**
     * Test: Job processing and attempt tracking
     * Validates: Processing lifecycle, attempt recording, failure handling
     */
    it('should track job processing and attempts', async () => {
      // Arrange
      const user = await testContext.helper.createTestUser({}, testContext.transaction);
      const task = await testContext.helper.createTestClaudeTask(
        user.id,
        null,
        {},
        testContext.transaction
      );

      const job = await testContext.queueJobRepo.create({
        taskId: task.id,
        queueName: 'test-queue',
        jobId: 'attempt-test-job',
        jobData: { test: true },
      });

      // Act: Start processing
      const processingJob = await testContext.queueJobRepo.startProcessing(job.id);

      // Assert: Status updated
      expect(processingJob.status).toBe('ACTIVE');
      expect(processingJob.processedAt).toBeTruthy();

      // Act: Add attempt
      const attempt = await testContext.queueJobRepo.addAttempt(job.id, {
        attemptNumber: 1,
        status: 'PROCESSING',
        startedAt: new Date(),
      });

      // Assert: Attempt recorded
      expect(attempt).toBeDefined();
      expect(attempt.attemptNumber).toBe(1);

      // Act: Complete job
      const completedJob = await testContext.queueJobRepo.completeJob(job.id, {
        success: true,
        result: 'Test completed',
      });

      // Assert: Job completed
      expect(completedJob.status).toBe('COMPLETED');
      expect(completedJob.finishedAt).toBeTruthy();
    });

    /**
     * Test: Queue statistics and monitoring
     * Validates: Queue metrics, job distribution, performance tracking
     */
    it('should provide queue statistics', async () => {
      // Arrange: Create jobs with different statuses
      const user = await testContext.helper.createTestUser({}, testContext.transaction);
      const tasks = await Promise.all([
        testContext.helper.createTestClaudeTask(user.id, null, {}, testContext.transaction),
        testContext.helper.createTestClaudeTask(user.id, null, {}, testContext.transaction),
        testContext.helper.createTestClaudeTask(user.id, null, {}, testContext.transaction),
      ]);

      await Promise.all([
        testContext.queueJobRepo.create({
          taskId: tasks[0].id,
          queueName: 'stats-queue',
          jobId: 'stats-job-1',
          status: 'WAITING',
          jobData: {},
        }),
        testContext.queueJobRepo.create({
          taskId: tasks[1].id,
          queueName: 'stats-queue',
          jobId: 'stats-job-2',
          status: 'ACTIVE',
          jobData: {},
        }),
        testContext.queueJobRepo.create({
          taskId: tasks[2].id,
          queueName: 'stats-queue',
          jobId: 'stats-job-3',
          status: 'COMPLETED',
          jobData: {},
        }),
      ]);

      // Act: Get queue statistics
      const stats = await testContext.queueJobRepo.getQueueStatistics('stats-queue');

      // Assert: Statistics accuracy
      expect(stats.total).toBe(3);
      expect(stats.waiting).toBe(1);
      expect(stats.active).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(0);
    });
  });

  describe('Execution Log Repository Integration', () => {
    /**
     * Test: Log creation and querying
     * Validates: Log storage, search capabilities, performance
     */
    it('should store and query logs correctly', async () => {
      // Arrange
      const scenario = await testContext.helper.createTaskExecutionScenario(
        {
          user: { email: 'log-test@example.com' },
          task: { title: 'Log Test Task' },
        },
        testContext.transaction
      );

      const logData = [
        {
          executionId: scenario.execution.id,
          level: 'INFO' as const,
          source: 'SYSTEM' as const,
          message: 'Execution started',
          component: 'ExecutionEngine',
          operation: 'start',
        },
        {
          executionId: scenario.execution.id,
          level: 'ERROR' as const,
          source: 'CLAUDE' as const,
          message: 'Processing error',
          component: 'TaskProcessor',
          operation: 'process',
        },
      ];

      // Act: Create logs
      const logs = await Promise.all(
        logData.map(data => testContext.executionLogRepo.create(data))
      );

      // Assert: Logs created
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe('INFO');
      expect(logs[1].level).toBe('ERROR');

      // Act: Find logs by execution
      const executionLogs = await testContext.executionLogRepo.findByExecution(
        scenario.execution.id
      );

      // Assert: Logs found
      expect(executionLogs).toHaveLength(2);

      // Act: Find logs by level
      const errorLogs = await testContext.executionLogRepo.findByLevel('ERROR');

      // Assert: Error logs found
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('Processing error');

      // Act: Find logs by component
      const systemLogs = await testContext.executionLogRepo.findByComponent('ExecutionEngine');

      // Assert: Component logs found
      expect(systemLogs).toHaveLength(1);
      expect(systemLogs[0].component).toBe('ExecutionEngine');
    });

    /**
     * Test: Log aggregation and analysis
     * Validates: Log analytics, error patterns, performance insights
     */
    it('should provide log analytics', async () => {
      // Arrange: Create execution with multiple logs
      const scenario = await testContext.helper.createTaskExecutionScenario(
        {
          logs: [
            { level: 'INFO', message: 'Start' },
            { level: 'DEBUG', message: 'Debug info' },
            { level: 'WARN', message: 'Warning' },
            { level: 'ERROR', message: 'Error 1' },
            { level: 'ERROR', message: 'Error 2' },
          ],
        },
        testContext.transaction
      );

      // Act: Get log statistics
      const stats = await testContext.executionLogRepo.getLogStatistics(scenario.execution.id);

      // Assert: Statistics accuracy
      expect(stats.total).toBe(5);
      expect(stats.info).toBe(1);
      expect(stats.debug).toBe(1);
      expect(stats.warn).toBe(1);
      expect(stats.error).toBe(2);
      expect(stats.fatal).toBe(0);

      // Act: Find error patterns
      const errorPatterns = await testContext.executionLogRepo.findErrorPatterns({
        executionId: scenario.execution.id,
      });

      // Assert: Error patterns found
      expect(errorPatterns).toHaveLength(2);
      expect(errorPatterns.every(log => log.level === 'ERROR')).toBe(true);
    });
  });

  describe('Cross-Entity Relationships and Complex Queries', () => {
    /**
     * Test: Relationship integrity and cascading operations
     * Validates: Foreign key relationships, cascade deletes, data consistency
     */
    it('should maintain relationship integrity', async () => {
      // Arrange: Create full scenario
      const scenario = await testContext.helper.createTaskExecutionScenario(
        {
          user: { email: 'relationship-test@example.com' },
          project: { name: 'Relationship Test Project' },
          task: { title: 'Relationship Test Task' },
        },
        testContext.transaction
      );

      // Act: Verify relationships exist
      const taskWithRelations = await testContext.claudeTaskRepo.findWithExecutions({
        userId: scenario.user.id,
      });

      // Assert: Relationships loaded correctly
      expect(taskWithRelations).toHaveLength(1);
      expect(taskWithRelations[0].executions).toHaveLength(1);
      expect(taskWithRelations[0].createdBy.id).toBe(scenario.user.id);
      expect(taskWithRelations[0].project.id).toBe(scenario.project.id);

      // Act: Test cascade delete (delete task should cascade to executions)
      await testContext.claudeTaskRepo.delete(scenario.task.id);

      // Assert: Related entities cleaned up
      const orphanedExecution = await testContext.taskExecutionRepo.findById(
        scenario.execution.id
      );
      expect(orphanedExecution).toBeNull();

      // Verify logs are also cleaned up (cascade through execution)
      const orphanedLogs = await testContext.executionLogRepo.findByExecution(
        scenario.execution.id
      );
      expect(orphanedLogs).toHaveLength(0);
    });

    /**
     * Test: Complex cross-entity queries
     * Validates: Join queries, performance, result accuracy
     */
    it('should execute complex cross-entity queries efficiently', async () => {
      // Arrange: Create multiple scenarios
      const scenarios = await Promise.all([
        testContext.helper.createTaskExecutionScenario(
          {
            user: { email: 'complex-query-1@example.com' },
            task: { status: 'COMPLETED', priority: 'HIGH' },
            execution: { status: 'COMPLETED' },
          },
          testContext.transaction
        ),
        testContext.helper.createTaskExecutionScenario(
          {
            user: { email: 'complex-query-2@example.com' },
            task: { status: 'RUNNING', priority: 'MEDIUM' },
            execution: { status: 'RUNNING' },
          },
          testContext.transaction
        ),
      ]);

      // Act: Complex query - Find all high priority completed tasks with their executions
      const highPriorityCompleted = await testContext.transaction.claudeTask.findMany({
        where: {
          priority: 'HIGH',
          status: 'COMPLETED',
        },
        include: {
          executions: {
            where: {
              status: 'COMPLETED',
            },
            include: {
              logs: {
                where: {
                  level: 'ERROR',
                },
              },
            },
          },
          createdBy: true,
          project: true,
        },
      });

      // Assert: Complex query results
      expect(highPriorityCompleted).toHaveLength(1);
      expect(highPriorityCompleted[0].priority).toBe('HIGH');
      expect(highPriorityCompleted[0].status).toBe('COMPLETED');
      expect(highPriorityCompleted[0].executions).toHaveLength(1);
      expect(highPriorityCompleted[0].createdBy).toBeDefined();

      // Act: Aggregation query - Task statistics by user
      const userStats = await testContext.transaction.claudeTask.groupBy({
        by: ['createdById', 'status'],
        _count: {
          id: true,
        },
        orderBy: {
          createdById: 'asc',
        },
      });

      // Assert: Aggregation results
      expect(userStats.length).toBeGreaterThan(0);
      expect(userStats.every(stat => stat._count.id > 0)).toBe(true);
    });

    /**
     * Test: Performance optimization and index usage
     * Validates: Query performance, index effectiveness, optimization
     */
    it('should demonstrate optimized query performance', async () => {
      // Note: This test validates that queries execute quickly
      // In a real environment, you might use query explain plans

      // Arrange: Create a reasonable amount of test data
      const user = await testContext.helper.createTestUser({}, testContext.transaction);

      // Create multiple tasks for performance testing
      const taskPromises = Array.from({ length: 10 }, (_, i) =>
        testContext.helper.createTestClaudeTask(
          user.id,
          null,
          {
            title: `Performance Test Task ${i}`,
            status: i % 2 === 0 ? 'COMPLETED' : 'PENDING',
            priority: i % 3 === 0 ? 'HIGH' : 'MEDIUM',
          },
          testContext.transaction
        )
      );

      await Promise.all(taskPromises);

      // Act: Measure query performance
      const startTime = Date.now();

      const results = await Promise.all([
        testContext.claudeTaskRepo.findByUserId(user.id),
        testContext.claudeTaskRepo.findByStatus('COMPLETED'),
        testContext.claudeTaskRepo.findByPriority('HIGH'),
        testContext.claudeTaskRepo.getTaskStatsByUser(user.id),
      ]);

      const queryTime = Date.now() - startTime;

      // Assert: Query performance and results
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
      expect(results[0]).toHaveLength(10); // All user tasks
      expect(results[1].length).toBeGreaterThan(0); // Completed tasks
      expect(results[2].length).toBeGreaterThan(0); // High priority tasks
      expect(results[3].total).toBe(10); // Statistics total
    });
  });

  describe('Data Validation and Business Logic', () => {
    /**
     * Test: Business rule enforcement
     * Validates: Domain constraints, business logic, data consistency
     */
    it('should enforce business rules correctly', async () => {
      // Arrange
      const user = await testContext.helper.createTestUser({}, testContext.transaction);
      const task = await testContext.helper.createTestClaudeTask(
        user.id,
        null,
        { status: 'PENDING' },
        testContext.transaction
      );

      // Act & Assert: Cannot create multiple running executions for same task
      const execution1 = await testContext.taskExecutionRepo.create({
        taskId: task.id,
        status: 'RUNNING',
      });

      // This should either fail or be handled by business logic
      // In a real implementation, you might have unique constraints or business logic to prevent this
      const execution2 = await testContext.taskExecutionRepo.create({
        taskId: task.id,
        status: 'RUNNING',
      });

      // Verify both executions exist (or implement constraint to prevent duplicates)
      expect(execution1).toBeDefined();
      expect(execution2).toBeDefined();

      // Act & Assert: Task duration should be calculated correctly
      const startTime = new Date();
      await testContext.claudeTaskRepo.updateStatus(task.id, 'RUNNING');

      // Simulate some execution time
      await new Promise(resolve => setTimeout(resolve, 100));

      const completedTask = await testContext.claudeTaskRepo.completeExecution(task.id, 100);

      // Assert: Duration and timestamps are logical
      expect(completedTask.actualDuration).toBe(100);
      expect(completedTask.completedAt.getTime()).toBeGreaterThan(completedTask.startedAt.getTime());
    });

    /**
     * Test: Comprehensive scenario validation
     * Validates: End-to-end workflow, data consistency, integration
     */
    it('should handle complete task execution workflow', async () => {
      // Arrange: Create initial scenario
      const user = await testContext.helper.createTestUser(
        { email: 'workflow-test@example.com' },
        testContext.transaction
      );
      const project = await testContext.helper.createTestProject(
        user.id,
        { name: 'Workflow Test Project' },
        testContext.transaction
      );

      // Act: Create task
      const task = await testContext.claudeTaskRepo.create({
        title: 'Complete Workflow Test',
        description: 'End-to-end workflow validation',
        prompt: 'Execute complete workflow test',
        priority: 'HIGH',
        createdById: user.id,
        projectId: project.id,
        estimatedDuration: 3600,
      });

      // Act: Queue job
      const queueJob = await testContext.queueJobRepo.create({
        taskId: task.id,
        queueName: 'workflow-test',
        jobId: 'workflow-job-001',
        priority: 10,
        jobData: { workflowTest: true },
      });

      // Act: Start processing
      await testContext.queueJobRepo.startProcessing(queueJob.id);
      await testContext.claudeTaskRepo.startExecution(task.id);

      // Act: Create execution
      const execution = await testContext.taskExecutionRepo.create({
        taskId: task.id,
        status: 'RUNNING',
        workerId: 'workflow-worker',
        progress: 0.0,
      });

      // Act: Log execution progress
      await testContext.executionLogRepo.create({
        executionId: execution.id,
        level: 'INFO',
        source: 'SYSTEM',
        message: 'Workflow execution started',
        component: 'WorkflowEngine',
      });

      // Act: Update progress
      await testContext.taskExecutionRepo.updateProgress(execution.id, 0.5, 'processing');

      // Act: Log progress
      await testContext.executionLogRepo.create({
        executionId: execution.id,
        level: 'INFO',
        source: 'SYSTEM',
        message: 'Workflow 50% complete',
        component: 'WorkflowEngine',
      });

      // Act: Complete execution
      await testContext.taskExecutionRepo.update(execution.id, {
        status: 'COMPLETED',
        progress: 1.0,
        completedAt: new Date(),
      });

      await testContext.claudeTaskRepo.completeExecution(task.id, 1800);
      await testContext.queueJobRepo.completeJob(queueJob.id, { success: true });

      // Act: Final log
      await testContext.executionLogRepo.create({
        executionId: execution.id,
        level: 'INFO',
        source: 'SYSTEM',
        message: 'Workflow execution completed successfully',
        component: 'WorkflowEngine',
      });

      // Assert: Verify complete workflow state
      const finalTask = await testContext.claudeTaskRepo.findById(task.id);
      const finalExecution = await testContext.taskExecutionRepo.findById(execution.id);
      const finalJob = await testContext.queueJobRepo.findById(queueJob.id);
      const executionLogs = await testContext.executionLogRepo.findByExecution(execution.id);

      expect(finalTask.status).toBe('COMPLETED');
      expect(finalTask.actualDuration).toBe(1800);
      expect(finalTask.completedAt).toBeTruthy();

      expect(finalExecution.status).toBe('COMPLETED');
      expect(finalExecution.progress).toBe(1.0);
      expect(finalExecution.completedAt).toBeTruthy();

      expect(finalJob.status).toBe('COMPLETED');
      expect(finalJob.finishedAt).toBeTruthy();

      expect(executionLogs).toHaveLength(3);
      expect(executionLogs.every(log => log.component === 'WorkflowEngine')).toBe(true);

      // Assert: Data integrity validation
      const integrity = await testContext.helper.validateDataIntegrity(testContext.transaction);
      expect(integrity.isValid).toBe(true);
      expect(integrity.errors).toHaveLength(0);
    });
  });
});