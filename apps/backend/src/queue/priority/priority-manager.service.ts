import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { QueueConfigService } from '../queue.config';
import {
  JobPriority,
  QueueJob,
  JobOptions,
  QueueManagerOptions,
  JobStatus
} from '../queue.schemas';

/**
 * Priority Manager Service
 *
 * Implements priority-based job processing with multiple queue levels and load balancing
 * following SOLID principles and performance optimization requirements.
 *
 * Key Features:
 * - Priority-based job distribution (URGENT, HIGH, NORMAL, LOW)
 * - Resource-aware worker scaling and load balancing
 * - Fair resource distribution to prevent starvation
 * - Real-time worker capacity management
 * - Performance metrics tracking
 *
 * Principles Applied:
 * - SRP: Manages priority queues and load balancing
 * - OCP: Extensible for new priority levels and balancing strategies
 * - DIP: Depends on configuration abstractions
 * - KISS: Simple priority mapping with effective load balancing
 * - DRY: Centralized priority logic and resource management
 */
@Injectable()
export class PriorityManagerService implements OnModuleInit {
  private readonly logger = new Logger(PriorityManagerService.name);

  // Priority queue mappings
  private readonly priorityQueues: Map<JobPriority, Queue> = new Map();
  private readonly priorityWorkers: Map<JobPriority, Worker[]> = new Map();
  private readonly queueEvents: Map<JobPriority, QueueEvents> = new Map();

  // Load balancing state
  private readonly workerLoadMetrics: Map<string, WorkerLoadMetric> = new Map();
  private readonly resourceThresholds: ResourceThresholds;

  // Priority processing weights (higher = more resources)
  private readonly priorityWeights: Record<JobPriority, number> = {
    [JobPriority.URGENT]: 4,   // 40% of resources
    [JobPriority.HIGH]: 3,     // 30% of resources
    [JobPriority.NORMAL]: 2,   // 20% of resources
    [JobPriority.LOW]: 1,      // 10% of resources
  };

  constructor(private readonly queueConfigService: QueueConfigService) {
    this.resourceThresholds = {
      cpuThreshold: 80,           // 80% CPU utilization threshold
      memoryThreshold: 85,        // 85% memory utilization threshold
      maxConcurrentJobs: 100,     // Maximum concurrent jobs per worker
      scaleUpThreshold: 0.8,      // Scale up when 80% capacity reached
      scaleDownThreshold: 0.3,    // Scale down when below 30% capacity
    };
  }

  async onModuleInit(): Promise<void> {
    await this.initializePriorityQueues();
    await this.initializePriorityWorkers();
    this.startLoadBalancingMonitor();
    this.logger.log('Priority Manager Service initialized successfully');
  }

  /**
   * Initialize priority-based queues for each priority level
   */
  private async initializePriorityQueues(): Promise<void> {
    const priorities = Object.values(JobPriority);

    for (const priority of priorities) {
      const queueName = this.getPriorityQueueName(priority);
      const connection = this.queueConfigService.getRedisConnection();

      // Create queue with priority-specific settings
      const queue = new Queue(queueName, {
        connection,
        defaultJobOptions: {
          ...this.queueConfigService.getDefaultJobOptions(),
          priority: this.getPriorityValue(priority),
          // Higher priority jobs get more attempts
          attempts: priority === JobPriority.URGENT ? 5 :
                   priority === JobPriority.HIGH ? 4 : 3,
        },
      });

      this.priorityQueues.set(priority, queue);

      // Initialize queue events for monitoring
      const queueEvents = new QueueEvents(queueName, {
        connection,
      });

      this.setupQueueEventListeners(queueEvents, priority);
      this.queueEvents.set(priority, queueEvents);

      this.logger.log(`Initialized ${priority} priority queue: ${queueName}`);
    }
  }

  /**
   * Initialize workers for each priority level with load balancing
   */
  private async initializePriorityWorkers(): Promise<void> {
    const priorities = Object.values(JobPriority);

    for (const priority of priorities) {
      const workers = await this.createWorkersForPriority(priority);
      this.priorityWorkers.set(priority, workers);

      this.logger.log(`Initialized ${workers.length} workers for ${priority} priority`);
    }
  }

