/**
 * @jest-environment jsdom
 */

import { validateWebSocketEvent, createWebSocketEvent, formatWebSocketError } from '../utils';
import { WebSocketEventSchema, TaskUpdateEvent } from '../types';
import { TaskState } from '@cc-task-manager/schemas';

// Mock Socket.IO client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    onAny: jest.fn(),
    off: jest.fn(),
  })),
}));

describe('WebSocket Utils', () => {
  describe('validateWebSocketEvent', () => {
    it('should validate a valid task update event', () => {
      const validEvent = {
        event: 'task:update',
        timestamp: new Date().toISOString(),
        data: {
          taskId: 'test-task-id',
          state: TaskState.RUNNING,
          lastActivity: new Date(),
        },
      };

      const result = validateWebSocketEvent(validEvent);
      expect(result).not.toBeNull();
      expect(result?.event).toBe('task:update');
    });

    it('should return null for invalid event', () => {
      const invalidEvent = {
        event: 'invalid:event',
        timestamp: 'invalid-timestamp',
        data: {},
      };

      const result = validateWebSocketEvent(invalidEvent);
      expect(result).toBeNull();
    });
  });

  describe('createWebSocketEvent', () => {
    it('should create a valid task update event', () => {
      const data = {
        taskId: 'test-task-id',
        state: TaskState.COMPLETED,
        lastActivity: new Date(),
      };

      const event = createWebSocketEvent<TaskUpdateEvent>('task:update', data);

      expect(event.event).toBe('task:update');
      expect(event.data).toEqual(data);
      expect(event.timestamp).toBeDefined();
    });
  });

  describe('formatWebSocketError', () => {
    it('should format Error object', () => {
      const error = new Error('Test error message');
      const formatted = formatWebSocketError(error);

      expect(formatted.message).toBe('Test error message');
      expect(formatted.code).toBe('UNKNOWN_ERROR');
      expect(formatted.timestamp).toBeDefined();
    });

    it('should format string error', () => {
      const error = 'String error message';
      const formatted = formatWebSocketError(error);

      expect(formatted.message).toBe('String error message');
      expect(formatted.code).toBe('UNKNOWN_ERROR');
      expect(formatted.timestamp).toBeDefined();
    });
  });
});

describe('WebSocket Event Schema', () => {
  it('should validate task update event schema', () => {
    const event = {
      event: 'task:update',
      timestamp: new Date().toISOString(),
      data: {
        taskId: 'test-task-id',
        state: TaskState.RUNNING,
        lastActivity: new Date(),
      },
    };

    expect(() => WebSocketEventSchema.parse(event)).not.toThrow();
  });

  it('should validate system status event schema', () => {
    const event = {
      event: 'system:status',
      timestamp: new Date().toISOString(),
      data: {
        activeTasks: 5,
        queueLength: 10,
        workerStatus: 'healthy' as const,
        uptime: 3600,
      },
    };

    expect(() => WebSocketEventSchema.parse(event)).not.toThrow();
  });

  it('should reject invalid event schema', () => {
    const event = {
      event: 'invalid:event',
      timestamp: new Date().toISOString(),
      data: {},
    };

    expect(() => WebSocketEventSchema.parse(event)).toThrow();
  });
});