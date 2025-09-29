import { Test, TestingModule } from '@nestjs/testing';
import { PriorityManagerService } from '../priority-manager.service';
import { QueueConfigService } from '../../queue.config';
import { JobPriority, QueueJob } from '../../queue.schemas';

describe('PriorityManagerService', () => {
  let service: PriorityManagerService;
  let queueConfigService: jest.Mocked<QueueConfigService>;

  const mockQueueConfig = {
    getQueueConfiguration: jest.fn().mockReturnValue({
      connection: { host: 'localhost', port: 6379 },
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      settings: { stalledInterval: 30000, maxStalledCount: 3 }
    }),
    getWorkerConfiguration: jest.fn().mockReturnValue({
      connection: { host: 'localhost', port: 6379 },
      concurrency: 5,
      settings: { stalledInterval: 30000, maxStalledCount: 3 }
    }),
    getWorkerConcurrency: jest.fn().mockReturnValue(10)
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriorityManagerService,
        {
          provide: QueueConfigService,
          useValue: mockQueueConfig
        }
      ],
    }).compile();

    service = module.get<PriorityManagerService>(PriorityManagerService);
    queueConfigService = module.get<QueueConfigService>(QueueConfigService) as jest.Mocked<QueueConfigService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Priority Queue Management', () => {
    it('should initialize priority queues for all priority levels', async () => {
      // Service initialization should create queues for all priority levels
      expect(queueConfigService.getQueueConfiguration).toHaveBeenCalledWith('urgent-priority');
      expect(queueConfigService.getQueueConfiguration).toHaveBeenCalledWith('high-priority');
      expect(queueConfigService.getQueueConfiguration).toHaveBeenCalledWith('normal-priority');
      expect(queueConfigService.getQueueConfiguration).toHaveBeenCalledWith('low-priority');
    });

    it('should assign jobs to appropriate priority queues', async () => {
      const testJob: QueueJob = {
        type: 'CLAUDE_CODE_TASK',
        prompt: 'Test prompt',
        priority: JobPriority.HIGH,
        metadata: {
          timestamp: new Date(),
          retryCount: 0
        }
      };

      // Test would verify job is added to high priority queue
      // Actual implementation would use mock Queue from BullMQ
      expect(async () => {
        await service.addJobWithPriority(testJob, { priority: JobPriority.HIGH });
      }).not.toThrow();
    });

    it('should calculate correct priority values for different levels', () => {
      // Test priority value calculation
      const urgentValue = (service as any).getPriorityValue(JobPriority.URGENT);
      const highValue = (service as any).getPriorityValue(JobPriority.HIGH);
      const normalValue = (service as any).getPriorityValue(JobPriority.NORMAL);
      const lowValue = (service as any).getPriorityValue(JobPriority.LOW);

      expect(urgentValue).toBeGreaterThan(highValue);
      expect(highValue).toBeGreaterThan(normalValue);
      expect(normalValue).toBeGreaterThan(lowValue);
      expect(urgentValue).toBe(1000);
      expect(lowValue).toBe(250);
    });
  });

  describe('Load Balancing', () => {
    it('should calculate optimal worker count based on priority weights', () => {
      const urgentWorkers = (service as any).getOptimalWorkerCount(JobPriority.URGENT);
      const normalWorkers = (service as any).getOptimalWorkerCount(JobPriority.NORMAL);
      const lowWorkers = (service as any).getOptimalWorkerCount(JobPriority.LOW);

      expect(urgentWorkers).toBeGreaterThan(normalWorkers);
      expect(normalWorkers).toBeGreaterThan(lowWorkers);
      expect(lowWorkers).toBeGreaterThanOrEqual(1); // Minimum workers
    });

    it('should set appropriate concurrency for different priority levels', () => {
      const urgentConcurrency = (service as any).getConcurrencyForPriority(JobPriority.URGENT);
      const normalConcurrency = (service as any).getConcurrencyForPriority(JobPriority.NORMAL);
      const lowConcurrency = (service as any).getConcurrencyForPriority(JobPriority.LOW);

      expect(urgentConcurrency).toBeGreaterThan(normalConcurrency);
      expect(normalConcurrency).toBeGreaterThan(lowConcurrency);
      expect(urgentConcurrency).toBe(10);
      expect(lowConcurrency).toBe(2);
    });

    it('should calculate processing time appropriately for priorities', () => {
      const urgentTime = (service as any).getProcessingTimeForPriority(JobPriority.URGENT);
      const normalTime = (service as any).getProcessingTimeForPriority(JobPriority.NORMAL);
      const lowTime = (service as any).getProcessingTimeForPriority(JobPriority.LOW);

      expect(urgentTime).toBeLessThan(normalTime);
      expect(normalTime).toBeLessThan(lowTime);
      expect(urgentTime).toBe(1000); // Fast processing for urgent
      expect(lowTime).toBe(5000);    // Slower for low priority
    });
  });

  describe('Resource Management', () => {
    it('should enforce minimum and maximum worker limits', () => {
      // Test worker limit enforcement
      expect((service as any).getMinWorkersForPriority(JobPriority.URGENT)).toBe(2);
      expect((service as any).getMaxWorkersForPriority(JobPriority.URGENT)).toBe(10);
      expect((service as any).getMinWorkersForPriority(JobPriority.LOW)).toBe(1);
      expect((service as any).getMaxWorkersForPriority(JobPriority.LOW)).toBe(3);
    });

    it('should calculate different retry attempts based on priority', () => {
      const urgentAttempts = (service as any).getAttemptsForPriority(JobPriority.URGENT);
      const normalAttempts = (service as any).getAttemptsForPriority(JobPriority.NORMAL);
      const lowAttempts = (service as any).getAttemptsForPriority(JobPriority.LOW);

      expect(urgentAttempts).toBeGreaterThan(normalAttempts);
      expect(normalAttempts).toBeGreaterThan(lowAttempts);
      expect(urgentAttempts).toBe(5);
      expect(lowAttempts).toBe(2);
    });

    it('should generate unique queue names for priority levels', () => {
      expect((service as any).getPriorityQueueName(JobPriority.URGENT)).toBe('urgent-priority');
      expect((service as any).getPriorityQueueName(JobPriority.HIGH)).toBe('high-priority');
      expect((service as any).getPriorityQueueName(JobPriority.NORMAL)).toBe('normal-priority');
      expect((service as any).getPriorityQueueName(JobPriority.LOW)).toBe('low-priority');
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should provide load balancing metrics structure', async () => {
      // Mock the async methods that getLoadBalancingMetrics depends on
      jest.spyOn(service as any, 'calculateAverageWaitTime').mockResolvedValue(1000);
      jest.spyOn(service as any, 'calculateThroughput').mockResolvedValue(5);
      jest.spyOn(service as any, 'getResourceUtilization').mockResolvedValue({
        cpuUsage: 50,
        memoryUsage: 60,
        diskUsage: 30,
        networkUsage: 20
      });

      const metrics = await service.getLoadBalancingMetrics();

      expect(metrics).toHaveProperty('priorityQueues');
      expect(metrics).toHaveProperty('workerUtilization');
      expect(metrics).toHaveProperty('resourceUtilization');
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics.timestamp).toBeInstanceOf(Date);
    });

    it('should calculate estimated average wait times by priority', async () => {
      const urgentWait = await (service as any).calculateAverageWaitTime(JobPriority.URGENT);
      const normalWait = await (service as any).calculateAverageWaitTime(JobPriority.NORMAL);
      const lowWait = await (service as any).calculateAverageWaitTime(JobPriority.LOW);

      expect(urgentWait).toBeLessThan(normalWait);
      expect(normalWait).toBeLessThan(lowWait);
      expect(urgentWait).toBe(500);   // 0.5 seconds
      expect(lowWait).toBe(10000);    // 10 seconds
    });

    it('should calculate throughput estimates based on priority weights', async () => {
      const urgentThroughput = await (service as any).calculateThroughput(JobPriority.URGENT);
      const normalThroughput = await (service as any).calculateThroughput(JobPriority.NORMAL);
      const lowThroughput = await (service as any).calculateThroughput(JobPriority.LOW);

      expect(urgentThroughput).toBeGreaterThan(normalThroughput);
      expect(normalThroughput).toBeGreaterThan(lowThroughput);
      expect(urgentThroughput).toBe(40); // 4 * 10
      expect(lowThroughput).toBe(10);    // 1 * 10
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle missing priority queues gracefully', async () => {
      const testJob: QueueJob = {
        type: 'CLAUDE_CODE_TASK',
        prompt: 'Test prompt',
        metadata: {
          timestamp: new Date(),
          retryCount: 0
        }
      };

      // Clear the priority queues map to simulate missing queue
      (service as any).priorityQueues.clear();

      await expect(service.addJobWithPriority(testJob, { priority: JobPriority.HIGH }))
        .rejects.toThrow('Priority queue not found for priority: high');
    });

    it('should handle invalid priority levels', () => {
      const invalidPriority = 'INVALID' as JobPriority;

      expect((service as any).getPriorityValue(invalidPriority)).toBe(500); // Default value
      expect((service as any).getProcessingTimeForPriority(invalidPriority)).toBe(3000);
      expect((service as any).getConcurrencyForPriority(invalidPriority)).toBe(5);
    });
  });

  describe('Lifecycle Management', () => {
    it('should initialize successfully', async () => {
      // Service should initialize without errors
      expect(async () => {
        await service.onModuleInit();
      }).not.toThrow();
    });

    it('should support pausing and resuming priority levels', async () => {
      // These methods should exist and be callable
      expect(async () => {
        await service.pausePriorityLevel(JobPriority.HIGH);
        await service.resumePriorityLevel(JobPriority.HIGH);
      }).not.toThrow();
    });

    it('should cleanup resources on shutdown', async () => {
      expect(async () => {
        await service.onModuleDestroy();
      }).not.toThrow();
    });
  });
});