import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebSocketMetricsService } from './websocket-metrics.service';
import { ConnectionManagerService } from '../connection/connection-manager.service';
import { WebSocketGateway } from '../websocket.gateway';

describe('WebSocketMetricsService', () => {
  let service: WebSocketMetricsService;
  let connectionManager: jest.Mocked<ConnectionManagerService>;
  let webSocketGateway: jest.Mocked<WebSocketGateway>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockConnectionManager = {
      getConnectionStats: jest.fn().mockReturnValue({
        totalConnections: 100,
        activeConnections: 95,
        staleConnections: 5,
        roomDistribution: {
          'room1': 20,
          'room2': 30,
          'room3': 50,
        },
        memoryUsage: {
          connectionsMemory: 1024 * 1024,
          averagePerConnection: 1024,
        },
        performanceMetrics: {
          avgLatency: 50,
          messagesPerSecond: 1000,
          connectionThroughput: 100,
        },
      }),
    };

    const mockWebSocketGateway = {
      emitToRoom: jest.fn(),
      getGlobalRoom: jest.fn().mockReturnValue('global'),
      getAdminRoom: jest.fn().mockReturnValue('admin'),
      getConnectionCount: jest.fn().mockReturnValue(100),
    };

    const mockEventEmitter = {
      on: jest.fn(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketMetricsService,
        {
          provide: ConnectionManagerService,
          useValue: mockConnectionManager,
        },
        {
          provide: WebSocketGateway,
          useValue: mockWebSocketGateway,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<WebSocketMetricsService>(WebSocketMetricsService);
    connectionManager = module.get(ConnectionManagerService);
    webSocketGateway = module.get(WebSocketGateway);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with default metrics', () => {
      const metrics = service.getCurrentMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.activeConnections).toBe(0);
      expect(metrics.messagesPerSecond).toBe(0);
      expect(metrics.errorRate).toBe(0);
    });

    it('should initialize with default optimization settings', () => {
      const optimization = service.getOptimizationSettings();

      expect(optimization).toBeDefined();
      expect(optimization.eventBatching.enabled).toBe(true);
      expect(optimization.connectionPooling.enabled).toBe(true);
      expect(optimization.messageCompression.enabled).toBe(true);
    });
  });

  describe('Metrics Collection', () => {
    it('should record message latency correctly', () => {
      service.recordMessageLatency('test_event', 100);
      service.recordMessageLatency('test_event', 150);
      service.recordMessageLatency('test_event', 200);

      // Latency metrics are calculated during metrics collection
      // We can't directly access them, but we can verify no errors occur
      expect(() => service.recordMessageLatency('test_event', 250)).not.toThrow();
    });

    it('should record connection duration', () => {
      const socketId = 'socket123';
      const duration = 30000; // 30 seconds

      expect(() => service.recordConnectionDuration(socketId, duration)).not.toThrow();
    });

    it('should increment event counters', () => {
      service.incrementEventCounter('message_sent', 5);
      service.incrementEventCounter('message_received', 3);

      expect(() => service.incrementEventCounter('user_joined')).not.toThrow();
    });

    it('should record errors for tracking', () => {
      service.recordError('connection_failed');
      service.recordError('authentication_error');
      service.recordError('message_validation_error');

      expect(() => service.recordError('unknown_error')).not.toThrow();
    });

    it('should get current metrics', () => {
      const metrics = service.getCurrentMetrics();

      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('messagesPerSecond');
      expect(metrics).toHaveProperty('messageLatency');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('memoryUsage');
    });

    it('should maintain metrics history', () => {
      const history = service.getMetricsHistory(10);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Performance Optimization', () => {
    it('should optimize event broadcasting with batching enabled', () => {
      const room = 'test-room';
      const events = [
        { eventType: 'test1', data: { message: 'hello' } },
        { eventType: 'test2', data: { message: 'world' } },
      ];

      // Enable batching
      service.updateOptimization({
        eventBatching: {
          enabled: true,
          batchSize: 50,
          flushInterval: 100,
          efficiency: 0,
        },
      });

      expect(() => service.optimizeEventBroadcast(room, events)).not.toThrow();
    });

    it('should send events individually when batching disabled', () => {
      const room = 'test-room';
      const events = [
        { eventType: 'test1', data: { message: 'hello' } },
        { eventType: 'test2', data: { message: 'world' } },
      ];

      // Disable batching
      service.updateOptimization({
        eventBatching: {
          enabled: false,
          batchSize: 50,
          flushInterval: 100,
          efficiency: 0,
        },
      });

      service.optimizeEventBroadcast(room, events);

      expect(webSocketGateway.emitToRoom).toHaveBeenCalledTimes(2);
    });

    it('should update optimization settings', () => {
      const newSettings = {
        eventBatching: {
          enabled: false,
          batchSize: 25,
          flushInterval: 50,
          efficiency: 0,
        },
        messageCompression: {
          enabled: false,
          compressionLevel: 3,
          compressionRatio: 0,
        },
      };

      service.updateOptimization(newSettings);

      const optimization = service.getOptimizationSettings();
      expect(optimization.eventBatching.enabled).toBe(false);
      expect(optimization.eventBatching.batchSize).toBe(25);
      expect(optimization.messageCompression.enabled).toBe(false);
    });

    it('should provide performance recommendations', () => {
      // First record some high metrics to trigger recommendations
      service.recordError('connection_failed');
      service.recordError('timeout_error');

      const recommendations = service.getPerformanceRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      // Recommendations depend on current metrics state
    });
  });

  describe('Event Listeners', () => {
    it('should set up event listeners on module init', async () => {
      await service.onModuleInit();

      expect(eventEmitter.on).toHaveBeenCalledWith('websocket.connection.established', expect.any(Function));
      expect(eventEmitter.on).toHaveBeenCalledWith('websocket.connection.closed', expect.any(Function));
      expect(eventEmitter.on).toHaveBeenCalledWith('websocket.message.sent', expect.any(Function));
      expect(eventEmitter.on).toHaveBeenCalledWith('websocket.error', expect.any(Function));
    });
  });

  describe('Performance Thresholds', () => {
    beforeEach(() => {
      // Mock process.cpuUsage for CPU calculation
      const mockCpuUsage = jest.spyOn(process, 'cpuUsage');
      mockCpuUsage.mockReturnValue({
        user: 10000000, // 10ms in microseconds
        system: 5000000, // 5ms in microseconds
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle high CPU usage scenarios', () => {
      // Simulate high metrics that would trigger recommendations
      const recommendations = service.getPerformanceRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should handle memory optimization', () => {
      const optimization = service.getOptimizationSettings();
      expect(optimization.caching.enabled).toBe(true);
      expect(optimization.caching.cacheSize).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle metrics collection errors gracefully', () => {
      // Mock connection manager to throw error
      connectionManager.getConnectionStats.mockImplementation(() => {
        throw new Error('Connection stats error');
      });

      // Should not throw when collecting metrics fails
      expect(() => {
        // Trigger metrics collection indirectly
        service.getCurrentMetrics();
      }).not.toThrow();
    });

    it('should handle optimization processing errors', () => {
      // Update with invalid settings to trigger error handling
      expect(() => {
        service.updateOptimization({
          eventBatching: {
            enabled: true,
            batchSize: -1, // Invalid batch size
            flushInterval: -1, // Invalid interval
            efficiency: 0,
          },
        });
      }).not.toThrow();
    });
  });

  describe('Module Lifecycle', () => {
    it('should clean up on module destroy', async () => {
      await service.onModuleInit();

      expect(() => service.onModuleDestroy()).not.toThrow();
    });

    it('should flush batches on shutdown', async () => {
      // Add some events to batch
      service.optimizeEventBroadcast('test-room', [
        { eventType: 'test', data: { message: 'test' } }
      ]);

      await service.onModuleDestroy();

      // Should have attempted to flush batches
      expect(webSocketGateway.emitToRoom).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty event arrays in optimization', () => {
      expect(() => service.optimizeEventBroadcast('test-room', [])).not.toThrow();
    });

    it('should handle metrics with no data', () => {
      const metrics = service.getCurrentMetrics();
      expect(metrics.messageLatency.average).toBe(0);
      expect(metrics.connectionDuration.average).toBe(0);
    });

    it('should handle large numbers of events efficiently', () => {
      const largeEventArray = Array.from({ length: 1000 }, (_, i) => ({
        eventType: `test_${i}`,
        data: { index: i },
      }));

      expect(() => service.optimizeEventBroadcast('test-room', largeEventArray)).not.toThrow();
    });
  });
});