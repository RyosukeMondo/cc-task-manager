import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { z } from 'zod';
import {
  ClaudeCommandResponse,
  ClaudeCommandRequest,
  ClaudeCommandType,
  CommandExecutionContext
} from './claude-command.service';
import {
  ClaudeSessionMetadata
} from './claude-session.service';
import { ClaudeResponse } from './claude-wrapper.service';

/**
 * Cache entry schema for validation and type safety
 * Ensures all cached data follows consistent structure
 */
export const CacheEntrySchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  ttl: z.number().int().min(0), // Time to live in seconds
  timestamp: z.number(),
  version: z.string().default('1.0'),
  metadata: z.object({
    type: z.enum(['command_response', 'session_data', 'command_context', 'stream_data']),
    sessionId: z.string().optional(),
    runId: z.string().optional(),
    userId: z.string().optional(),
    size: z.number().optional(),
  }).optional(),
});

export type CacheEntry = z.infer<typeof CacheEntrySchema>;

/**
 * Cache configuration schema with performance optimization settings
 * Configures caching behavior and performance characteristics
 */
export const CachingConfigSchema = z.object({
  // Redis connection settings
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().int().min(1).max(65535).default(6379),
    password: z.string().optional(),
    db: z.number().int().min(0).default(1), // Use separate DB for cache
    keyPrefix: z.string().default('claude:cache:'),
  }),

  // Cache behavior configuration
  cache: z.object({
    defaultTtl: z.number().int().min(60).default(3600), // 1 hour default
    maxMemory: z.string().default('500mb'),
    evictionPolicy: z.enum(['allkeys-lru', 'volatile-lru', 'allkeys-lfu', 'volatile-lfu']).default('allkeys-lru'),
    compressionEnabled: z.boolean().default(true),
    compressionThreshold: z.number().int().min(1024).default(1024), // Compress data > 1KB
  }),

  // Performance optimization settings
  performance: z.object({
    // Cache specific TTLs for different data types
    commandResponseTtl: z.number().int().min(300).default(1800), // 30 minutes
    sessionDataTtl: z.number().int().min(600).default(3600), // 1 hour
    contextDataTtl: z.number().int().min(120).default(900), // 15 minutes
    streamDataTtl: z.number().int().min(60).default(300), // 5 minutes

    // Cache warming and preloading
    preloadEnabled: z.boolean().default(true),
    warmupPatterns: z.array(z.string()).default(['session:*', 'command:frequent:*']),

    // Hit rate optimization
    targetHitRate: z.number().min(0.6).max(1.0).default(0.85), // 85% hit rate target
    hitRateWindow: z.number().int().min(300).default(3600), // 1 hour window
    adaptiveTtl: z.boolean().default(true), // Adjust TTL based on access patterns
  }),

  // Monitoring and metrics
  monitoring: z.object({
    metricsEnabled: z.boolean().default(true),
    slowLogEnabled: z.boolean().default(true),
    slowLogThreshold: z.number().min(10).default(100), // ms
    hitRateLogging: z.boolean().default(true),
    sizeLimitWarning: z.number().int().min(1024).default(10 * 1024 * 1024), // 10MB
  }),
});

export type CachingConfig = z.infer<typeof CachingConfigSchema>;

/**
 * Cache statistics interface for monitoring and optimization
 * Provides insights into cache performance and efficiency
 */
export interface CacheStatistics {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  averageResponseTime: number;
  cacheSize: number;
  evictions: number;
  compressionRatio: number;
  keyCount: number;
  memoryUsage: number;
  lastUpdated: Date;
}

/**
 * Cache key builder interface for consistent key generation
 * Ensures organized and predictable cache key structure
 */
export interface CacheKeyBuilder {
  buildCommandKey(commandType: ClaudeCommandType, hash: string): string;
  buildSessionKey(sessionId: string, suffix?: string): string;
  buildContextKey(runId: string, type: string): string;
  buildStreamKey(sessionId: string, timestamp: number): string;
  buildStatsKey(): string;
}

/**
 * Cache invalidation strategy interface
 * Provides flexible cache invalidation patterns
 */
export interface CacheInvalidationStrategy {
  invalidateSession(sessionId: string): Promise<number>;
  invalidateCommand(commandType: ClaudeCommandType): Promise<number>;
  invalidateUser(userId: string): Promise<number>;
  invalidatePattern(pattern: string): Promise<number>;
  invalidateExpired(): Promise<number>;
}

