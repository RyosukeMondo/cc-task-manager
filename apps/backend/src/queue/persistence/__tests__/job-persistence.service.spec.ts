import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { JobPersistenceService } from '../job-persistence.service';
import { QueueJobRepository } from '../../../database/repositories/queue-job.repository';
import { ExecutionLogRepository } from '../../../database/repositories/execution-log.repository';
import {
  QueueJobEntity,
  QueueJobStatus,
  BackoffType,
} from '../../../database/interfaces/queue-job-repository.interface';
import {
  ExecutionLogEntity,
  ExecutionStatus,
  LogLevel,
} from '../../../database/interfaces/execution-log-repository.interface';

describe('JobPersistenceService', () => {
  let service: JobPersistenceService;
  let queueJobRepository: jest.Mocked<QueueJobRepository>;
  let executionLogRepository: jest.Mocked<ExecutionLogRepository>;

  const mockQueueJob: QueueJobEntity = {
    id: 'job-1',
    taskId: 'task-1',
    queueName: 'test-queue',
    jobId: 'bullmq-job-1',
    status: QueueJobStatus.WAITING,
    priority: 0,
    delay: null,
    maxAttempts: 3,
    backoffType: BackoffType.EXPONENTIAL,
    backoffDelay: 2000,
    jobData: { test: 'data' },
    jobOptions: null,
    result: null,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    processedAt: null,
    finishedAt: null,
    attempts: [],
  };

  const mockExecutionLog: ExecutionLogEntity = {
    id: 'log-1',
    entityType: 'QueueJob',
    entityId: 'job-1',
    level: LogLevel.INFO,
    message: 'Job STATE_PERSISTED: bullmq-job-1',
    details: null,
    metadata: {},
    timestamp: new Date('2023-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    const mockQueueJobRepo = {
      findByStatus: jest.fn(),
      findByJobId: jest.fn(),
      findStuckJobs: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      markAsStuck: jest.fn(),
      cleanupCompletedJobs: jest.fn(),
      cleanupFailedJobs: jest.fn(),
      findByStatuses: jest.fn(),
    };

    const mockExecutionLogRepo = {
      create: jest.fn(),
      findByEntityId: jest.fn(),
      findByDateRange: jest.fn(),
      cleanupOldLogs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobPersistenceService,
        {
          provide: QueueJobRepository,
          useValue: mockQueueJobRepo,
        },
        {
          provide: ExecutionLogRepository,
          useValue: mockExecutionLogRepo,
        },
      ],
    }).compile();

    service = module.get<JobPersistenceService>(JobPersistenceService);
    queueJobRepository = module.get(QueueJobRepository);
    executionLogRepository = module.get(ExecutionLogRepository);

    // Mock logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('persistJobState', () => {
    it('should create new job when job does not exist', async () => {
      // Arrange
      const jobData = {
        taskId: 'task-1',
        queueName: 'test-queue',
        jobId: 'bullmq-job-1',
        status: QueueJobStatus.WAITING,
      };

      queueJobRepository.findByJobId.mockResolvedValue(null);
      queueJobRepository.create.mockResolvedValue(mockQueueJob);
      executionLogRepository.create.mockResolvedValue(mockExecutionLog);

      // Act
      const result = await service.persistJobState(jobData);

      // Assert
      expect(result).toEqual(mockQueueJob);
      expect(queueJobRepository.findByJobId).toHaveBeenCalledWith('bullmq-job-1');
      expect(queueJobRepository.create).toHaveBeenCalledWith({
        ...jobData,
        priority: 0,
        maxAttempts: 3,
        backoffType: BackoffType.EXPONENTIAL,
        backoffDelay: 2000,
        createdAt: expect.any(Date),
      });
      expect(executionLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'QueueJob',
          entityId: mockQueueJob.id,
          level: LogLevel.INFO,
          message: 'Job STATE_PERSISTED: bullmq-job-1',
        })
      );
    });

    it('should update existing job when job exists', async () => {
      // Arrange
      const jobData = {
        taskId: 'task-1',
        queueName: 'test-queue',
        jobId: 'bullmq-job-1',
        status: QueueJobStatus.ACTIVE,
      };

      const updatedJob = { ...mockQueueJob, status: QueueJobStatus.ACTIVE };

      queueJobRepository.findByJobId.mockResolvedValue(mockQueueJob);
      queueJobRepository.update.mockResolvedValue(updatedJob);
      executionLogRepository.create.mockResolvedValue(mockExecutionLog);

      // Act
      const result = await service.persistJobState(jobData);

      // Assert
      expect(result).toEqual(updatedJob);
      expect(queueJobRepository.findByJobId).toHaveBeenCalledWith('bullmq-job-1');
      expect(queueJobRepository.update).toHaveBeenCalledWith(mockQueueJob.id, {
        ...jobData,
        createdAt: mockQueueJob.createdAt,
      });
      expect(executionLogRepository.create).toHaveBeenCalled();
    });

    it('should validate required job data', async () => {
      // Arrange
      const invalidJobData = {
        queueName: 'test-queue',
        jobId: 'bullmq-job-1',
        // Missing taskId and status
      };

      // Act & Assert
      await expect(service.persistJobState(invalidJobData))
        .rejects.toThrow('Task ID is required for job persistence');
    });

    it('should skip audit logging when includeAuditLog is false', async () => {
      // Arrange
      const jobData = {
        taskId: 'task-1',
        queueName: 'test-queue',
        jobId: 'bullmq-job-1',
        status: QueueJobStatus.WAITING,
      };

      queueJobRepository.findByJobId.mockResolvedValue(null);
      queueJobRepository.create.mockResolvedValue(mockQueueJob);

      // Act
      await service.persistJobState(jobData, { includeAuditLog: false });

      // Assert
      expect(executionLogRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('performSystemStartupRecovery', () => {
    it('should recover active jobs on startup', async () => {
      // Arrange
      const activeJobs = [
        { ...mockQueueJob, status: QueueJobStatus.ACTIVE },
        { ...mockQueueJob, id: 'job-2', jobId: 'bullmq-job-2', status: QueueJobStatus.ACTIVE },
      ];

      queueJobRepository.findByStatus
        .mockResolvedValueOnce(activeJobs)
        .mockResolvedValueOnce([]); // No stuck jobs

      queueJobRepository.findStuckJobs.mockResolvedValue([]);
      queueJobRepository.updateStatus.mockResolvedValue(mockQueueJob);
      queueJobRepository.update.mockResolvedValue(mockQueueJob);
      executionLogRepository.create.mockResolvedValue(mockExecutionLog);

      // Act
      const result = await service.performSystemStartupRecovery();

      // Assert
      expect(result).toEqual({
        activeJobsRecovered: 2,
        stuckJobsRecovered: 0,
        failedRecoveries: 0,
        totalProcessed: 2,
      });

      expect(queueJobRepository.findByStatus).toHaveBeenCalledWith(QueueJobStatus.ACTIVE);
      expect(queueJobRepository.updateStatus).toHaveBeenCalledTimes(2);
      expect(queueJobRepository.update).toHaveBeenCalledTimes(2);
    });

    it('should recover stuck jobs based on threshold', async () => {
      // Arrange
      const stuckDate = new Date('2022-12-31T23:00:00Z');
      const stuckJobs = [
        {
          ...mockQueueJob,
          status: QueueJobStatus.ACTIVE,
          processedAt: stuckDate,
          attempts: [],
        },
      ];

      queueJobRepository.findByStatus.mockResolvedValue([]); // No active jobs
      queueJobRepository.findStuckJobs.mockResolvedValue(stuckJobs);
      queueJobRepository.markAsStuck.mockResolvedValue(mockQueueJob);
      queueJobRepository.updateStatus.mockResolvedValue(mockQueueJob);
      executionLogRepository.create.mockResolvedValue(mockExecutionLog);

      // Act
      const result = await service.performSystemStartupRecovery({
        stuckJobThresholdMinutes: 60,
      });

      // Assert
      expect(result).toEqual({
        activeJobsRecovered: 0,
        stuckJobsRecovered: 1,
        failedRecoveries: 0,
        totalProcessed: 1,
      });

      expect(queueJobRepository.markAsStuck).toHaveBeenCalledWith('job-1');
      expect(queueJobRepository.updateStatus).toHaveBeenCalledWith('job-1', QueueJobStatus.WAITING);
    });

    it('should handle recovery failures gracefully', async () => {
      // Arrange
      const activeJobs = [mockQueueJob];
      queueJobRepository.findByStatus.mockResolvedValue(activeJobs);
      queueJobRepository.findStuckJobs.mockResolvedValue([]);
      queueJobRepository.updateStatus.mockRejectedValue(new Error('Database error'));
      executionLogRepository.create.mockResolvedValue(mockExecutionLog);

      // Act
      const result = await service.performSystemStartupRecovery();

      // Assert
      expect(result).toEqual({
        activeJobsRecovered: 0,
        stuckJobsRecovered: 0,
        failedRecoveries: 1,
        totalProcessed: 1,
      });
    });
  });

  describe('trackJobHistory', () => {
    it('should create audit log entry for job event', async () => {
      // Arrange
      const event = {
        action: 'JOB_STARTED',
        level: LogLevel.INFO,
        details: 'Job processing started',
        metadata: { priority: 'high' },
      };

      executionLogRepository.create.mockResolvedValue(mockExecutionLog);

      // Act
      const result = await service.trackJobHistory(mockQueueJob, event);

      // Assert
      expect(result).toEqual(mockExecutionLog);
      expect(executionLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'QueueJob',
          entityId: mockQueueJob.id,
          level: LogLevel.INFO,
          message: 'Job JOB_STARTED: bullmq-job-1',
          details: 'Job processing started',
          metadata: expect.objectContaining({
            priority: 'high',
            taskId: mockQueueJob.taskId,
            queueName: mockQueueJob.queueName,
          }),
        })
      );
    });
  });

  describe('getJobHistory', () => {
    it('should retrieve job history by job ID', async () => {
      // Arrange
      const historyEntries = [mockExecutionLog];
      queueJobRepository.findByJobId.mockResolvedValue(mockQueueJob);
      executionLogRepository.findByEntityId.mockResolvedValue(historyEntries);

      // Act
      const result = await service.getJobHistory('bullmq-job-1');

      // Assert
      expect(result).toEqual(historyEntries);
      expect(queueJobRepository.findByJobId).toHaveBeenCalledWith('bullmq-job-1');
      expect(executionLogRepository.findByEntityId).toHaveBeenCalledWith(
        mockQueueJob.id,
        expect.objectContaining({ entityType: 'QueueJob' })
      );
    });

    it('should throw error when job not found', async () => {
      // Arrange
      queueJobRepository.findByJobId.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getJobHistory('non-existent-job'))
        .rejects.toThrow('Job not found with ID: non-existent-job');
    });
  });

  describe('cleanupJobHistory', () => {
    it('should cleanup old jobs and history entries', async () => {
      // Arrange
      const options = {
        olderThanDays: 30,
        keepSuccessfulJobs: false,
        keepFailedJobs: true,
      };

      queueJobRepository.cleanupCompletedJobs.mockResolvedValue(10);
      queueJobRepository.cleanupFailedJobs.mockResolvedValue(0); // Not cleaning failed jobs
      executionLogRepository.cleanupOldLogs.mockResolvedValue(25);
      executionLogRepository.create.mockResolvedValue(mockExecutionLog);

      // Act
      const result = await service.cleanupJobHistory(options);

      // Assert
      expect(result).toEqual({
        completedJobsDeleted: 10,
        failedJobsDeleted: 0,
        historyEntriesDeleted: 25,
        totalDeleted: 35,
      });

      expect(queueJobRepository.cleanupCompletedJobs).toHaveBeenCalledWith(
        expect.any(Date)
      );
      expect(queueJobRepository.cleanupFailedJobs).not.toHaveBeenCalled();
      expect(executionLogRepository.cleanupOldLogs).toHaveBeenCalledWith(
        expect.any(Date)
      );
    });

    it('should perform dry run without deleting data', async () => {
      // Arrange
      const options = { dryRun: true };
      const completedJobs = [
        { ...mockQueueJob, status: QueueJobStatus.COMPLETED, finishedAt: new Date('2022-01-01') },
      ];
      const failedJobs = [
        { ...mockQueueJob, status: QueueJobStatus.FAILED, finishedAt: new Date('2022-01-01') },
      ];
      const oldLogs = [mockExecutionLog];

      queueJobRepository.findByStatuses
        .mockResolvedValueOnce(completedJobs)
        .mockResolvedValueOnce(failedJobs);
      executionLogRepository.findByDateRange.mockResolvedValue(oldLogs);
      executionLogRepository.create.mockResolvedValue(mockExecutionLog);

      // Act
      const result = await service.cleanupJobHistory(options);

      // Assert
      expect(result.totalDeleted).toBeGreaterThan(0);
      expect(queueJobRepository.cleanupCompletedJobs).not.toHaveBeenCalled();
      expect(queueJobRepository.cleanupFailedJobs).not.toHaveBeenCalled();
      expect(executionLogRepository.cleanupOldLogs).not.toHaveBeenCalled();
    });
  });

  describe('system restart scenarios integration tests', () => {
    it('should handle complete system restart recovery workflow', async () => {
      // Arrange: Simulate system with various job states
      const activeJobs = [
        { ...mockQueueJob, id: 'job-1', status: QueueJobStatus.ACTIVE },
        { ...mockQueueJob, id: 'job-2', status: QueueJobStatus.ACTIVE, processedAt: new Date() },
      ];

      const stuckJobs = [
        {
          ...mockQueueJob,
          id: 'job-3',
          status: QueueJobStatus.ACTIVE,
          processedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          attempts: [],
        },
      ];

      queueJobRepository.findByStatus.mockResolvedValue(activeJobs);
      queueJobRepository.findStuckJobs.mockResolvedValue(stuckJobs);
      queueJobRepository.updateStatus.mockResolvedValue(mockQueueJob);
      queueJobRepository.update.mockResolvedValue(mockQueueJob);
      queueJobRepository.markAsStuck.mockResolvedValue(mockQueueJob);
      executionLogRepository.create.mockResolvedValue(mockExecutionLog);

      // Act: Perform startup recovery
      const result = await service.performSystemStartupRecovery({
        recoverActiveJobs: true,
        recoverStuckJobs: true,
        stuckJobThresholdMinutes: 60,
        maxRecoveryAttempts: 3,
      });

      // Assert: Verify recovery results
      expect(result).toEqual({
        activeJobsRecovered: 2,
        stuckJobsRecovered: 1,
        failedRecoveries: 0,
        totalProcessed: 3,
      });

      // Verify active job recovery
      expect(queueJobRepository.updateStatus).toHaveBeenCalledWith('job-1', QueueJobStatus.WAITING);
      expect(queueJobRepository.updateStatus).toHaveBeenCalledWith('job-2', QueueJobStatus.WAITING);

      // Verify stuck job recovery
      expect(queueJobRepository.markAsStuck).toHaveBeenCalledWith('job-3');
      expect(queueJobRepository.updateStatus).toHaveBeenCalledWith('job-3', QueueJobStatus.WAITING);

      // Verify audit logging
      expect(executionLogRepository.create).toHaveBeenCalledTimes(4); // 3 job recovery logs + 1 system log
    });

    it('should maintain data consistency during concurrent recovery operations', async () => {
      // This test verifies that recovery operations don't interfere with each other
      const jobs = Array.from({ length: 10 }, (_, i) => ({
        ...mockQueueJob,
        id: `job-${i}`,
        jobId: `bullmq-job-${i}`,
        status: QueueJobStatus.ACTIVE,
      }));

      queueJobRepository.findByStatus.mockResolvedValue(jobs);
      queueJobRepository.findStuckJobs.mockResolvedValue([]);
      queueJobRepository.updateStatus.mockResolvedValue(mockQueueJob);
      queueJobRepository.update.mockResolvedValue(mockQueueJob);
      executionLogRepository.create.mockResolvedValue(mockExecutionLog);

      // Act
      const result = await service.performSystemStartupRecovery();

      // Assert
      expect(result.activeJobsRecovered).toBe(10);
      expect(queueJobRepository.updateStatus).toHaveBeenCalledTimes(10);
      expect(queueJobRepository.update).toHaveBeenCalledTimes(10);
    });
  });
});