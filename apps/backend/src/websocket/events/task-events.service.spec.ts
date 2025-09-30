import { Test, TestingModule } from '@nestjs/testing';
import { TaskEventsService } from './task-events.service';
import { WebSocketGateway } from '../websocket.gateway';
import { WebSocketEventType, WebSocketRoomType, TaskEventData } from '../websocket-events.schemas';
import { TaskStatus, TaskPriority, TaskCategory } from '../../schemas/task.schemas';

describe('TaskEventsService', () => {
  let service: TaskEventsService;
  let mockWebSocketGateway: jest.Mocked<WebSocketGateway>;

  const mockTask = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Task',
    description: 'Test task description',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    category: TaskCategory.DEVELOPMENT,
    createdById: 'user1',
    assigneeId: 'user2',
    projectId: 'project1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Create mock WebSocket Gateway
    mockWebSocketGateway = {
      emitToRoom: jest.fn(),
      getTaskRoom: jest.fn((taskId: string) => `task:${taskId}`),
      getProjectRoom: jest.fn((projectId: string) => `project:${projectId}`),
      getUserRoom: jest.fn((userId: string) => `user:${userId}`),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskEventsService,
        {
          provide: WebSocketGateway,
          useValue: mockWebSocketGateway,
        },
      ],
    }).compile();

    service = module.get<TaskEventsService>(TaskEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('emitTaskCreated', () => {
    it('should emit task created event to appropriate rooms', async () => {
      await service.emitTaskCreated(mockTask, 'user1');

      // Should determine rooms correctly
      expect(mockWebSocketGateway.getTaskRoom).toHaveBeenCalledWith(mockTask.id);
      expect(mockWebSocketGateway.getProjectRoom).toHaveBeenCalledWith(mockTask.projectId);
      expect(mockWebSocketGateway.getUserRoom).toHaveBeenCalledWith(mockTask.createdById);
      expect(mockWebSocketGateway.getUserRoom).toHaveBeenCalledWith(mockTask.assigneeId);

      // Should emit event to multiple rooms
      expect(mockWebSocketGateway.emitToRoom).toHaveBeenCalledTimes(4); // task, project, creator, assignee rooms

      // Verify event structure
      const firstCallArgs = mockWebSocketGateway.emitToRoom.mock.calls[0];
      const event = firstCallArgs[1];
      const eventData = event.data as TaskEventData;
      expect(event.eventType).toBe(WebSocketEventType.TASK_CREATED);
      expect(event.userId).toBe('user1');
      expect(eventData.taskId).toBe(mockTask.id);
      expect(eventData.title).toBe(mockTask.title);
    });

    it('should handle missing assignee gracefully', async () => {
      const taskWithoutAssignee = { ...mockTask, assigneeId: null };

      await service.emitTaskCreated(taskWithoutAssignee, 'user1');

      expect(mockWebSocketGateway.emitToRoom).toHaveBeenCalledTimes(3); // task, project, creator rooms only
    });

    it('should handle errors gracefully', async () => {
      mockWebSocketGateway.emitToRoom.mockImplementation(() => {
        throw new Error('Emit failed');
      });

      // Should not throw error
      await expect(service.emitTaskCreated(mockTask, 'user1')).resolves.not.toThrow();
    });
  });

  describe('emitTaskUpdated', () => {
    it('should emit task updated event with change tracking', async () => {
      const previousTask = { ...mockTask, title: 'Old Title', status: TaskStatus.PENDING };
      const updatedTask = { ...mockTask, title: 'New Title', status: TaskStatus.IN_PROGRESS };

      await service.emitTaskUpdated(updatedTask, previousTask, 'user1');

      expect(mockWebSocketGateway.emitToRoom).toHaveBeenCalled();

      // Verify event includes changes
      const firstCallArgs = mockWebSocketGateway.emitToRoom.mock.calls[0];
      const event = firstCallArgs[1];
      const eventData = event.data as TaskEventData;
      expect(event.eventType).toBe(WebSocketEventType.TASK_UPDATED);
      expect(eventData.changes).toBeDefined();
      expect(eventData.changes!.title).toEqual({
        from: 'Old Title',
        to: 'New Title'
      });
      expect(eventData.changes!.status).toEqual({
        from: TaskStatus.PENDING,
        to: TaskStatus.IN_PROGRESS
      });
    });
  });

  describe('emitTaskStatusChanged', () => {
    it('should emit status change event with previous status', async () => {
      const previousStatus = TaskStatus.PENDING;
      const taskWithNewStatus = { ...mockTask, status: TaskStatus.IN_PROGRESS };

      await service.emitTaskStatusChanged(taskWithNewStatus, previousStatus, 'user1');

      expect(mockWebSocketGateway.emitToRoom).toHaveBeenCalled();

      const firstCallArgs = mockWebSocketGateway.emitToRoom.mock.calls[0];
      const event = firstCallArgs[1];
      const eventData = event.data as TaskEventData;
      expect(event.eventType).toBe(WebSocketEventType.TASK_STATUS_CHANGED);
      expect(eventData.previousStatus).toBe(previousStatus);
      expect(eventData.status).toBe(TaskStatus.IN_PROGRESS);
    });
  });

  describe('emitTaskAssigned', () => {
    it('should emit assignment event and include previous assignee room', async () => {
      const previousAssigneeId = 'user3';
      const taskWithNewAssignee = { ...mockTask, assigneeId: 'user4' };

      await service.emitTaskAssigned(taskWithNewAssignee, previousAssigneeId, 'user1');

      expect(mockWebSocketGateway.emitToRoom).toHaveBeenCalled();
      expect(mockWebSocketGateway.getUserRoom).toHaveBeenCalledWith(previousAssigneeId);
      expect(mockWebSocketGateway.getUserRoom).toHaveBeenCalledWith('user4');

      const firstCallArgs = mockWebSocketGateway.emitToRoom.mock.calls[0];
      const event = firstCallArgs[1];
      const eventData = event.data as TaskEventData;
      expect(event.eventType).toBe(WebSocketEventType.TASK_ASSIGNED);
      expect(eventData.assigneeId).toBe('user4');
    });

    it('should handle task unassignment', async () => {
      const previousAssigneeId = 'user3';
      const unassignedTask = { ...mockTask, assigneeId: null };

      await service.emitTaskAssigned(unassignedTask, previousAssigneeId, 'user1');

      expect(mockWebSocketGateway.emitToRoom).toHaveBeenCalled();
      expect(mockWebSocketGateway.getUserRoom).toHaveBeenCalledWith(previousAssigneeId);

      const firstCallArgs = mockWebSocketGateway.emitToRoom.mock.calls[0];
      const event = firstCallArgs[1];
      const eventData = event.data as TaskEventData;
      expect(event.eventType).toBe(WebSocketEventType.TASK_ASSIGNED);
      expect(eventData.assigneeId).toBe(null);
    });
  });

  describe('emitTaskDeleted', () => {
    it('should emit deletion event with minimal task data', async () => {
      await service.emitTaskDeleted(mockTask, 'user1');

      expect(mockWebSocketGateway.emitToRoom).toHaveBeenCalled();

      const firstCallArgs = mockWebSocketGateway.emitToRoom.mock.calls[0];
      const event = firstCallArgs[1];
      const eventData = event.data as TaskEventData;
      expect(event.eventType).toBe(WebSocketEventType.TASK_DELETED);
      expect(eventData.taskId).toBe(mockTask.id);
      expect(eventData.title).toBe(mockTask.title);
    });
  });

  describe('emitTaskCommentAdded', () => {
    it('should emit comment event with truncated content', async () => {
      const longComment = 'a'.repeat(200);

      await service.emitTaskCommentAdded(mockTask, 'comment1', longComment, 'user1');

      expect(mockWebSocketGateway.emitToRoom).toHaveBeenCalled();

      const firstCallArgs = mockWebSocketGateway.emitToRoom.mock.calls[0];
      const event = firstCallArgs[1];
      const eventData = event.data as any; // Task comment has extended data
      expect(event.eventType).toBe(WebSocketEventType.TASK_COMMENT_ADDED);
      expect(eventData.commentContent).toHaveLength(100); // Should be truncated
      expect(eventData.commentContent).toContain('...');
    });

    it('should not truncate short comments', async () => {
      const shortComment = 'Short comment';

      await service.emitTaskCommentAdded(mockTask, 'comment1', shortComment, 'user1');

      const firstCallArgs = mockWebSocketGateway.emitToRoom.mock.calls[0];
      const event = firstCallArgs[1];
      const eventData = event.data as any; // Task comment has extended data
      expect(eventData.commentContent).toBe(shortComment);
    });
  });

  describe('emitBatchTaskEvents', () => {
    it('should emit multiple events efficiently', async () => {
      const events = [
        { type: WebSocketEventType.TASK_UPDATED, task: mockTask, userId: 'user1' },
        { type: WebSocketEventType.TASK_STATUS_CHANGED, task: mockTask, userId: 'user1' },
      ];

      await service.emitBatchTaskEvents(events);

      // Should emit to rooms for each event
      expect(mockWebSocketGateway.emitToRoom).toHaveBeenCalled();
    });
  });

  describe('getEventQueueStatus', () => {
    it('should return queue status', () => {
      const status = service.getEventQueueStatus();

      expect(status).toHaveProperty('queueSize');
      expect(status).toHaveProperty('hasPendingBatch');
      expect(typeof status.queueSize).toBe('number');
      expect(typeof status.hasPendingBatch).toBe('boolean');
    });
  });
});