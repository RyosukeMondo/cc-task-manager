"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DevValidationMiddleware_1 = require("../DevValidationMiddleware");
const ContractRegistry_1 = require("../ContractRegistry");
const zod_1 = require("zod");
describe('DevValidationMiddleware', () => {
    let middleware;
    let contractRegistry;
    let mockRequest;
    let mockResponse;
    let mockNext;
    beforeEach(async () => {
        contractRegistry = new ContractRegistry_1.ContractRegistry();
        middleware = new DevValidationMiddleware_1.DevValidationMiddleware(contractRegistry);
        mockRequest = {};
        Object.defineProperty(mockRequest, 'path', { writable: true, value: '/api/test' });
        Object.defineProperty(mockRequest, 'method', { writable: true, value: 'POST' });
        Object.defineProperty(mockRequest, 'body', { writable: true, value: {} });
        Object.defineProperty(mockRequest, 'query', { writable: true, value: {} });
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        mockNext = jest.fn();
        process.env.NODE_ENV = 'development';
    });
    afterEach(() => {
        delete process.env.NODE_ENV;
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
            process.env.NODE_ENV = 'production';
            const prodMiddleware = new DevValidationMiddleware_1.DevValidationMiddleware(contractRegistry);
            prodMiddleware.use(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });
        it('should skip validation for health check routes', () => {
            Object.defineProperty(mockRequest, 'path', { writable: true, value: '/health' });
            middleware.use(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });
        it('should continue if no contract found for route', () => {
            Object.defineProperty(mockRequest, 'path', { writable: true, value: '/unknown/route' });
            middleware.use(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });
        it('should validate request when contract is found', async () => {
            const testSchema = zod_1.z.object({
                name: zod_1.z.string(),
                age: zod_1.z.number(),
            });
            await contractRegistry.registerContract('test', '1.0.0', testSchema);
            Object.defineProperty(mockRequest, 'path', { writable: true, value: '/api/test' });
            Object.defineProperty(mockRequest, 'body', { writable: true, value: { name: 'John', age: 30 } });
            middleware.use(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(mockRequest['contractValidation']).toBeDefined();
            expect(mockRequest['contractValidation'].contractName).toBe('test');
        });
        it('should return validation error for invalid request', async () => {
            const testSchema = zod_1.z.object({
                name: zod_1.z.string(),
                age: zod_1.z.number(),
            });
            await contractRegistry.registerContract('test', '1.0.0', testSchema);
            Object.defineProperty(mockRequest, 'path', { writable: true, value: '/api/test' });
            Object.defineProperty(mockRequest, 'body', { writable: true, value: { name: 'John', age: 'invalid' } });
            middleware.use(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'ContractValidationError',
                contract: expect.objectContaining({
                    name: 'test',
                    version: '1.0.0'
                })
            }));
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
            const testSchema = zod_1.z.object({ test: zod_1.z.string() });
            await contractRegistry.registerContract('user', '1.0.0', testSchema);
            const testCases = [
                { path: '/api/user', expected: 'user' },
                { path: '/user', expected: 'user' },
                { path: '/api/user/123', expected: 'user' }
            ];
            for (const testCase of testCases) {
                Object.defineProperty(mockRequest, 'path', { writable: true, value: testCase.path });
                Object.defineProperty(mockRequest, 'body', { writable: true, value: { test: 'value' } });
                middleware.use(mockRequest, mockResponse, mockNext);
                if (testCase.expected) {
                    expect(mockRequest['contractValidation']?.contractName).toBe(testCase.expected);
                }
            }
        });
    });
    describe('error handling', () => {
        it('should handle registry errors gracefully', () => {
            jest.spyOn(contractRegistry, 'getContractNames').mockImplementation(() => {
                throw new Error('Registry error');
            });
            Object.defineProperty(mockRequest, 'path', { writable: true, value: '/api/test' });
            Object.defineProperty(mockRequest, 'body', { writable: true, value: { test: 'value' } });
            middleware.use(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'DevValidationError',
                message: 'Development-time contract validation failed'
            }));
        });
    });
    describe('file watching', () => {
        it('should attempt to initialize file watcher in development mode', () => {
            const stats = middleware.getValidationStats();
            expect(stats.isDevelopmentMode).toBe(true);
            expect(stats.enabled).toBe(true);
        });
        it('should not initialize file watcher in production mode', () => {
            process.env.NODE_ENV = 'production';
            const prodMiddleware = new DevValidationMiddleware_1.DevValidationMiddleware(contractRegistry);
            const stats = prodMiddleware.getValidationStats();
            expect(stats.watcherActive).toBe(false);
        });
    });
});
//# sourceMappingURL=DevValidationMiddleware.spec.js.map