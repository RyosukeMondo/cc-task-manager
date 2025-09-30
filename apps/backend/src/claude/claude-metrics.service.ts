import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import { ClaudeWrapperService, ClaudeResponse } from './claude-wrapper.service';
import { ClaudeCommandService, CommandExecutionContext } from './claude-command.service';
import { ClaudeSessionService } from './claude-session.service';
import { ClaudeErrorService, ClaudeError } from './claude-error.service';
import { EnhancedLoggerService } from '../logging/enhanced-logger.service';

/**
 * Enum for Claude Code operation types
 * Following contract-driven design for operation classification
 */
export enum ClaudeOperationType {
  COMMAND_EXECUTION = 'command_execution',
  SESSION_CREATION = 'session_creation',
  SESSION_TERMINATION = 'session_termination',
  WRAPPER_INITIALIZATION = 'wrapper_initialization',
  STREAM_PROCESSING = 'stream_processing',
  ERROR_HANDLING = 'error_handling',
  QUEUE_PROCESSING = 'queue_processing',
}

/**
 * Interface for Claude Code performance metrics
 * Provides comprehensive performance measurement structure
 */
export interface ClaudePerformanceMetrics {
  operationId: string;
  operationType: ClaudeOperationType;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  error?: ClaudeError;
  context: {
    sessionId?: string;
    runId?: string;
    commandType?: string;
    userId?: string;
    workingDirectory?: string;
    payload?: any;
    [key: string]: any;
  };
  resourceUsage: {
    memoryUsage: number;
    cpuUsage?: number;
    ioOperations?: number;
    networkRequests?: number;
  };
  performanceFlags: {
    isSlowOperation: boolean;
    hasHighResourceUsage: boolean;
    hasMemoryLeak: boolean;
    needsOptimization: boolean;
  };
}

/**
 * Interface for aggregated Claude Code statistics
 * Provides insights into system performance and health
 */
export interface ClaudeSystemStatistics {
  timeRange: {
    startTime: Date;
    endTime: Date;
    durationHours: number;
  };
  operationCounts: Record<ClaudeOperationType, number>;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  successRate: number;
  averageExecutionTime: number;
  medianExecutionTime: number;
  slowOperationsCount: number;
  resourceUsage: {
    averageMemoryUsage: number;
    peakMemoryUsage: number;
    totalCpuTime: number;
    averageCpuUsage: number;
  };
  performanceDistribution: {
    fast: number; // < 1s
    normal: number; // 1-5s
    slow: number; // 5-30s
    verySlow: number; // > 30s
  };
  errorMetrics: {
    totalErrors: number;
    errorRate: number;
    criticalErrors: number;
    recoveredErrors: number;
    errorsByType: Record<string, number>;
  };
  trends: {
    operationsPerHour: number;
    successRateTrend: 'improving' | 'stable' | 'degrading';
    performanceTrend: 'improving' | 'stable' | 'degrading';
    errorRateTrend: 'improving' | 'stable' | 'degrading';
  };
}

/**
 * Interface for performance monitoring configuration
 * Defines system-wide performance monitoring behavior
 */
export interface PerformanceMonitoringConfig {
  enabledOperations: ClaudeOperationType[];
  metricCollectionEnabled: boolean;
  detailedLoggingEnabled: boolean;
  slowOperationThresholdMs: number;
  highMemoryUsageThresholdMB: number;
  maxMetricsHistorySize: number;
  aggregationIntervalMinutes: number;
  alertThresholds: {
    errorRatePercent: number;
    averageResponseTimeMs: number;
    memoryUsageMB: number;
    successRatePercent: number;
  };
  retentionPeriodHours: number;
}

/**
 * Interface for real-time performance alerts
 * Provides immediate performance issue notification
 */
export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  alertType: 'performance_degradation' | 'high_error_rate' | 'resource_exhaustion' | 'system_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  metrics: {
    currentValue: number;
    thresholdValue: number;
    unit: string;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  context: {
    operationType?: ClaudeOperationType;
    timeWindow: string;
    affectedSessions?: string[];
    potentialCause?: string;
  };
  recommendations: string[];
}