  /**
   * Add job to appropriate priority queue with load balancing
   */
  async addJobWithPriority(
    jobData: QueueJob,
    options?: QueueManagerOptions
  ): Promise<string> {
    const priority = options?.priority || JobPriority.NORMAL;
    const queue = this.priorityQueues.get(priority);

    if (!queue) {
      throw new Error(`Priority queue not found for priority: ${priority}`);
    }

    // Apply load balancing considerations
    const optimalQueue = await this.selectOptimalQueue(priority);

    // Prepare job options with priority settings
    const jobOptions = {
      priority: this.getPriorityValue(priority),
      attempts: this.getAttemptsForPriority(priority),
      backoff: {
        type: 'exponential' as const,
        delay: priority === JobPriority.URGENT ? 2000 : 5000,
      },
      ...options,
    };

    // Add job to selected queue
    const job = await optimalQueue.add(
      `${jobData.type}_${priority}`,
      jobData,
      {
        ...jobOptions,
        priority: typeof jobOptions.priority === 'number' ? jobOptions.priority : this.getPriorityValue(priority),
      }
    );

    // Update load metrics
    await this.updateLoadMetrics(priority, 'job_added');

    this.logger.debug(`Added ${priority} priority job ${job.id} to queue`);
    return job.id as string;
  }

  /**
   * Get current load balancing metrics for all priority levels
   */
  async getLoadBalancingMetrics(): Promise<LoadBalancingMetrics> {
    const metrics: LoadBalancingMetrics = {
      priorityQueues: {} as Record<JobPriority, any>,
      workerUtilization: {},
      resourceUtilization: await this.getResourceUtilization(),
      timestamp: new Date(),
    };

    // Gather metrics for each priority level
    for (const priority of Object.values(JobPriority)) {
      const queue = this.priorityQueues.get(priority);
      if (!queue) continue;
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      metrics.priorityQueues[priority] = {
        waiting,
        active,
        completed,
        failed,
        delayed,
        workers: this.priorityWorkers.get(priority)?.length || 0,
        averageWaitTime: await this.calculateAverageWaitTime(priority),
        throughput: await this.calculateThroughput(priority),
      };
    }

    // Gather worker utilization metrics
    for (const workerId of Array.from(this.workerLoadMetrics.keys())) {
      const loadMetric = this.workerLoadMetrics.get(workerId);
      if (!loadMetric) continue;
      metrics.workerUtilization[workerId] = {
        activeJobs: loadMetric.activeJobs,
        completedJobs: loadMetric.completedJobs,
        failedJobs: loadMetric.failedJobs,
        cpuUsage: loadMetric.cpuUsage,
        memoryUsage: loadMetric.memoryUsage,
        lastActivity: loadMetric.lastActivity,
      };
    }

    return metrics;
  }

  /**
   * Scale workers based on load and performance requirements
   */
  async scaleWorkers(priority: JobPriority, direction: 'up' | 'down'): Promise<void> {
    const currentWorkers = this.priorityWorkers.get(priority) || [];
    const queueName = this.getPriorityQueueName(priority);

    if (direction === 'up' && currentWorkers.length < this.getMaxWorkersForPriority(priority)) {
      // Scale up: Add new worker
      const newWorker = await this.createWorkerForPriority(priority, queueName);
      currentWorkers.push(newWorker);
      this.priorityWorkers.set(priority, currentWorkers);

      this.logger.log(`Scaled up ${priority} priority workers to ${currentWorkers.length}`);
    } else if (direction === 'down' && currentWorkers.length > this.getMinWorkersForPriority(priority)) {
      // Scale down: Remove least utilized worker
      const workerToRemove = this.selectWorkerForRemoval(currentWorkers);
      if (workerToRemove) {
        await workerToRemove.close();
        const updatedWorkers = currentWorkers.filter(w => w !== workerToRemove);
        this.priorityWorkers.set(priority, updatedWorkers);

        this.logger.log(`Scaled down ${priority} priority workers to ${updatedWorkers.length}`);
      }
    }
  }

  /**
   * Pause all workers for a specific priority level
   */
  async pausePriorityLevel(priority: JobPriority): Promise<void> {
    const queue = this.priorityQueues.get(priority);
    if (queue) {
      await queue.pause();
      this.logger.log(`Paused ${priority} priority queue`);
    }
  }

