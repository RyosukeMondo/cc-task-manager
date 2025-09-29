import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';
import {
  IExecutionLogRepository,
  ExecutionLogEntity,
  LogLevel,
  LogSource,
  PaginatedLogs,
  LogStatistics,
  ErrorAnalysis,
  LogVolumeMetrics,
  ArchiveResult,
  LogContext,
  LogPatternAggregation,
} from '../interfaces/execution-log-repository.interface';

/**
 * Execution Log Repository Implementation
 * Extends BaseRepository with logging-specific operations
 * Following Single Responsibility Principle for focused functionality
 *
 * Implements Repository Pattern with optimized queries and error handling
 * for Claude Code execution logging and monitoring
 */
@Injectable()
export class ExecutionLogRepository extends BaseRepository<ExecutionLogEntity> implements IExecutionLogRepository {
  constructor(prisma: PrismaService) {
    super(prisma, 'ExecutionLog');
  }

  /**
   * Get the Prisma ExecutionLog model delegate
   */
  protected getModel() {
    return this.prisma.executionLog;
  }

  /**
   * Transform Prisma entity to domain entity with optimized includes
   */
  protected transformToDomain(entity: any): ExecutionLogEntity {
    return {
      ...entity,
      // Ensure proper JSON handling for details field
      details: entity.details || null,
    } as ExecutionLogEntity;
  }

