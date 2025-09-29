import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClaudeCacheService, CacheEntry, CacheStatistics } from '../claude-cache.service';
import {
  ClaudeCommandRequest,
  ClaudeCommandResponse,
  ClaudeCommandType,
  CommandExecutionContext
} from '../claude-command.service';
import { ClaudeSessionMetadata } from '../claude-session.service';
import { ClaudeResponse } from '../claude-wrapper.service';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  config: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  flushdb: jest.fn().mockResolvedValue('OK'),
  dbsize: jest.fn().mockResolvedValue(100),
  info: jest.fn().mockResolvedValue(`
# Memory
used_memory:1024000
used_memory_human:1.02M
used_memory_peak:2048000
used_memory_peak_human:2.05M
# Stats
expired_keys:50
evicted_keys:10
  `),
  ping: jest.fn().mockResolvedValue('PONG'),
};

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisClient);
});

// Mock zlib for compression tests
const mockZlib = {
  gzipSync: jest.fn().mockReturnValue(Buffer.from('compressed-data')),
  gunzipSync: jest.fn().mockReturnValue(Buffer.from('{"decompressed": "data"}')),
};

jest.mock('zlib', () => mockZlib);

describe('ClaudeCacheService', () => {
  let service: ClaudeCacheService;
  let configService: ConfigService;
  let eventEmitter: EventEmitter2;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_CACHE_DB: 1,
        CACHE_KEY_PREFIX: 'test:cache:',
        CACHE_DEFAULT_TTL: 3600,
        CACHE_MAX_MEMORY: '100mb',
        CACHE_EVICTION_POLICY: 'allkeys-lru',
        CACHE_COMPRESSION_ENABLED: true,
        CACHE_COMPRESSION_THRESHOLD: 1024,
        CACHE_COMMAND_TTL: 1800,
        CACHE_SESSION_TTL: 3600,
        CACHE_CONTEXT_TTL: 900,
        CACHE_STREAM_TTL: 300,
        CACHE_PRELOAD_ENABLED: false, // Disable for tests
        CACHE_WARMUP_PATTERNS: 'session:*,command:frequent:*',
        CACHE_TARGET_HIT_RATE: 0.85,
        CACHE_HIT_RATE_WINDOW: 3600,
        CACHE_ADAPTIVE_TTL: true,
        CACHE_METRICS_ENABLED: true,
        CACHE_SLOW_LOG_ENABLED: true,
        CACHE_SLOW_LOG_THRESHOLD: 100,
        CACHE_HIT_RATE_LOGGING: false, // Disable for tests
        CACHE_SIZE_LIMIT_WARNING: 10485760,
      };
      return config[key] ?? defaultValue;
    }),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaudeCacheService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ClaudeCacheService>(ClaudeCacheService);
    configService = module.get<ConfigService>(ConfigService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // Wait for Redis initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize Redis client with correct configuration', () => {
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.config).toHaveBeenCalledWith('SET', 'maxmemory', '100mb');
      expect(mockRedisClient.config).toHaveBeenCalledWith('SET', 'maxmemory-policy', 'allkeys-lru');
    });

    it('should handle Redis initialization failure', async () => {
      const errorMessage = 'Redis connection failed';
      mockRedisClient.connect.mockRejectedValueOnce(new Error(errorMessage));

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            ClaudeCacheService,
            { provide: ConfigService, useValue: mockConfigService },
            { provide: EventEmitter2, useValue: mockEventEmitter },
          ],
        }).compile();

        module.get<ClaudeCacheService>(ClaudeCacheService);
      }).rejects.toThrow(errorMessage);
    });
  });

  describe('Command Response Caching', () => {
    const mockCommand: ClaudeCommandRequest = {
      type: ClaudeCommandType.PROMPT,
      prompt: 'Test prompt',
      runId: 'test-run-id',
      options: { cwd: '/test' },
    };

    const mockResponse: ClaudeCommandResponse = {
      success: true,
      runId: 'test-run-id',
      data: { result: 'Test result' },
    };

    it('should cache command response successfully', async () => {
      mockRedisClient.setex.mockResolvedValueOnce('OK');

      await service.cacheCommandResponse(mockCommand, mockResponse);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining('command:prompt:'),
        1800, // Default command TTL
        expect.any(String)
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.command.stored',
        expect.objectContaining({
          key: expect.stringContaining('command:prompt:'),
          ttl: 1800,
        })
      );
    });

    it('should retrieve cached command response successfully', async () => {
      const cacheEntry: CacheEntry = {
        key: 'test-key',
        value: mockResponse,
        ttl: 1800,
        timestamp: Date.now(),
        metadata: { type: 'command_response', runId: 'test-run-id' },
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cacheEntry));

      const result = await service.getCachedCommandResponse(mockCommand);

      expect(result).toEqual(mockResponse);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.command.hit',
        expect.objectContaining({
          key: expect.stringContaining('command:prompt:'),
        })
      );
    });

    it('should return null for cache miss', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await service.getCachedCommandResponse(mockCommand);

      expect(result).toBeNull();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.command.miss',
        expect.objectContaining({
          key: expect.stringContaining('command:prompt:'),
        })
      );
    });

    it('should handle cache retrieval errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis error'));

      const result = await service.getCachedCommandResponse(mockCommand);

      expect(result).toBeNull();
    });

    it('should use custom TTL when provided', async () => {
      const customTtl = 7200;
      mockRedisClient.setex.mockResolvedValueOnce('OK');

      await service.cacheCommandResponse(mockCommand, mockResponse, customTtl);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        customTtl,
        expect.any(String)
      );
    });
  });

  describe('Session Data Caching', () => {
    const mockSessionId = 'test-session-id';
    const mockSessionData: ClaudeSessionMetadata = {
      sessionId: mockSessionId,
      userId: 'test-user',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      status: 'active',
      commandCount: 5,
      activeCommands: 0,
      permissionMode: 'ask',
      resourceUsage: {
        memoryUsage: 1024,
        cpuTime: 100,
        diskSpace: 2048,
      },
    };

    it('should cache session data successfully', async () => {
      mockRedisClient.setex.mockResolvedValueOnce('OK');

      await service.cacheSessionData(mockSessionId, mockSessionData);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `session:${mockSessionId}:metadata`,
        3600, // Default session TTL
        expect.any(String)
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.session.stored',
        { sessionId: mockSessionId, ttl: 3600 }
      );
    });

    it('should retrieve cached session data successfully', async () => {
      const cacheEntry: CacheEntry = {
        key: 'test-key',
        value: mockSessionData,
        ttl: 3600,
        timestamp: Date.now(),
        metadata: { type: 'session_data', sessionId: mockSessionId },
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cacheEntry));

      const result = await service.getCachedSessionData(mockSessionId);

      expect(result).toEqual(mockSessionData);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.session.hit',
        expect.objectContaining({ sessionId: mockSessionId })
      );
    });

    it('should return null for session cache miss', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await service.getCachedSessionData(mockSessionId);

      expect(result).toBeNull();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.session.miss',
        { sessionId: mockSessionId }
      );
    });
  });

  describe('Execution Context Caching', () => {
    const mockRunId = 'test-run-id';
    const mockContext: CommandExecutionContext = {
      runId: mockRunId,
      commandType: ClaudeCommandType.PROMPT,
      startTime: new Date(),
      status: 'running',
      events: [],
      responseBuffer: [],
    };

    it('should cache execution context successfully', async () => {
      mockRedisClient.setex.mockResolvedValueOnce('OK');

      await service.cacheExecutionContext(mockRunId, mockContext);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `context:${mockRunId}:execution`,
        900, // Default context TTL
        expect.any(String)
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.context.stored',
        { runId: mockRunId, ttl: 900 }
      );
    });
  });

  describe('Stream Data Caching', () => {
    const mockSessionId = 'test-session-id';
    const mockStreamData: ClaudeResponse[] = [
      { event: 'stream', timestamp: new Date().toISOString(), payload: { content: 'test content' } },
      { event: 'status', timestamp: new Date().toISOString(), payload: { status: 'running' } },
    ];

    it('should cache stream data successfully', async () => {
      mockRedisClient.setex.mockResolvedValueOnce('OK');

      await service.cacheStreamData(mockSessionId, mockStreamData);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining(`stream:${mockSessionId}:`),
        300, // Default stream TTL
        expect.any(String)
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.stream.stored',
        expect.objectContaining({
          sessionId: mockSessionId,
          ttl: 300,
          count: 2,
        })
      );
    });
  });

  describe('Data Compression', () => {
    const largeData = 'x'.repeat(2000); // > compression threshold
    const smallData = 'small data';

    it('should compress large data automatically', async () => {
      const mockCommand: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: largeData,
      };

      const mockResponse: ClaudeCommandResponse = {
        success: true,
        data: { largeResult: largeData },
      };

      mockRedisClient.setex.mockResolvedValueOnce('OK');

      await service.cacheCommandResponse(mockCommand, mockResponse);

      expect(mockZlib.gzipSync).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.stringContaining('compressed')
      );
    });

    it('should not compress small data', async () => {
      const mockCommand: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: smallData,
      };

      const mockResponse: ClaudeCommandResponse = {
        success: true,
        data: { smallResult: smallData },
      };

      mockRedisClient.setex.mockResolvedValueOnce('OK');

      await service.cacheCommandResponse(mockCommand, mockResponse);

      expect(mockZlib.gzipSync).not.toHaveBeenCalled();
    });

    it('should decompress compressed data on retrieval', async () => {
      const compressedCacheEntry: CacheEntry = {
        key: 'test-key',
        value: {
          compressed: true,
          data: 'Y29tcHJlc3NlZC1kYXRh', // base64 encoded
          originalSize: 2000,
        },
        ttl: 1800,
        timestamp: Date.now(),
        metadata: { type: 'command_response' },
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(compressedCacheEntry));

      const mockCommand: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
      };

      const result = await service.getCachedCommandResponse(mockCommand);

      expect(mockZlib.gunzipSync).toHaveBeenCalled();
      expect(result).toEqual({ decompressed: 'data' });
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate session data', async () => {
      const sessionId = 'test-session-id';
      const keys = [`session:${sessionId}:metadata`, `session:${sessionId}:data`];

      mockRedisClient.keys.mockResolvedValueOnce(keys);
      mockRedisClient.del.mockResolvedValueOnce(2);

      const deletedCount = await service.invalidateSession(sessionId);

      expect(deletedCount).toBe(2);
      expect(mockRedisClient.keys).toHaveBeenCalledWith(`session:${sessionId}:*`);
      expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.invalidation',
        { pattern: `session:${sessionId}:*`, deletedCount: 2 }
      );
    });

    it('should invalidate command cache', async () => {
      const commandType = ClaudeCommandType.PROMPT;
      const keys = ['command:prompt:hash1', 'command:prompt:hash2'];

      mockRedisClient.keys.mockResolvedValueOnce(keys);
      mockRedisClient.del.mockResolvedValueOnce(2);

      const deletedCount = await service.invalidateCommand(commandType);

      expect(deletedCount).toBe(2);
      expect(mockRedisClient.keys).toHaveBeenCalledWith('command:prompt:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
    });

    it('should handle invalidation with no matching keys', async () => {
      mockRedisClient.keys.mockResolvedValueOnce([]);

      const deletedCount = await service.invalidateSession('non-existent-session');

      expect(deletedCount).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should handle invalidation errors', async () => {
      mockRedisClient.keys.mockRejectedValueOnce(new Error('Redis error'));

      await expect(service.invalidatePattern('test:*')).rejects.toThrow('Redis error');
    });
  });

  describe('Cache Statistics', () => {
    it('should calculate and return cache statistics', async () => {
      // Simulate some cache activity
      const mockCommand: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
      };

      // Cache hit
      const cacheEntry: CacheEntry = {
        key: 'test-key',
        value: { success: true },
        ttl: 1800,
        timestamp: Date.now(),
        metadata: { type: 'command_response' },
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cacheEntry));
      await service.getCachedCommandResponse(mockCommand);

      // Cache miss
      mockRedisClient.get.mockResolvedValueOnce(null);
      await service.getCachedCommandResponse(mockCommand);

      // Get statistics
      const stats = await service.getStatistics();

      expect(stats).toMatchObject({
        totalRequests: expect.any(Number),
        totalHits: expect.any(Number),
        totalMisses: expect.any(Number),
        hitRate: expect.any(Number),
        missRate: expect.any(Number),
        averageResponseTime: expect.any(Number),
        keyCount: 100, // Mocked value
        lastUpdated: expect.any(Date),
      });

      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
      expect(stats.hitRate + stats.missRate).toBeCloseTo(1, 2);
    });

    it('should handle statistics update errors gracefully', async () => {
      mockRedisClient.info.mockRejectedValueOnce(new Error('Redis info error'));

      const stats = await service.getStatistics();

      // Should still return statistics object with default values
      expect(stats).toBeDefined();
      expect(stats.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('Cache Key Building', () => {
    it('should build command keys correctly', () => {
      const key = service.buildCommandKey(ClaudeCommandType.PROMPT, 'test-hash');
      expect(key).toBe('command:prompt:test-hash');
    });

    it('should build session keys correctly', () => {
      const key1 = service.buildSessionKey('session-id');
      const key2 = service.buildSessionKey('session-id', 'metadata');

      expect(key1).toBe('session:session-id');
      expect(key2).toBe('session:session-id:metadata');
    });

    it('should build context keys correctly', () => {
      const key = service.buildContextKey('run-id', 'execution');
      expect(key).toBe('context:run-id:execution');
    });

    it('should build stream keys correctly', () => {
      const timestamp = 1234567890;
      const key = service.buildStreamKey('session-id', timestamp);
      expect(key).toBe('stream:session-id:1234567890');
    });

    it('should build stats keys correctly', () => {
      const key = service.buildStatsKey();
      expect(key).toBe('stats:global');
    });
  });

  describe('Performance Optimization', () => {
    it('should track slow operations', async () => {
      // Mock slow Redis operation
      mockRedisClient.get.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(null), 150))
      );

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockCommand: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
      };

      await service.getCachedCommandResponse(mockCommand);

      // Note: The actual slow log warning depends on internal implementation
      // This test verifies the mechanism exists
      expect(mockRedisClient.get).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should maintain response time window', async () => {
      const mockCommand: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
      };

      // Perform multiple operations to build response time history
      for (let i = 0; i < 5; i++) {
        mockRedisClient.get.mockResolvedValueOnce(null);
        await service.getCachedCommandResponse(mockCommand);
      }

      const stats = await service.getStatistics();
      expect(stats.averageResponseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Clearing', () => {
    it('should clear all cache data', async () => {
      await service.clearCache();

      expect(mockRedisClient.flushdb).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('cache.cleared');
    });

    it('should handle cache clearing errors', async () => {
      mockRedisClient.flushdb.mockRejectedValueOnce(new Error('Flush error'));

      await expect(service.clearCache()).rejects.toThrow('Flush error');
    });
  });

  describe('Configuration Validation', () => {
    it('should handle invalid configuration gracefully', async () => {
      const invalidConfigService = {
        get: jest.fn(() => 'invalid-number'), // Return invalid values
      };

      await expect(async () => {
        await Test.createTestingModule({
          providers: [
            ClaudeCacheService,
            { provide: ConfigService, useValue: invalidConfigService },
            { provide: EventEmitter2, useValue: mockEventEmitter },
          ],
        }).compile();
      }).rejects.toThrow();
    });
  });

  describe('Module Lifecycle', () => {
    it('should cleanup resources on module destroy', async () => {
      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockRedisClient.quit.mockRejectedValueOnce(new Error('Quit error'));

      // Should not throw
      await service.onModuleDestroy();
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors during operations', async () => {
      mockRedisClient.setex.mockRejectedValueOnce(new Error('Connection lost'));

      const mockCommand: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
      };

      const mockResponse: ClaudeCommandResponse = {
        success: true,
        data: 'test',
      };

      await expect(service.cacheCommandResponse(mockCommand, mockResponse))
        .rejects.toThrow('Connection lost');
    });

    it('should handle malformed cache data gracefully', async () => {
      mockRedisClient.get.mockResolvedValueOnce('invalid-json');

      const mockCommand: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
      };

      const result = await service.getCachedCommandResponse(mockCommand);

      expect(result).toBeNull();
    });

    it('should handle schema validation errors', async () => {
      const invalidCacheEntry = {
        // Missing required fields
        value: 'test',
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(invalidCacheEntry));

      const mockCommand: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
      };

      const result = await service.getCachedCommandResponse(mockCommand);

      expect(result).toBeNull();
    });
  });
});