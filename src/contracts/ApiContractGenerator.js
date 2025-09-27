"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ApiContractGenerator_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiContractGenerator = void 0;
const zod_1 = require("zod");
const common_1 = require("@nestjs/common");
const ContractRegistry_1 = require("./ContractRegistry");
let ApiContractGenerator = ApiContractGenerator_1 = class ApiContractGenerator {
    constructor(contractRegistry) {
        this.contractRegistry = contractRegistry;
        this.logger = new common_1.Logger(ApiContractGenerator_1.name);
        this.schemaRefs = new Map();
    }
    generateOpenAPISpec(endpoints, options) {
        try {
            this.logger.log('Generating OpenAPI specification');
            const spec = {
                openapi: '3.0.0',
                info: {
                    title: options.title,
                    version: options.version,
                    description: options.description,
                },
                servers: options.servers || [
                    { url: 'http://localhost:3000', description: 'Development server' }
                ],
                paths: {},
                components: { schemas: {} },
                tags: this.extractTags(endpoints),
            };
            for (const endpoint of endpoints) {
                this.processEndpoint(endpoint, spec);
            }
            this.logger.log(`Generated OpenAPI spec with ${Object.keys(spec.paths).length} paths`);
            return spec;
        }
        catch (error) {
            this.logger.error('Failed to generate OpenAPI specification:', error);
            throw new Error(`OpenAPI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    zodToOpenAPISchema(zodSchema, contractName) {
        try {
            return this.convertZodToOpenAPI(zodSchema, contractName);
        }
        catch (error) {
            this.logger.error(`Failed to convert Zod schema to OpenAPI:`, error);
            throw new Error(`Schema conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    generateContractSchema(contractName, contractVersion) {
        const contract = this.contractRegistry.getContract(contractName, contractVersion);
        if (!contract) {
            this.logger.warn(`Contract not found: ${contractName}@${contractVersion}`);
            return null;
        }
        try {
            return this.zodToOpenAPISchema(contract.schema, contractName);
        }
        catch (error) {
            this.logger.error(`Failed to generate schema for contract ${contractName}@${contractVersion}:`, error);
            return null;
        }
    }
    processEndpoint(endpoint, spec) {
        const { path, method } = endpoint;
        if (!spec.paths[path]) {
            spec.paths[path] = {};
        }
        const operation = {
            summary: endpoint.summary,
            description: endpoint.description,
            operationId: endpoint.operationId || `${method.toLowerCase()}${this.pathToOperationId(path)}`,
            tags: endpoint.tags,
            responses: {
                '200': {
                    description: 'Successful response',
                }
            },
        };
        if (endpoint.requestBodyContract) {
            const requestBodySchema = this.getContractSchema(endpoint.requestBodyContract.name, endpoint.requestBodyContract.version, spec.components);
            if (requestBodySchema) {
                operation.requestBody = {
                    required: true,
                    content: {
                        'application/json': {
                            schema: requestBodySchema,
                        },
                    },
                };
            }
        }
        if (endpoint.responseContract) {
            const responseSchema = this.getContractSchema(endpoint.responseContract.name, endpoint.responseContract.version, spec.components);
            if (responseSchema) {
                operation.responses['200'] = {
                    description: 'Successful response',
                    content: {
                        'application/json': {
                            schema: responseSchema,
                        },
                    },
                };
            }
        }
        if (endpoint.parameterContracts && endpoint.parameterContracts.length > 0) {
            operation.parameters = endpoint.parameterContracts.map(param => {
                const paramSchema = this.getContractSchema(param.contract.name, param.contract.version, spec.components);
                return {
                    name: param.name,
                    in: param.in,
                    required: param.in === 'path',
                    schema: paramSchema || { type: 'string' },
                };
            });
        }
        if (endpoint.security) {
            operation.security = endpoint.security;
        }
        spec.paths[path][method.toLowerCase()] = operation;
    }
    getContractSchema(contractName, contractVersion, components) {
        const refKey = `${contractName}_${contractVersion}`;
        if (components.schemas[refKey]) {
            return { $ref: `#/components/schemas/${refKey}` };
        }
        const contract = this.contractRegistry.getContract(contractName, contractVersion);
        if (!contract) {
            this.logger.warn(`Contract not found: ${contractName}@${contractVersion}`);
            return null;
        }
        try {
            const openAPISchema = this.zodToOpenAPISchema(contract.schema, contractName);
            components.schemas[refKey] = openAPISchema;
            return { $ref: `#/components/schemas/${refKey}` };
        }
        catch (error) {
            this.logger.error(`Failed to convert contract schema ${contractName}@${contractVersion}:`, error);
            return null;
        }
    }
    convertZodToOpenAPI(zodSchema, contractName) {
        const zodDef = zodSchema._def;
        switch (zodDef.typeName) {
            case zod_1.z.ZodFirstPartyTypeKind.ZodString:
                return this.handleZodString(zodDef);
            case zod_1.z.ZodFirstPartyTypeKind.ZodNumber:
                return this.handleZodNumber(zodDef);
            case zod_1.z.ZodFirstPartyTypeKind.ZodBoolean:
                return { type: 'boolean' };
            case zod_1.z.ZodFirstPartyTypeKind.ZodDate:
                return { type: 'string', format: 'date-time' };
            case zod_1.z.ZodFirstPartyTypeKind.ZodObject:
                return this.handleZodObject(zodDef, contractName);
            case zod_1.z.ZodFirstPartyTypeKind.ZodArray:
                return this.handleZodArray(zodDef, contractName);
            case zod_1.z.ZodFirstPartyTypeKind.ZodEnum:
                return this.handleZodEnum(zodDef);
            case zod_1.z.ZodFirstPartyTypeKind.ZodNativeEnum:
                return this.handleZodNativeEnum(zodDef);
            case zod_1.z.ZodFirstPartyTypeKind.ZodUnion:
                return this.handleZodUnion(zodDef, contractName);
            case zod_1.z.ZodFirstPartyTypeKind.ZodIntersection:
                return this.handleZodIntersection(zodDef, contractName);
            case zod_1.z.ZodFirstPartyTypeKind.ZodOptional:
                return this.convertZodToOpenAPI(zodDef.innerType, contractName);
            case zod_1.z.ZodFirstPartyTypeKind.ZodNullable:
                const innerSchema = this.convertZodToOpenAPI(zodDef.innerType, contractName);
                return { ...innerSchema, nullable: true };
            case zod_1.z.ZodFirstPartyTypeKind.ZodDefault:
                const defaultSchema = this.convertZodToOpenAPI(zodDef.innerType, contractName);
                return { ...defaultSchema, default: zodDef.defaultValue() };
            case zod_1.z.ZodFirstPartyTypeKind.ZodLiteral:
                return { type: typeof zodDef.value, enum: [zodDef.value] };
            case zod_1.z.ZodFirstPartyTypeKind.ZodRecord:
                return this.handleZodRecord(zodDef, contractName);
            case zod_1.z.ZodFirstPartyTypeKind.ZodAny:
                return {};
            case zod_1.z.ZodFirstPartyTypeKind.ZodUnknown:
                return {};
            default:
                this.logger.warn(`Unsupported Zod type: ${zodDef.typeName}`);
                return { type: 'object' };
        }
    }
    handleZodString(zodDef) {
        const schema = { type: 'string' };
        if (zodDef.checks) {
            for (const check of zodDef.checks) {
                switch (check.kind) {
                    case 'min':
                        schema.minLength = check.value;
                        break;
                    case 'max':
                        schema.maxLength = check.value;
                        break;
                    case 'email':
                        schema.format = 'email';
                        break;
                    case 'url':
                        schema.format = 'uri';
                        break;
                    case 'uuid':
                        schema.format = 'uuid';
                        break;
                    case 'regex':
                        schema.pattern = check.regex.source;
                        break;
                }
            }
        }
        return schema;
    }
    handleZodNumber(zodDef) {
        const schema = { type: 'number' };
        if (zodDef.checks) {
            for (const check of zodDef.checks) {
                switch (check.kind) {
                    case 'min':
                        schema.minimum = check.value;
                        break;
                    case 'max':
                        schema.maximum = check.value;
                        break;
                    case 'int':
                        schema.type = 'integer';
                        break;
                }
            }
        }
        return schema;
    }
    handleZodObject(zodDef, contractName) {
        const properties = {};
        const required = [];
        for (const [key, value] of Object.entries(zodDef.shape())) {
            properties[key] = this.convertZodToOpenAPI(value, contractName);
            if (value._def.typeName !== zod_1.z.ZodFirstPartyTypeKind.ZodOptional) {
                required.push(key);
            }
        }
        const schema = {
            type: 'object',
            properties,
        };
        if (required.length > 0) {
            schema.required = required;
        }
        return schema;
    }
    handleZodArray(zodDef, contractName) {
        const items = this.convertZodToOpenAPI(zodDef.type, contractName);
        const schema = {
            type: 'array',
            items,
        };
        if (zodDef._def?.minLength !== undefined) {
            schema.minLength = zodDef._def.minLength.value;
        }
        if (zodDef._def?.maxLength !== undefined) {
            schema.maxLength = zodDef._def.maxLength.value;
        }
        return schema;
    }
    handleZodEnum(zodDef) {
        return {
            type: 'string',
            enum: zodDef.values,
        };
    }
    handleZodNativeEnum(zodDef) {
        const enumValues = Object.values(zodDef.values);
        const enumType = typeof enumValues[0];
        return {
            type: enumType === 'string' ? 'string' : 'number',
            enum: enumValues,
        };
    }
    handleZodUnion(zodDef, contractName) {
        const options = zodDef.options.map((option) => this.convertZodToOpenAPI(option, contractName));
        return { anyOf: options };
    }
    handleZodIntersection(zodDef, contractName) {
        const left = this.convertZodToOpenAPI(zodDef.left, contractName);
        const right = this.convertZodToOpenAPI(zodDef.right, contractName);
        return { allOf: [left, right] };
    }
    handleZodRecord(zodDef, contractName) {
        const valueSchema = zodDef.valueType ?
            this.convertZodToOpenAPI(zodDef.valueType, contractName) :
            {};
        return {
            type: 'object',
            additionalProperties: valueSchema,
        };
    }
    extractTags(endpoints) {
        const tagSet = new Set();
        endpoints.forEach(endpoint => {
            if (endpoint.tags) {
                endpoint.tags.forEach(tag => tagSet.add(tag));
            }
        });
        return Array.from(tagSet).map(tag => ({ name: tag }));
    }
    pathToOperationId(path) {
        return path
            .split('/')
            .filter(segment => segment && !segment.startsWith('{'))
            .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
            .join('');
    }
};
exports.ApiContractGenerator = ApiContractGenerator;
exports.ApiContractGenerator = ApiContractGenerator = ApiContractGenerator_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ContractRegistry_1.ContractRegistry])
], ApiContractGenerator);
//# sourceMappingURL=ApiContractGenerator.js.map