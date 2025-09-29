import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { JWTPayload } from '../../schemas/auth.schemas';

export interface ConnectionInfo {
  userId: string;
  socket: Socket;
  rooms: Set<string>;
  connectedAt: Date;
  lastActivity: Date;
  healthStatus: 'healthy' | 'stale' | 'disconnected';
  metrics: {
    messagesReceived: number;
    messagesSent: number;
    roomJoins: number;
    roomLeaves: number;
  };
}

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  staleConnections: number;
  roomDistribution: Record<string, number>;
  memoryUsage: {
    connectionsMemory: number;
    averagePerConnection: number;
  };
  performanceMetrics: {
    avgLatency: number;
    messagesPerSecond: number;
    connectionThroughput: number;
  };
}

export interface ScalingConfig {
  maxConnectionsPerInstance: number;
  connectionHealthCheckInterval: number;
  staleConnectionTimeout: number;
  cleanupInterval: number;
  memoryOptimizationThreshold: number;
  enableHorizontalScaling: boolean;
  loadBalancingStrategy: 'round-robin' | 'least-connections' | 'memory-based';
}

/**
 * WebSocket Connection Manager Service
 *
 * Manages large numbers of concurrent WebSocket connections efficiently
 * Features:
 * - Connection pool management with health monitoring
 * - Automatic cleanup of stale connections
 * - Memory optimization and connection scaling
 * - Horizontal scaling support with load balancing
 * - Performance metrics and monitoring
 * - Connection health checks and recovery
 *
 * Follows SOLID principles:
 * - SRP: Single responsibility for connection management
 * - OCP: Open for extension via interfaces and config
 * - LSP: Substitutable interface contracts
 * - ISP: Segregated interfaces for different concerns
 * - DIP: Depends on abstractions, not concretions
 */
