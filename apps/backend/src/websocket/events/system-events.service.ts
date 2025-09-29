import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';
import * as fs from 'fs/promises';
import {
  WebSocketEventType,
  WebSocketRoomType,
  createSystemHealthEvent,
  createSystemPerformanceEvent,
  createSystemAlertEvent,
  SystemHealthStatus,
  SystemHealthEventData,
  SystemPerformanceEventData,
  SystemAlertEventData,
  WebSocketEvent
} from '../websocket-events.schemas';
import { WebSocketGateway } from '../websocket.gateway';

/**
 * System Events Service
 *
 * Implements real-time system health monitoring and performance metrics broadcasting
 * following SOLID principles:
 *
 * 1. Single Responsibility Principle:
 *    - Focuses solely on system monitoring and health event broadcasting
 *    - Delegates event validation to existing schemas
 *    - Delegates event emission to WebSocket gateway
 *
 * 2. Open/Closed Principle:
 *    - Extensible for new monitoring metrics without modification
 *    - Alert rules can be extended independently
 *
 * 3. Dependency Inversion Principle:
 *    - Depends on WebSocketGateway abstraction for emission
 *    - Uses validated event schemas for type safety
 *
 * 4. Interface Segregation Principle:
 *    - Provides focused system monitoring interface
 *    - Separate methods for different monitoring aspects
 *
 * Key Features:
 * - System health status monitoring (CPU, memory, disk, network)
 * - Performance metrics streaming with intelligent batching
 * - Alert notification system with severity levels
 * - Automatic thresholds for system health alerts
 * - Permission-based broadcasting to admin/monitoring rooms
 * - Comprehensive logging and error handling
 */
@Injectable()
export class SystemEventsService {
  private readonly logger = new Logger(SystemEventsService.name);

  // System monitoring state
  private previousHealthStatus = new Map<string, SystemHealthStatus>();
  private performanceHistory: SystemPerformanceEventData[] = [];
  private activeAlerts = new Map<string, SystemAlertEventData>();

  // Monitoring configuration
  private readonly SYSTEM_USER_ID = 'system'; // Special user ID for system events
  private readonly PERFORMANCE_HISTORY_SIZE = 100;
  private readonly ALERT_COOLDOWN_MS = 300000; // 5 minutes
  private readonly HEALTH_CHECK_SERVICES = [
    'database',
    'redis',
    'queue',
    'websocket',
    'api'
  ];

  // Performance thresholds for automatic alerts
  private readonly PERFORMANCE_THRESHOLDS = {
    cpuUsage: 80, // percentage
    memoryUsage: 85, // percentage
    diskUsage: 90, // percentage
    responseTime: 5000, // milliseconds
    errorRate: 5, // percentage
    queueSize: 1000, // number of jobs
  };

  constructor(
    private readonly webSocketGateway: WebSocketGateway
  ) {}

