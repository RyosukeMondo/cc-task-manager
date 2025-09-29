import { Test, TestingModule } from '@nestjs/testing';
import { ClaudeEventsService } from './claude-events.service';
import { WebSocketGateway } from '../websocket.gateway';

describe('ClaudeEventsService', () => {
  let service: ClaudeEventsService;
  let mockWebSocketGateway: jest.Mocked<WebSocketGateway>;

  beforeEach(async () => {
    const mockGateway = {
      emitToRoom: jest.fn(),
      getTaskRoom: jest.fn().mockReturnValue('task:task-123'),
      getProjectRoom: jest.fn().mockReturnValue('project:project-123'),
      getUserRoom: jest.fn().mockReturnValue('user:user-123'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaudeEventsService,
        {
          provide: WebSocketGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<ClaudeEventsService>(ClaudeEventsService);
    mockWebSocketGateway = module.get(WebSocketGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get all stream statuses', () => {
    const statuses = service.getAllStreamStatuses();
    expect(Array.isArray(statuses)).toBe(true);
    expect(statuses).toHaveLength(0); // Initially no active streams
  });

  it('should return null for non-existent stream status', () => {
    const status = service.getStreamStatus('non-existent-id');
    expect(status).toBeNull();
  });
});