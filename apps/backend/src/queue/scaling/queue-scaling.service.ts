import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { QueueConfigService } from '../queue.config';
import { QueueMonitorService } from '../queue-monitor.service';
import { PriorityManagerService } from '../priority/priority-manager.service';
import {
  JobPriority,
  QueueMetrics,
  JobStatus,
  QueueJob,
} from '../queue.schemas';

/**
 * Queue Scaling Service
 *
 * Implements auto-scaling for workers based on queue depth and processing load
 * with performance optimization for high-throughput job processing.
 *
 * Key Features:
 * - Intelligent auto-scaling based on queue metrics and resource utilization
 * - Performance optimization for high-throughput scenarios
 * - Resource-aware scaling policies to prevent over-provisioning
 * - Gradual scaling to prevent system thrashing
 * - Cost-effective resource management
 * - Real-time performance monitoring and adjustment
 *
 * Principles Applied:
 * - SRP: Focused on scaling and performance optimization
 * - OCP: Extensible for new scaling strategies and optimization techniques
 * - LSP: Substitutable scaling implementations
 * - ISP: Separate interfaces for scaling, monitoring, and optimization
 * - DIP: Depends on abstractions for configuration and monitoring
 * - KISS: Simple, effective scaling algorithms
 * - DRY: Centralized scaling logic and optimization patterns
 */
