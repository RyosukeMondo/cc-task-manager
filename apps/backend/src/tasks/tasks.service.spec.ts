import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { QueueService } from '../queue/queue.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('TasksService', () => {
  let service: TasksService;
  let repository: TasksRepository;
  let queueService: QueueService;
  let wsGateway: WebSocketGateway;
  let eventEmitter: EventEmitter2;

  const mockTask = {
    id: 'task-123',
    title: 'Test Task',
    description: 'Test Description',
    status: 'pending',
    priority: 'medium',
    assigneeId: 'user-123',
    createdBy: 'user-456',
    dueDate: new Date('2025-12-31'),
    tags: ['test', 'unit-test'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    role: 'user',
    name: 'Test User',
  };

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findByAssignee: jest.fn(),
    findByStatus: jest.fn(),
    updateStatus: jest.fn(),
    assignTask: jest.fn(),
    addComment: jest.fn(),
    getComments: jest.fn(),
    searchTasks: jest.fn(),
  };

  const mockQueueService = {
    addJob: jest.fn(),
    processJob: jest.fn(),
    getJobStatus: jest.fn(),
    removeJob: jest.fn(),
  };

  const mockWsGateway = {
    sendToUser: jest.fn(),
    sendToRoom: jest.fn(),
    broadcastTaskUpdate: jest.fn(),
    notifyAssignee: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
    emitAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: TasksRepository, useValue: mockRepository },
        { provide: QueueService, useValue: mockQueueService },
        { provide: WebSocketGateway, useValue: mockWsGateway },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    repository = module.get<TasksRepository>(TasksRepository);
    queueService = module.get<QueueService>(QueueService);
    wsGateway = module.get<WebSocketGateway>(WebSocketGateway);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new task and emit events', async () => {
      const createDto = {
        title: 'New Task',
        description: 'New Description',
        priority: 'high',
        assigneeId: 'user-789',
        dueDate: '2025-12-31',
        tags: ['new', 'important'],
      };

      const createdTask = { ...mockTask, ...createDto, id: 'new-task-id' };
      mockRepository.create.mockResolvedValue(createdTask);
      mockQueueService.addJob.mockResolvedValue({ id: 'job-123' });

      const result = await service.create(createDto, mockUser);

      expect(result).toEqual(createdTask);
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createDto,
        createdBy: mockUser.id,
        status: 'pending',
      });
      expect(mockQueueService.addJob).toHaveBeenCalledWith('task-created', {
        taskId: createdTask.id,
        userId: mockUser.id,
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('task.created', createdTask);
      expect(mockWsGateway.broadcastTaskUpdate).toHaveBeenCalledWith('created', createdTask);
    });

    it('should validate required fields', async () => {
      const invalidDto = {
        description: 'Missing title',
      };

      await expect(service.create(invalidDto as any, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated tasks with filters', async () => {
      const filters = {
        status: 'pending',
        assigneeId: 'user-123',
        page: 1,
        limit: 10,
      };

      const tasks = [mockTask];
      const paginatedResult = {
        data: tasks,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockRepository.findAll.mockResolvedValue(paginatedResult);

      const result = await service.findAll(filters);

      expect(result).toEqual(paginatedResult);
      expect(mockRepository.findAll).toHaveBeenCalledWith(filters);
    });

    it('should handle empty results', async () => {
      const paginatedResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };

      mockRepository.findAll.mockResolvedValue(paginatedResult);

      const result = await service.findAll({});

      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findById', () => {
    it('should return task by id', async () => {
      mockRepository.findById.mockResolvedValue(mockTask);

      const result = await service.findById('task-123');

      expect(result).toEqual(mockTask);
      expect(mockRepository.findById).toHaveBeenCalledWith('task-123');
    });

    it('should throw NotFoundException when task not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update task and emit events', async () => {
      const updateDto = {
        title: 'Updated Title',
        status: 'in_progress',
      };

      const updatedTask = { ...mockTask, ...updateDto };
      mockRepository.findById.mockResolvedValue(mockTask);
      mockRepository.update.mockResolvedValue(updatedTask);

      const result = await service.update('task-123', updateDto, mockUser);

      expect(result).toEqual(updatedTask);
      expect(mockRepository.update).toHaveBeenCalledWith('task-123', updateDto);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('task.updated', updatedTask);
      expect(mockWsGateway.broadcastTaskUpdate).toHaveBeenCalledWith('updated', updatedTask);
    });

    it('should check permissions before updating', async () => {
      const updateDto = { title: 'Updated' };
      const unauthorizedUser = { ...mockUser, id: 'other-user', role: 'user' };

      mockRepository.findById.mockResolvedValue(mockTask);

      await expect(
        service.update('task-123', updateDto, unauthorizedUser)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should queue status change jobs', async () => {
      const updateDto = { status: 'completed' };
      const updatedTask = { ...mockTask, status: 'completed' };

      mockRepository.findById.mockResolvedValue(mockTask);
      mockRepository.update.mockResolvedValue(updatedTask);
      mockQueueService.addJob.mockResolvedValue({ id: 'job-456' });

      await service.update('task-123', updateDto, { ...mockUser, role: 'admin' });

      expect(mockQueueService.addJob).toHaveBeenCalledWith('task-status-changed', {
        taskId: 'task-123',
        oldStatus: 'pending',
        newStatus: 'completed',
        userId: mockUser.id,
      });
    });
  });

  describe('delete', () => {
    it('should delete task and emit events', async () => {
      mockRepository.findById.mockResolvedValue(mockTask);
      mockRepository.delete.mockResolvedValue(true);

      await service.delete('task-123', { ...mockUser, id: 'user-456', role: 'admin' });

      expect(mockRepository.delete).toHaveBeenCalledWith('task-123');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('task.deleted', {
        taskId: 'task-123',
        deletedBy: 'user-456',
      });
      expect(mockWsGateway.broadcastTaskUpdate).toHaveBeenCalledWith('deleted', {
        id: 'task-123',
      });
    });

    it('should check delete permissions', async () => {
      const unauthorizedUser = { ...mockUser, id: 'other-user', role: 'user' };

      mockRepository.findById.mockResolvedValue(mockTask);

      await expect(service.delete('task-123', unauthorizedUser)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('assignTask', () => {
    it('should assign task to user and notify', async () => {
      const assigneeId = 'new-assignee';
      const updatedTask = { ...mockTask, assigneeId };

      mockRepository.findById.mockResolvedValue(mockTask);
      mockRepository.assignTask.mockResolvedValue(updatedTask);

      const result = await service.assignTask('task-123', assigneeId, mockUser);

      expect(result).toEqual(updatedTask);
      expect(mockRepository.assignTask).toHaveBeenCalledWith('task-123', assigneeId);
      expect(mockWsGateway.notifyAssignee).toHaveBeenCalledWith(assigneeId, updatedTask);
      expect(mockQueueService.addJob).toHaveBeenCalledWith('task-assigned', {
        taskId: 'task-123',
        assigneeId,
        assignedBy: mockUser.id,
      });
    });

    it('should handle self-assignment', async () => {
      const updatedTask = { ...mockTask, assigneeId: mockUser.id };

      mockRepository.findById.mockResolvedValue(mockTask);
      mockRepository.assignTask.mockResolvedValue(updatedTask);

      await service.assignTask('task-123', mockUser.id, mockUser);

      expect(mockWsGateway.notifyAssignee).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should update task status with validation', async () => {
      const newStatus = 'in_progress';
      const updatedTask = { ...mockTask, status: newStatus };

      mockRepository.findById.mockResolvedValue(mockTask);
      mockRepository.updateStatus.mockResolvedValue(updatedTask);

      const result = await service.updateStatus('task-123', newStatus, mockUser);

      expect(result).toEqual(updatedTask);
      expect(mockRepository.updateStatus).toHaveBeenCalledWith('task-123', newStatus);
    });

    it('should validate status transitions', async () => {
      const completedTask = { ...mockTask, status: 'completed' };
      mockRepository.findById.mockResolvedValue(completedTask);

      await expect(
        service.updateStatus('task-123', 'pending', mockUser)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('searchTasks', () => {
    it('should search tasks with query', async () => {
      const query = 'test';
      const searchResults = [mockTask];

      mockRepository.searchTasks.mockResolvedValue(searchResults);

      const result = await service.searchTasks(query, { limit: 10 });

      expect(result).toEqual(searchResults);
      expect(mockRepository.searchTasks).toHaveBeenCalledWith(query, { limit: 10 });
    });

    it('should handle empty search results', async () => {
      mockRepository.searchTasks.mockResolvedValue([]);

      const result = await service.searchTasks('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple tasks', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];
      const updateDto = { status: 'completed' };
      const tasks = taskIds.map(id => ({ ...mockTask, id }));

      tasks.forEach(task => {
        mockRepository.findById.mockResolvedValueOnce(task);
        mockRepository.update.mockResolvedValueOnce({ ...task, ...updateDto });
      });

      const results = await service.bulkUpdate(taskIds, updateDto, {
        ...mockUser,
        role: 'admin',
      });

      expect(results).toHaveLength(3);
      expect(mockRepository.update).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in bulk updates', async () => {
      const taskIds = ['task-1', 'nonexistent', 'task-3'];

      mockRepository.findById
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockTask);

      mockRepository.update.mockResolvedValue({ ...mockTask, status: 'completed' });

      const results = await service.bulkUpdate(
        taskIds,
        { status: 'completed' },
        { ...mockUser, role: 'admin' }
      );

      expect(results).toHaveLength(2);
      expect(mockRepository.update).toHaveBeenCalledTimes(2);
    });
  });
});