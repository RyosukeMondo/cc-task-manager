import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket as ClientSocket, io } from 'socket.io-client';
import { WebSocketGateway } from '../websocket.gateway';
import { WebSocketService } from '../websocket.service';
import { TaskEventsService } from '../events/task-events.service';
import { QueueEventsService } from '../events/queue-events.service';
import { ClaudeEventsService } from '../events/claude-events.service';
import { SystemEventsService } from '../events/system-events.service';
import { UserChannelsService } from '../channels/user-channels.service';
import { ConnectionManagerService } from '../connection/connection-manager.service';
import { EventReplayService } from '../persistence/event-replay.service';
import { WebSocketModule } from '../websocket.module';
import {
  WebSocketEventType,
  WebSocketRoomType,
  NotificationLevel,
  createTaskEvent,
  createNotificationEvent,
  createUserActivityEvent,
} from '../websocket-events.schemas';
import { TaskStatus, TaskPriority, TaskCategory } from '../../schemas/task.schemas';

/**
 * Comprehensive WebSocket Integration Tests
 *
 * This test suite validates the complete WebSocket system functionality:
 * - Connection handling and authentication
 * - Event broadcasting and filtering
 * - Room management and permissions
 * - Error scenarios and edge cases
 * - Performance characteristics under load
 * - Event replay and persistence
 * - Real-time communication flows
 *
 * Following SOLID principles:
 * - Single Responsibility: Each test focuses on specific functionality
 * - Open/Closed: Tests are extensible for new event types
 * - Dependency Inversion: Uses abstraction patterns for modularity
 */