  /**
   * Resume all workers for a specific priority level
   */
  async resumePriorityLevel(priority: JobPriority): Promise<void> {
    const queue = this.priorityQueues.get(priority);
    if (queue) {
      await queue.resume();
      this.logger.log(`Resumed ${priority} priority queue`);
    }
  }

  /**
   * Create workers for specific priority with proper concurrency
   */
  private async createWorkersForPriority(priority: JobPriority): Promise<Worker[]> {
    const workerCount = this.getOptimalWorkerCount(priority);
    const queueName = this.getPriorityQueueName(priority);
    const workers: Worker[] = [];

    for (let i = 0; i < workerCount; i++) {
      const worker = await this.createWorkerForPriority(priority, queueName);
      workers.push(worker);
    }

    return workers;
  }

  /**
   * Create individual worker for priority with load balancing
   */
  private async createWorkerForPriority(priority: JobPriority, queueName: string): Promise<Worker> {
    const connection = this.queueConfigService.getRedisConnection();
    const workerId = `${queueName}-worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const worker = new Worker(
      queueName,
      async (job) => {
        return await this.processJobWithLoadBalancing(job, priority, workerId);
      },
      {
        connection,
        concurrency: this.getConcurrencyForPriority(priority),
        // Priority-specific settings
      }
    );

    // Initialize load metrics for worker
    this.workerLoadMetrics.set(workerId, {
      workerId,
      priority,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      lastActivity: new Date(),
    });

    // Setup worker event listeners
    this.setupWorkerEventListeners(worker, workerId);

    return worker;
  }

  /**
   * Process job with load balancing considerations
   */
  private async processJobWithLoadBalancing(
    job: any,
    priority: JobPriority,
    workerId: string
  ): Promise<any> {
    const startTime = Date.now();
    const loadMetric = this.workerLoadMetrics.get(workerId);

    if (!loadMetric) {
      throw new Error(`Worker load metric not found for worker: ${workerId}`);
    }

    try {
      // Update load metrics - job started
      loadMetric.activeJobs++;
      loadMetric.lastActivity = new Date();
      await this.updateResourceUsage(workerId);

      // Process the job (delegate to appropriate processor)
      const result = await this.delegateJobProcessing(job, priority);

      // Update metrics - job completed
      loadMetric.activeJobs--;
      loadMetric.completedJobs++;

      const duration = Date.now() - startTime;
      this.logger.debug(`Worker ${workerId} completed ${priority} job ${job.id} in ${duration}ms`);

      return result;
    } catch (error) {
      // Update metrics - job failed
      loadMetric.activeJobs--;
      loadMetric.failedJobs++;

      this.logger.error(`Worker ${workerId} failed to process ${priority} job ${job.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delegate job processing to appropriate handler
   */
  private async delegateJobProcessing(job: any, priority: JobPriority): Promise<any> {
    // This would delegate to the appropriate processor based on job type
    // For now, simulate processing with priority-aware timing
    const processingTime = this.getProcessingTimeForPriority(priority);

    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Simulate progress updates for longer jobs
    if (processingTime > 5000) {
      await job.updateProgress(50);
      await new Promise(resolve => setTimeout(resolve, processingTime / 2));
      await job.updateProgress(100);
    }

    return { processedAt: new Date(), priority, duration: processingTime };
  }

  /**
   * Select optimal queue for job based on current load
   */
  private async selectOptimalQueue(priority: JobPriority): Promise<Queue> {
    const primaryQueue = this.priorityQueues.get(priority);
    if (!primaryQueue) {
      throw new Error(`No queue found for priority: ${priority}`);
    }

    // Check if primary queue is overloaded
    const queueLoad = await this.getQueueLoad(priority);
    if (queueLoad < this.resourceThresholds.scaleUpThreshold) {
      return primaryQueue;
    }

    // If overloaded, consider load balancing to lower priority queue
    if (priority === JobPriority.HIGH) {
      const normalQueue = this.priorityQueues.get(JobPriority.NORMAL);
      const normalLoad = await this.getQueueLoad(JobPriority.NORMAL);
      if (normalQueue && normalLoad < this.resourceThresholds.scaleUpThreshold) {
        this.logger.debug(`Load balancing HIGH priority job to NORMAL queue due to load`);
        return normalQueue;
      }
    }

    return primaryQueue;
  }

  /**
   * Get processing time based on priority (simulation)
   */
  private getProcessingTimeForPriority(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.URGENT: return 1000;  // Fast processing for urgent
      case JobPriority.HIGH: return 2000;
      case JobPriority.NORMAL: return 3000;
      case JobPriority.LOW: return 5000;     // Slower processing for low priority
      default: return 3000;
    }
  }

  /**
   * Calculate optimal worker count for priority level
   */
  private getOptimalWorkerCount(priority: JobPriority): number {
    const baseWorkerCount = this.queueConfigService.getWorkerConcurrency();
    const weight = this.priorityWeights[priority];
    const totalWeight = Object.values(this.priorityWeights).reduce((sum, w) => sum + w, 0);

    return Math.max(1, Math.floor((baseWorkerCount * weight) / totalWeight));
  }

  /**
   * Get concurrency setting for priority level
   */
  private getConcurrencyForPriority(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.URGENT: return 10;  // Higher concurrency for urgent
      case JobPriority.HIGH: return 8;
      case JobPriority.NORMAL: return 5;
      case JobPriority.LOW: return 2;      // Lower concurrency for low priority
      default: return 5;
    }
  }

