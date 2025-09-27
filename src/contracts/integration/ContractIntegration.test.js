"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const path_1 = require("path");
const fs_1 = require("fs");
const ContractRegistry_1 = require("../ContractRegistry");
const ApiContractGenerator_1 = require("../ApiContractGenerator");
const TypeScriptGenerator_1 = require("../TypeScriptGenerator");
const ContractValidationPipe_1 = require("../ContractValidationPipe");
const VersionManager_1 = require("../VersionManager");
const DevValidationMiddleware_1 = require("../DevValidationMiddleware");
const worker_service_1 = require("../../worker/worker.service");
const process_manager_service_1 = require("../../worker/process-manager.service");
const state_monitor_service_1 = require("../../worker/state-monitor.service");
const claude_code_client_service_1 = require("../../worker/claude-code-client.service");
const worker_config_1 = require("../../config/worker.config");
describe('Contract-Driven System Integration', () => {
    let app;
    let contractRegistry;
    let apiContractGenerator;
    let typeScriptGenerator;
    let versionManager;
    let devValidationMiddleware;
    let workerService;
    let processManager;
    let stateMonitor;
    let claudeCodeClient;
    let eventEmitter;
    let configService;
    let testWorkingDir;
    let mockWorkerConfig;
    const TaskExecutionV1Schema = zod_1.z.object({
        task: zod_1.z.string().min(1).max(1000).describe('Task description to execute'),
        options: zod_1.z.object({
            timeout: zod_1.z.number().min(1000).max(300000).default(30000).describe('Execution timeout in milliseconds'),
            priority: zod_1.z.enum(['low', 'normal', 'high']).default('normal').describe('Task priority level'),
            retryCount: zod_1.z.number().min(0).max(3).default(0).describe('Number of retry attempts'),
        }).optional().describe('Task execution options'),
        metadata: zod_1.z.object({
            correlationId: zod_1.z.string().uuid().optional().describe('Request correlation ID'),
            tags: zod_1.z.array(zod_1.z.string()).optional().describe('Task classification tags'),
            environment: zod_1.z.enum(['development', 'staging', 'production']).default('development'),
        }).optional().describe('Task metadata'),
    });
    const TaskExecutionV2Schema = TaskExecutionV1Schema.extend({
        config: zod_1.z.object({
            enableDetailedLogs: zod_1.z.boolean().default(false).describe('Enable verbose logging'),
            workingDirectory: zod_1.z.string().optional().describe('Custom working directory'),
            environmentVariables: zod_1.z.record(zod_1.z.string()).optional().describe('Environment variables'),
        }).optional().describe('Advanced task configuration'),
    });
    const TaskResponseSchema = zod_1.z.object({
        taskId: zod_1.z.string().uuid().describe('Unique task identifier'),
        success: zod_1.z.boolean().describe('Task execution success status'),
        state: zod_1.z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).describe('Current task state'),
        output: zod_1.z.string().optional().describe('Task execution output'),
        error: zod_1.z.string().optional().describe('Error message if failed'),
        correlationId: zod_1.z.string().uuid().describe('Request correlation ID'),
        startTime: zod_1.z.string().datetime().describe('Task start timestamp'),
        endTime: zod_1.z.string().datetime().optional().describe('Task completion timestamp'),
        duration: zod_1.z.number().optional().describe('Execution duration in milliseconds'),
        metadata: zod_1.z.object({
            pid: zod_1.z.number().optional().describe('Process ID'),
            outcome: zod_1.z.string().optional().describe('Normalized outcome'),
            reason: zod_1.z.string().optional().describe('Outcome reason'),
            tags: zod_1.z.array(zod_1.z.string()).optional().describe('Classification tags'),
        }).optional().describe('Task execution metadata'),
    });
    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        testWorkingDir = (0, path_1.join)(process.cwd(), 'tmp', 'contract-integration-tests');
        if ((0, fs_1.existsSync)(testWorkingDir)) {
            (0, fs_1.rmSync)(testWorkingDir, { recursive: true, force: true });
        }
        (0, fs_1.mkdirSync)(testWorkingDir, { recursive: true });
        mockWorkerConfig = {
            pythonExecutable: '/usr/bin/python3',
            gracefulShutdownMs: 1000,
            maxConcurrentTasks: 2,
            processTimeoutMs: 10000,
            pidCheckIntervalMs: 100,
            fileWatchTimeoutMs: 5000,
            inactivityTimeoutMs: 30000,
            wrapperScriptPath: (0, path_1.join)(testWorkingDir, 'mock-wrapper.py'),
            wrapperWorkingDir: testWorkingDir,
            queueName: 'test-claude-code-tasks',
            redisHost: 'localhost',
            redisPort: 6379,
            logLevel: 'debug',
            enableDetailedLogs: true,
            sessionLogsDir: (0, path_1.join)(testWorkingDir, 'logs'),
            awaitWriteFinish: true,
            awaitWriteFinishMs: 50,
        };
        const mockWrapperScript = `#!/usr/bin/env python3
import sys
import json
import time

def main():
    print(json.dumps({
        "status": "success",
        "output": "Mock task execution completed",
        "outcome": "completed",
        "reason": "Mock execution",
        "tags": ["test", "mock"],
        "duration": 100
    }))
    return 0

if __name__ == "__main__":
    sys.exit(main())
`;
        (0, fs_1.writeFileSync)(mockWorkerConfig.wrapperScriptPath, mockWrapperScript);
        (0, fs_1.mkdirSync)(mockWorkerConfig.sessionLogsDir, { recursive: true });
    });
    beforeEach(async () => {
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [event_emitter_1.EventEmitterModule.forRoot()],
            providers: [
                ContractRegistry_1.ContractRegistry,
                ApiContractGenerator_1.ApiContractGenerator,
                TypeScriptGenerator_1.TypeScriptGenerator,
                VersionManager_1.VersionManager,
                DevValidationMiddleware_1.DevValidationMiddleware,
                worker_service_1.WorkerService,
                process_manager_service_1.ProcessManagerService,
                state_monitor_service_1.StateMonitorService,
                claude_code_client_service_1.ClaudeCodeClientService,
                {
                    provide: config_1.ConfigService,
                    useValue: {
                        get: jest.fn((key) => {
                            if (key === 'worker')
                                return mockWorkerConfig;
                            return undefined;
                        }),
                    },
                },
                common_1.Logger,
            ],
        }).compile();
        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new common_1.ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }));
        contractRegistry = moduleFixture.get(ContractRegistry_1.ContractRegistry);
        apiContractGenerator = moduleFixture.get(ApiContractGenerator_1.ApiContractGenerator);
        typeScriptGenerator = moduleFixture.get(TypeScriptGenerator_1.TypeScriptGenerator);
        versionManager = moduleFixture.get(VersionManager_1.VersionManager);
        devValidationMiddleware = moduleFixture.get(DevValidationMiddleware_1.DevValidationMiddleware);
        workerService = moduleFixture.get(worker_service_1.WorkerService);
        processManager = moduleFixture.get(process_manager_service_1.ProcessManagerService);
        stateMonitor = moduleFixture.get(state_monitor_service_1.StateMonitorService);
        claudeCodeClient = moduleFixture.get(claude_code_client_service_1.ClaudeCodeClientService);
        eventEmitter = moduleFixture.get(event_emitter_1.EventEmitter2);
        configService = moduleFixture.get(config_1.ConfigService);
        await app.init();
    });
    afterEach(async () => {
        if (app) {
            await app.close();
        }
    });
    afterAll(async () => {
        if ((0, fs_1.existsSync)(testWorkingDir)) {
            (0, fs_1.rmSync)(testWorkingDir, { recursive: true, force: true });
        }
    });
    describe('Complete Contract Lifecycle', () => {
        it('should register, version, and validate contracts end-to-end', async () => {
            const registrationResult = await contractRegistry.registerContract('TaskExecution', '1.0.0', TaskExecutionV1Schema, {
                description: 'Task execution request schema v1.0',
                compatibleVersions: [],
            });
            expect(registrationResult).toBe(true);
            const contract = await contractRegistry.getContract('TaskExecution', '1.0.0');
            expect(contract).toBeDefined();
            expect(contract.metadata.name).toBe('TaskExecution');
            expect(contract.metadata.version).toBe('1.0.0');
            const endpoints = [{
                    path: '/api/tasks',
                    method: 'POST',
                    contractName: 'TaskExecution',
                    contractVersion: '1.0.0',
                    description: 'Create a new task'
                }];
            const options = {
                title: 'Contract API',
                version: '1.0.0',
                description: 'API documentation generated from contracts'
            };
            const openApiSpec = apiContractGenerator.generateOpenAPISpec(endpoints, options);
            expect(openApiSpec).toBeDefined();
            expect(openApiSpec.paths).toBeDefined();
            expect(openApiSpec.components?.schemas).toBeDefined();
            const schemas = openApiSpec.components?.schemas || {};
            expect(Object.keys(schemas)).toContain('TaskExecution_1_0_0');
            const typeResult = typeScriptGenerator.generateContractTypes('TaskExecution', '1.0.0');
            expect(typeResult).toBeDefined();
            expect(typeResult.types).toContain('export interface TaskExecution_1_0_0');
            expect(typeResult.types).toContain('task: string');
            expect(typeResult.types).toContain('options?: {');
            const validRequest = {
                task: 'Test task execution',
                options: {
                    timeout: 15000,
                    priority: 'high',
                    retryCount: 1,
                },
                metadata: {
                    correlationId: '123e4567-e89b-12d3-a456-426614174000',
                    tags: ['test', 'integration'],
                    environment: 'development',
                },
            };
            const validationPipe = new ContractValidationPipe_1.ContractValidationPipe(contractRegistry, {
                contractName: 'TaskExecution',
                version: '1.0.0'
            });
            const validatedRequest = await validationPipe.transform(validRequest, {
                type: 'body',
                metatype: Object,
                data: '',
            });
            expect(validatedRequest).toEqual(validRequest);
            const invalidRequest = {
                task: '',
                options: {
                    timeout: 500,
                    priority: 'invalid',
                },
            };
            await expect(validationPipe.transform(invalidRequest, {
                type: 'body',
                metatype: Object,
                data: '',
            })).rejects.toThrow();
        });
        it('should handle contract versioning and backward compatibility', async () => {
            await contractRegistry.registerContract('TaskExecution', '1.0.0', TaskExecutionV1Schema, { description: 'Initial version' });
            await contractRegistry.registerContract('TaskExecution', '2.0.0', TaskExecutionV2Schema, {
                description: 'Extended version with config options',
                compatibleVersions: ['1.0.0'],
            });
            const compatibilityResult = versionManager.isUpgradeCompatible('TaskExecution', '1.0.0', '2.0.0');
            expect(compatibilityResult.compatible).toBe(true);
            expect(compatibilityResult.breakingChanges).toHaveLength(0);
            expect(compatibilityResult.warnings).toHaveLength(0);
            const v1Request = {
                task: 'Test task',
                options: { timeout: 20000 },
            };
            const v2ValidationPipe = new ContractValidationPipe_1.ContractValidationPipe(contractRegistry, {
                contractName: 'TaskExecution',
                version: '2.0.0'
            });
            const validatedV1Request = await v2ValidationPipe.transform(v1Request, {
                type: 'body',
                metatype: Object,
                data: '',
            });
            expect(validatedV1Request.task).toBe('Test task');
            expect(validatedV1Request.options?.timeout).toBe(20000);
            const v2Request = {
                task: 'Advanced test task',
                options: { timeout: 25000 },
                config: {
                    workingDirectory: '/tmp/test',
                    environmentVariables: { TEST_MODE: 'true' },
                },
            };
            const validatedV2Request = await v2ValidationPipe.transform(v2Request, {
                type: 'body',
                metatype: Object,
                data: '',
            });
            expect(validatedV2Request.config?.enableDetailedLogs).toBe(true);
            expect(validatedV2Request.config?.environmentVariables?.TEST_MODE).toBe('true');
        });
    });
    describe('Worker Service Integration with Contracts', () => {
        it('should integrate contract validation with worker service execution', async () => {
            await contractRegistry.registerContract('TaskExecutionRequest', '1.0.0', worker_config_1.TaskExecutionRequestSchema, { description: 'Worker service task execution schema' });
            const taskRequest = {
                task: 'console.log("Hello from contract-validated task");',
                options: {
                    timeout: 10000,
                },
            };
            const mockProcess = {
                pid: 12345,
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
                kill: jest.fn(),
            };
            jest.spyOn(processManager, 'spawnWorkerProcess').mockResolvedValue(mockProcess);
            jest.spyOn(claudeCodeClient, 'parseResponse').mockResolvedValue({
                success: true,
                output: 'Hello from contract-validated task',
                outcome: 'completed',
                reason: 'Task executed successfully',
                tags: ['test'],
                normalizedMessage: 'Task execution completed',
            });
            const result = await workerService.executeTask(taskRequest);
            expect(result.success).toBe(true);
            expect(result.taskId).toBeDefined();
            expect(result.correlationId).toBeDefined();
            expect(result.state).toBe('completed');
            expect(result.output).toContain('Hello from contract-validated task');
            expect(processManager.spawnWorkerProcess).toHaveBeenCalled();
            expect(claudeCodeClient.parseResponse).toHaveBeenCalled();
        });
        it('should reject invalid requests through contract validation', async () => {
            await contractRegistry.registerContract('TaskExecutionRequest', '1.0.0', worker_config_1.TaskExecutionRequestSchema, { description: 'Worker service validation schema' });
            const invalidRequest = {
                task: '',
                options: {
                    timeout: 'invalid',
                    enableDetailedLogs: 'yes',
                },
            };
            await expect(workerService.executeTask(invalidRequest))
                .rejects
                .toThrow();
        });
        it('should track contract validation metrics', async () => {
            await contractRegistry.registerContract('TaskExecutionRequest', '1.0.0', worker_config_1.TaskExecutionRequestSchema, { description: 'Metrics tracking schema' });
            const validRequest = {
                task: 'print("Metrics test")',
                options: { timeout: 5000 },
            };
            const startTime = Date.now();
            jest.spyOn(processManager, 'spawnWorkerProcess').mockResolvedValue({
                pid: 12345,
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
                kill: jest.fn(),
            });
            jest.spyOn(claudeCodeClient, 'parseResponse').mockResolvedValue({
                success: true,
                output: 'Metrics test',
                outcome: 'completed',
                reason: 'Test execution',
                tags: ['metrics'],
                normalizedMessage: 'Test completed',
            });
            const result = await workerService.executeTask(validRequest);
            const validationDuration = Date.now() - startTime;
            expect(result.success).toBe(true);
            expect(validationDuration).toBeLessThan(1000);
        });
    });
    describe('Development-Time Contract Validation', () => {
        it('should provide real-time validation feedback during development', async () => {
            process.env.NODE_ENV = 'development';
            await contractRegistry.registerContract('DevTestContract', '1.0.0', zod_1.z.object({
                name: zod_1.z.string().min(1),
                value: zod_1.z.number().positive(),
            }), { description: 'Development validation test schema' });
            const validData = { name: 'test', value: 42 };
            const validationResult = await devValidationMiddleware.validateRequest('DevTestContract', '1.0.0', validData);
            expect(validationResult.isValid).toBe(true);
            expect(validationResult.errors).toHaveLength(0);
            const invalidData = { name: '', value: -1 };
            const invalidValidationResult = await devValidationMiddleware.validateRequest('DevTestContract', '1.0.0', invalidData);
            expect(invalidValidationResult.isValid).toBe(false);
            expect(invalidValidationResult.errors.length).toBeGreaterThan(0);
            expect(invalidValidationResult.errors.some(e => e.field === 'name')).toBe(true);
            expect(invalidValidationResult.errors.some(e => e.field === 'value')).toBe(true);
        });
        it('should provide actionable error messages for development', async () => {
            const complexSchema = zod_1.z.object({
                user: zod_1.z.object({
                    id: zod_1.z.string().uuid('Invalid UUID format'),
                    email: zod_1.z.string().email('Must be a valid email address'),
                    age: zod_1.z.number().min(18, 'Must be at least 18 years old').max(100, 'Must be under 100 years old'),
                }),
                preferences: zod_1.z.object({
                    theme: zod_1.z.enum(['light', 'dark'], { errorMap: () => ({ message: 'Theme must be light or dark' }) }),
                    notifications: zod_1.z.boolean(),
                }),
                tags: zod_1.z.array(zod_1.z.string().min(1, 'Tags cannot be empty')).min(1, 'At least one tag required'),
            });
            await contractRegistry.registerContract('ComplexContract', '1.0.0', complexSchema, { description: 'Complex validation test schema' });
            const invalidComplexData = {
                user: {
                    id: 'invalid-uuid',
                    email: 'not-an-email',
                    age: 15,
                },
                preferences: {
                    theme: 'invalid-theme',
                    notifications: 'yes',
                },
                tags: [],
            };
            const result = await devValidationMiddleware.validateRequest('ComplexContract', '1.0.0', invalidComplexData);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            const errorMessages = result.errors.map(e => e.message);
            expect(errorMessages.some(msg => msg.includes('UUID format'))).toBe(true);
            expect(errorMessages.some(msg => msg.includes('valid email'))).toBe(true);
            expect(errorMessages.some(msg => msg.includes('18 years old'))).toBe(true);
            expect(errorMessages.some(msg => msg.includes('light or dark'))).toBe(true);
        });
    });
    describe('Consumer-Driven Contract Testing', () => {
        it('should verify provider contracts against consumer expectations', async () => {
            const consumerContract = {
                provider: 'TaskManagerAPI',
                consumer: 'ClaudeCodeSDK',
                interactions: [
                    {
                        description: 'execute task request',
                        request: {
                            method: 'POST',
                            path: '/tasks/execute',
                            body: {
                                task: 'console.log("test")',
                                options: { timeout: 30000 },
                            },
                        },
                        response: {
                            status: 200,
                            body: {
                                taskId: 'string',
                                success: true,
                                state: 'completed',
                                correlationId: 'string',
                                startTime: 'string',
                            },
                        },
                    },
                ],
            };
            await contractRegistry.registerContract('TaskExecutionRequest', '1.0.0', worker_config_1.TaskExecutionRequestSchema, { description: 'Provider contract for task execution' });
            await contractRegistry.registerContract('TaskExecutionResponse', '1.0.0', TaskResponseSchema, { description: 'Provider response contract' });
            const requestValidation = worker_config_1.TaskExecutionRequestSchema.safeParse(consumerContract.interactions[0].request.body);
            expect(requestValidation.success).toBe(true);
            const mockResponse = {
                taskId: '123e4567-e89b-12d3-a456-426614174000',
                success: true,
                state: 'completed',
                output: 'test',
                correlationId: '123e4567-e89b-12d3-a456-426614174001',
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                duration: 1000,
            };
            const responseValidation = TaskResponseSchema.safeParse(mockResponse);
            expect(responseValidation.success).toBe(true);
            expect(responseValidation.data?.taskId).toBeDefined();
            expect(responseValidation.data?.success).toBe(true);
            expect(responseValidation.data?.state).toBe('completed');
        });
        it('should detect breaking changes in provider contracts', async () => {
            const initialRequestSchema = zod_1.z.object({
                task: zod_1.z.string(),
                timeout: zod_1.z.number().default(30000),
            });
            await contractRegistry.registerContract('TaskRequest', '1.0.0', initialRequestSchema, { description: 'Initial task request schema' });
            const consumerRequest = {
                task: 'test task',
                timeout: 15000,
            };
            const v1Validation = initialRequestSchema.safeParse(consumerRequest);
            expect(v1Validation.success).toBe(true);
            const breakingChangeSchema = zod_1.z.object({
                taskDescription: zod_1.z.string(),
                timeoutMs: zod_1.z.number().default(30000),
                required: zod_1.z.string(),
            });
            await contractRegistry.registerContract('TaskRequest', '2.0.0', breakingChangeSchema, { description: 'Breaking change version' });
            const compatibilityCheck = versionManager.isUpgradeCompatible('TaskRequest', '1.0.0', '2.0.0');
            expect(compatibilityCheck.compatible).toBe(false);
            expect(compatibilityCheck.breakingChanges.length).toBeGreaterThan(0);
            const v2Validation = breakingChangeSchema.safeParse(consumerRequest);
            expect(v2Validation.success).toBe(false);
        });
    });
    describe('Performance and Scalability', () => {
        it('should handle high-volume contract validation efficiently', async () => {
            await contractRegistry.registerContract('PerformanceTest', '1.0.0', worker_config_1.TaskExecutionRequestSchema, { description: 'Performance testing schema' });
            const validationPipe = new ContractValidationPipe_1.ContractValidationPipe(contractRegistry, {
                contractName: 'PerformanceTest',
                version: '1.0.0'
            });
            const testRequests = Array.from({ length: 100 }, (_, i) => ({
                task: `Performance test task ${i}`,
                options: { timeout: 30000 },
            }));
            const startTime = Date.now();
            const validationPromises = testRequests.map(request => validationPipe.transform(request, {
                type: 'body',
                metatype: Object,
                data: '',
            }));
            const results = await Promise.all(validationPromises);
            const totalTime = Date.now() - startTime;
            const avgTimePerValidation = totalTime / testRequests.length;
            expect(results).toHaveLength(100);
            expect(results.every(result => result.task.startsWith('Performance test task'))).toBe(true);
            expect(avgTimePerValidation).toBeLessThan(10);
            expect(totalTime).toBeLessThan(1000);
        });
        it('should cache contract schemas for performance optimization', async () => {
            await contractRegistry.registerContract('CacheTest', '1.0.0', worker_config_1.TaskExecutionRequestSchema, { description: 'Cache performance test' });
            const validationPipe = new ContractValidationPipe_1.ContractValidationPipe(contractRegistry, {
                contractName: 'CacheTest',
                version: '1.0.0'
            });
            const testRequest = {
                task: 'Cache test task',
                options: { timeout: 30000 },
            };
            const start1 = Date.now();
            await validationPipe.transform(testRequest, {
                type: 'body',
                metatype: Object,
                data: '',
            });
            const time1 = Date.now() - start1;
            const start2 = Date.now();
            await validationPipe.transform(testRequest, {
                type: 'body',
                metatype: Object,
                data: '',
            });
            const time2 = Date.now() - start2;
            expect(time2).toBeLessThanOrEqual(time1 * 1.5);
        });
    });
    describe('Error Handling and Recovery', () => {
        it('should gracefully handle contract registration failures', async () => {
            const invalidSchema = null;
            const result = await contractRegistry.registerContract('InvalidContract', '1.0.0', invalidSchema, { description: 'This should fail' });
            expect(result).toBe(false);
        });
        it('should handle missing contract gracefully', async () => {
            const validationPipe = new ContractValidationPipe_1.ContractValidationPipe(contractRegistry, {
                contractName: 'NonExistentContract',
                version: '1.0.0'
            });
            const testRequest = { data: 'test' };
            await expect(validationPipe.transform(testRequest, {
                type: 'body',
                metatype: Object,
                data: '',
            })).rejects.toThrow('Contract not found');
        });
        it('should provide detailed validation error information', async () => {
            const strictSchema = zod_1.z.object({
                requiredField: zod_1.z.string().min(5, 'Must be at least 5 characters'),
                numberField: zod_1.z.number().positive('Must be positive'),
                enumField: zod_1.z.enum(['option1', 'option2'], {
                    errorMap: () => ({ message: 'Must be option1 or option2' })
                }),
            });
            await contractRegistry.registerContract('StrictContract', '1.0.0', strictSchema, { description: 'Strict validation schema' });
            const validationPipe = new ContractValidationPipe_1.ContractValidationPipe(contractRegistry, {
                contractName: 'StrictContract',
                version: '1.0.0'
            });
            const invalidRequest = {
                requiredField: 'abc',
                numberField: -5,
                enumField: 'invalid',
            };
            try {
                await validationPipe.transform(invalidRequest, {
                    type: 'body',
                    metatype: Object,
                    data: '',
                });
                fail('Should have thrown validation error');
            }
            catch (error) {
                expect(error.message).toContain('validation');
                expect(error.message || error.toString()).toMatch(/requiredField|numberField|enumField/);
            }
        });
    });
    describe('Integration with Existing Systems', () => {
        it('should integrate seamlessly with existing worker service architecture', async () => {
            const originalConfig = configService.get('worker');
            expect(originalConfig).toEqual(mockWorkerConfig);
            const legacyRequest = {
                task: 'Legacy task without contract validation',
                options: { timeout: 5000 },
            };
            jest.spyOn(processManager, 'spawnWorkerProcess').mockResolvedValue({
                pid: 12345,
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
                kill: jest.fn(),
            });
            jest.spyOn(claudeCodeClient, 'parseResponse').mockResolvedValue({
                success: true,
                output: 'Legacy execution',
                outcome: 'completed',
                reason: 'Legacy test',
                tags: ['legacy'],
                normalizedMessage: 'Legacy task completed',
            });
            const result = await workerService.executeTask(legacyRequest);
            expect(result.success).toBe(true);
        });
        it('should maintain backward compatibility with existing APIs', async () => {
            await contractRegistry.registerContract('TaskExecutionRequest', '1.0.0', worker_config_1.TaskExecutionRequestSchema, { description: 'Current API contract' });
            const existingApiRequest = {
                task: 'Existing API test',
                options: {
                    timeout: 30000,
                },
            };
            const validationPipe = new ContractValidationPipe_1.ContractValidationPipe(contractRegistry, {
                contractName: 'TaskExecutionRequest',
                version: '1.0.0'
            });
            const validatedRequest = await validationPipe.transform(existingApiRequest, {
                type: 'body',
                metatype: Object,
                data: '',
            });
            expect(validatedRequest).toEqual(existingApiRequest);
            expect(validatedRequest.task).toBe('Existing API test');
            expect(validatedRequest.options?.timeout).toBe(30000);
        });
    });
});
//# sourceMappingURL=ContractIntegration.test.js.map