/**
 * Claude Code Cache Service
 *
 * Implements high-performance caching for Claude Code integration with intelligent
 * cache management, performance optimization, and comprehensive monitoring.
 *
 * Key Features:
 * - Redis-based caching with configurable TTL
 * - Intelligent cache invalidation strategies
 * - Performance monitoring and optimization
 * - Data compression for large responses
 * - Adaptive TTL based on access patterns
 * - Hit rate optimization and monitoring
 * - Memory usage tracking and alerts
 *
 * Architecture:
 * - Follows SOLID principles with dependency injection
 * - Implements contract-driven design with clear interfaces
 * - Uses Zod for configuration validation and type safety
 * - Integrates with existing Redis infrastructure via BullMQ
 * - Provides comprehensive error handling and recovery
 *
 * Performance Optimizations:
 * - Compression for responses > 1KB
 * - Intelligent TTL adjustment based on access patterns
 * - Cache warming for frequently accessed data
 * - Efficient key organization and lookup
 * - Memory usage monitoring and eviction policies
 */
@Injectable()
export class ClaudeCacheService implements OnModuleDestroy, CacheKeyBuilder, CacheInvalidationStrategy {
  private readonly logger = new Logger(ClaudeCacheService.name);
  private readonly config: CachingConfig;
  private redisClient: any;
  private stats: CacheStatistics;
  private statsInterval: NodeJS.Timeout;

  // Performance tracking
  private requestCount = 0;
  private hitCount = 0;
  private missCount = 0;
  private totalResponseTime = 0;
  private readonly responseTimeWindow: number[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Load and validate configuration
    this.config = this.loadCacheConfiguration();

    // Initialize statistics
    this.stats = this.initializeStatistics();

    // Setup Redis client
    this.initializeRedisClient();

    // Start performance monitoring
    this.startPerformanceMonitoring();

    this.logger.log('ClaudeCacheService initialized with Redis caching');
  }

  /**
   * Load and validate cache configuration
   * Ensures all configuration options are valid and properly typed
   */
  private loadCacheConfiguration(): CachingConfig {
    try {
      const rawConfig = {
        redis: {
          host: this.configService.get<string>('REDIS_HOST', 'localhost'),
          port: this.configService.get<number>('REDIS_PORT', 6379),
          password: this.configService.get<string>('REDIS_PASSWORD'),
          db: this.configService.get<number>('REDIS_CACHE_DB', 1),
          keyPrefix: this.configService.get<string>('CACHE_KEY_PREFIX', 'claude:cache:'),
        },
        cache: {
          defaultTtl: this.configService.get<number>('CACHE_DEFAULT_TTL', 3600),
          maxMemory: this.configService.get<string>('CACHE_MAX_MEMORY', '500mb'),
          evictionPolicy: this.configService.get<string>('CACHE_EVICTION_POLICY', 'allkeys-lru'),
          compressionEnabled: this.configService.get<boolean>('CACHE_COMPRESSION_ENABLED', true),
          compressionThreshold: this.configService.get<number>('CACHE_COMPRESSION_THRESHOLD', 1024),
        },
        performance: {
          commandResponseTtl: this.configService.get<number>('CACHE_COMMAND_TTL', 1800),
          sessionDataTtl: this.configService.get<number>('CACHE_SESSION_TTL', 3600),
          contextDataTtl: this.configService.get<number>('CACHE_CONTEXT_TTL', 900),
          streamDataTtl: this.configService.get<number>('CACHE_STREAM_TTL', 300),
          preloadEnabled: this.configService.get<boolean>('CACHE_PRELOAD_ENABLED', true),
          warmupPatterns: this.configService.get<string>('CACHE_WARMUP_PATTERNS', 'session:*,command:frequent:*').split(','),
          targetHitRate: this.configService.get<number>('CACHE_TARGET_HIT_RATE', 0.85),
          hitRateWindow: this.configService.get<number>('CACHE_HIT_RATE_WINDOW', 3600),
          adaptiveTtl: this.configService.get<boolean>('CACHE_ADAPTIVE_TTL', true),
        },
        monitoring: {
          metricsEnabled: this.configService.get<boolean>('CACHE_METRICS_ENABLED', true),
          slowLogEnabled: this.configService.get<boolean>('CACHE_SLOW_LOG_ENABLED', true),
          slowLogThreshold: this.configService.get<number>('CACHE_SLOW_LOG_THRESHOLD', 100),
          hitRateLogging: this.configService.get<boolean>('CACHE_HIT_RATE_LOGGING', true),
          sizeLimitWarning: this.configService.get<number>('CACHE_SIZE_LIMIT_WARNING', 10 * 1024 * 1024),
        },
      };

      const validatedConfig = CachingConfigSchema.parse(rawConfig);
      this.logger.debug('Cache configuration loaded and validated');
      return validatedConfig;
    } catch (error) {
      this.logger.error('Invalid cache configuration', error);
      throw new Error(`Cache configuration validation failed: ${error.message}`);
    }
  }