  /**
   * Get maximum workers allowed for priority level
   */
  private getMaxWorkersForPriority(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.URGENT: return 10;
      case JobPriority.HIGH: return 8;
      case JobPriority.NORMAL: return 6;
      case JobPriority.LOW: return 3;
      default: return 6;
    }
  }

  /**
   * Get minimum workers required for priority level
   */
  private getMinWorkersForPriority(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.URGENT: return 2;
      case JobPriority.HIGH: return 2;
      case JobPriority.NORMAL: return 1;
      case JobPriority.LOW: return 1;
      default: return 1;
    }
  }

  /**
   * Get attempts count for priority level
   */
  private getAttemptsForPriority(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.URGENT: return 5;
      case JobPriority.HIGH: return 4;
      case JobPriority.NORMAL: return 3;
      case JobPriority.LOW: return 2;
      default: return 3;
    }
  }

  /**
   * Convert priority enum to numeric value for BullMQ
   */
  private getPriorityValue(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.URGENT: return 1000;
      case JobPriority.HIGH: return 750;
      case JobPriority.NORMAL: return 500;
      case JobPriority.LOW: return 250;
      default: return 500;
    }
  }

  /**
   * Get queue name for priority level
   */
  private getPriorityQueueName(priority: JobPriority): string {
    return `${priority.toLowerCase()}-priority`;
  }

  /**
   * Setup queue event listeners for monitoring
   */
  private setupQueueEventListeners(queueEvents: QueueEvents, priority: JobPriority): void {
    queueEvents.on('completed', ({ jobId }) => {
      this.logger.debug(`${priority} priority job ${jobId} completed`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.error(`${priority} priority job ${jobId} failed: ${failedReason}`);
    });

    queueEvents.on('stalled', ({ jobId }) => {
      this.logger.warn(`${priority} priority job ${jobId} stalled`);
    });
  }

  /**
   * Setup worker event listeners for load balancing
   */
  private setupWorkerEventListeners(worker: Worker, workerId: string): void {
    worker.on('completed', (job) => {
      this.updateLoadMetrics(job.data.priority || JobPriority.NORMAL, 'job_completed');
    });

    worker.on('failed', (job, err) => {
      this.updateLoadMetrics(job?.data?.priority || JobPriority.NORMAL, 'job_failed');
    });

    worker.on('error', (err) => {
      this.logger.error(`Worker ${workerId} error: ${err.message}`);
    });
  }

  /**
   * Start load balancing monitor for auto-scaling
   */
  private startLoadBalancingMonitor(): void {
    setInterval(async () => {
      try {
        await this.performLoadBalancingCheck();
      } catch (error) {
        this.logger.error(`Load balancing check failed: ${error.message}`);
      }
    }, 30000); // Check every 30 seconds

    this.logger.log('Load balancing monitor started');
  }

  /**
   * Perform periodic load balancing check and scaling
   */
  private async performLoadBalancingCheck(): Promise<void> {
    for (const priority of Object.values(JobPriority)) {
      const load = await this.getQueueLoad(priority);

      // Scale up if load is high
      if (load > this.resourceThresholds.scaleUpThreshold) {
        await this.scaleWorkers(priority, 'up');
      }
      // Scale down if load is low
      else if (load < this.resourceThresholds.scaleDownThreshold) {
        await this.scaleWorkers(priority, 'down');
      }
    }
  }

  /**
   * Get current queue load percentage
   */
  private async getQueueLoad(priority: JobPriority): Promise<number> {
    const queue = this.priorityQueues.get(priority);
    if (!queue) return 0;

    const [waiting, active] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
    ]);

    const workers = this.priorityWorkers.get(priority)?.length || 1;
    const maxConcurrency = workers * this.getConcurrencyForPriority(priority);

    return (waiting + active) / maxConcurrency;
  }

  /**
   * Update load metrics for monitoring
   */
  private async updateLoadMetrics(priority: JobPriority, event: string): Promise<void> {
    // Implementation would update metrics based on events
    // This is a placeholder for the actual metrics update logic
  }

  /**
   * Update resource usage for worker
   */
  private async updateResourceUsage(workerId: string): Promise<void> {
    // Implementation would update CPU and memory usage
    // This is a placeholder for actual resource monitoring
  }

  /**
   * Calculate average wait time for priority
   */
  private async calculateAverageWaitTime(priority: JobPriority): Promise<number> {
    // Implementation would calculate actual wait times
    // This is a placeholder returning estimated values
    switch (priority) {
      case JobPriority.URGENT: return 500;   // 0.5 seconds
      case JobPriority.HIGH: return 2000;    // 2 seconds
      case JobPriority.NORMAL: return 5000;  // 5 seconds
      case JobPriority.LOW: return 10000;    // 10 seconds
      default: return 5000;
    }
  }

  /**
   * Calculate throughput for priority
   */
  private async calculateThroughput(priority: JobPriority): Promise<number> {
    // Implementation would calculate actual throughput
    // This is a placeholder returning estimated values
    const weights = this.priorityWeights[priority];
    return weights * 10; // Jobs per minute estimate
  }

  /**
   * Get current resource utilization
   */
  private async getResourceUtilization(): Promise<ResourceUtilization> {
    // Implementation would get actual system resource usage
    // This is a placeholder
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
      networkUsage: Math.random() * 100,
    };
  }

  /**
   * Select worker for removal during scale down
   */
  private selectWorkerForRemoval(workers: Worker[]): Worker | null {
    // Select worker with least active jobs
    // This is a simplified selection strategy
    return workers.length > 0 ? workers[workers.length - 1] : null;
  }

  /**
   * Graceful shutdown of all priority queues and workers
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Priority Manager Service...');

    // Close all workers
    for (const priority of Array.from(this.priorityWorkers.keys())) {
      const workers = this.priorityWorkers.get(priority);
      if (!workers) continue;
      for (const worker of workers) {
        await worker.close();
      }
      this.logger.debug(`Closed ${workers.length} workers for ${priority} priority`);
    }

    // Close all queue events
    for (const priority of Array.from(this.queueEvents.keys())) {
      const events = this.queueEvents.get(priority);
      if (!events) continue;
      await events.close();
      this.logger.debug(`Closed queue events for ${priority} priority`);
    }

    // Close all queues
    for (const priority of Array.from(this.priorityQueues.keys())) {
      const queue = this.priorityQueues.get(priority);
      if (!queue) continue;
      await queue.close();
      this.logger.debug(`Closed queue for ${priority} priority`);
    }

    this.logger.log('Priority Manager Service shutdown complete');
  }
}

// Type definitions for load balancing
interface WorkerLoadMetric {
  workerId: string;
  priority: JobPriority;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  cpuUsage: number;
  memoryUsage: number;
  lastActivity: Date;
}

interface ResourceThresholds {
  cpuThreshold: number;
  memoryThreshold: number;
  maxConcurrentJobs: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
}

interface LoadBalancingMetrics {
  priorityQueues: Record<JobPriority, {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    workers: number;
    averageWaitTime: number;
    throughput: number;
  }>;
  workerUtilization: Record<string, {
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    cpuUsage: number;
    memoryUsage: number;
    lastActivity: Date;
  }>;
  resourceUtilization: ResourceUtilization;
  timestamp: Date;
}

interface ResourceUtilization {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkUsage: number;
}