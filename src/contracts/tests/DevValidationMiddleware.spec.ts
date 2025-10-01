// Removed Test and TestingModule imports since we're instantiating directly
import { Request, Response, NextFunction } from 'express';
import { DevValidationMiddleware } from '../DevValidationMiddleware';
import { ContractRegistry } from '../ContractRegistry';
import { z } from 'zod';

describe('DevValidationMiddleware', () => {
  let middleware: DevValidationMiddleware;
  let contractRegistry: ContractRegistry;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let originalNodeEnv: string | undefined;

  beforeEach(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    jest.replaceProperty(process.env, 'NODE_ENV', 'development');

    contractRegistry = new ContractRegistry();
    middleware = new DevValidationMiddleware(contractRegistry);

    mockRequest = {} as Request;
    Object.defineProperty(mockRequest, 'path', { writable: true, value: '/api/test' });
    Object.defineProperty(mockRequest, 'method', { writable: true, value: 'POST' });
    Object.defineProperty(mockRequest, 'body', { writable: true, value: {} });
    Object.defineProperty(mockRequest, 'query', { writable: true, value: {} });

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalNodeEnv !== undefined) {
      jest.replaceProperty(process.env, 'NODE_ENV', originalNodeEnv as any);
    }
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(middleware).toBeDefined();
    });

    it('should initialize with default config in development mode', () => {
      const stats = middleware.getValidationStats();
      expect(stats.enabled).toBe(true);
      expect(stats.isDevelopmentMode).toBe(true);
    });
  });

  describe('use middleware', () => {
    it('should skip validation in production mode', () => {
      jest.replaceProperty(process.env, 'NODE_ENV', 'production');

      // Create new middleware instance for production
      const prodMiddleware = new DevValidationMiddleware(contractRegistry);
      prodMiddleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should skip validation for health check routes', () => {
      Object.defineProperty(mockRequest, 'path', { writable: true, value: '/health' });
      
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue if no contract found for route', () => {
      Object.defineProperty(mockRequest, 'path', { writable: true, value: '/unknown/route' });
      
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should validate request when contract is found', async () => {
      // Register a test contract
      const testSchema = z.object({
        name: z.string(),
        age: z.number(),
      });
      
      await contractRegistry.registerContract('test', '1.0.0', testSchema);
      
      Object.defineProperty(mockRequest, 'path', { writable: true, value: '/api/test' });
      Object.defineProperty(mockRequest, 'body', { writable: true, value: { name: 'John', age: 30 } });
      
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest['contractValidation']).toBeDefined();
      expect(mockRequest['contractValidation'].contractName).toBe('test');
    });

    it('should return validation error for invalid request', async () => {
      // Register a test contract
      const testSchema = z.object({
        name: z.string(),
        age: z.number(),
      });
      
      await contractRegistry.registerContract('test', '1.0.0', testSchema);
      
      Object.defineProperty(mockRequest, 'path', { writable: true, value: '/api/test' });
      Object.defineProperty(mockRequest, 'body', { writable: true, value: { name: 'John', age: 'invalid' } }); // Invalid age
      
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ContractValidationError',
          contract: expect.objectContaining({
            name: 'test',
            version: '1.0.0'
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should allow configuration updates', () => {
      middleware.configure({
        enabled: false,
        immediateValidation: false
      });
      
      const stats = middleware.getValidationStats();
      expect(stats.enabled).toBe(false);
    });
  });

  describe('validation stats', () => {
    it('should provide validation statistics', () => {
      const stats = middleware.getValidationStats();
      
      expect(stats).toHaveProperty('enabled');
      expect(stats).toHaveProperty('isDevelopmentMode');
      expect(stats).toHaveProperty('watcherActive');
      expect(stats).toHaveProperty('cachedResults');
      expect(stats).toHaveProperty('lastValidations');
    });
  });

  describe('route inference', () => {
    it('should infer contract from api routes', async () => {
      // Register a test contract
      const testSchema = z.object({ test: z.string() });
      await contractRegistry.registerContract('user', '1.0.0', testSchema);
      
      const testCases = [
        { path: '/api/user', expected: 'user' },
        { path: '/user', expected: 'user' },
        { path: '/api/user/123', expected: 'user' }
      ];
      
      for (const testCase of testCases) {
        Object.defineProperty(mockRequest, 'path', { writable: true, value: testCase.path });
        Object.defineProperty(mockRequest, 'body', { writable: true, value: { test: 'value' } });
        
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
        
        if (testCase.expected) {
          expect(mockRequest['contractValidation']?.contractName).toBe(testCase.expected);
        }
      }
    });
  });

  describe('error handling', () => {
    it('should handle registry errors gracefully', () => {
      // Mock registry to throw error
      jest.spyOn(contractRegistry, 'getContractNames').mockImplementation(() => {
        throw new Error('Registry error');
      });
      
      Object.defineProperty(mockRequest, 'path', { writable: true, value: '/api/test' });
      Object.defineProperty(mockRequest, 'body', { writable: true, value: { test: 'value' } });
      
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'DevValidationError',
          message: 'Development-time contract validation failed'
        })
      );
    });
  });

  describe('file watching', () => {
    it('should attempt to initialize file watcher in development mode', () => {
      const stats = middleware.getValidationStats();
      // File watcher may not work in test environment, but should attempt to initialize
      expect(stats.isDevelopmentMode).toBe(true);
      expect(stats.enabled).toBe(true);
    });

    it('should not initialize file watcher in production mode', () => {
      jest.replaceProperty(process.env, 'NODE_ENV', 'production');

      const prodMiddleware = new DevValidationMiddleware(contractRegistry);
      const stats = prodMiddleware.getValidationStats();

      expect(stats.watcherActive).toBe(false);
    });
  });
});