describe('WebSocket Integration Tests', () => {
  let app: INestApplication;
  let module: TestingModule;
  let gateway: WebSocketGateway;
  let webSocketService: WebSocketService;
  let taskEventsService: TaskEventsService;
  let queueEventsService: QueueEventsService;
  let claudeEventsService: ClaudeEventsService;
  let systemEventsService: SystemEventsService;
  let userChannelsService: UserChannelsService;
  let connectionManager: ConnectionManagerService;
  let eventReplayService: EventReplayService;
  let jwtService: JwtService;

  // Client socket connections for testing
  let clientSockets: ClientSocket[] = [];
  let serverAddress: string;

  // Test users
  const testUsers = [
    { id: 'user1', username: 'testuser1', role: 'user' },
    { id: 'user2', username: 'testuser2', role: 'user' },
    { id: 'admin1', username: 'admin', role: 'admin' },
  ];

  // Test data
  const testTask = {
    id: 'task-123',
    title: 'Test Task',
    description: 'Integration test task',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    category: TaskCategory.DEVELOPMENT,
    createdById: 'user1',
    assigneeId: 'user2',
    projectId: 'project-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    // Create testing module with real WebSocket components
    module = await Test.createTestingModule({
      imports: [WebSocketModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    await app.listen(0); // Use random port for testing

    // Get service instances
    gateway = module.get<WebSocketGateway>(WebSocketGateway);
    webSocketService = module.get<WebSocketService>(WebSocketService);
    taskEventsService = module.get<TaskEventsService>(TaskEventsService);
    queueEventsService = module.get<QueueEventsService>(QueueEventsService);
    claudeEventsService = module.get<ClaudeEventsService>(ClaudeEventsService);
    systemEventsService = module.get<SystemEventsService>(SystemEventsService);
    userChannelsService = module.get<UserChannelsService>(UserChannelsService);
    connectionManager = module.get<ConnectionManagerService>(ConnectionManagerService);
    eventReplayService = module.get<EventReplayService>(EventReplayService);
    jwtService = module.get<JwtService>(JwtService);

    // Get server address
    const server = app.getHttpServer();
    const address = server.address();
    serverAddress = `http://localhost:${address.port}`;
  });

  afterAll(async () => {
    // Clean up all client connections
    for (const socket of clientSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
    clientSockets = [];

    await app.close();
  });

  afterEach(async () => {
    // Clean up connections after each test
    for (const socket of clientSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
    clientSockets = [];

    // Wait for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  /**
   * Helper function to create authenticated client socket
   */
  const createAuthenticatedSocket = (user: { id: string; username: string; role: string }): Promise<ClientSocket> => {
    return new Promise((resolve, reject) => {
      // Generate JWT token
      const token = jwtService.sign({
        sub: user.id,
        username: user.username,
        role: user.role,
      });

      // Create socket connection with authentication
      const clientSocket = io(`${serverAddress}/ws`, {
        auth: { token },
        transports: ['websocket'],
        timeout: 5000,
      });

      clientSocket.on('connect', () => {
        clientSockets.push(clientSocket);
        resolve(clientSocket);
      });

      clientSocket.on('connect_error', (error) => {
        reject(new Error(`Connection failed: ${error.message}`));
      });

      // Set timeout for connection
      setTimeout(() => {
        if (!clientSocket.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  };

  /**
   * Helper function to wait for specific event
   */
  const waitForEvent = (socket: ClientSocket, eventName: string, timeout = 5000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeout);

      socket.once(eventName, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  };

  describe('Connection Management', () => {
    it('should establish authenticated WebSocket connection', async () => {
      const clientSocket = await createAuthenticatedSocket(testUsers[0]);

      expect(clientSocket.connected).toBe(true);
      expect(gateway.getConnectedUsersCount()).toBe(1);

      // Verify user is in their personal room
      const userRoom = gateway.getUserRoom(testUsers[0].id);
      const roomUsers = gateway.getUsersByRoom(userRoom);
      expect(roomUsers).toContain(testUsers[0].id);
    });

    it('should reject unauthenticated connections', async () => {
      await expect(async () => {
        const clientSocket = io(`${serverAddress}/ws`, {
          transports: ['websocket'],
          timeout: 2000,
        });

        await new Promise((resolve, reject) => {
          clientSocket.on('connect', resolve);
          clientSocket.on('connect_error', reject);
          setTimeout(() => reject(new Error('timeout')), 2000);
        });
      }).rejects.toThrow();
    });

    it('should handle multiple simultaneous connections', async () => {
      const connections = await Promise.all([
        createAuthenticatedSocket(testUsers[0]),
        createAuthenticatedSocket(testUsers[1]),
        createAuthenticatedSocket(testUsers[2]),
      ]);

      expect(connections).toHaveLength(3);
      expect(gateway.getConnectedUsersCount()).toBe(3);

      // Verify each user is connected
      for (let i = 0; i < connections.length; i++) {
        expect(connections[i].connected).toBe(true);
        expect(gateway.isUserConnected(testUsers[i].id)).toBe(true);
      }
    });

    it('should handle connection capacity limits', async () => {
      // Mock connection manager to simulate capacity limits
      jest.spyOn(connectionManager, 'canAcceptConnections').mockReturnValue(false);

      try {
        await createAuthenticatedSocket(testUsers[0]);
        fail('Expected connection to be rejected due to capacity');
      } catch (error) {
        expect(error.message).toContain('Connection failed');
      }

      // Restore original method
      jest.restoreAllMocks();
    });

    it('should clean up disconnected users', async () => {
      const clientSocket = await createAuthenticatedSocket(testUsers[0]);
      const userId = testUsers[0].id;

      expect(gateway.isUserConnected(userId)).toBe(true);

      // Disconnect client
      clientSocket.disconnect();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(gateway.isUserConnected(userId)).toBe(false);
    });
  });

  describe('Room Management', () => {
    let clientSocket: ClientSocket;

    beforeEach(async () => {
      clientSocket = await createAuthenticatedSocket(testUsers[0]);
    });

    it('should allow joining authorized rooms', async () => {
      const roomData = {
        room: 'project:123',
        roomType: WebSocketRoomType.PROJECT
      };

      // Send join room request
      clientSocket.emit('join-room', roomData);

      // Wait for confirmation
      const response = await waitForEvent(clientSocket, 'room-joined');

      expect(response.success).toBe(true);
      expect(response.room).toBe(roomData.room);
      expect(response.roomType).toBe(roomData.roomType);
    });

    it('should reject unauthorized room access', async () => {
      const roomData = {
        room: gateway.getUserRoom('other-user'),
        roomType: WebSocketRoomType.USER
      };

      // Send join room request
      clientSocket.emit('join-room', roomData);

      // Wait for error response
      const errorResponse = await waitForEvent(clientSocket, 'error');

      expect(errorResponse.code).toBe('ROOM_ACCESS_DENIED');
    });

    it('should handle room leaving', async () => {
      const roomData = {
        room: 'project:123',
        roomType: WebSocketRoomType.PROJECT
      };

      // Join room first
      clientSocket.emit('join-room', roomData);
      await waitForEvent(clientSocket, 'room-joined');

      // Leave room
      clientSocket.emit('leave-room', roomData);
      const response = await waitForEvent(clientSocket, 'room-left');

      expect(response.success).toBe(true);
      expect(response.room).toBe(roomData.room);
    });

    it('should broadcast user activity events in rooms', async () => {
      // Create second client to receive events
      const client2 = await createAuthenticatedSocket(testUsers[1]);

      const roomData = {
        room: 'project:123',
        roomType: WebSocketRoomType.PROJECT
      };

      // Both clients join the same room
      clientSocket.emit('join-room', roomData);
      client2.emit('join-room', roomData);

      await waitForEvent(clientSocket, 'room-joined');
      await waitForEvent(client2, 'room-joined');

      // Listen for events on second client
      const eventPromise = waitForEvent(client2, 'event');

      // First client joins room (should trigger event)
      clientSocket.emit('join-room', {
        room: 'project:456',
        roomType: WebSocketRoomType.PROJECT
      });

      // Wait for join event to be received
      const event = await eventPromise;
      expect(event.eventType).toBe(WebSocketEventType.USER_JOINED);
    });
  });

  describe('Event Broadcasting', () => {
    let client1: ClientSocket;
    let client2: ClientSocket;

    beforeEach(async () => {
      client1 = await createAuthenticatedSocket(testUsers[0]);
      client2 = await createAuthenticatedSocket(testUsers[1]);
    });

    it('should broadcast task events to relevant rooms', async () => {
      const taskRoom = gateway.getTaskRoom(testTask.id);
      const projectRoom = gateway.getProjectRoom(testTask.projectId);

      // Join relevant rooms
      client1.emit('join-room', { room: taskRoom, roomType: WebSocketRoomType.TASK });
      client2.emit('join-room', { room: projectRoom, roomType: WebSocketRoomType.PROJECT });

      await waitForEvent(client1, 'room-joined');
      await waitForEvent(client2, 'room-joined');

      // Listen for task events
      const taskEventPromise = waitForEvent(client1, 'event');
      const projectEventPromise = waitForEvent(client2, 'event');

      // Emit task created event
      const taskEvent = createTaskEvent(
        WebSocketEventType.TASK_CREATED,
        testUsers[0].id,
        {
          taskId: testTask.id,
          title: testTask.title,
          status: testTask.status,
          priority: testTask.priority,
          assigneeId: testTask.assigneeId,
          projectId: testTask.projectId,
        }
      );

      await gateway.emitToRoom(taskRoom, taskEvent);
      await gateway.emitToRoom(projectRoom, taskEvent);

      // Verify events received
      const receivedTaskEvent = await taskEventPromise;
      const receivedProjectEvent = await projectEventPromise;

      expect(receivedTaskEvent.eventType).toBe(WebSocketEventType.TASK_CREATED);
      expect(receivedProjectEvent.eventType).toBe(WebSocketEventType.TASK_CREATED);
      expect(receivedTaskEvent.data.taskId).toBe(testTask.id);
    });

    it('should send notifications to specific users', async () => {
      const notificationPromise = waitForEvent(client1, 'event');

      // Send notification to user1
      gateway.sendNotificationToUser(testUsers[0].id, {
        title: 'Test Notification',
        message: 'This is a test notification',
        level: NotificationLevel.INFO,
        actionUrl: '/test',
        actionText: 'View',
      });

      const notification = await notificationPromise;
      expect(notification.eventType).toBe(WebSocketEventType.NOTIFICATION);
      expect(notification.data.title).toBe('Test Notification');
    });

    it('should handle typing indicators', async () => {
      const room = 'project:123';

      // Both clients join same room
      client1.emit('join-room', { room, roomType: WebSocketRoomType.PROJECT });
      client2.emit('join-room', { room, roomType: WebSocketRoomType.PROJECT });

      await waitForEvent(client1, 'room-joined');
      await waitForEvent(client2, 'room-joined');

      // Listen for typing event on client2
      const typingPromise = waitForEvent(client2, 'event');

      // Client1 starts typing
      client1.emit('typing', { room, targetId: 'task-123' });

      const typingEvent = await typingPromise;
      expect(typingEvent.eventType).toBe(WebSocketEventType.USER_TYPING);
      expect(typingEvent.userId).toBe(testUsers[0].id);
    });

    it('should handle heartbeat/ping messages', async () => {
      const heartbeatPromise = waitForEvent(client1, 'heartbeat-ack');

      client1.emit('heartbeat');

      const response = await heartbeatPromise;
      expect(response.timestamp).toBeDefined();
    });
  });

  describe('Permission-based Event Filtering', () => {
    let client1: ClientSocket;
    let client2: ClientSocket;

    beforeEach(async () => {
      client1 = await createAuthenticatedSocket(testUsers[0]);
      client2 = await createAuthenticatedSocket(testUsers[1]);
    });

    it('should filter events based on user permissions', async () => {
      // Mock user channels service to simulate permission filtering
      jest.spyOn(userChannelsService, 'filterEventForUser')
        .mockImplementation(async (event, userId) => {
          // User1 can see all events, User2 can only see specific events
          return userId === testUsers[0].id || event.eventType === WebSocketEventType.NOTIFICATION;
        });

      const room = 'project:123';

      // Both clients join same room
      client1.emit('join-room', { room, roomType: WebSocketRoomType.PROJECT });
      client2.emit('join-room', { room, roomType: WebSocketRoomType.PROJECT });

      await waitForEvent(client1, 'room-joined');
      await waitForEvent(client2, 'room-joined');

      // Create a task event (should only be visible to client1)
      const taskEvent = createTaskEvent(
        WebSocketEventType.TASK_CREATED,
        testUsers[0].id,
        {
          taskId: testTask.id,
          title: testTask.title,
          status: testTask.status,
          priority: testTask.priority,
          assigneeId: testTask.assigneeId,
          projectId: testTask.projectId,
        }
      );

      // Set up event listeners
      let client1ReceivedEvent = false;
      let client2ReceivedEvent = false;

      client1.on('event', (event) => {
        if (event.eventType === WebSocketEventType.TASK_CREATED) {
          client1ReceivedEvent = true;
        }
      });

      client2.on('event', (event) => {
        if (event.eventType === WebSocketEventType.TASK_CREATED) {
          client2ReceivedEvent = true;
        }
      });

      // Emit event
      await gateway.emitToRoom(room, taskEvent);

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Client1 should receive event, client2 should not
      expect(client1ReceivedEvent).toBe(true);
      expect(client2ReceivedEvent).toBe(false);

      jest.restoreAllMocks();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle invalid event data gracefully', async () => {
      const clientSocket = await createAuthenticatedSocket(testUsers[0]);

      const errorPromise = waitForEvent(clientSocket, 'error');

      // Send malformed room join request
      clientSocket.emit('join-room', { invalid: 'data' });

      const error = await errorPromise;
      expect(error.code).toBe('ROOM_JOIN_FAILED');
    });

    it('should handle connection failures during event emission', async () => {
      const clientSocket = await createAuthenticatedSocket(testUsers[0]);

      // Join a room
      const room = 'test-room';
      clientSocket.emit('join-room', { room, roomType: WebSocketRoomType.PROJECT });
      await waitForEvent(clientSocket, 'room-joined');

      // Disconnect client abruptly
      clientSocket.disconnect();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      // Try to emit to room - should not throw error
      const testEvent = createNotificationEvent(
        testUsers[0].id,
        {
          title: 'Test',
          message: 'Test message',
          level: NotificationLevel.INFO,
        }
      );

      await expect(gateway.emitToRoom(room, testEvent)).resolves.not.toThrow();
    });

    it('should handle WebSocket gateway initialization errors', async () => {
      // This test verifies error handling during gateway initialization
      const logSpy = jest.spyOn(gateway['logger'], 'error').mockImplementation();

      // Simulate connection with invalid token
      const clientSocket = io(`${serverAddress}/ws`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
        timeout: 2000,
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(clientSocket.connected).toBe(false);

      logSpy.mockRestore();
    });
  });

  describe('Event Replay and Persistence', () => {
    let clientSocket: ClientSocket;

    beforeEach(async () => {
      clientSocket = await createAuthenticatedSocket(testUsers[0]);
    });

    it('should persist events for offline clients', async () => {
      const testEvent = createNotificationEvent(
        testUsers[0].id,
        {
          title: 'Persistent Event',
          message: 'This should be persisted',
          level: NotificationLevel.INFO,
        }
      );

      // Spy on event persistence
      const persistSpy = jest.spyOn(eventReplayService, 'persistEvent');

      const userRoom = gateway.getUserRoom(testUsers[0].id);
      await gateway.emitToRoom(userRoom, testEvent);

      expect(persistSpy).toHaveBeenCalledWith(testEvent);

      persistSpy.mockRestore();
    });

    it('should replay missed events on reconnection', async () => {
      const userId = testUsers[0].id;

      // Mock event replay service to return test events
      const mockReplayCount = 3;
      jest.spyOn(eventReplayService, 'replayMissedEvents')
        .mockResolvedValue(mockReplayCount);

      // Disconnect and reconnect
      clientSocket.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reconnect should trigger event replay
      const reconnectedSocket = await createAuthenticatedSocket(testUsers[0]);

      // Wait for connection to fully establish
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(eventReplayService.replayMissedEvents).toHaveBeenCalledWith(
        expect.any(String), // socket ID
        userId
      );

      jest.restoreAllMocks();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency events efficiently', async () => {
      const clientSocket = await createAuthenticatedSocket(testUsers[0]);
      const room = 'performance-test';

      // Join room
      clientSocket.emit('join-room', { room, roomType: WebSocketRoomType.PROJECT });
      await waitForEvent(clientSocket, 'room-joined');

      let eventCount = 0;
      clientSocket.on('event', () => {
        eventCount++;
      });

      // Send multiple events rapidly
      const eventPromises = [];
      const numEvents = 50;

      for (let i = 0; i < numEvents; i++) {
        const event = createNotificationEvent(
          testUsers[0].id,
          {
            title: `Event ${i}`,
            message: `High frequency event ${i}`,
            level: NotificationLevel.INFO,
          }
        );
        eventPromises.push(gateway.emitToRoom(room, event));
      }

      await Promise.all(eventPromises);

      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(eventCount).toBe(numEvents);
    });

    it('should provide accurate connection statistics', async () => {
      // Connect multiple clients
      const clients = await Promise.all([
        createAuthenticatedSocket(testUsers[0]),
        createAuthenticatedSocket(testUsers[1]),
        createAuthenticatedSocket(testUsers[2]),
      ]);

      const stats = gateway.getConnectionStats();

      expect(stats.totalConnections).toBe(3);
      expect(stats.timestamp).toBeInstanceOf(Date);
      expect(typeof stats.roomStats).toBe('object');
    });

    it('should handle connection manager scaling operations', async () => {
      const scalingConfig = gateway.getScalingConfiguration();
      expect(scalingConfig).toBeDefined();

      // Test configuration updates
      const updates = { maxConnections: 1000 };
      const result = gateway.updateScalingConfiguration(updates);
      expect(result).toBeDefined();

      // Test capacity checking
      const canAccept = gateway.canAcceptNewConnections();
      expect(typeof canAccept).toBe('boolean');
    });
  });

  describe('Service Integration', () => {
    let clientSocket: ClientSocket;

    beforeEach(async () => {
      clientSocket = await createAuthenticatedSocket(testUsers[0]);
    });

    it('should integrate with TaskEventsService', async () => {
      const eventPromise = waitForEvent(clientSocket, 'event');

      // Simulate task created event through service
      await taskEventsService.emitTaskCreated(testTask, testUsers[0].id);

      const receivedEvent = await eventPromise;
      expect(receivedEvent.eventType).toBe(WebSocketEventType.TASK_CREATED);
      expect(receivedEvent.data.taskId).toBe(testTask.id);
    });

    it('should integrate with QueueEventsService', async () => {
      const eventPromise = waitForEvent(clientSocket, 'event');

      // Simulate queue job progress event
      await queueEventsService.emitJobProgress('job-123', {
        progress: 50,
        message: 'Processing...',
        userId: testUsers[0].id,
      });

      const receivedEvent = await eventPromise;
      expect(receivedEvent.eventType).toBe(WebSocketEventType.QUEUE_JOB_PROGRESS);
    });

    it('should integrate with ClaudeEventsService', async () => {
      const eventPromise = waitForEvent(clientSocket, 'event');

      // Simulate Claude Code execution output
      await claudeEventsService.emitExecutionOutput('execution-123', {
        output: 'Test output',
        type: 'stdout',
        userId: testUsers[0].id,
      });

      const receivedEvent = await eventPromise;
      expect(receivedEvent.eventType).toBe(WebSocketEventType.CLAUDE_OUTPUT);
    });

    it('should integrate with SystemEventsService', async () => {
      const eventPromise = waitForEvent(clientSocket, 'event');

      // Simulate system health event
      await systemEventsService.emitSystemHealth({
        status: 'healthy',
        metrics: {
          cpu: 25,
          memory: 60,
          disk: 40,
        },
      });

      const receivedEvent = await eventPromise;
      expect(receivedEvent.eventType).toBe(WebSocketEventType.SYSTEM_HEALTH);
    });
  });

  describe('Real-time Communication Flows', () => {
    let client1: ClientSocket;
    let client2: ClientSocket;

    beforeEach(async () => {
      client1 = await createAuthenticatedSocket(testUsers[0]);
      client2 = await createAuthenticatedSocket(testUsers[1]);
    });

    it('should support complete task collaboration workflow', async () => {
      const taskRoom = gateway.getTaskRoom(testTask.id);
      const projectRoom = gateway.getProjectRoom(testTask.projectId);

      // Both users join relevant rooms
      client1.emit('join-room', { room: taskRoom, roomType: WebSocketRoomType.TASK });
      client2.emit('join-room', { room: projectRoom, roomType: WebSocketRoomType.PROJECT });

      await waitForEvent(client1, 'room-joined');
      await waitForEvent(client2, 'room-joined');

      // User1 starts working on task (typing indicator)
      const typingPromise = waitForEvent(client2, 'event');
      client1.emit('typing', { room: taskRoom, targetId: testTask.id });

      const typingEvent = await typingPromise;
      expect(typingEvent.eventType).toBe(WebSocketEventType.USER_TYPING);

      // Task status update
      const taskUpdatePromise = waitForEvent(client2, 'event');
      await webSocketService.handleTaskUpdated(
        testTask,
        { ...testTask, status: TaskStatus.IN_PROGRESS },
        testUsers[0].id,
        { status: TaskStatus.IN_PROGRESS }
      );

      const taskUpdateEvent = await taskUpdatePromise;
      expect(taskUpdateEvent.eventType).toBe(WebSocketEventType.TASK_UPDATED);
      expect(taskUpdateEvent.data.status).toBe(TaskStatus.IN_PROGRESS);

      // User1 stops typing
      const stoppedTypingPromise = waitForEvent(client2, 'event');
      client1.emit('stopped-typing', { room: taskRoom, targetId: testTask.id });

      const stoppedTypingEvent = await stoppedTypingPromise;
      expect(stoppedTypingEvent.eventType).toBe(WebSocketEventType.USER_STOPPED_TYPING);
    });

    it('should handle multi-room event propagation correctly', async () => {
      const rooms = ['room1', 'room2', 'room3'];

      // Client1 joins all rooms
      for (const room of rooms) {
        client1.emit('join-room', { room, roomType: WebSocketRoomType.PROJECT });
        await waitForEvent(client1, 'room-joined');
      }

      // Client2 joins subset of rooms
      client2.emit('join-room', { room: rooms[0], roomType: WebSocketRoomType.PROJECT });
      client2.emit('join-room', { room: rooms[2], roomType: WebSocketRoomType.PROJECT });
      await waitForEvent(client2, 'room-joined');
      await waitForEvent(client2, 'room-joined');

      let client1Events = 0;
      let client2Events = 0;

      client1.on('event', (event) => {
        if (event.eventType === WebSocketEventType.NOTIFICATION) {
          client1Events++;
        }
      });

      client2.on('event', (event) => {
        if (event.eventType === WebSocketEventType.NOTIFICATION) {
          client2Events++;
        }
      });

      // Send events to each room
      for (let i = 0; i < rooms.length; i++) {
        const event = createNotificationEvent(
          testUsers[0].id,
          {
            title: `Event ${i}`,
            message: `Room ${rooms[i]} event`,
            level: NotificationLevel.INFO,
          }
        );
        await gateway.emitToRoom(rooms[i], event);
      }

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Client1 should receive all 3 events, client2 should receive 2
      expect(client1Events).toBe(3);
      expect(client2Events).toBe(2);
    });
  });
});