/**
 * Claude Code performance monitoring and metrics service
 *
 * Implements comprehensive performance monitoring for Claude Code integration following SOLID principles:
 *
 * - Single Responsibility: Manages Claude Code performance monitoring and metrics collection
 * - Open/Closed: Extensible for new metric types and monitoring features
 * - Liskov Substitution: Can be substituted with other monitoring implementations
 * - Interface Segregation: Focused interface for metrics operations
 * - Dependency Inversion: Depends on Claude service abstractions
 *
 * Applies KISS principle for simple performance monitoring workflow
 * Ensures DRY/SSOT compliance with centralized metrics management
 * Implements fail-fast validation and comprehensive performance tracking
 * Provides actionable insights and automated alerting
 */
@Injectable()
export class ClaudeMetricsService extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(ClaudeMetricsService.name);
  private readonly metricsHistory = new Map<string, ClaudePerformanceMetrics>();
  private readonly aggregatedMetrics = new Map<string, ClaudeSystemStatistics>();
  private readonly activeOperations = new Map<string, ClaudePerformanceMetrics>();
  private readonly performanceAlerts = new Map<string, PerformanceAlert>();

  private aggregationInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private systemStartTime: Date;

  // Default configuration
  private readonly defaultConfig: PerformanceMonitoringConfig = {
    enabledOperations: Object.values(ClaudeOperationType),
    metricCollectionEnabled: true,
    detailedLoggingEnabled: true,
    slowOperationThresholdMs: 5000, // 5 seconds
    highMemoryUsageThresholdMB: 512, // 512 MB
    maxMetricsHistorySize: 10000,
    aggregationIntervalMinutes: 5,
    alertThresholds: {
      errorRatePercent: 10,
      averageResponseTimeMs: 10000, // 10 seconds
      memoryUsageMB: 1024, // 1 GB
      successRatePercent: 95,
    },
    retentionPeriodHours: 168, // 7 days
  };

  private config: PerformanceMonitoringConfig;

  constructor(
    private readonly enhancedLogger?: EnhancedLoggerService,
    private readonly wrapperService?: ClaudeWrapperService,
    private readonly commandService?: ClaudeCommandService,
    private readonly sessionService?: ClaudeSessionService,
    private readonly errorService?: ClaudeErrorService
  ) {
    super();
    this.config = { ...this.defaultConfig };
    this.systemStartTime = new Date();
    this.setupMetricsCollection();
    this.setupAggregation();
    this.setupCleanupScheduler();
  }

  /**
   * Start performance monitoring operation
   * Implements operation tracking with comprehensive context capture
   */
  startOperation(
    operationType: ClaudeOperationType,
    context: Partial<ClaudePerformanceMetrics['context']> = {}
  ): string {
    if (!this.config.enabledOperations.includes(operationType)) {
      return '';
    }

    const operationId = this.generateOperationId();
    const startTime = new Date();

    const metrics: ClaudePerformanceMetrics = {
      operationId,
      operationType,
      startTime,
      success: false, // Will be updated on completion
      context: { ...context },
      resourceUsage: {
        memoryUsage: this.getCurrentMemoryUsage(),
        cpuUsage: undefined, // Will be calculated on completion
        ioOperations: 0,
        networkRequests: 0,
      },
      performanceFlags: {
        isSlowOperation: false,
        hasHighResourceUsage: false,
        hasMemoryLeak: false,
        needsOptimization: false,
      },
    };

    this.activeOperations.set(operationId, metrics);

    if (this.config.detailedLoggingEnabled) {
      this.logger.debug(`Started operation ${operationType} with ID: ${operationId}`);
    }

    this.emit('operation_started', { operationId, operationType, startTime });

    return operationId;
  }

  /**
   * Complete performance monitoring operation
   * Implements operation completion with comprehensive metrics calculation
   */
  completeOperation(
    operationId: string,
    success: boolean,
    error?: ClaudeError,
    additionalContext?: Partial<ClaudePerformanceMetrics['context']>
  ): ClaudePerformanceMetrics | null {
    const metrics = this.activeOperations.get(operationId);
    if (!metrics) {
      this.logger.warn(`Operation ${operationId} not found in active operations`);
      return null;
    }

    const endTime = new Date();
    const duration = endTime.getTime() - metrics.startTime.getTime();
    const finalMemoryUsage = this.getCurrentMemoryUsage();

    // Update metrics with completion data
    metrics.endTime = endTime;
    metrics.duration = duration;
    metrics.success = success;
    metrics.error = error;
    metrics.context = { ...metrics.context, ...additionalContext };
    metrics.resourceUsage.memoryUsage = finalMemoryUsage;

    // Calculate performance flags
    metrics.performanceFlags.isSlowOperation = duration > this.config.slowOperationThresholdMs;
    metrics.performanceFlags.hasHighResourceUsage = finalMemoryUsage > this.config.highMemoryUsageThresholdMB * 1024 * 1024;
    metrics.performanceFlags.needsOptimization = metrics.performanceFlags.isSlowOperation || metrics.performanceFlags.hasHighResourceUsage;

    // Store in history
    this.storeMetrics(metrics);

    // Remove from active operations
    this.activeOperations.delete(operationId);

    // Log completion
    if (this.config.detailedLoggingEnabled) {
      const level = success ? 'debug' : 'warn';
      this.logger[level](
        `Completed operation ${metrics.operationType} (${operationId}) in ${duration}ms - Success: ${success}`
      );
    }

    // Enhanced logging for structured observability
    if (this.enhancedLogger) {
      this.enhancedLogger.logOperation(
        `claude_${metrics.operationType}`,
        duration,
        success,
        {
          operationId,
          operationType: metrics.operationType,
          sessionId: metrics.context.sessionId,
          runId: metrics.context.runId,
          memoryUsage: finalMemoryUsage,
          isSlowOperation: metrics.performanceFlags.isSlowOperation,
          hasHighResourceUsage: metrics.performanceFlags.hasHighResourceUsage,
        }
      );
    }

    // Check for performance alerts
    this.checkPerformanceAlerts(metrics);

    this.emit('operation_completed', metrics);

    return metrics;
  }

  /**
   * Record Claude Code command execution metrics
   * Implements command-specific performance tracking
   */
  recordCommandExecution(
    commandType: string,
    duration: number,
    success: boolean,
    context: CommandExecutionContext,
    error?: ClaudeError
  ): void {
    const operationId = this.startOperation(ClaudeOperationType.COMMAND_EXECUTION, {
      commandType,
      sessionId: context.sessionId,
      runId: context.runId,
      userId: context.userId,
      workingDirectory: context.workingDirectory,
    });

    // Simulate operation timing by backdating start time
    const metrics = this.activeOperations.get(operationId);
    if (metrics) {
      metrics.startTime = new Date(Date.now() - duration);
    }

    this.completeOperation(operationId, success, error, {
      commandType,
      executionDetails: {
        promptLength: context.prompt?.length,
        optionsCount: Object.keys(context.options || {}).length,
      },
    });
  }

  /**
   * Record session operation metrics
   * Implements session lifecycle performance tracking
   */
  recordSessionOperation(
    operationType: ClaudeOperationType.SESSION_CREATION | ClaudeOperationType.SESSION_TERMINATION,
    sessionId: string,
    duration: number,
    success: boolean,
    userId?: string,
    error?: ClaudeError
  ): void {
    const operationId = this.startOperation(operationType, {
      sessionId,
      userId,
    });

    // Backdate start time to match actual duration
    const metrics = this.activeOperations.get(operationId);
    if (metrics) {
      metrics.startTime = new Date(Date.now() - duration);
    }

    this.completeOperation(operationId, success, error);
  }

  /**
   * Record stream processing metrics
   * Implements streaming performance tracking
   */
  recordStreamProcessing(
    sessionId: string,
    runId: string,
    bytesProcessed: number,
    processingTime: number,
    success: boolean,
    error?: ClaudeError
  ): void {
    const operationId = this.startOperation(ClaudeOperationType.STREAM_PROCESSING, {
      sessionId,
      runId,
      streamingDetails: {
        bytesProcessed,
        throughputBps: bytesProcessed / (processingTime / 1000),
      },
    });

    // Backdate start time to match processing duration
    const metrics = this.activeOperations.get(operationId);
    if (metrics) {
      metrics.startTime = new Date(Date.now() - processingTime);
      metrics.resourceUsage.ioOperations = bytesProcessed;
    }

    this.completeOperation(operationId, success, error);
  }

  /**
   * Get current system performance statistics
   * Implements comprehensive system health assessment
   */
  getSystemStatistics(timeRangeHours: number = 1): ClaudeSystemStatistics {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (timeRangeHours * 60 * 60 * 1000));

    const relevantMetrics = Array.from(this.metricsHistory.values())
      .filter(metric =>
        metric.startTime >= startTime &&
        metric.endTime &&
        metric.endTime <= endTime
      );

    if (relevantMetrics.length === 0) {
      return this.createEmptyStatistics(startTime, endTime, timeRangeHours);
    }

    // Calculate operation counts
    const operationCounts = {} as Record<ClaudeOperationType, number>;
    Object.values(ClaudeOperationType).forEach(type => {
      operationCounts[type] = 0;
    });
    relevantMetrics.forEach(metric => operationCounts[metric.operationType]++);

    // Calculate basic statistics
    const totalOperations = relevantMetrics.length;
    const successfulOperations = relevantMetrics.filter(m => m.success).length;
    const failedOperations = totalOperations - successfulOperations;
    const successRate = totalOperations > 0 ? successfulOperations / totalOperations : 0;

    // Calculate execution time statistics
    const durations = relevantMetrics.map(m => m.duration || 0);
    const averageExecutionTime = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const sortedDurations = durations.sort((a, b) => a - b);
    const medianExecutionTime = sortedDurations[Math.floor(sortedDurations.length / 2)] || 0;
    const slowOperationsCount = relevantMetrics.filter(m => m.performanceFlags.isSlowOperation).length;

    // Calculate resource usage
    const memoryUsages = relevantMetrics.map(m => m.resourceUsage.memoryUsage);
    const averageMemoryUsage = memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length;
    const peakMemoryUsage = Math.max(...memoryUsages);

    // Calculate performance distribution
    const performanceDistribution = {
      fast: relevantMetrics.filter(m => (m.duration || 0) < 1000).length,
      normal: relevantMetrics.filter(m => (m.duration || 0) >= 1000 && (m.duration || 0) < 5000).length,
      slow: relevantMetrics.filter(m => (m.duration || 0) >= 5000 && (m.duration || 0) < 30000).length,
      verySlow: relevantMetrics.filter(m => (m.duration || 0) >= 30000).length,
    };

    // Calculate error metrics
    const errors = relevantMetrics.filter(m => m.error).map(m => m.error!);
    const errorsByType = {} as Record<string, number>;
    errors.forEach(error => {
      const type = error.category || 'unknown';
      errorsByType[type] = (errorsByType[type] || 0) + 1;
    });

    const statistics: ClaudeSystemStatistics = {
      timeRange: {
        startTime,
        endTime,
        durationHours: timeRangeHours,
      },
      operationCounts,
      totalOperations,
      successfulOperations,
      failedOperations,
      successRate,
      averageExecutionTime,
      medianExecutionTime,
      slowOperationsCount,
      resourceUsage: {
        averageMemoryUsage,
        peakMemoryUsage,
        totalCpuTime: 0, // Not currently tracked
        averageCpuUsage: 0, // Not currently tracked
      },
      performanceDistribution,
      errorMetrics: {
        totalErrors: errors.length,
        errorRate: totalOperations > 0 ? errors.length / totalOperations : 0,
        criticalErrors: errors.filter(e => e.severity === 'critical').length,
        recoveredErrors: errors.filter(e => e.recoverable).length,
        errorsByType,
      },
      trends: this.calculateTrends(relevantMetrics, timeRangeHours),
    };

    return statistics;
  }

  /**
   * Get recent performance metrics
   * Implements metrics history retrieval
   */
  getRecentMetrics(limit: number = 100): ClaudePerformanceMetrics[] {
    return Array.from(this.metricsHistory.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  /**
   * Get performance metrics for specific operation type
   * Implements operation-specific metrics filtering
   */
  getMetricsByOperationType(
    operationType: ClaudeOperationType,
    limit: number = 50
  ): ClaudePerformanceMetrics[] {
    return Array.from(this.metricsHistory.values())
      .filter(metric => metric.operationType === operationType)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  /**
   * Get active performance alerts
   * Implements alerting system integration
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.performanceAlerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Update performance monitoring configuration
   * Implements runtime configuration management
   */
  updateConfig(newConfig: Partial<PerformanceMonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Performance monitoring configuration updated');
    this.emit('config_updated', this.config);

    // Restart aggregation with new interval if changed
    if (newConfig.aggregationIntervalMinutes && this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.setupAggregation();
    }
  }

  /**
   * Get current configuration
   * Provides configuration inspection
   */
  getConfig(): PerformanceMonitoringConfig {
    return { ...this.config };
  }

  /**
   * Clear metrics history
   * Implements metrics cleanup
   */
  clearMetricsHistory(): void {
    this.metricsHistory.clear();
    this.aggregatedMetrics.clear();
    this.performanceAlerts.clear();
    this.logger.log('Performance metrics history cleared');
    this.emit('metrics_cleared');
  }

  /**
   * Get system health status
   * Implements overall system health assessment
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
    uptime: number;
    activeOperations: number;
  } {
    const stats = this.getSystemStatistics(1); // Last hour
    const issues: string[] = [];
    const recommendations: string[] = [];

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check success rate
    if (stats.successRate < this.config.alertThresholds.successRatePercent / 100) {
      status = 'warning';
      issues.push(`Low success rate: ${(stats.successRate * 100).toFixed(1)}%`);
      recommendations.push('Investigate error patterns and implement error handling improvements');
    }

    // Check average response time
    if (stats.averageExecutionTime > this.config.alertThresholds.averageResponseTimeMs) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`High average response time: ${stats.averageExecutionTime.toFixed(0)}ms`);
      recommendations.push('Consider performance optimizations and resource scaling');
    }

    // Check error rate
    if (stats.errorMetrics.errorRate > this.config.alertThresholds.errorRatePercent / 100) {
      status = 'critical';
      issues.push(`High error rate: ${(stats.errorMetrics.errorRate * 100).toFixed(1)}%`);
      recommendations.push('Immediate investigation required for error resolution');
    }

    // Check memory usage
    if (stats.resourceUsage.averageMemoryUsage > this.config.alertThresholds.memoryUsageMB * 1024 * 1024) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`High memory usage: ${(stats.resourceUsage.averageMemoryUsage / 1024 / 1024).toFixed(0)}MB`);
      recommendations.push('Monitor memory usage patterns and consider memory optimization');
    }

    const uptime = Date.now() - this.systemStartTime.getTime();

    return {
      status,
      issues,
      recommendations,
      uptime,
      activeOperations: this.activeOperations.size,
    };
  }

  /**
   * Setup metrics collection from Claude services
   * Implements service integration for automatic metrics collection
   */
  private setupMetricsCollection(): void {
    // Wrapper service metrics
    this.wrapperService?.on('process_started', () => {
      this.startOperation(ClaudeOperationType.WRAPPER_INITIALIZATION);
    });

    this.wrapperService?.on('process_ready', () => {
      // Complete any pending wrapper initialization
      const wrapperOps = Array.from(this.activeOperations.entries())
        .filter(([_, metrics]) => metrics.operationType === ClaudeOperationType.WRAPPER_INITIALIZATION);

      wrapperOps.forEach(([operationId]) => {
        this.completeOperation(operationId, true);
      });
    });

    // Error service metrics
    this.errorService?.on('error_handled', (claudeError: ClaudeError) => {
      this.recordErrorHandling(claudeError);
    });

    // Session service metrics
    this.sessionService?.on('session_created', ({ sessionId, userId }: { sessionId: string; userId: string }) => {
      this.recordSessionOperation(
        ClaudeOperationType.SESSION_CREATION,
        sessionId,
        0, // Duration will be calculated
        true,
        userId
      );
    });

    this.sessionService?.on('session_terminated', ({ sessionId, userId }: { sessionId: string; userId: string }) => {
      this.recordSessionOperation(
        ClaudeOperationType.SESSION_TERMINATION,
        sessionId,
        0, // Duration will be calculated
        true,
        userId
      );
    });
  }

  /**
   * Record error handling metrics
   * Implements error handling performance tracking
   */
  private recordErrorHandling(claudeError: ClaudeError): void {
    const operationId = this.startOperation(ClaudeOperationType.ERROR_HANDLING, {
      sessionId: claudeError.context.sessionId,
      runId: claudeError.context.runId,
      userId: claudeError.context.userId,
      errorCategory: claudeError.category,
      errorSeverity: claudeError.severity,
    });

    this.completeOperation(operationId, true, undefined, {
      errorHandlingResult: {
        recoveryStrategy: claudeError.recoveryStrategy,
        retryCount: claudeError.retryCount,
        recoverable: claudeError.recoverable,
      },
    });
  }

  /**
   * Setup performance metrics aggregation
   * Implements periodic metrics aggregation and analysis
   */
  private setupAggregation(): void {
    const intervalMs = this.config.aggregationIntervalMinutes * 60 * 1000;

    this.aggregationInterval = setInterval(() => {
      this.performAggregation();
    }, intervalMs);
  }

  /**
   * Perform metrics aggregation
   * Implements metrics analysis and storage
   */
  private performAggregation(): void {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - (60 * 60 * 1000));

    const aggregatedStats = this.getSystemStatistics(1);
    const aggregationKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;

    this.aggregatedMetrics.set(aggregationKey, aggregatedStats);

    // Limit aggregated metrics size
    if (this.aggregatedMetrics.size > 168) { // Keep 7 days of hourly aggregations
      const oldestKey = Array.from(this.aggregatedMetrics.keys())[0];
      this.aggregatedMetrics.delete(oldestKey);
    }

    this.emit('aggregation_completed', aggregatedStats);
  }

  /**
   * Setup cleanup scheduler
   * Implements automatic resource cleanup
   */
  private setupCleanupScheduler(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Perform periodic cleanup
   * Implements metrics history cleanup and maintenance
   */
  private performCleanup(): void {
    const now = Date.now();
    const retentionMs = this.config.retentionPeriodHours * 60 * 60 * 1000;
    const cutoffTime = now - retentionMs;

    // Clean up old metrics
    for (const [operationId, metrics] of Array.from(this.metricsHistory.entries())) {
      if (metrics.startTime.getTime() < cutoffTime) {
        this.metricsHistory.delete(operationId);
      }
    }

    // Clean up old alerts
    for (const [alertId, alert] of Array.from(this.performanceAlerts.entries())) {
      const alertAge = now - alert.timestamp.getTime();
      if (alertAge > (24 * 60 * 60 * 1000)) { // Remove alerts older than 24 hours
        this.performanceAlerts.delete(alertId);
      }
    }

    this.logger.debug('Performance metrics cleanup completed');
  }

  /**
   * Store performance metrics in history
   * Implements metrics storage with size management
   */
  private storeMetrics(metrics: ClaudePerformanceMetrics): void {
    this.metricsHistory.set(metrics.operationId, metrics);

    // Maintain history size limit
    if (this.metricsHistory.size > this.config.maxMetricsHistorySize) {
      const oldestMetric = Array.from(this.metricsHistory.keys())[0];
      this.metricsHistory.delete(oldestMetric);
    }

    this.emit('metrics_stored', metrics);
  }

  /**
   * Check for performance alerts
   * Implements real-time performance monitoring and alerting
   */
  private checkPerformanceAlerts(metrics: ClaudePerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // Check for slow operation
    if (metrics.performanceFlags.isSlowOperation) {
      alerts.push(this.createPerformanceAlert(
        'performance_degradation',
        'medium',
        'Slow Operation Detected',
        `Operation ${metrics.operationType} took ${metrics.duration}ms to complete`,
        {
          currentValue: metrics.duration || 0,
          thresholdValue: this.config.slowOperationThresholdMs,
          unit: 'ms',
          trend: 'stable',
        },
        {
          operationType: metrics.operationType,
          timeWindow: '1 operation',
          potentialCause: 'Resource constraints or inefficient processing',
        },
        [
          'Monitor resource usage patterns',
          'Consider performance optimization',
          'Check for system resource constraints',
        ]
      ));
    }

    // Check for high memory usage
    if (metrics.performanceFlags.hasHighResourceUsage) {
      alerts.push(this.createPerformanceAlert(
        'resource_exhaustion',
        'high',
        'High Memory Usage Detected',
        `Operation ${metrics.operationType} used ${(metrics.resourceUsage.memoryUsage / 1024 / 1024).toFixed(0)}MB of memory`,
        {
          currentValue: metrics.resourceUsage.memoryUsage,
          thresholdValue: this.config.highMemoryUsageThresholdMB * 1024 * 1024,
          unit: 'bytes',
          trend: 'stable',
        },
        {
          operationType: metrics.operationType,
          timeWindow: '1 operation',
          potentialCause: 'Memory leak or inefficient memory usage',
        },
        [
          'Monitor memory usage over time',
          'Check for memory leaks',
          'Consider memory optimization strategies',
        ]
      ));
    }

    // Store alerts
    alerts.forEach(alert => {
      this.performanceAlerts.set(alert.id, alert);
      this.emit('performance_alert', alert);
    });
  }

  /**
   * Create performance alert
   * Implements alert creation with comprehensive context
   */
  private createPerformanceAlert(
    alertType: PerformanceAlert['alertType'],
    severity: PerformanceAlert['severity'],
    title: string,
    description: string,
    metrics: PerformanceAlert['metrics'],
    context: PerformanceAlert['context'],
    recommendations: string[]
  ): PerformanceAlert {
    return {
      id: this.generateAlertId(),
      timestamp: new Date(),
      alertType,
      severity,
      title,
      description,
      metrics,
      context,
      recommendations,
    };
  }

  /**
   * Calculate performance trends
   * Implements trend analysis for performance metrics
   */
  private calculateTrends(
    metrics: ClaudePerformanceMetrics[],
    timeRangeHours: number
  ): ClaudeSystemStatistics['trends'] {
    const operationsPerHour = metrics.length / timeRangeHours;

    // Simple trend calculation (would be more sophisticated in production)
    const midpoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, midpoint);
    const secondHalf = metrics.slice(midpoint);

    const firstHalfSuccess = firstHalf.filter(m => m.success).length / firstHalf.length;
    const secondHalfSuccess = secondHalf.filter(m => m.success).length / secondHalf.length;

    const firstHalfAvgTime = firstHalf.reduce((sum, m) => sum + (m.duration || 0), 0) / firstHalf.length;
    const secondHalfAvgTime = secondHalf.reduce((sum, m) => sum + (m.duration || 0), 0) / secondHalf.length;

    const firstHalfErrors = firstHalf.filter(m => m.error).length / firstHalf.length;
    const secondHalfErrors = secondHalf.filter(m => m.error).length / secondHalf.length;

    return {
      operationsPerHour,
      successRateTrend: this.calculateTrend(firstHalfSuccess, secondHalfSuccess),
      performanceTrend: this.calculateTrend(secondHalfAvgTime, firstHalfAvgTime), // Inverted - lower is better
      errorRateTrend: this.calculateTrend(secondHalfErrors, firstHalfErrors), // Inverted - lower is better
    };
  }

  /**
   * Calculate trend direction
   * Implements simple trend analysis
   */
  private calculateTrend(oldValue: number, newValue: number): 'improving' | 'stable' | 'degrading' {
    const threshold = 0.05; // 5% change threshold
    const change = (newValue - oldValue) / oldValue;

    if (Math.abs(change) < threshold) return 'stable';
    return change > 0 ? 'improving' : 'degrading';
  }

  /**
   * Create empty statistics object
   * Implements fallback statistics when no data available
   */
  private createEmptyStatistics(
    startTime: Date,
    endTime: Date,
    durationHours: number
  ): ClaudeSystemStatistics {
    const operationCounts = {} as Record<ClaudeOperationType, number>;
    Object.values(ClaudeOperationType).forEach(type => {
      operationCounts[type] = 0;
    });

    return {
      timeRange: { startTime, endTime, durationHours },
      operationCounts,
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      successRate: 0,
      averageExecutionTime: 0,
      medianExecutionTime: 0,
      slowOperationsCount: 0,
      resourceUsage: {
        averageMemoryUsage: 0,
        peakMemoryUsage: 0,
        totalCpuTime: 0,
        averageCpuUsage: 0,
      },
      performanceDistribution: { fast: 0, normal: 0, slow: 0, verySlow: 0 },
      errorMetrics: {
        totalErrors: 0,
        errorRate: 0,
        criticalErrors: 0,
        recoveredErrors: 0,
        errorsByType: {},
      },
      trends: {
        operationsPerHour: 0,
        successRateTrend: 'stable',
        performanceTrend: 'stable',
        errorRateTrend: 'stable',
      },
    };
  }

  /**
   * Get current memory usage
   * Implements memory usage tracking
   */
  private getCurrentMemoryUsage(): number {
    return process.memoryUsage().heapUsed;
  }

  /**
   * Generate unique operation ID
   * Implements operation identification
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique alert ID
   * Implements alert identification
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Module cleanup
   * Implements proper resource cleanup on module destruction
   */
  onModuleDestroy(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.logger.log('Claude metrics service shut down');
  }
}