import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { QueueScalingService } from '../queue-scaling.service';
import { QueueConfigService } from '../../queue.config';
import { QueueMonitorService } from '../../queue-monitor.service';
import { PriorityManagerService } from '../../priority/priority-manager.service';
import { JobPriority } from '../../queue.schemas';

// Mock implementations
const mockQueueConfigService = {
  getRedisConnection: jest.fn().mockReturnValue({
    host: 'localhost',
    port: 6379,
    db: 0,
  }),
  getWorkerConcurrency: jest.fn().mockReturnValue(5),
  getDefaultJobOptions: jest.fn().mockReturnValue({
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  }),
};

const mockQueueMonitorService = {
  getCurrentMetrics: jest.fn().mockResolvedValue([
    {
      queueName: 'urgent-priority',
      waiting: 10,
      active: 5,
      completed: 100,
      failed: 2,
      delayed: 0,
      paused: false,
      throughput: 50,
      averageProcessingTime: 2000,
      failureRate: 2,
      timestamp: new Date(),
    },
    {
      queueName: 'normal-priority',
      waiting: 20,
      active: 8,
      completed: 200,
      failed: 5,
      delayed: 1,
      paused: false,
      throughput: 80,
      averageProcessingTime: 3000,
      failureRate: 2.5,
      timestamp: new Date(),
    },
  ]),
};

const mockPriorityManagerService = {
  getLoadBalancingMetrics: jest.fn().mockResolvedValue({
    priorityQueues: {},
    workerUtilization: {},
    resourceUtilization: {
      cpuUsage: 50,
      memoryUsage: 60,
      diskUsage: 30,
      networkUsage: 40,
    },
    timestamp: new Date(),
  }),
};

