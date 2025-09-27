"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const ApiContractGenerator_1 = require("../ApiContractGenerator");
const ContractRegistry_1 = require("../ContractRegistry");
describe('ApiContractGenerator', () => {
    let generator;
    let contractRegistry;
    beforeEach(() => {
        contractRegistry = new ContractRegistry_1.ContractRegistry();
        generator = new ApiContractGenerator_1.ApiContractGenerator(contractRegistry);
    });
    describe('zodToOpenAPISchema', () => {
        it('should convert Zod string schema to OpenAPI schema', () => {
            const zodSchema = zod_1.z.string().min(1).max(100).email();
            const openAPISchema = generator.zodToOpenAPISchema(zodSchema);
            expect(openAPISchema).toEqual({
                type: 'string',
                minLength: 1,
                maxLength: 100,
                format: 'email',
            });
        });
        it('should convert Zod number schema to OpenAPI schema', () => {
            const zodSchema = zod_1.z.number().min(0).max(100).int();
            const openAPISchema = generator.zodToOpenAPISchema(zodSchema);
            expect(openAPISchema).toEqual({
                type: 'integer',
                minimum: 0,
                maximum: 100,
            });
        });
        it('should convert Zod boolean schema to OpenAPI schema', () => {
            const zodSchema = zod_1.z.boolean();
            const openAPISchema = generator.zodToOpenAPISchema(zodSchema);
            expect(openAPISchema).toEqual({
                type: 'boolean',
            });
        });
        it('should convert Zod date schema to OpenAPI schema', () => {
            const zodSchema = zod_1.z.date();
            const openAPISchema = generator.zodToOpenAPISchema(zodSchema);
            expect(openAPISchema).toEqual({
                type: 'string',
                format: 'date-time',
            });
        });
        it('should convert Zod object schema to OpenAPI schema', () => {
            const zodSchema = zod_1.z.object({
                name: zod_1.z.string(),
                age: zod_1.z.number().optional(),
                email: zod_1.z.string().email(),
            });
            const openAPISchema = generator.zodToOpenAPISchema(zodSchema);
            expect(openAPISchema).toEqual({
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                    email: { type: 'string', format: 'email' },
                },
                required: ['name', 'email'],
            });
        });
        it('should convert Zod array schema to OpenAPI schema', () => {
            const zodSchema = zod_1.z.array(zod_1.z.string());
            const openAPISchema = generator.zodToOpenAPISchema(zodSchema);
            expect(openAPISchema).toEqual({
                type: 'array',
                items: { type: 'string' },
            });
        });
        it('should convert Zod enum schema to OpenAPI schema', () => {
            const zodSchema = zod_1.z.enum(['active', 'inactive', 'pending']);
            const openAPISchema = generator.zodToOpenAPISchema(zodSchema);
            expect(openAPISchema).toEqual({
                type: 'string',
                enum: ['active', 'inactive', 'pending'],
            });
        });
        it('should convert Zod union schema to OpenAPI schema', () => {
            const zodSchema = zod_1.z.union([zod_1.z.string(), zod_1.z.number()]);
            const openAPISchema = generator.zodToOpenAPISchema(zodSchema);
            expect(openAPISchema).toEqual({
                anyOf: [
                    { type: 'string' },
                    { type: 'number' },
                ],
            });
        });
        it('should convert Zod nullable schema to OpenAPI schema', () => {
            const zodSchema = zod_1.z.string().nullable();
            const openAPISchema = generator.zodToOpenAPISchema(zodSchema);
            expect(openAPISchema).toEqual({
                type: 'string',
                nullable: true,
            });
        });
        it('should convert Zod default schema to OpenAPI schema', () => {
            const zodSchema = zod_1.z.string().default('default-value');
            const openAPISchema = generator.zodToOpenAPISchema(zodSchema);
            expect(openAPISchema).toEqual({
                type: 'string',
                default: 'default-value',
            });
        });
    });
    describe('generateOpenAPISpec', () => {
        beforeEach(async () => {
            const userSchema = zod_1.z.object({
                id: zod_1.z.string(),
                name: zod_1.z.string(),
                email: zod_1.z.string().email(),
                age: zod_1.z.number().min(0).optional(),
            });
            const createUserSchema = zod_1.z.object({
                name: zod_1.z.string().min(1),
                email: zod_1.z.string().email(),
                age: zod_1.z.number().min(0).optional(),
            });
            await contractRegistry.registerContract('User', '1.0.0', userSchema);
            await contractRegistry.registerContract('CreateUser', '1.0.0', createUserSchema);
        });
        it('should generate complete OpenAPI specification', () => {
            const endpoints = [
                {
                    path: '/users',
                    method: 'GET',
                    summary: 'Get all users',
                    description: 'Retrieve a list of all users',
                    operationId: 'getUsers',
                    tags: ['users'],
                    responseContract: {
                        name: 'User',
                        version: '1.0.0',
                    },
                },
                {
                    path: '/users',
                    method: 'POST',
                    summary: 'Create user',
                    description: 'Create a new user',
                    operationId: 'createUser',
                    tags: ['users'],
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
            const spec = generator.generateOpenAPISpec(endpoints, {
                title: 'Test API',
                version: '1.0.0',
                description: 'Test API for contract generation',
            });
            expect(spec.openapi).toBe('3.0.0');
            expect(spec.info.title).toBe('Test API');
            expect(spec.info.version).toBe('1.0.0');
            expect(spec.info.description).toBe('Test API for contract generation');
            expect(spec.paths['/users']).toBeDefined();
            expect(spec.paths['/users']['get']).toBeDefined();
            expect(spec.paths['/users']['post']).toBeDefined();
            const getEndpoint = spec.paths['/users']['get'];
            expect(getEndpoint.summary).toBe('Get all users');
            expect(getEndpoint.operationId).toBe('getUsers');
            expect(getEndpoint.tags).toEqual(['users']);
            expect(getEndpoint.responses['200']).toBeDefined();
            const postEndpoint = spec.paths['/users']['post'];
            expect(postEndpoint.summary).toBe('Create user');
            expect(postEndpoint.operationId).toBe('createUser');
            expect(postEndpoint.tags).toEqual(['users']);
            expect(postEndpoint.requestBody).toBeDefined();
            expect(postEndpoint.responses['200']).toBeDefined();
            expect(spec.components.schemas['CreateUser_1.0.0']).toBeDefined();
            expect(spec.components.schemas['User_1.0.0']).toBeDefined();
            expect(postEndpoint.requestBody?.content['application/json'].schema.$ref)
                .toBe('#/components/schemas/CreateUser_1.0.0');
            expect(postEndpoint.responses['200'].content?.['application/json'].schema.$ref)
                .toBe('#/components/schemas/User_1.0.0');
            expect(spec.tags).toContainEqual({ name: 'users' });
        });
        it('should handle endpoints without contracts', () => {
            const endpoints = [
                {
                    path: '/health',
                    method: 'GET',
                    summary: 'Health check',
                    description: 'Check API health',
                    operationId: 'healthCheck',
                },
            ];
            const spec = generator.generateOpenAPISpec(endpoints, {
                title: 'Test API',
                version: '1.0.0',
            });
            expect(spec.paths['/health']['get']).toBeDefined();
            expect(spec.paths['/health']['get'].responses['200']).toEqual({
                description: 'Successful response',
            });
        });
        it('should handle path parameters', () => {
            const endpoints = [
                {
                    path: '/users/{id}',
                    method: 'GET',
                    summary: 'Get user by ID',
                    operationId: 'getUserById',
                    parameterContracts: [
                        {
                            name: 'id',
                            in: 'path',
                            contract: {
                                name: 'User',
                                version: '1.0.0',
                            },
                        },
                    ],
                },
            ];
            const spec = generator.generateOpenAPISpec(endpoints, {
                title: 'Test API',
                version: '1.0.0',
            });
            const endpoint = spec.paths['/users/{id}']['get'];
            expect(endpoint.parameters).toBeDefined();
            expect(endpoint.parameters).toHaveLength(1);
            expect(endpoint.parameters[0].name).toBe('id');
            expect(endpoint.parameters[0].in).toBe('path');
            expect(endpoint.parameters[0].required).toBe(true);
        });
    });
    describe('generateContractSchema', () => {
        beforeEach(async () => {
            const testSchema = zod_1.z.object({
                name: zod_1.z.string(),
                value: zod_1.z.number(),
            });
            await contractRegistry.registerContract('TestContract', '1.0.0', testSchema);
        });
        it('should generate schema for existing contract', () => {
            const schema = generator.generateContractSchema('TestContract', '1.0.0');
            expect(schema).toEqual({
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    value: { type: 'number' },
                },
                required: ['name', 'value'],
            });
        });
        it('should return null for non-existent contract', () => {
            const schema = generator.generateContractSchema('NonExistent', '1.0.0');
            expect(schema).toBeNull();
        });
    });
    describe('error handling', () => {
        it('should handle invalid endpoint metadata gracefully', () => {
            const endpoints = [
                {
                    path: '/test',
                    method: 'GET',
                    requestBodyContract: {
                        name: 'NonExistent',
                        version: '1.0.0',
                    },
                },
            ];
            const spec = generator.generateOpenAPISpec(endpoints, {
                title: 'Test API',
                version: '1.0.0',
            });
            expect(spec.paths['/test']['get']).toBeDefined();
            expect(spec.paths['/test']['get'].requestBody).toBeUndefined();
        });
        it('should handle empty title gracefully', () => {
            const spec = generator.generateOpenAPISpec([], {
                title: '',
                version: '1.0.0',
            });
            expect(spec.info.title).toBe('');
            expect(spec.info.version).toBe('1.0.0');
        });
    });
});
//# sourceMappingURL=ApiContractGenerator.spec.js.map