@Injectable()
export class ConnectionManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConnectionManagerService.name);

  // Connection pool - using Map for O(1) operations
  private readonly connections = new Map<string, ConnectionInfo>();

  // Room membership tracking for efficient lookups
  private readonly roomMembership = new Map<string, Set<string>>();

  // User-to-socket mapping for quick user lookups
  private readonly userSockets = new Map<string, Set<string>>();

  // Health monitoring intervals
  private healthCheckInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;

  // Performance metrics
  private metrics = {
    totalMessagesProcessed: 0,
    avgLatency: 0,
    connectionsPerSecond: 0,
    lastConnectionTime: Date.now(),
    connectionHistory: [] as number[],
  };

  // Scaling configuration
  private readonly config: ScalingConfig = {
    maxConnectionsPerInstance: parseInt(process.env.WS_MAX_CONNECTIONS || '10000'),
    connectionHealthCheckInterval: parseInt(process.env.WS_HEALTH_CHECK_INTERVAL || '30000'),
    staleConnectionTimeout: parseInt(process.env.WS_STALE_TIMEOUT || '300000'), // 5 minutes
    cleanupInterval: parseInt(process.env.WS_CLEANUP_INTERVAL || '60000'), // 1 minute
    memoryOptimizationThreshold: parseFloat(process.env.WS_MEMORY_THRESHOLD || '0.8'), // 80%
    enableHorizontalScaling: process.env.WS_ENABLE_SCALING === 'true',
    loadBalancingStrategy: (process.env.WS_LOAD_STRATEGY as any) || 'least-connections',
  };

  async onModuleInit() {
    this.logger.log('Initializing WebSocket Connection Manager');
    this.startHealthMonitoring();
    this.startCleanupProcess();
    this.startMetricsCollection();

    this.logger.log(`Connection Manager initialized with max connections: ${this.config.maxConnectionsPerInstance}`);
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down WebSocket Connection Manager');

    // Clear all intervals
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);

    // Gracefully disconnect all connections
    await this.gracefulShutdown();
  }

  /**
   * Register a new WebSocket connection
   */
  registerConnection(socket: Socket, user: JWTPayload): boolean {
    try {
      // Validate inputs
      if (!socket || !socket.id || !user || !user.sub) {
        this.logger.error('Invalid socket or user provided for registration');
        return false;
      }

      // Check connection limits
      if (this.connections.size >= this.config.maxConnectionsPerInstance) {
        this.logger.warn(`Connection limit reached (${this.config.maxConnectionsPerInstance}). Rejecting new connection.`);
        return false;
      }

      const connectionInfo: ConnectionInfo = {
        userId: user.sub,
        socket,
        rooms: new Set(),
        connectedAt: new Date(),
        lastActivity: new Date(),
        healthStatus: 'healthy',
        metrics: {
          messagesReceived: 0,
          messagesSent: 0,
          roomJoins: 0,
          roomLeaves: 0,
        },
      };

      // Store connection
      this.connections.set(socket.id, connectionInfo);

      // Update user-socket mapping
      if (!this.userSockets.has(user.sub)) {
        this.userSockets.set(user.sub, new Set());
      }
      this.userSockets.get(user.sub)!.add(socket.id);

      // Set up socket event listeners for metrics
      this.setupSocketMetrics(socket, connectionInfo);

      // Update connection metrics
      this.updateConnectionMetrics();

      this.logger.debug(`Registered connection ${socket.id} for user ${user.username} (${user.sub})`);
      return true;

    } catch (error) {
      const socketId = socket?.id || 'unknown';
      this.logger.error(`Failed to register connection ${socketId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Unregister a WebSocket connection
   */
  unregisterConnection(socketId: string): void {
    try {
      const connection = this.connections.get(socketId);
      if (!connection) {
        this.logger.debug(`Connection ${socketId} not found for unregistration`);
        return;
      }

      // Remove from all rooms
      for (const room of connection.rooms) {
        this.removeFromRoom(socketId, room);
      }

      // Update user-socket mapping
      const userSocketSet = this.userSockets.get(connection.userId);
      if (userSocketSet) {
        userSocketSet.delete(socketId);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(connection.userId);
        }
      }

      // Remove connection
      this.connections.delete(socketId);

      this.logger.debug(`Unregistered connection ${socketId} for user ${connection.userId}`);

    } catch (error) {
      this.logger.error(`Failed to unregister connection ${socketId}: ${error.message}`);
    }
  }

  /**
   * Add connection to room with efficient tracking
   */
  addToRoom(socketId: string, room: string): boolean {
    try {
      const connection = this.connections.get(socketId);
      if (!connection) {
        this.logger.warn(`Cannot add non-existent connection ${socketId} to room ${room}`);
        return false;
      }

      // Add to connection's rooms
      connection.rooms.add(room);
      connection.metrics.roomJoins++;

      // Add to room membership tracking
      if (!this.roomMembership.has(room)) {
        this.roomMembership.set(room, new Set());
      }
      this.roomMembership.get(room)!.add(socketId);

      this.logger.debug(`Added connection ${socketId} to room ${room}`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to add connection ${socketId} to room ${room}: ${error.message}`);
      return false;
    }
  }

  /**
   * Remove connection from room
   */
  removeFromRoom(socketId: string, room: string): boolean {
    try {
      const connection = this.connections.get(socketId);
      if (connection) {
        connection.rooms.delete(room);
        connection.metrics.roomLeaves++;
      }

      // Remove from room membership tracking
      const roomMembers = this.roomMembership.get(room);
      if (roomMembers) {
        roomMembers.delete(socketId);
        if (roomMembers.size === 0) {
          this.roomMembership.delete(room);
        }
      }

      this.logger.debug(`Removed connection ${socketId} from room ${room}`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to remove connection ${socketId} from room ${room}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get connections in a specific room
   */
  getRoomConnections(room: string): ConnectionInfo[] {
    const roomMembers = this.roomMembership.get(room);
    if (!roomMembers) return [];

    const connections: ConnectionInfo[] = [];
    for (const socketId of roomMembers) {
      const connection = this.connections.get(socketId);
      if (connection) {
        connections.push(connection);
      }
    }

    return connections;
  }

  /**
   * Get all connections for a specific user
   */
  getUserConnections(userId: string): ConnectionInfo[] {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds) return [];

    const connections: ConnectionInfo[] = [];
    for (const socketId of socketIds) {
      const connection = this.connections.get(socketId);
      if (connection) {
        connections.push(connection);
      }
    }

    return connections;
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): ConnectionPoolStats {
    const totalConnections = this.connections.size;
    let activeConnections = 0;
    let staleConnections = 0;
    const roomDistribution: Record<string, number> = {};

    // Calculate connection states and room distribution
    for (const connection of this.connections.values()) {
      if (connection.healthStatus === 'healthy') {
        activeConnections++;
      } else if (connection.healthStatus === 'stale') {
        staleConnections++;
      }

      for (const room of connection.rooms) {
        roomDistribution[room] = (roomDistribution[room] || 0) + 1;
      }
    }

    // Calculate memory usage (approximate)
    const connectionsMemory = this.estimateMemoryUsage();
    const averagePerConnection = totalConnections > 0 ? connectionsMemory / totalConnections : 0;

    return {
      totalConnections,
      activeConnections,
      staleConnections,
      roomDistribution,
      memoryUsage: {
        connectionsMemory,
        averagePerConnection,
      },
      performanceMetrics: {
        avgLatency: this.metrics.avgLatency,
        messagesPerSecond: this.calculateMessagesPerSecond(),
        connectionThroughput: this.metrics.connectionsPerSecond,
      },
    };
  }

  /**
   * Check if the connection manager can accept new connections
   */
  canAcceptConnections(): boolean {
    const currentConnections = this.connections.size;
    const maxConnections = this.config.maxConnectionsPerInstance;
    const utilizationRate = currentConnections / maxConnections;

    // Consider memory pressure
    const memoryUsage = this.estimateMemoryUsage();
    const memoryPressure = memoryUsage > (1024 * 1024 * 100); // 100MB threshold

    return utilizationRate < 0.95 && !memoryPressure;
  }

  /**
   * Get configuration for horizontal scaling
   */
  getScalingConfig(): ScalingConfig {
    return { ...this.config };
  }

  /**
   * Update scaling configuration
   */
  updateScalingConfig(updates: Partial<ScalingConfig>): void {
    Object.assign(this.config, updates);
    this.logger.log(`Updated scaling configuration: ${JSON.stringify(updates)}`);
  }

  /**
   * Start health monitoring process
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.connectionHealthCheckInterval);

    this.logger.debug(`Health monitoring started with ${this.config.connectionHealthCheckInterval}ms interval`);
  }

  /**
   * Start cleanup process for stale connections
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, this.config.cleanupInterval);

    this.logger.debug(`Cleanup process started with ${this.config.cleanupInterval}ms interval`);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 5000); // Update metrics every 5 seconds

    this.logger.debug('Metrics collection started');
  }

  /**
   * Perform health check on all connections
   */
  private performHealthCheck(): void {
    const now = Date.now();
    let healthyCount = 0;
    let staleCount = 0;

    for (const [socketId, connection] of this.connections) {
      const timeSinceActivity = now - connection.lastActivity.getTime();

      if (timeSinceActivity > this.config.staleConnectionTimeout) {
        connection.healthStatus = 'stale';
        staleCount++;
      } else {
        connection.healthStatus = 'healthy';
        healthyCount++;
      }

      // Ping stale connections to check if they're still alive
      if (connection.healthStatus === 'stale') {
        this.pingConnection(connection);
      }
    }

    this.logger.debug(`Health check completed: ${healthyCount} healthy, ${staleCount} stale connections`);
  }

  /**
   * Clean up stale connections
   */
  private cleanupStaleConnections(): void {
    const staleCutoff = Date.now() - this.config.staleConnectionTimeout * 2; // Double timeout for cleanup
    const connectionsToCleanup: string[] = [];

    for (const [socketId, connection] of this.connections) {
      if (connection.healthStatus === 'stale' &&
          connection.lastActivity.getTime() < staleCutoff) {
        connectionsToCleanup.push(socketId);
      }
    }

    for (const socketId of connectionsToCleanup) {
      const connection = this.connections.get(socketId);
      if (connection) {
        this.logger.warn(`Cleaning up stale connection ${socketId} for user ${connection.userId}`);
        connection.socket.disconnect(true);
        this.unregisterConnection(socketId);
      }
    }

    if (connectionsToCleanup.length > 0) {
      this.logger.log(`Cleaned up ${connectionsToCleanup.length} stale connections`);
    }
  }

  /**
   * Ping a connection to check if it's still alive
   */
  private pingConnection(connection: ConnectionInfo): void {
    try {
      connection.socket.emit('ping', { timestamp: Date.now() });

      // Set up timeout for pong response
      const pongTimeout = setTimeout(() => {
        this.logger.warn(`Connection ${connection.socket.id} failed ping test`);
        connection.healthStatus = 'disconnected';
      }, 5000);

      // Listen for pong response once
      connection.socket.once('pong', () => {
        clearTimeout(pongTimeout);
        connection.lastActivity = new Date();
        connection.healthStatus = 'healthy';
        this.logger.debug(`Connection ${connection.socket.id} responded to ping`);
      });

    } catch (error) {
      this.logger.error(`Failed to ping connection ${connection.socket.id}: ${error.message}`);
      connection.healthStatus = 'disconnected';
    }
  }

  /**
   * Set up socket metrics tracking
   */
  private setupSocketMetrics(socket: Socket, connection: ConnectionInfo): void {
    // Track messages received
    socket.onAny(() => {
      connection.metrics.messagesReceived++;
      connection.lastActivity = new Date();
      this.metrics.totalMessagesProcessed++;
    });

    // Track messages sent (override emit)
    const originalEmit = socket.emit.bind(socket);
    socket.emit = (...args: any[]) => {
      connection.metrics.messagesSent++;
      return originalEmit(...args);
    };
  }

  /**
   * Update connection-related metrics
   */
  private updateConnectionMetrics(): void {
    const now = Date.now();
    const timeSinceLastConnection = now - this.metrics.lastConnectionTime;

    // Update connection rate
    this.metrics.connectionHistory.push(now);

    // Keep only last minute of connection history
    const oneMinuteAgo = now - 60000;
    this.metrics.connectionHistory = this.metrics.connectionHistory.filter(time => time > oneMinuteAgo);

    // Calculate connections per second
    this.metrics.connectionsPerSecond = this.metrics.connectionHistory.length / 60;
    this.metrics.lastConnectionTime = now;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    // Calculate messages per second
    // This is a simplified calculation - in production, you'd want more sophisticated metrics
    const messagesPerSecond = this.calculateMessagesPerSecond();

    this.logger.debug(`Performance metrics - Messages/sec: ${messagesPerSecond}, Connections: ${this.connections.size}`);
  }

  /**
   * Calculate messages per second
   */
  private calculateMessagesPerSecond(): number {
    // Simplified calculation - in production, implement proper rate calculation
    let totalMessages = 0;
    for (const connection of this.connections.values()) {
      totalMessages += connection.metrics.messagesReceived + connection.metrics.messagesSent;
    }

    return totalMessages / Math.max(1, this.connections.size);
  }

  /**
   * Estimate memory usage of connection pool
   */
  private estimateMemoryUsage(): number {
    // Rough estimation - in production, use more sophisticated memory tracking
    const connectionOverhead = 1024; // Estimated bytes per connection
    const roomOverhead = 100; // Estimated bytes per room membership

    let totalMemory = this.connections.size * connectionOverhead;

    for (const connection of this.connections.values()) {
      totalMemory += connection.rooms.size * roomOverhead;
    }

    return totalMemory;
  }

  /**
   * Graceful shutdown process
   */
  private async gracefulShutdown(): Promise<void> {
    this.logger.log(`Initiating graceful shutdown for ${this.connections.size} connections`);

    const shutdownPromises: Promise<void>[] = [];

    for (const [socketId, connection] of this.connections) {
      shutdownPromises.push(
        new Promise<void>((resolve) => {
          // Send shutdown notice
          connection.socket.emit('shutdown', {
            message: 'Server is shutting down',
            timestamp: new Date()
          });

          // Disconnect after brief delay
          setTimeout(() => {
            connection.socket.disconnect(true);
            this.unregisterConnection(socketId);
            resolve();
          }, 1000);
        })
      );
    }

    try {
      await Promise.allSettled(shutdownPromises);
      this.logger.log('Graceful shutdown completed');
    } catch (error) {
      this.logger.error(`Error during graceful shutdown: ${error.message}`);
    }
  }
}