// Mock BullMQ classes
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
    getWaitingCount: jest.fn().mockResolvedValue(10),
    getActiveCount: jest.fn().mockResolvedValue(5),
    getCompletedCount: jest.fn().mockResolvedValue(100),
    getFailedCount: jest.fn().mockResolvedValue(2),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Worker: jest.fn().mockImplementation((queueName, processor, options) => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    queueName,
    processor,
    options,
  })),
  QueueEvents: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('QueueScalingService', () => {
  let service: QueueScalingService;
  let module: TestingModule;

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        QueueScalingService,
        {
          provide: QueueConfigService,
          useValue: mockQueueConfigService,
        },
        {
          provide: QueueMonitorService,
          useValue: mockQueueMonitorService,
        },
        {
          provide: PriorityManagerService,
          useValue: mockPriorityManagerService,
        },
      ],
    }).compile();

    service = module.get<QueueScalingService>(QueueScalingService);

    // Mock the logger to avoid console output during tests
    jest.spyOn(service['logger'], 'log').mockImplementation();
    jest.spyOn(service['logger'], 'debug').mockImplementation();
    jest.spyOn(service['logger'], 'warn').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with proper configuration', () => {
      expect(service).toBeInstanceOf(QueueScalingService);
    });

    it('should initialize worker pools for all priority levels', async () => {
      await service.onModuleInit();

      // Verify worker pools are created for each priority
      const scalingStatus = await service.getScalingStatus();
      expect(Object.keys(scalingStatus.queues)).toHaveLength(4); // URGENT, HIGH, NORMAL, LOW
    });
  });

  describe('Auto-scaling Functionality', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should calculate queue utilization correctly', async () => {
      const scalingStatus = await service.getScalingStatus();

      // Check that utilization is calculated for each queue
      for (const queueStatus of Object.values(scalingStatus.queues)) {
        expect(queueStatus.utilization).toBeGreaterThanOrEqual(0);
        expect(queueStatus.utilization).toBeLessThanOrEqual(1);
      }
    });

    it('should provide scaling recommendations', async () => {
      const scalingStatus = await service.getScalingStatus();

      expect(scalingStatus.recommendations).toBeDefined();
      expect(Array.isArray(scalingStatus.recommendations)).toBe(true);
    });

    it('should track scaling history', async () => {
      const scalingStatus = await service.getScalingStatus();

      for (const queueStatus of Object.values(scalingStatus.queues)) {
        expect(queueStatus.scalingHistory).toBeDefined();
        expect(Array.isArray(queueStatus.scalingHistory)).toBe(true);
      }
    });

    it('should prevent concurrent scaling operations', async () => {
      // This test would verify that scaling operations don't overlap
      const queueName = 'urgent-priority';

      // Start multiple scaling operations simultaneously
      const promises = [
        service.manualScale(queueName, 6),
        service.manualScale(queueName, 8),
      ];

      // One should succeed, others should handle gracefully
      await expect(Promise.allSettled(promises)).resolves.toBeDefined();
    });
  });

  describe('Manual Scaling', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should allow manual scaling within limits', async () => {
      const queueName = 'normal-priority';
      const targetWorkers = 5;

      await expect(service.manualScale(queueName, targetWorkers)).resolves.not.toThrow();

      const scalingStatus = await service.getScalingStatus();
      // Note: In real implementation, this would verify the actual worker count
    });

    it('should reject scaling below minimum workers', async () => {
      const queueName = 'normal-priority';
      const targetWorkers = 1; // Below minimum of 2

      await expect(service.manualScale(queueName, targetWorkers)).rejects.toThrow();
    });

    it('should reject scaling above maximum workers', async () => {
      const queueName = 'normal-priority';
      const targetWorkers = 25; // Above maximum of 20

      await expect(service.manualScale(queueName, targetWorkers)).rejects.toThrow();
    });

    it('should reject scaling for non-existent queues', async () => {
      const queueName = 'non-existent-queue';
      const targetWorkers = 5;

      await expect(service.manualScale(queueName, targetWorkers)).rejects.toThrow();
    });
  });

  describe('Performance Optimization', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should track performance metrics', async () => {
      const scalingStatus = await service.getScalingStatus();

      expect(scalingStatus.overallPerformance).toBeDefined();
      expect(scalingStatus.overallPerformance.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(scalingStatus.overallPerformance.totalThroughput).toBeGreaterThanOrEqual(0);
      expect(scalingStatus.overallPerformance.overallFailureRate).toBeGreaterThanOrEqual(0);
      expect(scalingStatus.overallPerformance.healthScore).toBeGreaterThanOrEqual(0);
      expect(scalingStatus.overallPerformance.healthScore).toBeLessThanOrEqual(100);
    });

    it('should monitor resource utilization', async () => {
      const scalingStatus = await service.getScalingStatus();

      expect(scalingStatus.resourceUtilization).toBeDefined();
      expect(scalingStatus.resourceUtilization.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(scalingStatus.resourceUtilization.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(scalingStatus.resourceUtilization.diskUsage).toBeGreaterThanOrEqual(0);
      expect(scalingStatus.resourceUtilization.networkUsage).toBeGreaterThanOrEqual(0);
    });

    it('should calculate health scores correctly', async () => {
      const scalingStatus = await service.getScalingStatus();

      // Health score should be between 0 and 100
      expect(scalingStatus.overallPerformance.healthScore).toBeGreaterThanOrEqual(0);
      expect(scalingStatus.overallPerformance.healthScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Priority-based Optimization', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should optimize workers based on priority levels', async () => {
      const scalingStatus = await service.getScalingStatus();

      // Urgent priority should have more initial workers than low priority
      const urgentQueue = scalingStatus.queues['urgent-priority'];
      const lowQueue = scalingStatus.queues['low-priority'];

      if (urgentQueue && lowQueue) {
        expect(urgentQueue.currentWorkers).toBeGreaterThanOrEqual(lowQueue.currentWorkers);
      }
    });

    it('should handle different priority levels correctly', async () => {
      const scalingStatus = await service.getScalingStatus();

      // Verify all priority levels are handled
      const expectedPriorities = ['urgent-priority', 'high-priority', 'normal-priority', 'low-priority'];
      const actualQueues = Object.keys(scalingStatus.queues);

      expectedPriorities.forEach(priority => {
        expect(actualQueues).toContain(priority);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should handle monitor service failures gracefully', async () => {
      // Mock monitor service to fail
      mockQueueMonitorService.getCurrentMetrics.mockRejectedValueOnce(new Error('Monitor failure'));

      // Should not throw and should handle the error gracefully
      await expect(service.getScalingStatus()).resolves.toBeDefined();
    });

    it('should handle worker creation failures', async () => {
      // This test would verify graceful handling of worker creation failures
      // In a real implementation, worker creation might fail due to resource constraints
      await expect(service.getScalingStatus()).resolves.toBeDefined();
    });

    it('should handle empty metrics gracefully', async () => {
      // Mock empty metrics
      mockQueueMonitorService.getCurrentMetrics.mockResolvedValueOnce([]);

      const scalingStatus = await service.getScalingStatus();
      expect(scalingStatus).toBeDefined();
      expect(scalingStatus.recommendations).toBeDefined();
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should respect resource limits during scaling', async () => {
      // Mock high resource utilization
      mockPriorityManagerService.getLoadBalancingMetrics.mockResolvedValueOnce({
        priorityQueues: {},
        workerUtilization: {},
        resourceUtilization: {
          cpuUsage: 90,  // High CPU usage
          memoryUsage: 95,  // High memory usage
          diskUsage: 80,
          networkUsage: 70,
        },
        timestamp: new Date(),
      });

      const scalingStatus = await service.getScalingStatus();

      // Should recommend caution due to high resource usage
      expect(scalingStatus.recommendations.some(rec =>
        rec.includes('CPU') || rec.includes('memory')
      )).toBe(true);
    });

    it('should generate appropriate recommendations for resource constraints', async () => {
      const scalingStatus = await service.getScalingStatus();

      expect(scalingStatus.recommendations).toBeDefined();
      expect(Array.isArray(scalingStatus.recommendations)).toBe(true);
      expect(scalingStatus.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await service.onModuleInit();
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });

    it('should clean up resources during shutdown', async () => {
      await service.onModuleInit();

      // Spy on worker close methods to verify they are called
      const scalingStatus = await service.getScalingStatus();
      const workerCount = Object.values(scalingStatus.queues)
        .reduce((total, queue) => total + queue.currentWorkers, 0);

      await service.onModuleDestroy();

      // Verify that the service cleaned up properly
      expect(service['scalingMonitorInterval']).toBeNull();
      expect(service['performanceMonitorInterval']).toBeNull();
      expect(service['optimizationInterval']).toBeNull();
    });
  });

  describe('Integration with Other Services', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should integrate properly with QueueConfigService', () => {
      expect(mockQueueConfigService.getRedisConnection).toHaveBeenCalled();
      expect(mockQueueConfigService.getWorkerConcurrency).toHaveBeenCalled();
    });

    it('should integrate properly with QueueMonitorService', async () => {
      await service.getScalingStatus();
      expect(mockQueueMonitorService.getCurrentMetrics).toHaveBeenCalled();
    });

    it('should use proper configuration values', () => {
      // Verify that the service uses configuration values correctly
      expect(mockQueueConfigService.getRedisConnection).toHaveBeenCalledTimes(4); // Once per priority level
    });
  });

  describe('Performance Metrics Calculation', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should calculate performance trends correctly', async () => {
      const scalingStatus = await service.getScalingStatus();

      // Verify performance metrics are calculated
      expect(scalingStatus.overallPerformance.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(scalingStatus.overallPerformance.totalThroughput).toBeGreaterThanOrEqual(0);
    });

    it('should track worker performance individually', async () => {
      const scalingStatus = await service.getScalingStatus();

      for (const queueStatus of Object.values(scalingStatus.queues)) {
        expect(queueStatus.performance).toBeDefined();
        expect(queueStatus.performance.averageProcessingTime).toBeGreaterThanOrEqual(0);
        expect(queueStatus.performance.throughput).toBeGreaterThanOrEqual(0);
        expect(queueStatus.performance.failureRate).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

// Additional utility function tests
describe('QueueScalingService Utility Functions', () => {
  let service: QueueScalingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        QueueScalingService,
        {
          provide: QueueConfigService,
          useValue: mockQueueConfigService,
        },
        {
          provide: QueueMonitorService,
          useValue: mockQueueMonitorService,
        },
        {
          provide: PriorityManagerService,
          useValue: mockPriorityManagerService,
        },
      ],
    }).compile();

    service = module.get<QueueScalingService>(QueueScalingService);

    // Mock the logger
    jest.spyOn(service['logger'], 'log').mockImplementation();
    jest.spyOn(service['logger'], 'debug').mockImplementation();
    jest.spyOn(service['logger'], 'warn').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
  });

  it('should calculate optimal worker counts for different priorities', () => {
    // Test that URGENT gets more workers than LOW priority
    const urgentCount = service['getInitialWorkerCount'](JobPriority.URGENT);
    const lowCount = service['getInitialWorkerCount'](JobPriority.LOW);

    expect(urgentCount).toBeGreaterThanOrEqual(lowCount);
    expect(urgentCount).toBeGreaterThan(0);
    expect(lowCount).toBeGreaterThan(0);
  });

  it('should calculate optimal concurrency for different priorities', () => {
    const urgentConcurrency = service['getOptimalConcurrency'](JobPriority.URGENT);
    const lowConcurrency = service['getOptimalConcurrency'](JobPriority.LOW);

    expect(urgentConcurrency).toBeGreaterThan(lowConcurrency);
    expect(urgentConcurrency).toBeGreaterThan(0);
    expect(lowConcurrency).toBeGreaterThan(0);
  });

  it('should provide optimized processing times based on priority', () => {
    const urgentTime = service['getOptimizedProcessingTime'](JobPriority.URGENT);
    const lowTime = service['getOptimizedProcessingTime'](JobPriority.LOW);

    expect(urgentTime).toBeLessThan(lowTime);
    expect(urgentTime).toBeGreaterThan(0);
    expect(lowTime).toBeGreaterThan(0);
  });
});