  /**
   * Find logs by execution ID
   */
  async findByExecutionId(executionId: string): Promise<ExecutionLogEntity[]> {
    try {
      this.logger.debug('Finding logs by execution ID', { executionId });

      const logs = await this.getModel().findMany({
        where: { executionId },
        include: {
          execution: {
            select: { id: true, taskId: true, status: true, workerId: true }
          },
        },
        orderBy: { timestamp: 'desc' },
      });

      this.logger.debug(`Found ${logs.length} logs for execution ${executionId}`);
      return logs.map(log => this.transformToDomain(log));
    } catch (error) {
      this.logger.error('Failed to find logs by execution ID', {
        error: error.message,
        executionId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find logs by log level
   */
  async findByLevel(level: LogLevel): Promise<ExecutionLogEntity[]> {
    try {
      this.logger.debug('Finding logs by level', { level });

      const logs = await this.getModel().findMany({
        where: { level },
        include: {
          execution: {
            select: { id: true, taskId: true, status: true, workerId: true }
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 1000, // Limit to prevent memory issues
      });

      this.logger.debug(`Found ${logs.length} logs with level ${level}`);
      return logs.map(log => this.transformToDomain(log));
    } catch (error) {
      this.logger.error('Failed to find logs by level', {
        error: error.message,
        level,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find logs by log source
   */
  async findBySource(source: LogSource): Promise<ExecutionLogEntity[]> {
    try {
      this.logger.debug('Finding logs by source', { source });

      const logs = await this.getModel().findMany({
        where: { source },
        include: {
          execution: {
            select: { id: true, taskId: true, status: true, workerId: true }
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 1000, // Limit to prevent memory issues
      });

      this.logger.debug(`Found ${logs.length} logs from source ${source}`);
      return logs.map(log => this.transformToDomain(log));
    } catch (error) {
      this.logger.error('Failed to find logs by source', {
        error: error.message,
        source,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find logs by component
   */
  async findByComponent(component: string): Promise<ExecutionLogEntity[]> {
    try {
      this.logger.debug('Finding logs by component', { component });

      const logs = await this.getModel().findMany({
        where: { component },
        include: {
          execution: {
            select: { id: true, taskId: true, status: true, workerId: true }
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 1000, // Limit to prevent memory issues
      });

      this.logger.debug(`Found ${logs.length} logs for component ${component}`);
      return logs.map(log => this.transformToDomain(log));
    } catch (error) {
      this.logger.error('Failed to find logs by component', {
        error: error.message,
        component,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find logs by correlation ID (for distributed tracing)
   */
  async findByCorrelationId(correlationId: string): Promise<ExecutionLogEntity[]> {
    try {
      this.logger.debug('Finding logs by correlation ID', { correlationId });

      const logs = await this.getModel().findMany({
        where: { correlationId },
        include: {
          execution: {
            select: { id: true, taskId: true, status: true, workerId: true }
          },
        },
        orderBy: { timestamp: 'asc' }, // Chronological order for tracing
      });

      this.logger.debug(`Found ${logs.length} logs with correlation ID ${correlationId}`);
      return logs.map(log => this.transformToDomain(log));
    } catch (error) {
      this.logger.error('Failed to find logs by correlation ID', {
        error: error.message,
        correlationId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find logs within time range
   */
  async findByTimeRange(fromDate: Date, toDate: Date): Promise<ExecutionLogEntity[]> {
    try {
      this.logger.debug('Finding logs by time range', { fromDate, toDate });

      const logs = await this.getModel().findMany({
        where: {
          timestamp: {
            gte: fromDate,
            lte: toDate,
          },
        },
        include: {
          execution: {
            select: { id: true, taskId: true, status: true, workerId: true }
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 5000, // Limit to prevent memory issues
      });

      this.logger.debug(`Found ${logs.length} logs in time range`);
      return logs.map(log => this.transformToDomain(log));
    } catch (error) {
      this.logger.error('Failed to find logs by time range', {
        error: error.message,
        fromDate,
        toDate,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find error logs (WARN, ERROR, FATAL levels)
   */
  async findErrorLogs(options: { executionId?: string; fromDate?: Date; toDate?: Date } = {}): Promise<ExecutionLogEntity[]> {
    try {
      this.logger.debug('Finding error logs', options);

      const whereClause: any = {
        level: {
          in: [LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL],
        },
      };

      if (options.executionId) {
        whereClause.executionId = options.executionId;
      }

      if (options.fromDate || options.toDate) {
        whereClause.timestamp = {};
        if (options.fromDate) {
          whereClause.timestamp.gte = options.fromDate;
        }
        if (options.toDate) {
          whereClause.timestamp.lte = options.toDate;
        }
      }

      const logs = await this.getModel().findMany({
        where: whereClause,
        include: {
          execution: {
            select: { id: true, taskId: true, status: true, workerId: true }
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 2000, // Limit to prevent memory issues
      });

      this.logger.debug(`Found ${logs.length} error logs`);
      return logs.map(log => this.transformToDomain(log));
    } catch (error) {
      this.logger.error('Failed to find error logs', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find logs with pagination for monitoring dashboards
   */
  async findWithPagination(options: {
    page: number;
    limit: number;
    executionId?: string;
    level?: LogLevel;
    source?: LogSource;
    component?: string;
    fromDate?: Date;
    toDate?: Date;
    searchText?: string;
  }): Promise<PaginatedLogs> {
    try {
      this.logger.debug('Finding logs with pagination', options);

      const whereClause: any = {};

      if (options.executionId) {
        whereClause.executionId = options.executionId;
      }
      if (options.level) {
        whereClause.level = options.level;
      }
      if (options.source) {
        whereClause.source = options.source;
      }
      if (options.component) {
        whereClause.component = options.component;
      }
      if (options.fromDate || options.toDate) {
        whereClause.timestamp = {};
        if (options.fromDate) {
          whereClause.timestamp.gte = options.fromDate;
        }
        if (options.toDate) {
          whereClause.timestamp.lte = options.toDate;
        }
      }
      if (options.searchText) {
        whereClause.message = {
          contains: options.searchText,
          mode: 'insensitive',
        };
      }

      const skip = (options.page - 1) * options.limit;

      const [logs, total] = await Promise.all([
        this.getModel().findMany({
          where: whereClause,
          include: {
            execution: {
              select: { id: true, taskId: true, status: true, workerId: true }
            },
          },
          orderBy: { timestamp: 'desc' },
          skip,
          take: options.limit,
        }),
        this.getModel().count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / options.limit);

      const result: PaginatedLogs = {
        logs: logs.map(log => this.transformToDomain(log)),
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          totalPages,
          hasNext: options.page < totalPages,
          hasPrev: options.page > 1,
        },
      };

      this.logger.debug(`Found ${logs.length} logs on page ${options.page}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to find logs with pagination', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Search logs by message content
   */
  async searchLogs(searchText: string, options: {
    executionId?: string;
    level?: LogLevel;
    source?: LogSource;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  } = {}): Promise<ExecutionLogEntity[]> {
    try {
      this.logger.debug('Searching logs', { searchText, options });

      const whereClause: any = {
        message: {
          contains: searchText,
          mode: 'insensitive',
        },
      };

      if (options.executionId) {
        whereClause.executionId = options.executionId;
      }
      if (options.level) {
        whereClause.level = options.level;
      }
      if (options.source) {
        whereClause.source = options.source;
      }
      if (options.fromDate || options.toDate) {
        whereClause.timestamp = {};
        if (options.fromDate) {
          whereClause.timestamp.gte = options.fromDate;
        }
        if (options.toDate) {
          whereClause.timestamp.lte = options.toDate;
        }
      }

      const logs = await this.getModel().findMany({
        where: whereClause,
        include: {
          execution: {
            select: { id: true, taskId: true, status: true, workerId: true }
          },
        },
        orderBy: { timestamp: 'desc' },
        take: options.limit || 500,
      });

      this.logger.debug(`Found ${logs.length} logs matching search "${searchText}"`);
      return logs.map(log => this.transformToDomain(log));
    } catch (error) {
      this.logger.error('Failed to search logs', {
        error: error.message,
        searchText,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get log statistics by execution
   */
  async getLogStatsByExecution(executionId: string): Promise<LogStatistics> {
    try {
      this.logger.debug('Getting log statistics by execution', { executionId });

      const [levelStats, sourceStats, componentStats, timeRange] = await Promise.all([
        // Level statistics
        this.getModel().groupBy({
          by: ['level'],
          where: { executionId },
          _count: { level: true },
        }),

        // Source statistics
        this.getModel().groupBy({
          by: ['source'],
          where: { executionId },
          _count: { source: true },
        }),

        // Component statistics
        this.getModel().groupBy({
          by: ['component'],
          where: { executionId, component: { not: null } },
          _count: { component: true },
        }),

        // Time range
        this.getModel().aggregate({
          where: { executionId },
          _min: { timestamp: true },
          _max: { timestamp: true },
        }),
      ]);

      const total = levelStats.reduce((sum, stat) => sum + stat._count.level, 0);
      const errorCount = levelStats
        .filter(s => [LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL].includes(s.level as LogLevel))
        .reduce((sum, stat) => sum + stat._count.level, 0);

      const bySource: { [source: string]: number } = {};
      sourceStats.forEach(stat => {
        bySource[stat.source] = stat._count.source;
      });

      const byComponent: { [component: string]: number } = {};
      componentStats.forEach(stat => {
        if (stat.component) {
          byComponent[stat.component] = stat._count.component;
        }
      });

      const result: LogStatistics = {
        total,
        trace: levelStats.find(s => s.level === LogLevel.TRACE)?._count.level || 0,
        debug: levelStats.find(s => s.level === LogLevel.DEBUG)?._count.level || 0,
        info: levelStats.find(s => s.level === LogLevel.INFO)?._count.level || 0,
        warn: levelStats.find(s => s.level === LogLevel.WARN)?._count.level || 0,
        error: levelStats.find(s => s.level === LogLevel.ERROR)?._count.level || 0,
        fatal: levelStats.find(s => s.level === LogLevel.FATAL)?._count.level || 0,
        bySource,
        byComponent,
        timeRange: {
          earliest: timeRange._min.timestamp,
          latest: timeRange._max.timestamp,
        },
        errorRate: total > 0 ? (errorCount / total) * 100 : 0,
      };

      this.logger.debug('Log statistics calculated', { executionId, stats: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get log statistics by execution', {
        error: error.message,
        executionId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get log statistics by component
   */
  async getLogStatsByComponent(component: string, fromDate?: Date, toDate?: Date): Promise<LogStatistics> {
    try {
      this.logger.debug('Getting log statistics by component', { component, fromDate, toDate });

      const whereClause: any = { component };
      if (fromDate || toDate) {
        whereClause.timestamp = {};
        if (fromDate) {
          whereClause.timestamp.gte = fromDate;
        }
        if (toDate) {
          whereClause.timestamp.lte = toDate;
        }
      }

      const [levelStats, sourceStats, timeRange] = await Promise.all([
        // Level statistics
        this.getModel().groupBy({
          by: ['level'],
          where: whereClause,
          _count: { level: true },
        }),

        // Source statistics
        this.getModel().groupBy({
          by: ['source'],
          where: whereClause,
          _count: { source: true },
        }),

        // Time range
        this.getModel().aggregate({
          where: whereClause,
          _min: { timestamp: true },
          _max: { timestamp: true },
        }),
      ]);

      const total = levelStats.reduce((sum, stat) => sum + stat._count.level, 0);
      const errorCount = levelStats
        .filter(s => [LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL].includes(s.level as LogLevel))
        .reduce((sum, stat) => sum + stat._count.level, 0);

      const bySource: { [source: string]: number } = {};
      sourceStats.forEach(stat => {
        bySource[stat.source] = stat._count.source;
      });

      const result: LogStatistics = {
        total,
        trace: levelStats.find(s => s.level === LogLevel.TRACE)?._count.level || 0,
        debug: levelStats.find(s => s.level === LogLevel.DEBUG)?._count.level || 0,
        info: levelStats.find(s => s.level === LogLevel.INFO)?._count.level || 0,
        warn: levelStats.find(s => s.level === LogLevel.WARN)?._count.level || 0,
        error: levelStats.find(s => s.level === LogLevel.ERROR)?._count.level || 0,
        fatal: levelStats.find(s => s.level === LogLevel.FATAL)?._count.level || 0,
        bySource,
        byComponent: { [component]: total },
        timeRange: {
          earliest: timeRange._min.timestamp,
          latest: timeRange._max.timestamp,
        },
        errorRate: total > 0 ? (errorCount / total) * 100 : 0,
      };

      this.logger.debug('Log statistics calculated', { component, stats: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get log statistics by component', {
        error: error.message,
        component,
        fromDate,
        toDate,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get error analysis for troubleshooting
   */
  async getErrorAnalysis(options: {
    executionId?: string;
    component?: string;
    fromDate?: Date;
    toDate?: Date;
  } = {}): Promise<ErrorAnalysis> {
    try {
      this.logger.debug('Getting error analysis', options);

      const whereClause: any = {
        level: {
          in: [LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL],
        },
      };

      if (options.executionId) {
        whereClause.executionId = options.executionId;
      }
      if (options.component) {
        whereClause.component = options.component;
      }
      if (options.fromDate || options.toDate) {
        whereClause.timestamp = {};
        if (options.fromDate) {
          whereClause.timestamp.gte = options.fromDate;
        }
        if (options.toDate) {
          whereClause.timestamp.lte = options.toDate;
        }
      }

      const errorLogs = await this.getModel().findMany({
        where: whereClause,
        select: {
          level: true,
          message: true,
          component: true,
          operation: true,
          correlationId: true,
          timestamp: true,
        },
        orderBy: { timestamp: 'desc' },
      });

      const totalErrors = errorLogs.length;

      // Errors by level
      const errorsByLevel: { [level: string]: number } = {};
      errorLogs.forEach(log => {
        errorsByLevel[log.level] = (errorsByLevel[log.level] || 0) + 1;
      });

      // Errors by component
      const errorsByComponent: { [component: string]: number } = {};
      errorLogs.forEach(log => {
        if (log.component) {
          errorsByComponent[log.component] = (errorsByComponent[log.component] || 0) + 1;
        }
      });

      // Errors by operation
      const errorsByOperation: { [operation: string]: number } = {};
      errorLogs.forEach(log => {
        if (log.operation) {
          errorsByOperation[log.operation] = (errorsByOperation[log.operation] || 0) + 1;
        }
      });

      // Common error patterns (simplified pattern matching)
      const patternMap = new Map<string, { count: number; examples: string[] }>();
      errorLogs.forEach(log => {
        // Extract first few words as pattern
        const pattern = log.message.split(' ').slice(0, 3).join(' ');
        if (!patternMap.has(pattern)) {
          patternMap.set(pattern, { count: 0, examples: [] });
        }
        const existing = patternMap.get(pattern)!;
        existing.count++;
        if (existing.examples.length < 3) {
          existing.examples.push(log.message);
        }
      });

      const commonErrorPatterns = Array.from(patternMap.entries())
        .map(([pattern, data]) => ({
          pattern,
          count: data.count,
          examples: data.examples,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Error timeline (simplified - hourly buckets)
      const timelineMap = new Map<string, { count: number; level: LogLevel }>();
      errorLogs.forEach(log => {
        const hour = new Date(log.timestamp);
        hour.setMinutes(0, 0, 0);
        const key = hour.toISOString();
        if (!timelineMap.has(key)) {
          timelineMap.set(key, { count: 0, level: log.level as LogLevel });
        }
        timelineMap.get(key)!.count++;
      });

      const errorTimeline = Array.from(timelineMap.entries())
        .map(([timestamp, data]) => ({
          timestamp: new Date(timestamp),
          count: data.count,
          level: data.level,
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Correlated errors
      const correlationMap = new Map<string, { errorCount: number; timestamps: Date[] }>();
      errorLogs.forEach(log => {
        if (log.correlationId) {
          if (!correlationMap.has(log.correlationId)) {
            correlationMap.set(log.correlationId, { errorCount: 0, timestamps: [] });
          }
          const existing = correlationMap.get(log.correlationId)!;
          existing.errorCount++;
          existing.timestamps.push(log.timestamp);
        }
      });

      const correlatedErrors = Array.from(correlationMap.entries())
        .map(([correlationId, data]) => {
          const sortedTimestamps = data.timestamps.sort((a, b) => a.getTime() - b.getTime());
          const timeSpan = sortedTimestamps.length > 1
            ? sortedTimestamps[sortedTimestamps.length - 1].getTime() - sortedTimestamps[0].getTime()
            : 0;
          return {
            correlationId,
            errorCount: data.errorCount,
            timeSpan,
          };
        })
        .filter(item => item.errorCount > 1)
        .sort((a, b) => b.errorCount - a.errorCount)
        .slice(0, 10);

      const result: ErrorAnalysis = {
        totalErrors,
        errorsByLevel,
        errorsByComponent,
        errorsByOperation,
        commonErrorPatterns,
        errorTimeline,
        correlatedErrors,
      };

      this.logger.debug('Error analysis calculated', { options, analysis: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get error analysis', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get log volume metrics for monitoring
   */
  async getLogVolumeMetrics(options: {
    granularity: 'hour' | 'day' | 'week';
    fromDate?: Date;
    toDate?: Date;
  } = { granularity: 'hour' }): Promise<LogVolumeMetrics> {
    try {
      this.logger.debug('Getting log volume metrics', options);

      const whereClause: any = {};
      if (options.fromDate || options.toDate) {
        whereClause.timestamp = {};
        if (options.fromDate) {
          whereClause.timestamp.gte = options.fromDate;
        }
        if (options.toDate) {
          whereClause.timestamp.lte = options.toDate;
        }
      }

      const logs = await this.getModel().findMany({
        where: whereClause,
        select: {
          timestamp: true,
          level: true,
        },
        orderBy: { timestamp: 'asc' },
      });

      // Group by time buckets
      const timeSeriesMap = new Map<string, { count: number; errorCount: number; warnCount: number }>();

      logs.forEach(log => {
        const bucket = this.getTimeBucket(log.timestamp, options.granularity);
        if (!timeSeriesMap.has(bucket)) {
          timeSeriesMap.set(bucket, { count: 0, errorCount: 0, warnCount: 0 });
        }
        const existing = timeSeriesMap.get(bucket)!;
        existing.count++;
        if ([LogLevel.ERROR, LogLevel.FATAL].includes(log.level as LogLevel)) {
          existing.errorCount++;
        }
        if (log.level === LogLevel.WARN) {
          existing.warnCount++;
        }
      });

      const timeSeries = Array.from(timeSeriesMap.entries())
        .map(([timestamp, data]) => ({
          timestamp: new Date(timestamp),
          count: data.count,
          errorCount: data.errorCount,
          warnCount: data.warnCount,
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const totalLogs = logs.length;
      const totalErrors = logs.filter(l => [LogLevel.ERROR, LogLevel.FATAL].includes(l.level as LogLevel)).length;
      const averageLogsPerPeriod = timeSeries.length > 0 ? totalLogs / timeSeries.length : 0;
      const peakLogsPerPeriod = Math.max(...timeSeries.map(t => t.count), 0);
      const errorRate = totalLogs > 0 ? (totalErrors / totalLogs) * 100 : 0;

      const result: LogVolumeMetrics = {
        granularity: options.granularity,
        timeSeries,
        summary: {
          totalLogs,
          totalErrors,
          averageLogsPerPeriod,
          peakLogsPerPeriod,
          errorRate,
        },
      };

      this.logger.debug('Log volume metrics calculated', { options, metrics: result });
      return result;
    } catch (error) {
      this.logger.error('Failed to get log volume metrics', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Clean up logs older than specified date
   */
  async cleanupOldLogs(beforeDate: Date, keepErrorLogs: boolean = true): Promise<number> {
    try {
      this.logger.debug('Cleaning up old logs', { beforeDate, keepErrorLogs });

      const whereClause: any = {
        timestamp: {
          lt: beforeDate,
        },
      };

      if (keepErrorLogs) {
        whereClause.level = {
          notIn: [LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL],
        };
      }

      const result = await this.getModel().deleteMany({
        where: whereClause,
      });

      this.logger.log(`Cleaned up ${result.count} old logs`, { beforeDate, keepErrorLogs });
      return result.count;
    } catch (error) {
      this.logger.error('Failed to clean up old logs', {
        error: error.message,
        beforeDate,
        keepErrorLogs,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Archive logs to external storage (placeholder implementation)
   */
  async archiveLogs(beforeDate: Date): Promise<ArchiveResult> {
    try {
      this.logger.debug('Archiving logs', { beforeDate });

      // In a real implementation, this would:
      // 1. Export logs to external storage (S3, etc.)
      // 2. Compress the data
      // 3. Delete archived logs from database
      // 4. Return archive details

      const logsToArchive = await this.getModel().findMany({
        where: {
          timestamp: {
            lt: beforeDate,
          },
        },
        select: {
          id: true,
          timestamp: true,
        },
        orderBy: { timestamp: 'asc' },
      });

      if (logsToArchive.length === 0) {
        return {
          archivedCount: 0,
          archiveLocation: '',
          archiveSize: 0,
          archivedTimeRange: {
            from: beforeDate,
            to: beforeDate,
          },
        };
      }

      // Placeholder: In real implementation, would export to external storage
      const archiveLocation = `logs_archive_${beforeDate.toISOString().split('T')[0]}.json.gz`;
      const estimatedSize = logsToArchive.length * 200; // Rough estimate

      const result: ArchiveResult = {
        archivedCount: logsToArchive.length,
        archiveLocation,
        archiveSize: estimatedSize,
        archivedTimeRange: {
          from: logsToArchive[0].timestamp,
          to: logsToArchive[logsToArchive.length - 1].timestamp,
        },
      };

      this.logger.log(`Archived ${result.archivedCount} logs`, { beforeDate, archiveLocation });
      return result;
    } catch (error) {
      this.logger.error('Failed to archive logs', {
        error: error.message,
        beforeDate,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Bulk insert logs for high-throughput scenarios
   */
  async bulkInsert(logs: Omit<ExecutionLogEntity, 'id' | 'timestamp'>[]): Promise<ExecutionLogEntity[]> {
    try {
      this.logger.debug('Bulk inserting logs', { count: logs.length });

      const now = new Date();
      const logsWithTimestamp = logs.map(log => ({
        ...log,
        timestamp: now,
      }));

      const created = await this.getModel().createMany({
        data: logsWithTimestamp,
        skipDuplicates: true,
      });

      this.logger.log(`Bulk inserted ${created.count} logs`);

      // Return the created logs (simplified - in real implementation might need to fetch)
      return logsWithTimestamp.map(log => ({
        ...log,
        id: `bulk_${Date.now()}_${Math.random()}`, // Placeholder ID
        timestamp: now,
      })) as ExecutionLogEntity[];
    } catch (error) {
      this.logger.error('Failed to bulk insert logs', {
        error: error.message,
        count: logs.length,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get recent logs for real-time monitoring
   */
  async getRecentLogs(options: {
    executionId?: string;
    level?: LogLevel;
    source?: LogSource;
    limit?: number;
    sinceTimestamp?: Date;
  } = {}): Promise<ExecutionLogEntity[]> {
    try {
      this.logger.debug('Getting recent logs', options);

      const whereClause: any = {};

      if (options.executionId) {
        whereClause.executionId = options.executionId;
      }
      if (options.level) {
        whereClause.level = options.level;
      }
      if (options.source) {
        whereClause.source = options.source;
      }
      if (options.sinceTimestamp) {
        whereClause.timestamp = {
          gt: options.sinceTimestamp,
        };
      }

      const logs = await this.getModel().findMany({
        where: whereClause,
        include: {
          execution: {
            select: { id: true, taskId: true, status: true, workerId: true }
          },
        },
        orderBy: { timestamp: 'desc' },
        take: options.limit || 100,
      });

      this.logger.debug(`Found ${logs.length} recent logs`);
      return logs.map(log => this.transformToDomain(log));
    } catch (error) {
      this.logger.error('Failed to get recent logs', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Get log context around a specific log entry
   */
  async getLogContext(logId: string, contextLines: number = 5): Promise<LogContext> {
    try {
      this.logger.debug('Getting log context', { logId, contextLines });

      const targetLog = await this.getModel().findUnique({
        where: { id: logId },
        include: {
          execution: {
            select: { id: true, taskId: true, status: true, workerId: true }
          },
        },
      });

      if (!targetLog) {
        throw new Error(`Log not found: ${logId}`);
      }

      const [beforeLogs, afterLogs] = await Promise.all([
        // Logs before the target
        this.getModel().findMany({
          where: {
            executionId: targetLog.executionId,
            timestamp: {
              lt: targetLog.timestamp,
            },
          },
          orderBy: { timestamp: 'desc' },
          take: contextLines,
        }),

        // Logs after the target
        this.getModel().findMany({
          where: {
            executionId: targetLog.executionId,
            timestamp: {
              gt: targetLog.timestamp,
            },
          },
          orderBy: { timestamp: 'asc' },
          take: contextLines,
        }),
      ]);

      const result: LogContext = {
        targetLog: this.transformToDomain(targetLog),
        beforeLogs: beforeLogs.reverse().map(log => this.transformToDomain(log)),
        afterLogs: afterLogs.map(log => this.transformToDomain(log)),
        contextMetadata: {
          totalContext: beforeLogs.length + afterLogs.length,
          beforeCount: beforeLogs.length,
          afterCount: afterLogs.length,
        },
      };

      this.logger.debug('Log context retrieved', { logId, contextLines });
      return result;
    } catch (error) {
      this.logger.error('Failed to get log context', {
        error: error.message,
        logId,
        contextLines,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Aggregate logs by patterns for analytics
   */
  async aggregateLogPatterns(options: {
    executionId?: string;
    component?: string;
    fromDate?: Date;
    toDate?: Date;
  } = {}): Promise<LogPatternAggregation[]> {
    try {
      this.logger.debug('Aggregating log patterns', options);

      const whereClause: any = {};

      if (options.executionId) {
        whereClause.executionId = options.executionId;
      }
      if (options.component) {
        whereClause.component = options.component;
      }
      if (options.fromDate || options.toDate) {
        whereClause.timestamp = {};
        if (options.fromDate) {
          whereClause.timestamp.gte = options.fromDate;
        }
        if (options.toDate) {
          whereClause.timestamp.lte = options.toDate;
        }
      }

      const logs = await this.getModel().findMany({
        where: whereClause,
        select: {
          message: true,
          level: true,
          source: true,
          component: true,
          details: true,
          timestamp: true,
        },
      });

      // Group logs by pattern (simplified pattern extraction)
      const patternMap = new Map<string, {
        level: LogLevel;
        source: LogSource;
        component: string | null;
        examples: { message: string; timestamp: Date; details: any }[];
        timestamps: Date[];
      }>();

      logs.forEach(log => {
        // Extract pattern from first few words
        const pattern = log.message.split(' ').slice(0, 4).join(' ');
        if (!patternMap.has(pattern)) {
          patternMap.set(pattern, {
            level: log.level as LogLevel,
            source: log.source as LogSource,
            component: log.component,
            examples: [],
            timestamps: [],
          });
        }
        const existing = patternMap.get(pattern)!;
        existing.timestamps.push(log.timestamp);
        if (existing.examples.length < 3) {
          existing.examples.push({
            message: log.message,
            timestamp: log.timestamp,
            details: log.details,
          });
        }
      });

      const result = Array.from(patternMap.entries())
        .map(([pattern, data]) => {
          // Calculate frequency metrics
          const sortedTimestamps = data.timestamps.sort((a, b) => a.getTime() - b.getTime());
          const timeSpan = sortedTimestamps.length > 1
            ? (sortedTimestamps[sortedTimestamps.length - 1].getTime() - sortedTimestamps[0].getTime()) / (1000 * 60 * 60 * 24)
            : 1;

          return {
            pattern,
            count: data.timestamps.length,
            level: data.level,
            source: data.source,
            component: data.component,
            examples: data.examples,
            frequency: {
              hourly: data.timestamps.length / Math.max(timeSpan * 24, 1),
              daily: data.timestamps.length / Math.max(timeSpan, 1),
              weekly: data.timestamps.length / Math.max(timeSpan / 7, 1),
            },
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      this.logger.debug(`Aggregated ${result.length} log patterns`, options);
      return result;
    } catch (error) {
      this.logger.error('Failed to aggregate log patterns', {
        error: error.message,
        options,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Helper method to create time buckets for grouping
   */
  private getTimeBucket(timestamp: Date, granularity: 'hour' | 'day' | 'week'): string {
    const date = new Date(timestamp);

    switch (granularity) {
      case 'hour':
        date.setMinutes(0, 0, 0);
        break;
      case 'day':
        date.setHours(0, 0, 0, 0);
        break;
      case 'week':
        const dayOfWeek = date.getDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday as start of week
        date.setDate(date.getDate() - daysToSubtract);
        date.setHours(0, 0, 0, 0);
        break;
    }

    return date.toISOString();
  }
}