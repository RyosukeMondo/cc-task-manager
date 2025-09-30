import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { UserChannelsService, PermissionContext, EventFilter } from './user-channels.service';
import { JWTPayload, UserRole } from '../../schemas/auth.schemas';
import {
  WebSocketEvent,
  WebSocketEventType,
  WebSocketRoomType,
  createTaskEvent,
  createNotificationEvent,
  createUserActivityEvent,
  NotificationLevel,
} from '../websocket-events.schemas';

describe('UserChannelsService', () => {
  let service: UserChannelsService;
  let mockServer: jest.Mocked<Server>;
  let mockSocket: jest.Mocked<Socket>;

  const mockAdminUser: JWTPayload = {
    sub: 'admin-123',
    email: 'admin@example.com',
    username: 'admin',
    role: UserRole.ADMIN,
    iat: Date.now(),
    exp: Date.now() + 3600,
  };

  const mockRegularUser: JWTPayload = {
    sub: 'user-456',
    email: 'user@example.com',
    username: 'user',
    role: UserRole.USER,
    iat: Date.now(),
    exp: Date.now() + 3600,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserChannelsService],
    }).compile();

    service = module.get<UserChannelsService>(UserChannelsService);

    // Mock Socket.IO Server and Socket
    mockServer = {
      allSockets: jest.fn(),
      sockets: {
        sockets: new Map(),
      },
    } as any;

    mockSocket = {
      id: 'socket-123',
      data: { user: mockRegularUser },
      join: jest.fn(),
      leave: jest.fn(),
    } as any;

    mockServer.sockets.sockets.set(mockSocket.id, mockSocket);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeUserChannels', () => {
    it('should initialize personal and role channels for regular user', async () => {
      await service.initializeUserChannels(mockRegularUser.sub, mockRegularUser, mockServer);

      const userChannels = service.getUserChannels(mockRegularUser.sub);
      expect(userChannels).toContain('user:user-456');
      expect(userChannels).toContain('role:user');
      expect(userChannels.size).toBeGreaterThanOrEqual(2);
    });

    it('should initialize admin channels for admin user', async () => {
      await service.initializeUserChannels(mockAdminUser.sub, mockAdminUser, mockServer);

      const userChannels = service.getUserChannels(mockAdminUser.sub);
      expect(userChannels).toContain('user:admin-123');
      expect(userChannels).toContain('role:admin');
    });

    it('should handle initialization errors gracefully', async () => {
      const invalidUser = { ...mockRegularUser, sub: '' }; // Invalid user ID

      await expect(
        service.initializeUserChannels(invalidUser.sub, invalidUser, mockServer)
      ).rejects.toThrow();
    });
  });

  describe('cleanupUserChannels', () => {
    it('should clean up all user data and channels', async () => {
      // Initialize user first
      await service.initializeUserChannels(mockRegularUser.sub, mockRegularUser, mockServer);

      expect(service.getUserChannels(mockRegularUser.sub).size).toBeGreaterThan(0);

      // Clean up
      await service.cleanupUserChannels(mockRegularUser.sub);

      expect(service.getUserChannels(mockRegularUser.sub).size).toBe(0);
    });

    it('should handle cleanup for non-existent user gracefully', async () => {
      await expect(
        service.cleanupUserChannels('non-existent-user')
      ).resolves.not.toThrow();
    });
  });

  describe('filterEventForUser - Security Boundaries', () => {
    beforeEach(async () => {
      // Initialize both users
      await service.initializeUserChannels(mockRegularUser.sub, mockRegularUser, mockServer);
      await service.initializeUserChannels(mockAdminUser.sub, mockAdminUser, mockServer);
    });

    describe('Personal Event Security', () => {
      it('should allow users to see their own user events', async () => {
        const userEvent = createUserActivityEvent(
          WebSocketEventType.USER_JOINED,
          mockRegularUser.sub,
          { username: 'user', activity: 'joined room' }
        );

        const canReceive = await service.filterEventForUser(userEvent, mockRegularUser.sub);
        expect(canReceive).toBe(true);
      });

      it('should deny users access to other users\' personal events', async () => {
        const otherUserEvent = createUserActivityEvent(
          WebSocketEventType.USER_JOINED,
          'other-user-789',
          { username: 'other', activity: 'joined room' }
        );

        const canReceive = await service.filterEventForUser(otherUserEvent, mockRegularUser.sub);
        expect(canReceive).toBe(false);
      });

      it('should allow admins to see all user events', async () => {
        const userEvent = createUserActivityEvent(
          WebSocketEventType.USER_JOINED,
          mockRegularUser.sub,
          { username: 'user', activity: 'joined room' }
        );

        const canReceive = await service.filterEventForUser(userEvent, mockAdminUser.sub);
        expect(canReceive).toBe(true);
      });
    });

    describe('Task Event Security', () => {
      it('should deny regular users access to unauthorized task events', async () => {
        const taskEvent = createTaskEvent(
          WebSocketEventType.TASK_CREATED,
          'other-user-789',
          {
            taskId: 'unauthorized-task-123',
            title: 'Secret Task',
          }
        );

        const canReceive = await service.filterEventForUser(taskEvent, mockRegularUser.sub);
        expect(canReceive).toBe(false);
      });

      it('should allow admins to see all task events', async () => {
        const taskEvent = createTaskEvent(
          WebSocketEventType.TASK_CREATED,
          'other-user-789',
          {
            taskId: 'any-task-123',
            title: 'Any Task',
          }
        );

        const canReceive = await service.filterEventForUser(taskEvent, mockAdminUser.sub);
        expect(canReceive).toBe(true);
      });
    });

    describe('Project Event Security', () => {
      it('should deny regular users access to unauthorized project events', async () => {
        const projectEvent = createNotificationEvent(
          'other-user-789',
          {
            title: 'Project Update',
            message: 'Secret project updated',
            level: NotificationLevel.INFO,
          },
          'project:unauthorized-project',
          WebSocketRoomType.PROJECT
        );

        const canReceive = await service.filterEventForUser(projectEvent, mockRegularUser.sub);
        expect(canReceive).toBe(false);
      });

      it('should allow admins to see all project events', async () => {
        const projectEvent = createNotificationEvent(
          'other-user-789',
          {
            title: 'Project Update',
            message: 'Any project updated',
            level: NotificationLevel.INFO,
          },
          'project:any-project',
          WebSocketRoomType.PROJECT
        );

        const canReceive = await service.filterEventForUser(projectEvent, mockAdminUser.sub);
        expect(canReceive).toBe(true);
      });
    });

    describe('System Event Security', () => {
      it('should deny regular users access to system events', async () => {
        const systemEvent = createNotificationEvent(
          mockAdminUser.sub,
          {
            title: 'System Alert',
            message: 'System maintenance required',
            level: NotificationLevel.WARNING,
          }
        );
        // Manually set system event type
        (systemEvent as any).eventType = 'system:maintenance';

        const canReceive = await service.filterEventForUser(systemEvent, mockRegularUser.sub);
        expect(canReceive).toBe(false);
      });

      it('should allow admins to see system events', async () => {
        const systemEvent = createNotificationEvent(
          mockAdminUser.sub,
          {
            title: 'System Alert',
            message: 'System maintenance required',
            level: NotificationLevel.WARNING,
          }
        );
        // Manually set system event type
        (systemEvent as any).eventType = 'system:maintenance';

        const canReceive = await service.filterEventForUser(systemEvent, mockAdminUser.sub);
        expect(canReceive).toBe(true);
      });
    });

    describe('Error Handling Security', () => {
      it('should deny access when permission context is missing', async () => {
        const event = createNotificationEvent(
          mockRegularUser.sub,
          {
            title: 'Test Event',
            message: 'Test message',
            level: NotificationLevel.INFO,
          }
        );

        // Test with non-existent user
        const canReceive = await service.filterEventForUser(event, 'non-existent-user');
        expect(canReceive).toBe(false);
      });

      it('should deny access on filtering errors (fail-secure)', async () => {
        const event = createNotificationEvent(
          mockRegularUser.sub,
          {
            title: 'Test Event',
            message: 'Test message',
            level: NotificationLevel.INFO,
          }
        );

        // Mock an error in permission checking
        jest.spyOn(service as any, 'getPermissionContext').mockRejectedValueOnce(new Error('Database error'));

        const canReceive = await service.filterEventForUser(event, mockRegularUser.sub);
        expect(canReceive).toBe(false);
      });
    });
  });

  describe('Channel Management Security', () => {
    beforeEach(async () => {
      await service.initializeUserChannels(mockRegularUser.sub, mockRegularUser, mockServer);
      mockServer.allSockets.mockResolvedValue(new Set([mockSocket.id]));
    });

    it('should allow users to join their personal channels', async () => {
      const personalChannel = 'user:user-456';

      const result = await service.subscribeUserToChannel(mockRegularUser.sub, personalChannel, mockServer);
      expect(result).toBe(true);
      expect(mockSocket.join).toHaveBeenCalledWith(personalChannel);
    });

    it('should deny users access to other users\' personal channels', async () => {
      const otherPersonalChannel = 'user:other-user';

      const result = await service.subscribeUserToChannel(mockRegularUser.sub, otherPersonalChannel, mockServer);
      expect(result).toBe(false);
      expect(mockSocket.join).not.toHaveBeenCalledWith(otherPersonalChannel);
    });

    it('should deny regular users access to admin channels', async () => {
      const adminChannel = 'admin-notifications';

      const result = await service.subscribeUserToChannel(mockRegularUser.sub, adminChannel, mockServer);
      expect(result).toBe(false);
      expect(mockSocket.join).not.toHaveBeenCalledWith(adminChannel);
    });

    it('should handle subscription errors gracefully', async () => {
      mockSocket.join.mockRejectedValueOnce(new Error('Socket error'));

      const result = await service.subscribeUserToChannel(mockRegularUser.sub, 'user:user-456', mockServer);
      expect(result).toBe(false);
    });
  });

  describe('Custom Event Filters', () => {
    const customFilter: EventFilter = {
      canReceiveEvent: jest.fn().mockReturnValue(true),
    };

    beforeEach(async () => {
      await service.initializeUserChannels(mockRegularUser.sub, mockRegularUser, mockServer);
      service.registerEventFilter(customFilter);
    });

    it('should apply custom event filters', async () => {
      const event = createNotificationEvent(
        mockRegularUser.sub,
        {
          title: 'Test Event',
          message: 'Test message',
          level: NotificationLevel.INFO,
        }
      );

      await service.filterEventForUser(event, mockRegularUser.sub);
      expect(customFilter.canReceiveEvent).toHaveBeenCalledWith(event, expect.any(Object));
    });

    it('should deny access when custom filter returns false', async () => {
      (customFilter.canReceiveEvent as jest.Mock).mockReturnValue(false);

      const event = createNotificationEvent(
        mockRegularUser.sub,
        {
          title: 'Test Event',
          message: 'Test message',
          level: NotificationLevel.INFO,
        }
      );

      const canReceive = await service.filterEventForUser(event, mockRegularUser.sub);
      expect(canReceive).toBe(false);
    });
  });

  describe('Permission Updates', () => {
    beforeEach(async () => {
      await service.initializeUserChannels(mockRegularUser.sub, mockRegularUser, mockServer);
      mockServer.allSockets.mockResolvedValue(new Set([mockSocket.id]));
    });

    it('should update channel subscriptions when permissions change', async () => {
      const newContext: PermissionContext = {
        userId: mockRegularUser.sub,
        role: UserRole.USER,
        projectIds: ['project-123'],
        taskIds: ['task-456'],
      };

      await service.updateUserPermissions(mockRegularUser.sub, newContext, mockServer);

      // Should have joined project and task channels
      expect(mockSocket.join).toHaveBeenCalledWith('project:project-123');
      expect(mockSocket.join).toHaveBeenCalledWith('task:task-456');
    });

    it('should remove channels when permissions are revoked', async () => {
      // First add some channels
      const initialContext: PermissionContext = {
        userId: mockRegularUser.sub,
        role: UserRole.USER,
        projectIds: ['project-123'],
        taskIds: ['task-456'],
      };
      await service.updateUserPermissions(mockRegularUser.sub, initialContext, mockServer);

      // Then remove project access
      const updatedContext: PermissionContext = {
        userId: mockRegularUser.sub,
        role: UserRole.USER,
        projectIds: [], // Removed project access
        taskIds: ['task-456'],
      };
      await service.updateUserPermissions(mockRegularUser.sub, updatedContext, mockServer);

      expect(mockSocket.leave).toHaveBeenCalledWith('project:project-123');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate channel statistics', async () => {
      await service.initializeUserChannels(mockRegularUser.sub, mockRegularUser, mockServer);
      await service.initializeUserChannels(mockAdminUser.sub, mockAdminUser, mockServer);

      const stats = service.getChannelStatistics();

      expect(stats.totalUsers).toBe(2);
      expect(stats.totalChannels).toBeGreaterThan(0);
      expect(stats.channelUserCounts).toBeDefined();
      expect(Object.keys(stats.channelUserCounts).length).toBeGreaterThan(0);
    });

    it('should track channel user counts correctly', async () => {
      await service.initializeUserChannels(mockRegularUser.sub, mockRegularUser, mockServer);

      const userChannels = service.getUserChannels(mockRegularUser.sub);
      expect(userChannels.size).toBeGreaterThan(0);

      for (const channel of userChannels) {
        const channelUsers = service.getChannelUsers(channel);
        expect(channelUsers.has(mockRegularUser.sub)).toBe(true);
      }
    });
  });
});