import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Analytics Cache Service
 *
 * Provides Redis-based caching for analytics queries to improve performance.
 * Implements 5-minute TTL for analytics data with automatic invalidation.
 */
@Injectable()
export class AnalyticsCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsCacheService.name);
  private redisClient: Redis;
  private readonly defaultTtl: number;

  constructor(private readonly configService: ConfigService) {
    this.defaultTtl = this.configService.get<number>('ANALYTICS_CACHE_TTL', 300);
    this.initializeRedisClient();
  }

  /**
   * Initialize Redis client with configuration from environment
   */
  private initializeRedisClient(): void {
    try {
      this.redisClient = new Redis({
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get<string>('REDIS_PASSWORD'),
        db: this.configService.get<number>('REDIS_DB', 0),
        keyPrefix: 'analytics:',
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: false,
      });

      this.redisClient.on('error', (err) => {
        this.logger.error('Redis connection error:', err);
      });

      this.redisClient.on('connect', () => {
        this.logger.log('Redis cache client connected');
      });

      this.logger.log('Analytics cache service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Redis client:', error);
      throw error;
    }
  }

  /**
   * Get cached value by key
   * @param key Cache key
   * @returns Cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redisClient.get(key);
      if (!cached) {
        return null;
      }
      return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.error(`Failed to get cache for key: ${key}`, error);
      return null;
    }
  }

  /**
   * Set cache value with TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds (default: 300s / 5 minutes)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const ttlSeconds = ttl || this.defaultTtl;
      await this.redisClient.setex(key, ttlSeconds, JSON.stringify(value));
      this.logger.debug(`Cached key: ${key} with TTL: ${ttlSeconds}s`);
    } catch (error) {
      this.logger.error(`Failed to set cache for key: ${key}`, error);
    }
  }

  /**
   * Delete cache entries matching pattern
   * @param pattern Redis key pattern (e.g., 'userId:123:*')
   * @returns Number of deleted keys
   */
  async invalidate(pattern: string): Promise<number> {
    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.redisClient.del(...keys);
      this.logger.debug(`Invalidated ${deleted} keys matching pattern: ${pattern}`);
      return deleted;
    } catch (error) {
      this.logger.error(`Failed to invalidate pattern: ${pattern}`, error);
      return 0;
    }
  }

  /**
   * Generate cache key for analytics queries
   * @param userId User ID
   * @param queryType Type of analytics query
   * @param params Query parameters
   * @returns Cache key
   */
  generateCacheKey(userId: string, queryType: string, params: Record<string, any>): string {
    const paramString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join(':');

    return `${userId}:${queryType}:${paramString}`;
  }

  /**
   * Cleanup resources on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.logger.log('Analytics cache service destroyed');
    }
  }
}
