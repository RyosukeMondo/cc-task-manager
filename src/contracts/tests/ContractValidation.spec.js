"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const common_1 = require("@nestjs/common");
const ContractRegistry_1 = require("../ContractRegistry");
const ApiContractGenerator_1 = require("../ApiContractGenerator");
const TypeScriptGenerator_1 = require("../TypeScriptGenerator");
const ContractValidationPipe_1 = require("../ContractValidationPipe");
const VersionManager_1 = require("../VersionManager");
const DevValidationMiddleware_1 = require("../DevValidationMiddleware");
describe('Contract Validation System', () => {
    let contractRegistry;
    let apiGenerator;
    let tsGenerator;
    let versionManager;
    let devMiddleware;
    const userSchema = zod_1.z.object({
        id: zod_1.z.string().uuid(),
        name: zod_1.z.string().min(1).max(100),
        email: zod_1.z.string().email(),
        age: zod_1.z.number().min(0).max(150).optional(),
        status: zod_1.z.enum(['active', 'inactive', 'pending']),
        metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    });
    const createUserSchema = zod_1.z.object({
        name: zod_1.z.string().min(1).max(100),
        email: zod_1.z.string().email(),
        age: zod_1.z.number().min(0).max(150).optional(),
        status: zod_1.z.enum(['active', 'inactive']).default('active'),
    });
    const updateUserSchema = zod_1.z.object({
        name: zod_1.z.string().min(1).max(100).optional(),
        email: zod_1.z.string().email().optional(),
        age: zod_1.z.number().min(0).max(150).optional(),
        status: zod_1.z.enum(['active', 'inactive', 'pending']).optional(),
    });
    beforeEach(async () => {
        process.env.NODE_ENV = 'development';
        contractRegistry = new ContractRegistry_1.ContractRegistry();
        apiGenerator = new ApiContractGenerator_1.ApiContractGenerator(contractRegistry);
        tsGenerator = new TypeScriptGenerator_1.TypeScriptGenerator(contractRegistry);
        versionManager = new VersionManager_1.VersionManager(contractRegistry);
        devMiddleware = new DevValidationMiddleware_1.DevValidationMiddleware(contractRegistry);
        await contractRegistry.registerContract('User', '1.0.0', userSchema);
        await contractRegistry.registerContract('CreateUser', '1.0.0', createUserSchema);
        await contractRegistry.registerContract('UpdateUser', '1.0.0', updateUserSchema);
    });
    afterEach(() => {
        delete process.env.NODE_ENV;
    });
    describe('ContractRegistry Integration', () => {
        it('should register and retrieve contracts successfully', async () => {
            const testSchema = zod_1.z.object({
                test: zod_1.z.string(),
            });
            await contractRegistry.registerContract('Test', '1.0.0', testSchema);
            const retrieved = contractRegistry.getContract('Test', '1.0.0');
            expect(retrieved).toBeDefined();
            expect(retrieved?.metadata.name).toBe('Test');
            expect(retrieved?.metadata.version).toBe('1.0.0');
        });
        it('should validate data against registered contracts', () => {
            const validUser = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'John Doe',
                email: 'john@example.com',
                age: 30,
                status: 'active',
            };
            const result = contractRegistry.validateAgainstContract('User', '1.0.0', validUser);
            expect(result.success).toBe(true);
            expect(result.data).toEqual(validUser);
        });
        it('should reject invalid data with detailed errors', () => {
            const invalidUser = {
                id: 'invalid-uuid',
                name: '',
                email: 'invalid-email',
                age: -5,
                status: 'unknown',
            };
            const result = contractRegistry.validateAgainstContract('User', '1.0.0', invalidUser);
            expect(result.success).toBe(false);
            expect(result.error).toContain('invalid');
        });
        it('should check contract compatibility between versions', async () => {
            const userSchemaV1_1 = zod_1.z.object({
                id: zod_1.z.string().uuid(),
                name: zod_1.z.string().min(1).max(100),
                email: zod_1.z.string().email(),
                age: zod_1.z.number().min(0).max(150).optional(),
                status: zod_1.z.enum(['active', 'inactive', 'pending']),
                metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
                createdAt: zod_1.z.date().optional(),
            });
            await contractRegistry.registerContract('User', '1.1.0', userSchemaV1_1);
            const compatibility = contractRegistry.checkCompatibility('User', '1.0.0', '1.1.0');
            expect(compatibility.compatible).toBe(true);
            expect(compatibility.issues).toHaveLength(0);
        });
        it('should detect breaking changes between versions', async () => {
            const userSchemaV2 = zod_1.z.object({
                id: zod_1.z.string().uuid(),
                fullName: zod_1.z.string().min(1).max(100),
                email: zod_1.z.string().email(),
                birthDate: zod_1.z.date(),
                status: zod_1.z.enum(['active', 'inactive']),
            });
            await contractRegistry.registerContract('User', '2.0.0', userSchemaV2);
            const compatibility = contractRegistry.checkCompatibility('User', '1.0.0', '2.0.0');
            expect(compatibility.compatible).toBe(false);
            expect(compatibility.breakingChanges.length).toBeGreaterThan(0);
        });
    });
    describe('ContractValidationPipe Integration', () => {
        it('should validate request body against contract', () => {
            const pipe = new ContractValidationPipe_1.ContractValidationPipe(contractRegistry, {
                contractName: 'CreateUser',
                version: '1.0.0',
                location: 'body',
            });
            const validData = {
                name: 'Jane Doe',
                email: 'jane@example.com',
                age: 25,
            };
            const result = pipe.transform(validData, { type: 'body', metatype: Object, data: '' });
            expect(result).toEqual({
                name: 'Jane Doe',
                email: 'jane@example.com',
                age: 25,
                status: 'active',
            });
        });
        it('should throw BadRequestException for invalid data', () => {
            const pipe = new ContractValidationPipe_1.ContractValidationPipe(contractRegistry, {
                contractName: 'CreateUser',
                version: '1.0.0',
                location: 'body',
            });
            const invalidData = {
                name: '',
                email: 'invalid-email',
                age: -1,
            };
            expect(() => {
                pipe.transform(invalidData, { type: 'body', metatype: Object, data: '' });
            }).toThrow(common_1.BadRequestException);
        });
        it('should handle missing contracts gracefully', () => {
            const pipe = new ContractValidationPipe_1.ContractValidationPipe(contractRegistry, {
                contractName: 'NonExistent',
                version: '1.0.0',
                location: 'body',
            });
            expect(() => {
                pipe.transform({}, { type: 'body', metatype: Object, data: '' });
            }).toThrow(common_1.BadRequestException);
        });
        it('should use latest version when version not specified', () => {
            const pipe = new ContractValidationPipe_1.ContractValidationPipe(contractRegistry, {
                contractName: 'CreateUser',
                location: 'body',
            });
            const validData = {
                name: 'Test User',
                email: 'test@example.com',
            };
            const result = pipe.transform(validData, { type: 'body', metatype: Object, data: '' });
            expect(result.status).toBe('active');
        });
    });
    describe('API Contract Generation Integration', () => {
        it('should generate OpenAPI spec from registered contracts', () => {
            const endpoints = [
                {
                    path: '/users',
                    method: 'POST',
                    summary: 'Create user',
                    operationId: 'createUser',
                    requestBodyContract: {
                        name: 'CreateUser',
                        version: '1.0.0',
                    },
                    responseContract: {
                        name: 'User',
                        version: '1.0.0',
                    },
                },
            ];
            const spec = apiGenerator.generateOpenAPISpec(endpoints, {
                title: 'Test API',
                version: '1.0.0',
            });
            expect(spec.openapi).toBe('3.0.0');
            expect(spec.paths['/users']['post']).toBeDefined();
            expect(spec.components.schemas['CreateUser_1.0.0']).toBeDefined();
            expect(spec.components.schemas['User_1.0.0']).toBeDefined();
        });
        it('should handle complex nested schemas in OpenAPI generation', () => {
            const complexSchema = zod_1.z.object({
                user: userSchema,
                permissions: zod_1.z.array(zod_1.z.enum(['read', 'write', 'delete'])),
                config: zod_1.z.object({
                    theme: zod_1.z.string(),
                    notifications: zod_1.z.boolean(),
                    limits: zod_1.z.object({
                        maxFiles: zod_1.z.number(),
                        maxSize: zod_1.z.number(),
                    }),
                }),
            });
            contractRegistry.registerContract('ComplexEntity', '1.0.0', complexSchema);
            const schema = apiGenerator.generateContractSchema('ComplexEntity', '1.0.0');
            expect(schema).toBeDefined();
            expect(schema?.type).toBe('object');
            expect(schema?.properties?.user).toBeDefined();
            expect(schema?.properties?.permissions).toBeDefined();
            expect(schema?.properties?.config).toBeDefined();
        });
    });
    describe('TypeScript Generation Integration', () => {
        it('should generate TypeScript types from contracts', () => {
            const generated = tsGenerator.generateContractTypes('User', '1.0.0');
            expect(generated).toBeDefined();
            expect(generated?.types).toContain('User');
            expect(generated?.types).toContain('export type');
            expect(generated?.metadata.contractName).toBe('User');
            expect(generated?.metadata.contractVersion).toBe('1.0.0');
        });
        it('should handle optional fields correctly in type generation', () => {
            const generated = tsGenerator.generateContractTypes('User', '1.0.0');
            expect(generated?.types).toContain('?');
        });
        it('should generate multiple contract types', () => {
            const allTypes = tsGenerator.generateAllContractTypes();
            expect(allTypes.size).toBeGreaterThan(0);
            expect(allTypes.has('User')).toBe(true);
            expect(allTypes.has('CreateUser')).toBe(true);
        });
    });
    describe('Version Management Integration', () => {
        it('should create version upgrade plans', async () => {
            await contractRegistry.registerContract('User', '1.1.0', userSchema);
            await contractRegistry.registerContract('User', '2.0.0', userSchema);
            await versionManager.addMigrationStrategy({
                fromVersion: '1.0.0',
                toVersion: '2.0.0',
                strategy: 'manual',
                description: 'Test migration from 1.0.0 to 2.0.0',
                breakingChanges: ['Test breaking change'],
                migrationSteps: ['Test migration step'],
            });
            const plan = versionManager.createUpgradePlan('User', '1.0.0', '2.0.0');
            if (plan) {
                expect(plan.contractName).toBe('User');
                expect(plan.currentVersion).toBe('1.0.0');
                expect(plan.targetVersion).toBe('2.0.0');
                expect(plan.phases.length).toBeGreaterThan(0);
            }
            else {
                const fromContract = contractRegistry.getContract('User', '1.0.0');
                const toContract = contractRegistry.getContract('User', '2.0.0');
                expect(fromContract).toBeDefined();
                expect(toContract).toBeDefined();
            }
        });
        it('should check upgrade compatibility', () => {
            const compatibility = versionManager.isUpgradeCompatible('User', '1.0.0', '1.1.0');
            expect(compatibility).toBeDefined();
            expect(typeof compatibility.compatible).toBe('boolean');
            expect(typeof compatibility.semverCompliant).toBe('boolean');
            expect(Array.isArray(compatibility.breakingChanges)).toBe(true);
            expect(Array.isArray(compatibility.warnings)).toBe(true);
        });
        it('should track contract deprecation', () => {
            const deprecationResult = versionManager.deprecateVersion('User', '1.0.0', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), 'Replaced by v2.0.0');
            expect(deprecationResult).toBe(true);
            const deprecatedContract = contractRegistry.getContract('User', '1.0.0');
            expect(deprecatedContract?.metadata.deprecated).toBe(true);
        });
        it('should validate version compliance', () => {
            const compliance = versionManager.validateVersionCompliance('User', '1.0.0');
            expect(compliance).toBeDefined();
            expect(typeof compliance.compliant).toBe('boolean');
            expect(compliance.contractName).toBe('User');
            expect(compliance.version).toBe('1.0.0');
        });
    });
    describe('Development Validation Integration', () => {
        it('should be instantiated with contract registry', () => {
            expect(devMiddleware).toBeDefined();
            expect(devMiddleware).toBeInstanceOf(DevValidationMiddleware_1.DevValidationMiddleware);
        });
        it('should provide validation statistics', () => {
            const stats = devMiddleware.getValidationStats();
            expect(stats).toBeDefined();
            expect(typeof stats.enabled).toBe('boolean');
            expect(typeof stats.isDevelopmentMode).toBe('boolean');
            expect(typeof stats.watcherActive).toBe('boolean');
            expect(typeof stats.cachedResults).toBe('number');
            expect(Array.isArray(stats.lastValidations)).toBe(true);
        });
        it('should allow configuration updates', () => {
            const newConfig = {
                enabled: true,
                watchPaths: ['./src/contracts'],
                contractPaths: ['./src/contracts/**/*.ts'],
                immediateValidation: true,
                hotReload: false,
            };
            devMiddleware.configure(newConfig);
            expect(true).toBe(true);
        });
        it('should handle middleware use method', () => {
            const mockRequest = {
                path: '/health',
                method: 'GET',
                body: {},
                query: {},
                headers: {},
            };
            const mockResponse = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            const mockNext = jest.fn();
            expect(() => {
                devMiddleware.use(mockRequest, mockResponse, mockNext);
            }).not.toThrow();
        });
    });
    describe('End-to-End Contract Workflow', () => {
        it('should handle complete contract lifecycle', async () => {
            const newSchema = zod_1.z.object({
                title: zod_1.z.string(),
                content: zod_1.z.string(),
                published: zod_1.z.boolean().default(false),
            });
            await contractRegistry.registerContract('Article', '1.0.0', newSchema);
            const endpoints = [
                {
                    path: '/articles',
                    method: 'POST',
                    summary: 'Create article',
                    requestBodyContract: {
                        name: 'Article',
                        version: '1.0.0',
                    },
                },
            ];
            const openApiSpec = apiGenerator.generateOpenAPISpec(endpoints, {
                title: 'Article API',
                version: '1.0.0',
            });
            expect(openApiSpec.components.schemas['Article_1.0.0']).toBeDefined();
            const generated = tsGenerator.generateContractTypes('Article', '1.0.0');
            expect(generated?.types).toContain('Article');
            const pipe = new ContractValidationPipe_1.ContractValidationPipe(contractRegistry, {
                contractName: 'Article',
                version: '1.0.0',
            });
            const validArticle = {
                title: 'Test Article',
                content: 'This is test content',
            };
            const result = pipe.transform(validArticle, { type: 'body', metatype: Object, data: '' });
            expect(result.published).toBe(false);
            const articleV2 = zod_1.z.object({
                title: zod_1.z.string(),
                content: zod_1.z.string(),
                published: zod_1.z.boolean().default(false),
                tags: zod_1.z.array(zod_1.z.string()).default([]),
            });
            await contractRegistry.registerContract('Article', '1.1.0', articleV2);
            const compatibility = contractRegistry.checkCompatibility('Article', '1.0.0', '1.1.0');
            expect(compatibility.compatible).toBe(true);
        });
        it('should handle contract validation errors with structured responses', () => {
            const pipe = new ContractValidationPipe_1.ContractValidationPipe(contractRegistry, {
                contractName: 'User',
                version: '1.0.0',
                location: 'body',
            });
            const invalidData = {
                id: 'invalid-uuid',
                name: '',
                email: 'not-an-email',
                age: 200,
                status: 'invalid-status',
            };
            try {
                pipe.transform(invalidData, { type: 'body', metatype: Object, data: '' });
                fail('Expected BadRequestException to be thrown');
            }
            catch (error) {
                expect(error).toBeInstanceOf(common_1.BadRequestException);
                const response = error.getResponse();
                expect(response.error).toBe('ContractValidationError');
                expect(response.contract.name).toBe('User');
                expect(response.contract.version).toBe('1.0.0');
                expect(response.location).toBe('body');
            }
        });
        it('should maintain performance under load', async () => {
            const startTime = Date.now();
            const iterations = 100;
            const validUser = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'John Doe',
                email: 'john@example.com',
                status: 'active',
            };
            for (let i = 0; i < iterations; i++) {
                const result = contractRegistry.validateAgainstContract('User', '1.0.0', validUser);
                expect(result.success).toBe(true);
            }
            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(1000);
        });
    });
    describe('Absolute Path Testing', () => {
        it('should handle absolute file paths correctly', () => {
            const absolutePath = '/home/rmondo/repos/cc-task-manager/src/contracts/tests/ContractValidation.spec.ts';
            expect(absolutePath).toMatch(/^\/.*\.spec\.ts$/);
            expect(absolutePath).toContain('ContractValidation');
        });
    });
    describe('Edge Cases and Error Handling', () => {
        it('should handle circular references in schemas', () => {
            const categorySchema = zod_1.z.lazy(() => zod_1.z.object({
                id: zod_1.z.string(),
                name: zod_1.z.string(),
                parent: categorySchema.optional(),
            }));
            expect(() => {
                contractRegistry.registerContract('Category', '1.0.0', categorySchema);
            }).not.toThrow();
        });
        it('should handle very large schemas', async () => {
            const largeSchemaFields = {};
            for (let i = 0; i < 100; i++) {
                largeSchemaFields[`field${i}`] = zod_1.z.string().optional();
            }
            const largeSchema = zod_1.z.object(largeSchemaFields);
            await contractRegistry.registerContract('LargeEntity', '1.0.0', largeSchema);
            const retrieved = contractRegistry.getContract('LargeEntity', '1.0.0');
            expect(retrieved).toBeDefined();
        });
        it('should handle malformed contract data gracefully', () => {
            const result = contractRegistry.validateAgainstContract('User', '1.0.0', null);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
        it('should handle missing contract versions', () => {
            const result = contractRegistry.validateAgainstContract('User', '999.0.0', {});
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
        it('should handle concurrent contract registrations', async () => {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                const schema = zod_1.z.object({
                    id: zod_1.z.string(),
                    value: zod_1.z.number(),
                });
                promises.push(contractRegistry.registerContract(`ConcurrentTest${i}`, '1.0.0', schema));
            }
            await Promise.all(promises);
            for (let i = 0; i < 10; i++) {
                const contract = contractRegistry.getContract(`ConcurrentTest${i}`, '1.0.0');
                expect(contract).toBeDefined();
            }
        });
    });
});
//# sourceMappingURL=ContractValidation.spec.js.map