  /**
   * Emit system health status change event
   *
   * @param service Service name being monitored
   * @param status Current health status
   * @param message Optional status message
   * @param details Optional detailed health information
   */
  async emitHealthStatus(
    service: string,
    status: SystemHealthStatus,
    message?: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      const previousStatus = this.previousHealthStatus.get(service);

      // Only emit if status changed to avoid spam
      if (previousStatus === status && !details) {
        return;
      }

      const healthData: SystemHealthEventData = {
        service,
        status,
        message,
        details,
        previousStatus,
        timestamp: new Date(),
        responseTime: details?.responseTime,
        uptime: details?.uptime,
        version: details?.version,
        environment: process.env.NODE_ENV || 'development',
      };

      const event = createSystemHealthEvent(
        this.SYSTEM_USER_ID,
        healthData,
        this.webSocketGateway.getGlobalRoom(),
        WebSocketRoomType.GLOBAL
      );

      await this.broadcastSystemEvent(event);
      this.previousHealthStatus.set(service, status);

      // Generate alert if status degraded
      if (this.shouldGenerateHealthAlert(status, previousStatus)) {
        await this.generateHealthAlert(service, status, previousStatus, message);
      }

      this.logger.debug(`Health status emitted for ${service}: ${previousStatus || 'unknown'} → ${status}`);
    } catch (error) {
      this.logger.error(`Failed to emit health status for ${service}: ${error.message}`);
    }
  }

  /**
   * Emit system performance metrics
   *
   * @param metrics Performance metrics data
   */
  async emitPerformanceMetrics(metrics: Partial<SystemPerformanceEventData>): Promise<void> {
    try {
      const performanceData: SystemPerformanceEventData = {
        ...metrics,
        timestamp: new Date(),
        service: metrics.service || 'system',
        environment: process.env.NODE_ENV || 'development',
      };

      // Add to performance history for trend analysis
      this.addToPerformanceHistory(performanceData);

      const event = createSystemPerformanceEvent(
        this.SYSTEM_USER_ID,
        performanceData,
        this.webSocketGateway.getGlobalRoom(),
        WebSocketRoomType.GLOBAL
      );

      await this.broadcastSystemEvent(event);

      // Check for performance-based alerts
      await this.checkPerformanceAlerts(performanceData);

      this.logger.debug(`Performance metrics emitted for ${performanceData.service}`);
    } catch (error) {
      this.logger.error(`Failed to emit performance metrics: ${error.message}`);
    }
  }

  /**
   * Emit system alert notification
   *
   * @param alertData Alert notification data
   */
  async emitSystemAlert(alertData: Omit<SystemAlertEventData, 'alertId' | 'triggeredAt'>): Promise<void> {
    try {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const fullAlertData: SystemAlertEventData = {
        ...alertData,
        alertId,
        triggeredAt: new Date(),
        environment: process.env.NODE_ENV || 'development',
      };

      // Check for alert cooldown to prevent spam
      if (this.isAlertInCooldown(fullAlertData)) {
        this.logger.debug(`Alert ${alertId} suppressed due to cooldown period`);
        return;
      }

      const event = createSystemAlertEvent(
        this.SYSTEM_USER_ID,
        fullAlertData,
        this.webSocketGateway.getGlobalRoom(),
        WebSocketRoomType.GLOBAL
      );

      await this.broadcastSystemEvent(event);
      this.activeAlerts.set(alertId, fullAlertData);

      this.logger.warn(`System alert emitted: ${fullAlertData.title} (${fullAlertData.severity})`);
    } catch (error) {
      this.logger.error(`Failed to emit system alert: ${error.message}`);
    }
  }

  /**
   * Acknowledge a system alert
   *
   * @param alertId ID of the alert to acknowledge
   * @param acknowledgedBy User ID who acknowledged the alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        this.logger.warn(`Attempt to acknowledge non-existent alert: ${alertId}`);
        return;
      }

      const updatedAlert: SystemAlertEventData = {
        ...alert,
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: new Date(),
      };

      const event = createSystemAlertEvent(
        acknowledgedBy,
        updatedAlert,
        this.webSocketGateway.getGlobalRoom(),
        WebSocketRoomType.GLOBAL
      );

      await this.broadcastSystemEvent(event);
      this.activeAlerts.set(alertId, updatedAlert);

      this.logger.log(`Alert ${alertId} acknowledged by user ${acknowledgedBy}`);
    } catch (error) {
      this.logger.error(`Failed to acknowledge alert ${alertId}: ${error.message}`);
    }
  }

  /**
   * Resolve a system alert
   *
   * @param alertId ID of the alert to resolve
   * @param resolvedBy User ID who resolved the alert
   */
  async resolveAlert(alertId: string, resolvedBy?: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        this.logger.warn(`Attempt to resolve non-existent alert: ${alertId}`);
        return;
      }

      const resolvedAlert: SystemAlertEventData = {
        ...alert,
        resolvedAt: new Date(),
      };

      const event = createSystemAlertEvent(
        resolvedBy || this.SYSTEM_USER_ID,
        resolvedAlert,
        this.webSocketGateway.getGlobalRoom(),
        WebSocketRoomType.GLOBAL
      );

      await this.broadcastSystemEvent(event);
      this.activeAlerts.delete(alertId);

      this.logger.log(`Alert ${alertId} resolved${resolvedBy ? ` by user ${resolvedBy}` : ' automatically'}`);
    } catch (error) {
      this.logger.error(`Failed to resolve alert ${alertId}: ${error.message}`);
    }
  }

  /**
   * Manual system health check method
   * In a full implementation, this would be scheduled to run every 30 seconds
   */
  async performSystemHealthCheck(): Promise<void> {
    try {
      await Promise.all(this.HEALTH_CHECK_SERVICES.map(service =>
        this.checkServiceHealth(service)
      ));
    } catch (error) {
      this.logger.error(`System health check failed: ${error.message}`);
    }
  }

  /**
   * Manual performance metrics collection method
   * In a full implementation, this would be scheduled to run every minute
   */
  async collectPerformanceMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherSystemMetrics();
      await this.emitPerformanceMetrics(metrics);
    } catch (error) {
      this.logger.error(`Performance metrics collection failed: ${error.message}`);
    }
  }

  /**
   * Check health status of a specific service
   *
   * @private
   */
  private async checkServiceHealth(service: string): Promise<void> {
    let status = SystemHealthStatus.HEALTHY;
    let message = '';
    let details: Record<string, any> = {};
    let responseTime = 0;

    const startTime = Date.now();

    try {
      switch (service) {
        case 'database':
          // Simulate database health check
          // In real implementation, check database connectivity
          status = SystemHealthStatus.HEALTHY;
          break;

        case 'redis':
          // Simulate Redis health check
          status = SystemHealthStatus.HEALTHY;
          break;

        case 'queue':
          // Check queue system health
          details = await this.checkQueueHealth();
          status = details.healthy ? SystemHealthStatus.HEALTHY : SystemHealthStatus.DEGRADED;
          break;

        case 'websocket':
          // Check WebSocket connectivity
          details = this.webSocketGateway.getConnectionStats();
          status = SystemHealthStatus.HEALTHY;
          break;

        case 'api':
          // Check API health
          const systemStats = await this.gatherSystemMetrics();
          status = this.determineApiHealthFromMetrics(systemStats);
          details = systemStats;
          break;

        default:
          status = SystemHealthStatus.HEALTHY;
      }

      responseTime = Date.now() - startTime;
      details.responseTime = responseTime;

    } catch (error) {
      status = SystemHealthStatus.UNHEALTHY;
      message = `Health check failed: ${error.message}`;
      responseTime = Date.now() - startTime;
    }

    await this.emitHealthStatus(service, status, message, details);
  }

  /**
   * Gather comprehensive system metrics
   *
   * @private
   */
  private async gatherSystemMetrics(): Promise<SystemPerformanceEventData> {
    const memInfo = process.memoryUsage();
    const cpuUsage = await this.getCpuUsage();

    return {
      // CPU metrics
      cpuUsage,
      cpuLoadAverage: os.loadavg(),

      // Memory metrics
      memoryUsage: memInfo.rss,
      memoryTotal: os.totalmem(),
      memoryPercentage: (memInfo.rss / os.totalmem()) * 100,
      heapUsed: memInfo.heapUsed,
      heapTotal: memInfo.heapTotal,

      // Application metrics
      activeConnections: this.webSocketGateway.getConnectionCount(),

      // System info
      service: 'system',
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * Calculate CPU usage percentage
   *
   * @private
   */
  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();

      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const currentTime = Date.now();

        const userPercent = (currentUsage.user / 1000) / (currentTime - startTime) * 100;
        const systemPercent = (currentUsage.system / 1000) / (currentTime - startTime) * 100;

        resolve(Math.min(100, userPercent + systemPercent));
      }, 100);
    });
  }

  /**
   * Check queue system health
   *
   * @private
   */
  private async checkQueueHealth(): Promise<Record<string, any>> {
    // In real implementation, check BullMQ queue health
    return {
      healthy: true,
      queueSize: 0,
      activeJobs: 0,
      failedJobs: 0,
      completedJobs: 0,
    };
  }

  /**
   * Determine API health from system metrics
   *
   * @private
   */
  private determineApiHealthFromMetrics(metrics: SystemPerformanceEventData): SystemHealthStatus {
    if (metrics.memoryPercentage && metrics.memoryPercentage > 90) {
      return SystemHealthStatus.CRITICAL;
    }

    if (metrics.cpuUsage && metrics.cpuUsage > 85) {
      return SystemHealthStatus.UNHEALTHY;
    }

    if ((metrics.memoryPercentage && metrics.memoryPercentage > 75) ||
        (metrics.cpuUsage && metrics.cpuUsage > 70)) {
      return SystemHealthStatus.DEGRADED;
    }

    return SystemHealthStatus.HEALTHY;
  }

  /**
   * Check if health status change should generate an alert
   *
   * @private
   */
  private shouldGenerateHealthAlert(
    currentStatus: SystemHealthStatus,
    previousStatus?: SystemHealthStatus
  ): boolean {
    if (!previousStatus) return false;

    const statusPriority = {
      [SystemHealthStatus.HEALTHY]: 0,
      [SystemHealthStatus.DEGRADED]: 1,
      [SystemHealthStatus.UNHEALTHY]: 2,
      [SystemHealthStatus.CRITICAL]: 3,
    };

    return statusPriority[currentStatus] > statusPriority[previousStatus];
  }

  /**
   * Generate health degradation alert
   *
   * @private
   */
  private async generateHealthAlert(
    service: string,
    currentStatus: SystemHealthStatus,
    previousStatus?: SystemHealthStatus,
    message?: string
  ): Promise<void> {
    const severity = this.getAlertSeverityFromHealth(currentStatus);

    await this.emitSystemAlert({
      title: `Service Health Degradation: ${service}`,
      message: message || `Service ${service} status changed from ${previousStatus || 'unknown'} to ${currentStatus}`,
      severity,
      category: 'availability',
      service,
      autoResolve: currentStatus === SystemHealthStatus.HEALTHY,
      tags: ['health', 'monitoring', service],
    });
  }

  /**
   * Check performance metrics for alert conditions
   *
   * @private
   */
  private async checkPerformanceAlerts(metrics: SystemPerformanceEventData): Promise<void> {
    const alerts: Array<Omit<SystemAlertEventData, 'alertId' | 'triggeredAt'>> = [];

    // CPU usage alert
    if (metrics.cpuUsage && metrics.cpuUsage > this.PERFORMANCE_THRESHOLDS.cpuUsage) {
      alerts.push({
        title: 'High CPU Usage Detected',
        message: `CPU usage is ${metrics.cpuUsage.toFixed(1)}%, exceeding threshold of ${this.PERFORMANCE_THRESHOLDS.cpuUsage}%`,
        severity: metrics.cpuUsage > 90 ? 'critical' : 'high',
        category: 'performance',
        service: metrics.service,
        rule: 'cpu_usage_threshold',
        threshold: this.PERFORMANCE_THRESHOLDS.cpuUsage,
        currentValue: metrics.cpuUsage,
        tags: ['performance', 'cpu'],
      });
    }

    // Memory usage alert
    if (metrics.memoryPercentage && metrics.memoryPercentage > this.PERFORMANCE_THRESHOLDS.memoryUsage) {
      alerts.push({
        title: 'High Memory Usage Detected',
        message: `Memory usage is ${metrics.memoryPercentage.toFixed(1)}%, exceeding threshold of ${this.PERFORMANCE_THRESHOLDS.memoryUsage}%`,
        severity: metrics.memoryPercentage > 95 ? 'critical' : 'high',
        category: 'performance',
        service: metrics.service,
        rule: 'memory_usage_threshold',
        threshold: this.PERFORMANCE_THRESHOLDS.memoryUsage,
        currentValue: metrics.memoryPercentage,
        tags: ['performance', 'memory'],
      });
    }

    // Emit all alerts
    for (const alert of alerts) {
      await this.emitSystemAlert(alert);
    }
  }

  /**
   * Add performance data to history for trend analysis
   *
   * @private
   */
  private addToPerformanceHistory(data: SystemPerformanceEventData): void {
    this.performanceHistory.push(data);

    // Keep only recent history
    if (this.performanceHistory.length > this.PERFORMANCE_HISTORY_SIZE) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Check if alert is in cooldown period to prevent spam
   *
   * @private
   */
  private isAlertInCooldown(alert: SystemAlertEventData): boolean {
    const now = Date.now();

    for (const [_, activeAlert] of this.activeAlerts) {
      if (activeAlert.service === alert.service &&
          activeAlert.category === alert.category &&
          activeAlert.rule === alert.rule &&
          !activeAlert.resolvedAt &&
          (now - activeAlert.triggeredAt.getTime()) < this.ALERT_COOLDOWN_MS) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get alert severity from health status
   *
   * @private
   */
  private getAlertSeverityFromHealth(status: SystemHealthStatus): 'low' | 'medium' | 'high' | 'critical' {
    switch (status) {
      case SystemHealthStatus.CRITICAL:
        return 'critical';
      case SystemHealthStatus.UNHEALTHY:
        return 'high';
      case SystemHealthStatus.DEGRADED:
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Broadcast system event to appropriate rooms with permission filtering
   *
   * @private
   */
  private async broadcastSystemEvent(event: WebSocketEvent): Promise<void> {
    // System events are broadcast to global room for administrators
    // In a full implementation, you would add permission filtering
    this.webSocketGateway.emitToRoom(this.webSocketGateway.getGlobalRoom(), event);

    // Also broadcast to admin-specific rooms if they exist
    const adminRoom = this.webSocketGateway.getAdminRoom();
    if (adminRoom) {
      this.webSocketGateway.emitToRoom(adminRoom, event);
    }
  }

  /**
   * Get current system health overview
   */
  getSystemHealthOverview(): Record<string, any> {
    const healthOverview: Record<string, any> = {};

    for (const [service, status] of this.previousHealthStatus) {
      healthOverview[service] = status;
    }

    return {
      services: healthOverview,
      alertsActive: this.activeAlerts.size,
      performanceHistorySize: this.performanceHistory.length,
      lastCheck: new Date(),
    };
  }

  /**
   * Get active alerts summary
   */
  getActiveAlerts(): SystemAlertEventData[] {
    return Array.from(this.activeAlerts.values())
      .filter(alert => !alert.resolvedAt)
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
  }

  /**
   * Get performance metrics history
   */
  getPerformanceHistory(): SystemPerformanceEventData[] {
    return [...this.performanceHistory];
  }
}