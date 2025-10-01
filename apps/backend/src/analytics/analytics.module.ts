import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AnalyticsCacheService } from './analytics-cache.service';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

/**
 * Analytics Module
 *
 * Provides analytics functionality with Redis caching for performance optimization.
 *
 * Features:
 * - Performance metrics aggregation
 * - Trend data calculation
 * - Redis-based caching with 5-minute TTL
 * - Integration with PrismaModule for database access
 *
 * Configuration:
 * - Redis connection via environment variables (REDIS_HOST, REDIS_PORT)
 * - Cache TTL configurable via ANALYTICS_CACHE_TTL (default: 300 seconds)
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
  ],
  providers: [
    AnalyticsCacheService,
    AnalyticsRepository,
    AnalyticsService,
  ],
  exports: [
    AnalyticsService,
  ],
})
export class AnalyticsModule {}