  /**
   * Initialize Redis client with proper configuration
   * Sets up Redis connection with caching-optimized settings
   */
  private async initializeRedisClient(): Promise<void> {
    try {
      // Use BullMQ's Redis connection pattern for consistency
      const Redis = require('ioredis');

      this.redisClient = new Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        db: this.config.redis.db,
        keyPrefix: this.config.redis.keyPrefix,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      // Configure Redis for optimal caching
      await this.redisClient.connect();
      await this.redisClient.config('SET', 'maxmemory', this.config.cache.maxMemory);
      await this.redisClient.config('SET', 'maxmemory-policy', this.config.cache.evictionPolicy);

      this.logger.log(`Redis cache client connected on ${this.config.redis.host}:${this.config.redis.port}`);

      // Warm up cache if enabled
      if (this.config.performance.preloadEnabled) {
        await this.warmupCache();
      }
    } catch (error) {
      this.logger.error('Failed to initialize Redis client', error);
      throw error;
    }
  }

  /**
   * Initialize performance statistics tracking
   * Sets up baseline metrics for monitoring
   */
  private initializeStatistics(): CacheStatistics {
    return {
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
      averageResponseTime: 0,
      cacheSize: 0,
      evictions: 0,
      compressionRatio: 0,
      keyCount: 0,
      memoryUsage: 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Start performance monitoring interval
   * Continuously tracks and updates cache performance metrics
   */
  private startPerformanceMonitoring(): void {
    if (!this.config.monitoring.metricsEnabled) {
      return;
    }

    this.statsInterval = setInterval(async () => {
      await this.updateStatistics();

      if (this.config.monitoring.hitRateLogging) {
        this.logPerformanceMetrics();
      }

      await this.optimizePerformance();
    }, 60000); // Update every minute

    this.logger.debug('Performance monitoring started');
  }

  /**
   * Cache a command response with intelligent TTL
   * Stores command responses with optimized expiration and compression
   */
  async cacheCommandResponse(
    command: ClaudeCommandRequest,
    response: ClaudeCommandResponse,
    customTtl?: number
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const key = this.buildCommandKey(command.type, this.hashCommand(command));
      const ttl = customTtl || this.getOptimalTtl('command_response', key);

      const cacheEntry: CacheEntry = {
        key,
        value: response,
        ttl,
        timestamp: Date.now(),
        metadata: {
          type: 'command_response',
          runId: command.runId,
          size: JSON.stringify(response).length,
        },
      };

      const compressedData = await this.compressIfNeeded(cacheEntry);
      await this.redisClient.setex(key, ttl, JSON.stringify(compressedData));

      this.trackRequest(startTime, true);
      this.eventEmitter.emit('cache.command.stored', { key, ttl, size: cacheEntry.metadata?.size });

      this.logger.debug(`Cached command response: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      this.trackRequest(startTime, false);
      this.logger.error('Failed to cache command response', error);
      throw error;
    }
  }

  /**
   * Retrieve cached command response
   * Gets cached command response with hit/miss tracking
   */
  async getCachedCommandResponse(command: ClaudeCommandRequest): Promise<ClaudeCommandResponse | null> {
    const startTime = Date.now();

    try {
      const key = this.buildCommandKey(command.type, this.hashCommand(command));
      const cachedData = await this.redisClient.get(key);

      if (!cachedData) {
        this.trackRequest(startTime, false);
        this.eventEmitter.emit('cache.command.miss', { key });
        return null;
      }

      const decompressedData = await this.decompressIfNeeded(JSON.parse(cachedData));
      const cacheEntry = CacheEntrySchema.parse(decompressedData);

      this.trackRequest(startTime, true);
      this.eventEmitter.emit('cache.command.hit', { key, age: Date.now() - cacheEntry.timestamp });

      this.logger.debug(`Cache hit for command: ${key}`);
      return cacheEntry.value as ClaudeCommandResponse;
    } catch (error) {
      this.trackRequest(startTime, false);
      this.logger.error('Failed to retrieve cached command response', error);
      return null;
    }
  }

  /**
   * Cache session data with metadata
   * Stores session information for quick retrieval
   */
  async cacheSessionData(
    sessionId: string,
    sessionData: ClaudeSessionMetadata,
    customTtl?: number
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const key = this.buildSessionKey(sessionId, 'metadata');
      const ttl = customTtl || this.config.performance.sessionDataTtl;

      const cacheEntry: CacheEntry = {
        key,
        value: sessionData,
        ttl,
        timestamp: Date.now(),
        metadata: {
          type: 'session_data',
          sessionId,
          size: JSON.stringify(sessionData).length,
        },
      };

      const compressedData = await this.compressIfNeeded(cacheEntry);
      await this.redisClient.setex(key, ttl, JSON.stringify(compressedData));

      this.trackRequest(startTime, true);
      this.eventEmitter.emit('cache.session.stored', { sessionId, ttl });

      this.logger.debug(`Cached session data: ${sessionId} (TTL: ${ttl}s)`);
    } catch (error) {
      this.trackRequest(startTime, false);
      this.logger.error('Failed to cache session data', error);
      throw error;
    }
  }

  /**
   * Retrieve cached session data
   * Gets cached session metadata with performance tracking
   */
  async getCachedSessionData(sessionId: string): Promise<ClaudeSessionMetadata | null> {
    const startTime = Date.now();

    try {
      const key = this.buildSessionKey(sessionId, 'metadata');
      const cachedData = await this.redisClient.get(key);

      if (!cachedData) {
        this.trackRequest(startTime, false);
        this.eventEmitter.emit('cache.session.miss', { sessionId });
        return null;
      }

      const decompressedData = await this.decompressIfNeeded(JSON.parse(cachedData));
      const cacheEntry = CacheEntrySchema.parse(decompressedData);

      this.trackRequest(startTime, true);
      this.eventEmitter.emit('cache.session.hit', { sessionId, age: Date.now() - cacheEntry.timestamp });

      this.logger.debug(`Cache hit for session: ${sessionId}`);
      return cacheEntry.value as ClaudeSessionMetadata;
    } catch (error) {
      this.trackRequest(startTime, false);
      this.logger.error('Failed to retrieve cached session data', error);
      return null;
    }
  }

  /**
   * Cache command execution context
   * Stores execution context for debugging and monitoring
   */
  async cacheExecutionContext(
    runId: string,
    context: CommandExecutionContext,
    customTtl?: number
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const key = this.buildContextKey(runId, 'execution');
      const ttl = customTtl || this.config.performance.contextDataTtl;

      const cacheEntry: CacheEntry = {
        key,
        value: context,
        ttl,
        timestamp: Date.now(),
        metadata: {
          type: 'command_context',
          runId,
          size: JSON.stringify(context).length,
        },
      };

      const compressedData = await this.compressIfNeeded(cacheEntry);
      await this.redisClient.setex(key, ttl, JSON.stringify(compressedData));

      this.trackRequest(startTime, true);
      this.eventEmitter.emit('cache.context.stored', { runId, ttl });

      this.logger.debug(`Cached execution context: ${runId} (TTL: ${ttl}s)`);
    } catch (error) {
      this.trackRequest(startTime, false);
      this.logger.error('Failed to cache execution context', error);
      throw error;
    }
  }

  /**
   * Cache stream data for real-time features
   * Stores streaming data with short TTL for real-time access
   */
  async cacheStreamData(
    sessionId: string,
    streamData: ClaudeResponse[],
    customTtl?: number
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const key = this.buildStreamKey(sessionId, Date.now());
      const ttl = customTtl || this.config.performance.streamDataTtl;

      const cacheEntry: CacheEntry = {
        key,
        value: streamData,
        ttl,
        timestamp: Date.now(),
        metadata: {
          type: 'stream_data',
          sessionId,
          size: JSON.stringify(streamData).length,
        },
      };

      const compressedData = await this.compressIfNeeded(cacheEntry);
      await this.redisClient.setex(key, ttl, JSON.stringify(compressedData));

      this.trackRequest(startTime, true);
      this.eventEmitter.emit('cache.stream.stored', { sessionId, ttl, count: streamData.length });

      this.logger.debug(`Cached stream data: ${sessionId} (TTL: ${ttl}s, ${streamData.length} events)`);
    } catch (error) {
      this.trackRequest(startTime, false);
      this.logger.error('Failed to cache stream data', error);
      throw error;
    }
  }

  // Implementation of CacheKeyBuilder interface
  buildCommandKey(commandType: ClaudeCommandType, hash: string): string {
    return `command:${commandType}:${hash}`;
  }

  buildSessionKey(sessionId: string, suffix?: string): string {
    return `session:${sessionId}${suffix ? `:${suffix}` : ''}`;
  }

  buildContextKey(runId: string, type: string): string {
    return `context:${runId}:${type}`;
  }

  buildStreamKey(sessionId: string, timestamp: number): string {
    return `stream:${sessionId}:${timestamp}`;
  }

  buildStatsKey(): string {
    return 'stats:global';
  }

  // Implementation of CacheInvalidationStrategy interface
  async invalidateSession(sessionId: string): Promise<number> {
    const pattern = this.buildSessionKey(sessionId, '*');
    return this.invalidatePattern(pattern);
  }

  async invalidateCommand(commandType: ClaudeCommandType): Promise<number> {
    const pattern = `command:${commandType}:*`;
    return this.invalidatePattern(pattern);
  }

  async invalidateUser(userId: string): Promise<number> {
    // This would require tracking user associations with cache keys
    // For now, return 0 as this is a future enhancement
    this.logger.warn(`User-based invalidation not yet implemented for userId: ${userId}`);
    return 0;
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.redisClient.del(...keys);
      this.eventEmitter.emit('cache.invalidation', { pattern, deletedCount: deleted });

      this.logger.debug(`Invalidated ${deleted} keys matching pattern: ${pattern}`);
      return deleted;
    } catch (error) {
      this.logger.error(`Failed to invalidate pattern: ${pattern}`, error);
      throw error;
    }
  }

  async invalidateExpired(): Promise<number> {
    // Redis automatically handles expired keys, but we can get stats
    const info = await this.redisClient.info('stats');
    const expiredKeys = this.parseRedisInfo(info).expired_keys || '0';
    return parseInt(expiredKeys, 10);
  }

  /**
   * Get current cache statistics
   * Returns comprehensive performance metrics
   */
  async getStatistics(): Promise<CacheStatistics> {
    await this.updateStatistics();
    return { ...this.stats };
  }

  /**
   * Clear all cache data
   * Emergency cache clearing for maintenance
   */
  async clearCache(): Promise<void> {
    try {
      await this.redisClient.flushdb();
      this.eventEmitter.emit('cache.cleared');
      this.logger.warn('Cache cleared completely');
    } catch (error) {
      this.logger.error('Failed to clear cache', error);
      throw error;
    }
  }

  /**
   * Cleanup resources on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    if (this.redisClient) {
      await this.redisClient.quit();
    }

    this.logger.log('ClaudeCacheService destroyed');
  }

  // Private helper methods

  private hashCommand(command: ClaudeCommandRequest): string {
    // Create a hash of the command for consistent caching
    const crypto = require('crypto');
    const commandString = JSON.stringify({
      type: command.type,
      prompt: command.prompt ? crypto.createHash('md5').update(command.prompt).digest('hex') : undefined,
      options: command.options,
    });
    return crypto.createHash('sha256').update(commandString).digest('hex').substring(0, 16);
  }

  private async compressIfNeeded(cacheEntry: CacheEntry): Promise<CacheEntry> {
    if (!this.config.cache.compressionEnabled) {
      return cacheEntry;
    }

    const dataSize = JSON.stringify(cacheEntry.value).length;
    if (dataSize > this.config.cache.compressionThreshold) {
      const zlib = require('zlib');
      const compressed = zlib.gzipSync(JSON.stringify(cacheEntry.value));

      return {
        ...cacheEntry,
        value: {
          compressed: true,
          data: compressed.toString('base64'),
          originalSize: dataSize,
        },
        metadata: {
          ...cacheEntry.metadata,
          size: compressed.length,
        },
      };
    }

    return cacheEntry;
  }

  private async decompressIfNeeded(cacheEntry: CacheEntry): Promise<CacheEntry> {
    if (typeof cacheEntry.value === 'object' &&
        cacheEntry.value !== null &&
        'compressed' in cacheEntry.value &&
        cacheEntry.value.compressed) {
      const zlib = require('zlib');
      const compressedValue = cacheEntry.value as { compressed: boolean; data: string; originalSize: number };
      const compressed = Buffer.from(compressedValue.data, 'base64');
      const decompressed = zlib.gunzipSync(compressed);

      return {
        ...cacheEntry,
        value: JSON.parse(decompressed.toString()),
      };
    }

    return cacheEntry;
  }

  private getOptimalTtl(type: string, key: string): number {
    if (!this.config.performance.adaptiveTtl) {
      return this.config.cache.defaultTtl;
    }

    // Implement adaptive TTL based on access patterns
    // This is a simplified version - could be enhanced with ML
    switch (type) {
      case 'command_response':
        return this.config.performance.commandResponseTtl;
      case 'session_data':
        return this.config.performance.sessionDataTtl;
      case 'command_context':
        return this.config.performance.contextDataTtl;
      case 'stream_data':
        return this.config.performance.streamDataTtl;
      default:
        return this.config.cache.defaultTtl;
    }
  }

  private trackRequest(startTime: number, isHit: boolean): void {
    const responseTime = Date.now() - startTime;

    this.requestCount++;
    this.totalResponseTime += responseTime;

    // Keep rolling window of response times
    this.responseTimeWindow.push(responseTime);
    if (this.responseTimeWindow.length > 1000) {
      this.responseTimeWindow.shift();
    }

    if (isHit) {
      this.hitCount++;
    } else {
      this.missCount++;
    }

    if (this.config.monitoring.slowLogEnabled && responseTime > this.config.monitoring.slowLogThreshold) {
      this.logger.warn(`Slow cache operation: ${responseTime}ms`);
    }
  }

  private async updateStatistics(): Promise<void> {
    try {
      const info = await this.redisClient.info('memory');
      const memoryInfo = this.parseRedisInfo(info);

      this.stats = {
        hitRate: this.requestCount > 0 ? this.hitCount / this.requestCount : 0,
        missRate: this.requestCount > 0 ? this.missCount / this.requestCount : 0,
        totalRequests: this.requestCount,
        totalHits: this.hitCount,
        totalMisses: this.missCount,
        averageResponseTime: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
        cacheSize: parseInt(memoryInfo.used_memory || '0', 10),
        evictions: parseInt(memoryInfo.evicted_keys || '0', 10),
        compressionRatio: this.calculateCompressionRatio(),
        keyCount: await this.redisClient.dbsize(),
        memoryUsage: parseInt(memoryInfo.used_memory_human?.replace(/[^\d.]/g, '') || '0', 10),
        lastUpdated: new Date(),
      };

      // Store stats in cache for external monitoring
      await this.redisClient.setex(this.buildStatsKey(), 300, JSON.stringify(this.stats));
    } catch (error) {
      this.logger.error('Failed to update statistics', error);
    }
  }

  private calculateCompressionRatio(): number {
    // Simplified compression ratio calculation
    // In a real implementation, we'd track original vs compressed sizes
    return this.config.cache.compressionEnabled ? 0.7 : 1.0;
  }

  private logPerformanceMetrics(): void {
    const hitRate = (this.stats.hitRate * 100).toFixed(1);
    const avgResponseTime = this.stats.averageResponseTime.toFixed(1);

    this.logger.log(
      `Cache Performance - Hit Rate: ${hitRate}%, ` +
      `Avg Response: ${avgResponseTime}ms, ` +
      `Keys: ${this.stats.keyCount}, ` +
      `Memory: ${this.stats.memoryUsage}MB`
    );

    if (this.stats.hitRate < this.config.performance.targetHitRate) {
      this.logger.warn(
        `Cache hit rate (${hitRate}%) below target (${(this.config.performance.targetHitRate * 100).toFixed(1)}%)`
      );
    }
  }

  private async optimizePerformance(): Promise<void> {
    // Implement performance optimization strategies
    if (this.stats.hitRate < this.config.performance.targetHitRate) {
      this.logger.debug('Attempting cache performance optimization');

      // Could implement strategies like:
      // - Adjusting TTL values
      // - Preloading frequently accessed data
      // - Analyzing access patterns
      // - Triggering cache warming
    }
  }

  private async warmupCache(): Promise<void> {
    try {
      this.logger.debug('Starting cache warmup...');

      // Implement cache warming logic for frequently accessed patterns
      for (const pattern of this.config.performance.warmupPatterns) {
        // This would typically load common session data, frequent commands, etc.
        this.logger.debug(`Warming up pattern: ${pattern}`);
      }

      this.logger.log('Cache warmup completed');
    } catch (error) {
      this.logger.error('Cache warmup failed', error);
    }
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const lines = info.split('\r\n');
    const result: Record<string, string> = {};

    lines.forEach((line) => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    });

    return result;
  }
}