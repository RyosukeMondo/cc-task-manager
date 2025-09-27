/**
 * @jest-environment jsdom
 */

import { io, Socket } from 'socket.io-client'
import { WebSocketClient } from '../../lib/websocket/client'
import { validateWebSocketEvent, createWebSocketEvent } from '../../lib/websocket/utils'
import { TaskState } from '@cc-task-manager/schemas'
import type { TaskUpdateEvent, SystemStatusEvent } from '../../lib/websocket/types'

// Mock socket.io-client
const mockSocket = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  connected: false,
  id: 'mock-socket-id',
} as any

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}))

describe('WebSocket Integration Tests', () => {
  let webSocketClient: WebSocketClient
  const mockAuthToken = 'mock-jwt-token'

  beforeEach(() => {
    jest.clearAllMocks()
    mockSocket.connected = false
    webSocketClient = new WebSocketClient({
      url: 'ws://localhost:3001',
      authToken: mockAuthToken,
    })
  })

  afterEach(() => {
    webSocketClient.disconnect()
  })

  describe('Connection Management', () => {
    it('should establish WebSocket connection with JWT authentication', async () => {
      const connectPromise = webSocketClient.connect()

      // Simulate successful connection
      const connectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]
      mockSocket.connected = true
      connectCallback?.()

      await connectPromise

      expect(io).toHaveBeenCalledWith('ws://localhost:3001', expect.objectContaining({
        auth: {
          token: mockAuthToken
        },
        transports: ['websocket']
      }))
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function))
    })

    it('should handle connection errors gracefully', async () => {
      const errorCallback = jest.fn()
      webSocketClient.onError(errorCallback)

      const connectPromise = webSocketClient.connect()

      // Simulate connection error
      const connectErrorCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect_error'
      )?.[1]
      const mockError = new Error('Connection failed')
      connectErrorCallback?.(mockError)

      await expect(connectPromise).rejects.toThrow('Connection failed')
      expect(errorCallback).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Connection failed',
        code: 'CONNECTION_ERROR'
      }))
    })

    it('should implement automatic reconnection with exponential backoff', async () => {
      jest.useFakeTimers()

      webSocketClient.connect()

      // Simulate disconnect
      const disconnectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1]
      disconnectCallback?.('transport close')

      // First reconnection attempt (1 second)
      jest.advanceTimersByTime(1000)
      expect(mockSocket.connect).toHaveBeenCalledTimes(2)

      // Simulate another disconnect
      disconnectCallback?.('transport close')

      // Second reconnection attempt (2 seconds)
      jest.advanceTimersByTime(2000)
      expect(mockSocket.connect).toHaveBeenCalledTimes(3)

      jest.useRealTimers()
    })

    it('should disconnect cleanly', () => {
      webSocketClient.connect()
      webSocketClient.disconnect()

      expect(mockSocket.disconnect).toHaveBeenCalled()
    })
  })

  describe('Event Handling and Validation', () => {
    beforeEach(async () => {
      await webSocketClient.connect()
      // Simulate successful connection
      const connectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]
      mockSocket.connected = true
      connectCallback?.()
    })

    it('should validate and handle task update events', () => {
      const taskUpdateHandler = jest.fn()
      webSocketClient.onTaskUpdate(taskUpdateHandler)

      const validTaskUpdate = createWebSocketEvent<TaskUpdateEvent>('task:update', {
        taskId: 'test-task-123',
        state: TaskState.RUNNING,
        progress: 0.75,
        lastActivity: new Date(),
      })

      // Simulate receiving the event
      const taskUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'task:update'
      )?.[1]
      taskUpdateCallback?.(validTaskUpdate)

      expect(taskUpdateHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'test-task-123',
          state: TaskState.RUNNING,
          progress: 0.75
        })
      )
    })

    it('should validate and handle system status events', () => {
      const systemStatusHandler = jest.fn()
      webSocketClient.onSystemStatus(systemStatusHandler)

      const validSystemStatus = createWebSocketEvent<SystemStatusEvent>('system:status', {
        activeTasks: 5,
        queueLength: 10,
        workerStatus: 'healthy',
        uptime: 3600,
      })

      // Simulate receiving the event
      const systemStatusCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'system:status'
      )?.[1]
      systemStatusCallback?.(validSystemStatus)

      expect(systemStatusHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          activeTasks: 5,
          queueLength: 10,
          workerStatus: 'healthy',
          uptime: 3600
        })
      )
    })

    it('should reject invalid events and log errors', () => {
      const taskUpdateHandler = jest.fn()
      const errorHandler = jest.fn()
      webSocketClient.onTaskUpdate(taskUpdateHandler)
      webSocketClient.onError(errorHandler)

      const invalidEvent = {
        event: 'task:update',
        timestamp: 'invalid-timestamp',
        data: {
          taskId: '', // Invalid: empty taskId
          state: 'invalid-state', // Invalid: not in TaskState enum
        }
      }

      // Simulate receiving invalid event
      const taskUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'task:update'
      )?.[1]
      taskUpdateCallback?.(invalidEvent)

      expect(taskUpdateHandler).not.toHaveBeenCalled()
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('validation'),
          code: 'VALIDATION_ERROR'
        })
      )
    })

    it('should handle room-based subscriptions', () => {
      const taskId = 'task-123'
      webSocketClient.subscribeToTask(taskId)

      expect(mockSocket.emit).toHaveBeenCalledWith('join', `task:${taskId}`)

      webSocketClient.unsubscribeFromTask(taskId)
      expect(mockSocket.emit).toHaveBeenCalledWith('leave', `task:${taskId}`)
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should handle network disconnections gracefully', async () => {
      const disconnectHandler = jest.fn()
      const reconnectHandler = jest.fn()

      webSocketClient.onDisconnect(disconnectHandler)
      webSocketClient.onReconnect(reconnectHandler)

      await webSocketClient.connect()

      // Simulate network disconnection
      const disconnectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1]
      disconnectCallback?.('transport close')

      expect(disconnectHandler).toHaveBeenCalledWith('transport close')

      // Simulate reconnection
      const connectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]
      mockSocket.connected = true
      connectCallback?.()

      expect(reconnectHandler).toHaveBeenCalled()
    })

    it('should queue events during disconnection and replay on reconnect', async () => {
      await webSocketClient.connect()

      // Simulate disconnection
      mockSocket.connected = false
      const disconnectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1]
      disconnectCallback?.('transport close')

      // Try to emit event while disconnected
      webSocketClient.emit('test-event', { data: 'test' })

      // Should queue the event instead of emitting immediately
      expect(mockSocket.emit).not.toHaveBeenCalledWith('test-event', { data: 'test' })

      // Simulate reconnection
      mockSocket.connected = true
      const connectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]
      connectCallback?.()

      // Should replay queued events
      expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test' })
    })

    it('should limit queued events to prevent memory issues', async () => {
      await webSocketClient.connect()

      // Simulate disconnection
      mockSocket.connected = false

      // Queue many events
      for (let i = 0; i < 150; i++) {
        webSocketClient.emit('test-event', { data: `test-${i}` })
      }

      // Simulate reconnection
      mockSocket.connected = true
      const connectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]
      connectCallback?.()

      // Should only replay the last 100 events (queue limit)
      const emitCalls = mockSocket.emit.mock.calls.filter(
        call => call[0] === 'test-event'
      )
      expect(emitCalls.length).toBeLessThanOrEqual(100)
    })
  })

  describe('Performance and Resource Management', () => {
    it('should debounce rapid successive events', async () => {
      jest.useFakeTimers()

      const taskUpdateHandler = jest.fn()
      webSocketClient.onTaskUpdate(taskUpdateHandler)

      await webSocketClient.connect()

      // Simulate rapid task updates
      const taskUpdateCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'task:update'
      )?.[1]

      const baseEvent = createWebSocketEvent<TaskUpdateEvent>('task:update', {
        taskId: 'test-task-123',
        state: TaskState.RUNNING,
        lastActivity: new Date(),
      })

      // Send multiple updates rapidly
      for (let i = 0; i < 5; i++) {
        taskUpdateCallback?.({
          ...baseEvent,
          data: { ...baseEvent.data, progress: i * 0.2 }
        })
      }

      // Should only process the last event after debounce period
      jest.advanceTimersByTime(300)

      expect(taskUpdateHandler).toHaveBeenCalledTimes(1)
      expect(taskUpdateHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: 0.8 // Last progress value
        })
      )

      jest.useRealTimers()
    })

    it('should clean up event listeners on disconnect', () => {
      webSocketClient.connect()

      const taskUpdateHandler = jest.fn()
      const systemStatusHandler = jest.fn()

      webSocketClient.onTaskUpdate(taskUpdateHandler)
      webSocketClient.onSystemStatus(systemStatusHandler)

      webSocketClient.disconnect()

      expect(mockSocket.off).toHaveBeenCalledWith('task:update')
      expect(mockSocket.off).toHaveBeenCalledWith('system:status')
    })

    it('should handle concurrent connections gracefully', async () => {
      const client1 = new WebSocketClient({
        url: 'ws://localhost:3001',
        authToken: 'token1'
      })
      const client2 = new WebSocketClient({
        url: 'ws://localhost:3001',
        authToken: 'token2'
      })

      const promises = [client1.connect(), client2.connect()]

      // Both connections should succeed independently
      await expect(Promise.all(promises)).resolves.toBeDefined()

      client1.disconnect()
      client2.disconnect()
    })
  })
})