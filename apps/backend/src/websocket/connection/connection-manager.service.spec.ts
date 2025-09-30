import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionManagerService } from './connection-manager.service';
import { Socket } from 'socket.io';
import { JWTPayload } from '@schemas/auth';

describe('ConnectionManagerService', () => {
  let service: ConnectionManagerService;
  let mockSocket: Partial<Socket>;
  let mockUser: JWTPayload;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConnectionManagerService],
    }).compile();

    service = module.get<ConnectionManagerService>(ConnectionManagerService);

    // Create mock socket
    mockSocket = {
      id: 'socket-123',
      emit: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      onAny: jest.fn(),
      disconnect: jest.fn(),
    };

    // Create mock user
    mockUser = {
      sub: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    };
  });

  afterEach(async () => {
    // Clean up any intervals
    await service.onModuleDestroy();
  });

  describe('Connection Registration', () => {
    it('should register a new connection successfully', () => {
      const result = service.registerConnection(mockSocket as Socket, mockUser);
      expect(result).toBe(true);
    });

    it('should track connection count', () => {
      service.registerConnection(mockSocket as Socket, mockUser);
      const stats = service.getPoolStats();
      expect(stats.totalConnections).toBe(1);
    });

    it('should reject connections when at capacity', () => {
      // Set a low capacity for testing
      service.updateScalingConfig({ maxConnectionsPerInstance: 1 });

      // Register first connection
      const firstResult = service.registerConnection(mockSocket as Socket, mockUser);
      expect(firstResult).toBe(true);

      // Try to register second connection - should fail
      const secondSocket = { ...mockSocket, id: 'socket-456' };
      const secondResult = service.registerConnection(secondSocket as Socket, mockUser);
      expect(secondResult).toBe(false);
    });
  });

  describe('Connection Unregistration', () => {
    it('should unregister connection successfully', () => {
      service.registerConnection(mockSocket as Socket, mockUser);
      service.unregisterConnection(mockSocket.id as string);

      const stats = service.getPoolStats();
      expect(stats.totalConnections).toBe(0);
    });

    it('should handle unregistering non-existent connection', () => {
      // Should not throw error
      expect(() => service.unregisterConnection('non-existent')).not.toThrow();
    });
  });

  describe('Room Management', () => {
    beforeEach(() => {
      service.registerConnection(mockSocket as Socket, mockUser);
    });

    it('should add connection to room', () => {
      const result = service.addToRoom(mockSocket.id as string, 'test-room');
      expect(result).toBe(true);

      const roomConnections = service.getRoomConnections('test-room');
      expect(roomConnections).toHaveLength(1);
      expect(roomConnections[0].userId).toBe(mockUser.sub);
    });

    it('should remove connection from room', () => {
      service.addToRoom(mockSocket.id as string, 'test-room');
      service.removeFromRoom(mockSocket.id as string, 'test-room');

      const roomConnections = service.getRoomConnections('test-room');
      expect(roomConnections).toHaveLength(0);
    });

    it('should handle removing from non-existent room', () => {
      const result = service.removeFromRoom(mockSocket.id as string, 'non-existent');
      expect(result).toBe(true);
    });
  });

  describe('User Connection Tracking', () => {
    it('should track multiple connections for same user', () => {
      const secondSocket = { ...mockSocket, id: 'socket-456' };

      service.registerConnection(mockSocket as Socket, mockUser);
      service.registerConnection(secondSocket as Socket, mockUser);

      const userConnections = service.getUserConnections(mockUser.sub);
      expect(userConnections).toHaveLength(2);
    });

    it('should return empty array for non-existent user', () => {
      const userConnections = service.getUserConnections('non-existent');
      expect(userConnections).toHaveLength(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate pool statistics', () => {
      service.registerConnection(mockSocket as Socket, mockUser);
      service.addToRoom(mockSocket.id as string, 'test-room');

      const stats = service.getPoolStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeConnections).toBe(1);
      expect(stats.roomDistribution['test-room']).toBe(1);
    });

    it('should calculate memory usage estimates', () => {
      service.registerConnection(mockSocket as Socket, mockUser);

      const stats = service.getPoolStats();
      expect(stats.memoryUsage.connectionsMemory).toBeGreaterThan(0);
      expect(stats.memoryUsage.averagePerConnection).toBeGreaterThan(0);
    });
  });

  describe('Capacity Management', () => {
    it('should report when can accept connections', () => {
      expect(service.canAcceptConnections()).toBe(true);
    });

    it('should report when at capacity', () => {
      service.updateScalingConfig({ maxConnectionsPerInstance: 1 });
      service.registerConnection(mockSocket as Socket, mockUser);

      expect(service.canAcceptConnections()).toBe(false);
    });
  });

  describe('Configuration Management', () => {
    it('should get scaling configuration', () => {
      const config = service.getScalingConfig();
      expect(config).toHaveProperty('maxConnectionsPerInstance');
      expect(config).toHaveProperty('connectionHealthCheckInterval');
    });

    it('should update scaling configuration', () => {
      const updates = { maxConnectionsPerInstance: 5000 };
      service.updateScalingConfig(updates);

      const config = service.getScalingConfig();
      expect(config.maxConnectionsPerInstance).toBe(5000);
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(() => {
      service.registerConnection(mockSocket as Socket, mockUser);
    });

    it('should track connection health status', () => {
      const userConnections = service.getUserConnections(mockUser.sub);
      expect(userConnections[0].healthStatus).toBe('healthy');
    });

    it('should track connection metrics', () => {
      const userConnections = service.getUserConnections(mockUser.sub);
      const connection = userConnections[0];

      expect(connection.metrics).toHaveProperty('messagesReceived');
      expect(connection.metrics).toHaveProperty('messagesSent');
      expect(connection.metrics).toHaveProperty('roomJoins');
      expect(connection.metrics).toHaveProperty('roomLeaves');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in registration gracefully', () => {
      const invalidSocket = null as any;
      const result = service.registerConnection(invalidSocket, mockUser);
      expect(result).toBe(false);
    });

    it('should handle errors in room operations gracefully', () => {
      const result = service.addToRoom('non-existent-socket', 'test-room');
      expect(result).toBe(false);
    });
  });
});