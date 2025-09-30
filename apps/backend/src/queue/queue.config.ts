import { Injectable, Logger } from '@nestjs/common';
import { ConnectionOptions } from 'bullmq';
import { ApplicationConfigService } from '../config/config.service';
import { RedisConfig, QueueConfig } from '../config/config.schema';

/**
 * BullMQ Queue Configuration Service
 *
 * Provides centralized configuration for BullMQ queues with Redis connection.
 * Follows SOLID principles and leverages existing configuration patterns.
 *
 * Key Features:
 * - Type-safe Redis connection configuration
 * - Comprehensive retry policies and rate limiting
 * - Graceful connection failure handling
 * - Environment-specific queue settings
 * - Fail-fast validation on initialization
 */
@Injectable()
export class QueueConfigService {
  private readonly logger = new Logger(QueueConfigService.name);
  private readonly redisConfig: RedisConfig;
  private readonly queueConfig: QueueConfig;

  constructor(private readonly configService: ApplicationConfigService) {
    this.redisConfig = this.configService.getRedisConfig();
    this.queueConfig = this.configService.getQueueConfig();

    this.validateConfiguration();
    this.logger.log('Queue configuration initialized successfully');
  }

  /**
   * Get Redis connection configuration for BullMQ
   *
   * @returns Redis connection options with retry and timeout settings
   */
  getRedisConnection(): ConnectionOptions {
    return {
      host: this.redisConfig.host,
      port: this.redisConfig.port,
      password: this.redisConfig.password,
      db: this.redisConfig.db,

      // Connection resilience settings
      retryDelayOnFailover: this.redisConfig.retryDelayOnFailover,
      maxRetriesPerRequest: this.redisConfig.maxRetriesPerRequest,
      lazyConnect: this.redisConfig.lazyConnect,

      // Connection timeout and retry policies
      connectTimeout: 10000,
      commandTimeout: 5000,

      // Connection events handling
      enableOfflineQueue: false,
    };
  }

  /**
   * Get default job options for all queues
   *
   * @returns Default job configuration with retry and cleanup policies
   */
  getDefaultJobOptions() {
    return {
      attempts: this.queueConfig.defaultJobOptions.attempts,
      backoff: {
        type: this.queueConfig.defaultJobOptions.backoff.type,
        delay: this.queueConfig.defaultJobOptions.backoff.delay,
      },

      // Job lifecycle management
      removeOnComplete: this.queueConfig.defaultJobOptions.removeOnComplete,
      removeOnFail: this.queueConfig.defaultJobOptions.removeOnFail,

      // Job scheduling
      delay: this.queueConfig.defaultJobOptions.delay,
      priority: this.queueConfig.defaultJobOptions.priority,

      // Job identification
      jobId: this.queueConfig.defaultJobOptions.jobId,

      // Job timeout settings
      ttl: 60000, // 1 minute default TTL
      timeout: 300000, // 5 minutes default timeout
    };
  }

  /**
   * Get queue-specific settings
   *
   * @returns Queue settings for worker management and error handling
   */
  getQueueSettings() {
    return {
      stalledInterval: this.queueConfig.settings.stalledInterval,
      maxStalledCount: this.queueConfig.settings.maxStalledCount,
      retryProcessDelay: this.queueConfig.settings.retryProcessDelay,

      // Additional queue behavior settings
      removeDependencyOnFailure: true,
      skipVersionCheck: false,
    };
  }

  /**
   * Get rate limiting configuration
   *
   * @returns Rate limiter settings to prevent queue overload
   */
  getRateLimiterOptions() {
    return {
      max: this.queueConfig.limiter.max,
      duration: this.queueConfig.limiter.duration,

      // Additional rate limiting behavior
      bounceBack: false,
      groupKey: 'default',
    };
  }

  /**
   * Get worker concurrency settings
   *
   * @returns Worker concurrency configuration
   */
  getWorkerConcurrency(): number {
    return this.queueConfig.concurrency;
  }

  /**
   * Get environment-specific queue prefix
   *
   * @returns Queue name prefix based on environment
   */
  getQueuePrefix(): string {
    const env = this.configService.getNodeEnv();
    return `cc-task-manager-${env}`;
  }

  /**
   * Get complete queue configuration
   *
   * @param queueName Name of the queue
   * @returns Complete BullMQ queue configuration
   */
  getQueueConfiguration(queueName: string) {
    return {
      connection: this.getRedisConnection(),
      defaultJobOptions: this.getDefaultJobOptions(),

      // Queue naming with environment prefix
      prefix: `{${this.getQueuePrefix()}}`,

      // Additional queue options
      streams: {
        events: {
          maxLen: 1000,
        },
      },
    };
  }

  /**
   * Get worker configuration
   *
   * @param queueName Name of the queue
   * @returns Complete BullMQ worker configuration
   */
  getWorkerConfiguration(queueName: string) {
    return {
      connection: this.getRedisConnection(),
      concurrency: this.getWorkerConcurrency(),
      settings: this.getQueueSettings(),

      // Worker naming with environment prefix
      prefix: `{${this.getQueuePrefix()}}`,

      // Worker behavior options
      autorun: true,
      stalledInterval: this.queueConfig.settings.stalledInterval,
      maxStalledCount: this.queueConfig.settings.maxStalledCount,

      // Limiter configuration
      limiter: this.getRateLimiterOptions(),
    };
  }

  /**
   * Test Redis connectivity
   *
   * @returns Promise resolving to connection test result
   */
  async testConnection(): Promise<boolean> {
    try {
      // Use BullMQ's Queue to test Redis connectivity
      const { Queue } = await import('bullmq');
      const testQueue = new Queue('test-connection', {
        connection: this.getRedisConnection(),
      });

      // Test connection by getting queue info
      await testQueue.getWaiting();
      await testQueue.close();

      this.logger.log('Redis connection test successful');
      return true;
    } catch (error) {
      this.logger.error('Redis connection test failed:', error);
      return false;
    }
  }

  /**
   * Validate configuration on initialization
   *
   * @private
   */
  private validateConfiguration(): void {
    // Validate Redis configuration
    if (!this.redisConfig.host) {
      throw new Error('Redis host is required for queue configuration');
    }

    if (this.redisConfig.port < 1 || this.redisConfig.port > 65535) {
      throw new Error('Redis port must be between 1 and 65535');
    }

    // Validate queue configuration
    if (this.queueConfig.concurrency < 1) {
      throw new Error('Queue concurrency must be at least 1');
    }

    if (this.queueConfig.defaultJobOptions.attempts < 1) {
      throw new Error('Default job attempts must be at least 1');
    }

    // Validate rate limiting configuration
    if (this.queueConfig.limiter.max < 1) {
      throw new Error('Rate limiter max must be at least 1');
    }

    if (this.queueConfig.limiter.duration < 1000) {
      throw new Error('Rate limiter duration must be at least 1000ms');
    }

    this.logger.log('Queue configuration validation successful');
  }
}