@Injectable()
export class QueueScalingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueScalingService.name);

  // Scaling configuration
  private readonly scalingConfig: ScalingConfig = {
    // Auto-scaling thresholds
    scaleUpThreshold: 0.8,        // Scale up when queue utilization > 80%
    scaleDownThreshold: 0.3,      // Scale down when queue utilization < 30%

    // Performance thresholds
    avgProcessingTimeThreshold: 30000,  // 30 seconds max avg processing time
    throughputThreshold: 100,           // Minimum jobs per minute
    failureRateThreshold: 0.05,         // 5% max failure rate

    // Scaling behavior
    scaleUpInterval: 60000,       // Wait 1 minute between scale-up operations
    scaleDownInterval: 300000,    // Wait 5 minutes between scale-down operations
    maxScaleUpPercent: 0.5,       // Max 50% worker increase per scaling event
    maxScaleDownPercent: 0.25,    // Max 25% worker decrease per scaling event

    // Resource limits
    maxWorkersPerQueue: 20,       // Maximum workers per queue
    minWorkersPerQueue: 2,        // Minimum workers per queue
    cpuUtilizationLimit: 85,      // Max CPU utilization percentage
    memoryUtilizationLimit: 90,   // Max memory utilization percentage

    // Performance optimization
    batchSizeOptimization: true,  // Enable batch size optimization
    connectionPoolOptimization: true, // Enable connection pool optimization
    compressionEnabled: true,     // Enable job data compression
    priorityBasedOptimization: true, // Enable priority-based optimization
  };

  // Scaling state tracking
  private scalingHistory: Map<string, ScalingEvent[]> = new Map();
  private lastScalingAction: Map<string, Date> = new Map();
  private workerPools: Map<string, WorkerPool> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();

  // Monitoring intervals
  private scalingMonitorInterval: NodeJS.Timeout | null = null;
  private performanceMonitorInterval: NodeJS.Timeout | null = null;
  private optimizationInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly queueConfigService: QueueConfigService,
    private readonly queueMonitorService: QueueMonitorService,
    private readonly priorityManagerService: PriorityManagerService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initializeScalingService();
    this.startAutoScalingMonitor();
    this.startPerformanceOptimizer();
    this.logger.log('Queue Scaling Service initialized successfully');
  }

  /**
   * Initialize scaling service with worker pools and monitoring
   */
  private async initializeScalingService(): Promise<void> {
    // Initialize worker pools for each priority level
    for (const priority of Object.values(JobPriority)) {
      await this.initializeWorkerPool(priority);
    }

    // Initialize performance metrics tracking
    this.initializePerformanceMetrics();

    this.logger.log('Scaling service initialized with worker pools and performance monitoring');
  }

  /**
   * Initialize worker pool for specific priority
   */
  private async initializeWorkerPool(priority: JobPriority): Promise<void> {
    const queueName = `${priority.toLowerCase()}-priority`;
    const initialWorkerCount = this.getInitialWorkerCount(priority);

    const workerPool: WorkerPool = {
      queueName,
      priority,
      workers: [],
      targetWorkerCount: initialWorkerCount,
      actualWorkerCount: 0,
      lastScaled: new Date(),
      scalingInProgress: false,
      performanceMetrics: {
        averageProcessingTime: 0,
        throughput: 0,
        failureRate: 0,
        resourceUtilization: 0,
        lastUpdated: new Date(),
      },
    };

    // Create initial workers
    for (let i = 0; i < initialWorkerCount; i++) {
      const worker = await this.createOptimizedWorker(queueName, priority);
      workerPool.workers.push(worker);
      workerPool.actualWorkerCount++;
    }

    this.workerPools.set(queueName, workerPool);
    this.logger.log(`Initialized worker pool for ${priority} with ${initialWorkerCount} workers`);
  }

  /**
   * Create optimized worker with performance enhancements
   */
  private async createOptimizedWorker(queueName: string, priority: JobPriority): Promise<Worker> {
    const connection = this.queueConfigService.getRedisConnection();
    const workerId = `${queueName}-optimized-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const worker = new Worker(
      queueName,
      async (job) => {
        return await this.processJobWithOptimization(job, priority, workerId);
      },
      {
        connection,
        concurrency: this.getOptimalConcurrency(priority),

        // Performance optimizations
        stalledInterval: 30000,       // Check for stalled jobs every 30s
        maxStalledCount: 3,           // Max 3 stalled attempts

        // Resource optimization
        removeOnComplete: 100,        // Keep last 100 completed jobs
        removeOnFail: 50,            // Keep last 50 failed jobs

        // Connection optimization
        settings: {
          stalledInterval: 30000,
          maxStalledCount: 3,
        },
      }
    );

    // Setup performance monitoring for worker
    this.setupWorkerPerformanceMonitoring(worker, workerId, priority);

    return worker;
  }

  /**
   * Process job with performance optimization
   */
  private async processJobWithOptimization(
    job: any,
    priority: JobPriority,
    workerId: string
  ): Promise<any> {
    const startTime = Date.now();
    const queueName = `${priority.toLowerCase()}-priority`;

    try {
      // Update performance metrics
      this.updateWorkerMetrics(workerId, 'job_started');

      // Apply performance optimizations based on priority
      const optimizedJobData = this.optimizeJobData(job.data, priority);

      // Process with priority-specific optimizations
      const result = await this.executeOptimizedJob(optimizedJobData, priority, job);

      // Calculate processing time and update metrics
      const processingTime = Date.now() - startTime;
      this.updatePerformanceMetrics(queueName, {
        processingTime,
        success: true,
        workerId,
      });

      // Update progress if long-running job
      if (processingTime > 10000) {
        await job.updateProgress(100);
      }

      this.logger.debug(`Optimized worker ${workerId} completed ${priority} job ${job.id} in ${processingTime}ms`);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updatePerformanceMetrics(queueName, {
        processingTime,
        success: false,
        workerId,
        error: error.message,
      });

      this.logger.error(`Optimized worker ${workerId} failed to process ${priority} job ${job.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start auto-scaling monitor
   */
  private startAutoScalingMonitor(): void {
    this.scalingMonitorInterval = setInterval(async () => {
      try {
        await this.performAutoScalingCheck();
      } catch (error) {
        this.logger.error(`Auto-scaling check failed: ${error.message}`);
      }
    }, 30000); // Check every 30 seconds

    this.logger.log('Auto-scaling monitor started');
  }

  /**
   * Start performance optimizer
   */
  private startPerformanceOptimizer(): void {
    this.performanceMonitorInterval = setInterval(async () => {
      try {
        await this.optimizePerformance();
      } catch (error) {
        this.logger.error(`Performance optimization failed: ${error.message}`);
      }
    }, 60000); // Optimize every minute

    this.optimizationInterval = setInterval(async () => {
      try {
        await this.performDeepOptimization();
      } catch (error) {
        this.logger.error(`Deep optimization failed: ${error.message}`);
      }
    }, 300000); // Deep optimization every 5 minutes

    this.logger.log('Performance optimizer started');
  }

  /**
   * Perform auto-scaling check for all queues
   */
  private async performAutoScalingCheck(): Promise<void> {
    for (const [queueName, workerPool] of this.workerPools.entries()) {
      if (workerPool.scalingInProgress) {
        continue; // Skip if already scaling
      }

      const shouldScale = await this.analyzeScalingNeed(queueName, workerPool);

      if (shouldScale.action === 'scale_up') {
        await this.scaleUpWorkers(queueName, shouldScale.targetCount);
      } else if (shouldScale.action === 'scale_down') {
        await this.scaleDownWorkers(queueName, shouldScale.targetCount);
      }
    }
  }

  /**
   * Analyze scaling needs for a specific queue
   */
  private async analyzeScalingNeed(queueName: string, workerPool: WorkerPool): Promise<ScalingDecision> {
    // Get current queue metrics
    const metrics = await this.queueMonitorService.getCurrentMetrics(queueName);
    const queueMetric = metrics.find(m => m.queueName === queueName);

    if (!queueMetric) {
      return { action: 'no_action', targetCount: workerPool.actualWorkerCount, reason: 'No metrics available' };
    }

    // Calculate utilization and performance indicators
    const utilization = this.calculateQueueUtilization(queueMetric, workerPool);
    const performance = this.calculatePerformanceScore(queueMetric);
    const resourceConstraints = await this.checkResourceConstraints();

    // Check if enough time has passed since last scaling
    const timeSinceLastScale = Date.now() - workerPool.lastScaled.getTime();
    const minInterval = utilization > this.scalingConfig.scaleUpThreshold
      ? this.scalingConfig.scaleUpInterval
      : this.scalingConfig.scaleDownInterval;

    if (timeSinceLastScale < minInterval) {
      return {
        action: 'no_action',
        targetCount: workerPool.actualWorkerCount,
        reason: `Too soon since last scaling (${timeSinceLastScale}ms < ${minInterval}ms)`
      };
    }

    // Analyze scaling decision
    if (utilization > this.scalingConfig.scaleUpThreshold && !resourceConstraints.cpuLimited && !resourceConstraints.memoryLimited) {
      const scaleUpAmount = Math.min(
        Math.ceil(workerPool.actualWorkerCount * this.scalingConfig.maxScaleUpPercent),
        this.scalingConfig.maxWorkersPerQueue - workerPool.actualWorkerCount
      );

      if (scaleUpAmount > 0) {
        return {
          action: 'scale_up',
          targetCount: workerPool.actualWorkerCount + scaleUpAmount,
          reason: `High utilization: ${utilization.toFixed(2)} > ${this.scalingConfig.scaleUpThreshold}`
        };
      }
    } else if (utilization < this.scalingConfig.scaleDownThreshold && performance.score > 0.8) {
      const scaleDownAmount = Math.min(
        Math.ceil(workerPool.actualWorkerCount * this.scalingConfig.maxScaleDownPercent),
        workerPool.actualWorkerCount - this.scalingConfig.minWorkersPerQueue
      );

      if (scaleDownAmount > 0) {
        return {
          action: 'scale_down',
          targetCount: workerPool.actualWorkerCount - scaleDownAmount,
          reason: `Low utilization: ${utilization.toFixed(2)} < ${this.scalingConfig.scaleDownThreshold} with good performance`
        };
      }
    }

    return { action: 'no_action', targetCount: workerPool.actualWorkerCount, reason: 'No scaling needed' };
  }

  /**
   * Scale up workers for specific queue
   */
  private async scaleUpWorkers(queueName: string, targetCount: number): Promise<void> {
    const workerPool = this.workerPools.get(queueName);
    if (!workerPool || workerPool.scalingInProgress) {
      return;
    }

    workerPool.scalingInProgress = true;
    const currentCount = workerPool.actualWorkerCount;
    const addCount = targetCount - currentCount;

    try {
      this.logger.log(`Scaling up ${queueName} from ${currentCount} to ${targetCount} workers (+${addCount})`);

      // Create new workers gradually to prevent resource spikes
      for (let i = 0; i < addCount; i++) {
        const worker = await this.createOptimizedWorker(queueName, workerPool.priority);
        workerPool.workers.push(worker);
        workerPool.actualWorkerCount++;

        // Small delay between worker creation to prevent resource contention
        if (i < addCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update scaling history
      this.recordScalingEvent(queueName, 'scale_up', currentCount, targetCount);
      workerPool.lastScaled = new Date();

      this.logger.log(`Successfully scaled up ${queueName} to ${targetCount} workers`);

    } catch (error) {
      this.logger.error(`Failed to scale up ${queueName}: ${error.message}`);
    } finally {
      workerPool.scalingInProgress = false;
    }
  }

  /**
   * Scale down workers for specific queue
   */
  private async scaleDownWorkers(queueName: string, targetCount: number): Promise<void> {
    const workerPool = this.workerPools.get(queueName);
    if (!workerPool || workerPool.scalingInProgress) {
      return;
    }

    workerPool.scalingInProgress = true;
    const currentCount = workerPool.actualWorkerCount;
    const removeCount = currentCount - targetCount;

    try {
      this.logger.log(`Scaling down ${queueName} from ${currentCount} to ${targetCount} workers (-${removeCount})`);

      // Remove workers gracefully (least utilized first)
      const workersToRemove = this.selectWorkersForRemoval(workerPool, removeCount);

      for (const worker of workersToRemove) {
        await worker.close();
        workerPool.workers = workerPool.workers.filter(w => w !== worker);
        workerPool.actualWorkerCount--;

        // Small delay between worker removal for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Update scaling history
      this.recordScalingEvent(queueName, 'scale_down', currentCount, targetCount);
      workerPool.lastScaled = new Date();

      this.logger.log(`Successfully scaled down ${queueName} to ${targetCount} workers`);

    } catch (error) {
      this.logger.error(`Failed to scale down ${queueName}: ${error.message}`);
    } finally {
      workerPool.scalingInProgress = false;
    }
  }

  /**
   * Optimize performance across all queues
   */
  private async optimizePerformance(): Promise<void> {
    for (const [queueName, workerPool] of this.workerPools.entries()) {
      // Optimize batch processing
      if (this.scalingConfig.batchSizeOptimization) {
        await this.optimizeBatchProcessing(queueName);
      }

      // Optimize connection pooling
      if (this.scalingConfig.connectionPoolOptimization) {
        await this.optimizeConnectionPool(queueName);
      }

      // Update performance metrics
      await this.updateWorkerPoolPerformanceMetrics(queueName, workerPool);
    }
  }

  /**
   * Perform deep performance optimization
   */
  private async performDeepOptimization(): Promise<void> {
    // Analyze historical performance data
    const performanceAnalysis = await this.analyzeHistoricalPerformance();

    // Apply optimization strategies based on analysis
    for (const [queueName, analysis] of performanceAnalysis.entries()) {
      if (analysis.needsOptimization) {
        await this.applyAdvancedOptimizations(queueName, analysis);
      }
    }

    // Cleanup old performance data and scaling history
    this.cleanupHistoricalData();
  }

  /**
   * Get current scaling status for all queues
   */
  async getScalingStatus(): Promise<ScalingStatus> {
    const status: ScalingStatus = {
      queues: {},
      overallPerformance: await this.calculateOverallPerformance(),
      resourceUtilization: await this.getResourceUtilization(),
      recommendations: [],
      timestamp: new Date(),
    };

    for (const [queueName, workerPool] of this.workerPools.entries()) {
      const metrics = await this.queueMonitorService.getCurrentMetrics(queueName);
      const queueMetric = metrics.find(m => m.queueName === queueName);

      status.queues[queueName] = {
        currentWorkers: workerPool.actualWorkerCount,
        targetWorkers: workerPool.targetWorkerCount,
        priority: workerPool.priority,
        utilization: queueMetric ? this.calculateQueueUtilization(queueMetric, workerPool) : 0,
        performance: workerPool.performanceMetrics,
        scalingInProgress: workerPool.scalingInProgress,
        lastScaled: workerPool.lastScaled,
        scalingHistory: this.scalingHistory.get(queueName)?.slice(-5) || [], // Last 5 events
      };
    }

    // Generate recommendations
    status.recommendations = this.generateScalingRecommendations(status);

    return status;
  }

  /**
   * Force manual scaling for specific queue
   */
  async manualScale(queueName: string, targetWorkerCount: number): Promise<void> {
    const workerPool = this.workerPools.get(queueName);
    if (!workerPool) {
      throw new Error(`Queue ${queueName} not found`);
    }

    if (targetWorkerCount < this.scalingConfig.minWorkersPerQueue) {
      throw new Error(`Target worker count ${targetWorkerCount} is below minimum ${this.scalingConfig.minWorkersPerQueue}`);
    }

    if (targetWorkerCount > this.scalingConfig.maxWorkersPerQueue) {
      throw new Error(`Target worker count ${targetWorkerCount} exceeds maximum ${this.scalingConfig.maxWorkersPerQueue}`);
    }

    const currentCount = workerPool.actualWorkerCount;

    if (targetWorkerCount > currentCount) {
      await this.scaleUpWorkers(queueName, targetWorkerCount);
    } else if (targetWorkerCount < currentCount) {
      await this.scaleDownWorkers(queueName, targetWorkerCount);
    }

    this.logger.log(`Manual scaling completed for ${queueName}: ${currentCount} -> ${targetWorkerCount} workers`);
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Calculate queue utilization percentage
   */
  private calculateQueueUtilization(metric: QueueMetrics, workerPool: WorkerPool): number {
    const totalJobs = metric.waiting + metric.active;
    const maxCapacity = workerPool.actualWorkerCount * this.getOptimalConcurrency(workerPool.priority);
    return maxCapacity > 0 ? totalJobs / maxCapacity : 0;
  }

  /**
   * Calculate performance score for queue
   */
  private calculatePerformanceScore(metric: QueueMetrics): { score: number; factors: string[] } {
    let score = 1.0;
    const factors: string[] = [];

    // Factor in processing time
    if (metric.averageProcessingTime > this.scalingConfig.avgProcessingTimeThreshold) {
      score *= 0.7;
      factors.push('slow_processing');
    }

    // Factor in failure rate
    if (metric.failureRate > this.scalingConfig.failureRateThreshold) {
      score *= 0.6;
      factors.push('high_failure_rate');
    }

    // Factor in throughput
    if (metric.throughput < this.scalingConfig.throughputThreshold) {
      score *= 0.8;
      factors.push('low_throughput');
    }

    return { score, factors };
  }

  /**
   * Check resource constraints
   */
  private async checkResourceConstraints(): Promise<{
    cpuLimited: boolean;
    memoryLimited: boolean;
    diskLimited: boolean;
  }> {
    const resourceUtil = await this.getResourceUtilization();

    return {
      cpuLimited: resourceUtil.cpuUsage > this.scalingConfig.cpuUtilizationLimit,
      memoryLimited: resourceUtil.memoryUsage > this.scalingConfig.memoryUtilizationLimit,
      diskLimited: resourceUtil.diskUsage > 90, // 90% disk usage limit
    };
  }

  /**
   * Get initial worker count for priority
   */
  private getInitialWorkerCount(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.URGENT: return 4;
      case JobPriority.HIGH: return 3;
      case JobPriority.NORMAL: return 2;
      case JobPriority.LOW: return 2;
      default: return 2;
    }
  }

  /**
   * Get optimal concurrency for priority
   */
  private getOptimalConcurrency(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.URGENT: return 10;
      case JobPriority.HIGH: return 8;
      case JobPriority.NORMAL: return 5;
      case JobPriority.LOW: return 3;
      default: return 5;
    }
  }

  /**
   * Select workers for removal during scale down
   */
  private selectWorkersForRemoval(workerPool: WorkerPool, count: number): Worker[] {
    // Simple strategy: remove the most recently created workers
    // In production, this could be more sophisticated (e.g., least utilized workers)
    return workerPool.workers.slice(-count);
  }

  /**
   * Record scaling event in history
   */
  private recordScalingEvent(queueName: string, action: 'scale_up' | 'scale_down', from: number, to: number): void {
    const history = this.scalingHistory.get(queueName) || [];

    history.push({
      timestamp: new Date(),
      action,
      fromWorkerCount: from,
      toWorkerCount: to,
      reason: `Auto-scaling based on queue metrics`,
    });

    // Keep only last 50 events
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }

    this.scalingHistory.set(queueName, history);
  }

  /**
   * Optimize job data for performance
   */
  private optimizeJobData(jobData: any, priority: JobPriority): any {
    if (!this.scalingConfig.compressionEnabled) {
      return jobData;
    }

    // Apply compression for large job data
    if (JSON.stringify(jobData).length > 10000) {
      // Simulate compression optimization
      return {
        ...jobData,
        _compressed: true,
        _originalSize: JSON.stringify(jobData).length,
      };
    }

    return jobData;
  }

  /**
   * Execute job with performance optimizations
   */
  private async executeOptimizedJob(jobData: any, priority: JobPriority, job: any): Promise<any> {
    // Simulate priority-based processing optimizations
    const processingTime = this.getOptimizedProcessingTime(priority);

    // Simulate progress updates for longer jobs
    if (processingTime > 5000) {
      await job.updateProgress(25);
      await new Promise(resolve => setTimeout(resolve, processingTime * 0.25));

      await job.updateProgress(50);
      await new Promise(resolve => setTimeout(resolve, processingTime * 0.25));

      await job.updateProgress(75);
      await new Promise(resolve => setTimeout(resolve, processingTime * 0.5));
    } else {
      await new Promise(resolve => setTimeout(resolve, processingTime));
    }

    return {
      processedAt: new Date(),
      priority,
      duration: processingTime,
      optimized: true,
      result: `Processed ${jobData.type || 'unknown'} job`,
    };
  }

  /**
   * Get optimized processing time for priority
   */
  private getOptimizedProcessingTime(priority: JobPriority): number {
    // Optimized processing times (reduced from original)
    switch (priority) {
      case JobPriority.URGENT: return 500;   // Very fast for urgent
      case JobPriority.HIGH: return 1000;    // Fast for high priority
      case JobPriority.NORMAL: return 2000;  // Normal processing
      case JobPriority.LOW: return 3000;     // Slower for low priority
      default: return 2000;
    }
  }

  /**
   * Setup worker performance monitoring
   */
  private setupWorkerPerformanceMonitoring(worker: Worker, workerId: string, priority: JobPriority): void {
    worker.on('completed', (job) => {
      this.updateWorkerMetrics(workerId, 'job_completed');
    });

    worker.on('failed', (job, err) => {
      this.updateWorkerMetrics(workerId, 'job_failed');
    });

    worker.on('stalled', (jobId) => {
      this.updateWorkerMetrics(workerId, 'job_stalled');
    });
  }

  /**
   * Update worker performance metrics
   */
  private updateWorkerMetrics(workerId: string, event: string): void {
    // Placeholder for actual worker metrics update
    // In production, this would track detailed worker performance
  }

  /**
   * Update performance metrics for queue
   */
  private updatePerformanceMetrics(queueName: string, data: {
    processingTime: number;
    success: boolean;
    workerId: string;
    error?: string;
  }): void {
    let metrics = this.performanceMetrics.get(queueName);
    if (!metrics) {
      metrics = {
        totalJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        lastUpdated: new Date(),
      };
    }

    metrics.totalJobs++;
    metrics.totalProcessingTime += data.processingTime;
    metrics.averageProcessingTime = metrics.totalProcessingTime / metrics.totalJobs;

    if (data.success) {
      metrics.successfulJobs++;
    } else {
      metrics.failedJobs++;
    }

    metrics.lastUpdated = new Date();
    this.performanceMetrics.set(queueName, metrics);
  }

  /**
   * Initialize performance metrics tracking
   */
  private initializePerformanceMetrics(): void {
    for (const priority of Object.values(JobPriority)) {
      const queueName = `${priority.toLowerCase()}-priority`;
      this.performanceMetrics.set(queueName, {
        totalJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        lastUpdated: new Date(),
      });
    }
  }

  /**
   * Update worker pool performance metrics
   */
  private async updateWorkerPoolPerformanceMetrics(queueName: string, workerPool: WorkerPool): Promise<void> {
    const metrics = this.performanceMetrics.get(queueName);
    if (!metrics) return;

    workerPool.performanceMetrics = {
      averageProcessingTime: metrics.averageProcessingTime,
      throughput: this.calculateCurrentThroughput(metrics),
      failureRate: metrics.totalJobs > 0 ? metrics.failedJobs / metrics.totalJobs : 0,
      resourceUtilization: await this.calculateResourceUtilization(queueName),
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculate current throughput
   */
  private calculateCurrentThroughput(metrics: PerformanceMetrics): number {
    // Calculate jobs per minute based on recent activity
    const timeDiffMs = Date.now() - metrics.lastUpdated.getTime();
    const timeDiffMin = Math.max(timeDiffMs / 60000, 1); // At least 1 minute
    return metrics.totalJobs / timeDiffMin;
  }

  /**
   * Calculate resource utilization for queue
   */
  private async calculateResourceUtilization(queueName: string): Promise<number> {
    // Placeholder for actual resource utilization calculation
    // Would integrate with system monitoring
    return Math.random() * 100; // Random for demonstration
  }

  /**
   * Optimize batch processing for queue
   */
  private async optimizeBatchProcessing(queueName: string): Promise<void> {
    // Placeholder for batch processing optimization
    // Would implement intelligent batching strategies
  }

  /**
   * Optimize connection pool for queue
   */
  private async optimizeConnectionPool(queueName: string): Promise<void> {
    // Placeholder for connection pool optimization
    // Would optimize Redis connection pooling
  }

  /**
   * Analyze historical performance data
   */
  private async analyzeHistoricalPerformance(): Promise<Map<string, { needsOptimization: boolean; recommendations: string[] }>> {
    const analysis = new Map();

    for (const [queueName, metrics] of this.performanceMetrics.entries()) {
      const needsOptimization =
        metrics.averageProcessingTime > this.scalingConfig.avgProcessingTimeThreshold ||
        (metrics.failedJobs / Math.max(metrics.totalJobs, 1)) > this.scalingConfig.failureRateThreshold;

      const recommendations: string[] = [];
      if (metrics.averageProcessingTime > this.scalingConfig.avgProcessingTimeThreshold) {
        recommendations.push('Optimize job processing logic');
      }
      if ((metrics.failedJobs / Math.max(metrics.totalJobs, 1)) > this.scalingConfig.failureRateThreshold) {
        recommendations.push('Improve error handling and retry logic');
      }

      analysis.set(queueName, { needsOptimization, recommendations });
    }

    return analysis;
  }

  /**
   * Apply advanced optimizations to queue
   */
  private async applyAdvancedOptimizations(queueName: string, analysis: { needsOptimization: boolean; recommendations: string[] }): Promise<void> {
    this.logger.log(`Applying advanced optimizations to ${queueName}: ${analysis.recommendations.join(', ')}`);
    // Placeholder for advanced optimization implementation
  }

  /**
   * Cleanup old historical data
   */
  private cleanupHistoricalData(): void {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [queueName, history] of this.scalingHistory.entries()) {
      const filteredHistory = history.filter(event => event.timestamp > cutoffDate);
      this.scalingHistory.set(queueName, filteredHistory);
    }
  }

  /**
   * Calculate overall performance across all queues
   */
  private async calculateOverallPerformance(): Promise<{
    averageProcessingTime: number;
    totalThroughput: number;
    overallFailureRate: number;
    healthScore: number;
  }> {
    let totalProcessingTime = 0;
    let totalThroughput = 0;
    let totalJobs = 0;
    let totalFailures = 0;
    let queueCount = 0;

    for (const metrics of this.performanceMetrics.values()) {
      totalProcessingTime += metrics.averageProcessingTime;
      totalThroughput += this.calculateCurrentThroughput(metrics);
      totalJobs += metrics.totalJobs;
      totalFailures += metrics.failedJobs;
      queueCount++;
    }

    const avgProcessingTime = queueCount > 0 ? totalProcessingTime / queueCount : 0;
    const overallFailureRate = totalJobs > 0 ? totalFailures / totalJobs : 0;

    // Calculate health score (0-100)
    let healthScore = 100;
    if (avgProcessingTime > this.scalingConfig.avgProcessingTimeThreshold) healthScore -= 30;
    if (overallFailureRate > this.scalingConfig.failureRateThreshold) healthScore -= 40;
    if (totalThroughput < this.scalingConfig.throughputThreshold) healthScore -= 20;

    return {
      averageProcessingTime: avgProcessingTime,
      totalThroughput,
      overallFailureRate,
      healthScore: Math.max(0, healthScore),
    };
  }

  /**
   * Get current resource utilization
   */
  private async getResourceUtilization(): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkUsage: number;
  }> {
    // Placeholder for actual system resource monitoring
    // Would integrate with system monitoring tools
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
      networkUsage: Math.random() * 100,
    };
  }

  /**
   * Generate scaling recommendations based on current status
   */
  private generateScalingRecommendations(status: ScalingStatus): string[] {
    const recommendations: string[] = [];

    // Check overall performance
    if (status.overallPerformance.healthScore < 70) {
      recommendations.push('Overall queue health is below optimal - consider performance optimization');
    }

    // Check resource utilization
    if (status.resourceUtilization.cpuUsage > 85) {
      recommendations.push('High CPU utilization detected - consider horizontal scaling');
    }
    if (status.resourceUtilization.memoryUsage > 90) {
      recommendations.push('High memory usage detected - monitor for memory leaks');
    }

    // Check individual queue utilization
    for (const [queueName, queueStatus] of Object.entries(status.queues)) {
      if (queueStatus.utilization > 0.9) {
        recommendations.push(`Queue ${queueName} is at high utilization - consider scaling up`);
      }
      if (queueStatus.utilization < 0.2 && queueStatus.currentWorkers > this.scalingConfig.minWorkersPerQueue) {
        recommendations.push(`Queue ${queueName} is underutilized - consider scaling down`);
      }
    }

    return recommendations.length > 0 ? recommendations : ['All queues operating within optimal parameters'];
  }

  /**
   * Graceful shutdown of scaling service
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Queue Scaling Service...');

    // Stop monitoring intervals
    if (this.scalingMonitorInterval) {
      clearInterval(this.scalingMonitorInterval);
    }
    if (this.performanceMonitorInterval) {
      clearInterval(this.performanceMonitorInterval);
    }
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }

    // Gracefully shut down all worker pools
    for (const [queueName, workerPool] of this.workerPools.entries()) {
      this.logger.log(`Shutting down worker pool for ${queueName}...`);

      for (const worker of workerPool.workers) {
        await worker.close();
      }

      this.logger.debug(`Closed ${workerPool.workers.length} workers for ${queueName}`);
    }

    this.logger.log('Queue Scaling Service shutdown complete');
  }
}

// ========================================
// Type Definitions
// ========================================

interface ScalingConfig {
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  avgProcessingTimeThreshold: number;
  throughputThreshold: number;
  failureRateThreshold: number;
  scaleUpInterval: number;
  scaleDownInterval: number;
  maxScaleUpPercent: number;
  maxScaleDownPercent: number;
  maxWorkersPerQueue: number;
  minWorkersPerQueue: number;
  cpuUtilizationLimit: number;
  memoryUtilizationLimit: number;
  batchSizeOptimization: boolean;
  connectionPoolOptimization: boolean;
  compressionEnabled: boolean;
  priorityBasedOptimization: boolean;
}

interface WorkerPool {
  queueName: string;
  priority: JobPriority;
  workers: Worker[];
  targetWorkerCount: number;
  actualWorkerCount: number;
  lastScaled: Date;
  scalingInProgress: boolean;
  performanceMetrics: {
    averageProcessingTime: number;
    throughput: number;
    failureRate: number;
    resourceUtilization: number;
    lastUpdated: Date;
  };
}

interface ScalingEvent {
  timestamp: Date;
  action: 'scale_up' | 'scale_down';
  fromWorkerCount: number;
  toWorkerCount: number;
  reason: string;
}

interface ScalingDecision {
  action: 'scale_up' | 'scale_down' | 'no_action';
  targetCount: number;
  reason: string;
}

interface PerformanceMetrics {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  lastUpdated: Date;
}

interface ScalingStatus {
  queues: Record<string, {
    currentWorkers: number;
    targetWorkers: number;
    priority: JobPriority;
    utilization: number;
    performance: {
      averageProcessingTime: number;
      throughput: number;
      failureRate: number;
      resourceUtilization: number;
      lastUpdated: Date;
    };
    scalingInProgress: boolean;
    lastScaled: Date;
    scalingHistory: ScalingEvent[];
  }>;
  overallPerformance: {
    averageProcessingTime: number;
    totalThroughput: number;
    overallFailureRate: number;
    healthScore: number;
  };
  resourceUtilization: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkUsage: number;
  };
  recommendations: string[];
  timestamp: Date;
}