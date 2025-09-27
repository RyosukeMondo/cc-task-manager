import { z } from 'zod';
import { ContractRegistry } from './ContractRegistry';
export interface OpenAPIComponents {
    schemas: Record<string, OpenAPISchema>;
}
export interface OpenAPISchema {
    type?: string;
    format?: string;
    description?: string;
    properties?: Record<string, OpenAPISchema>;
    items?: OpenAPISchema;
    required?: string[];
    enum?: any[];
    oneOf?: OpenAPISchema[];
    anyOf?: OpenAPISchema[];
    allOf?: OpenAPISchema[];
    default?: any;
    example?: any;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    nullable?: boolean;
    additionalProperties?: boolean | OpenAPISchema;
    $ref?: string;
}
export interface OpenAPIOperation {
    summary?: string;
    description?: string;
    operationId?: string;
    tags?: string[];
    parameters?: OpenAPIParameter[];
    requestBody?: OpenAPIRequestBody;
    responses: Record<string, OpenAPIResponse>;
    security?: OpenAPISecurityRequirement[];
}
export interface OpenAPIParameter {
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie';
    description?: string;
    required?: boolean;
    schema: OpenAPISchema;
    example?: any;
}
export interface OpenAPIRequestBody {
    description?: string;
    required?: boolean;
    content: Record<string, OpenAPIMediaType>;
}
export interface OpenAPIResponse {
    description: string;
    content?: Record<string, OpenAPIMediaType>;
    headers?: Record<string, OpenAPIHeader>;
}
export interface OpenAPIMediaType {
    schema: OpenAPISchema;
    example?: any;
    examples?: Record<string, OpenAPIExample>;
}
export interface OpenAPIHeader {
    description?: string;
    schema: OpenAPISchema;
}
export interface OpenAPIExample {
    summary?: string;
    description?: string;
    value?: any;
}
export interface OpenAPISecurityRequirement {
    [name: string]: string[];
}
export interface EndpointMetadata {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
    summary?: string;
    description?: string;
    operationId?: string;
    tags?: string[];
    requestBodyContract?: {
        name: string;
        version: string;
    };
    responseContract?: {
        name: string;
        version: string;
    };
    parameterContracts?: {
        name: string;
        in: 'query' | 'header' | 'path' | 'cookie';
        contract: {
            name: string;
            version: string;
        };
    }[];
    security?: OpenAPISecurityRequirement[];
}
export interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
        contact?: {
            name?: string;
            email?: string;
            url?: string;
        };
        license?: {
            name: string;
            url?: string;
        };
    };
    servers?: {
        url: string;
        description?: string;
        variables?: Record<string, {
            default: string;
            description?: string;
            enum?: string[];
        }>;
    }[];
    paths: Record<string, Record<string, OpenAPIOperation>>;
    components: OpenAPIComponents;
    security?: OpenAPISecurityRequirement[];
    tags?: {
        name: string;
        description?: string;
    }[];
}
export declare class ApiContractGenerator {
    private readonly contractRegistry;
    private readonly logger;
    private readonly schemaRefs;
    constructor(contractRegistry: ContractRegistry);
    generateOpenAPISpec(endpoints: EndpointMetadata[], options: {
        title: string;
        version: string;
        description?: string;
        servers?: Array<{
            url: string;
            description?: string;
        }>;
    }): OpenAPISpec;
    zodToOpenAPISchema(zodSchema: z.ZodSchema, contractName?: string): OpenAPISchema;
    generateContractSchema(contractName: string, contractVersion: string): OpenAPISchema | null;
    private processEndpoint;
    private getContractSchema;
    private convertZodToOpenAPI;
    private handleZodString;
    private handleZodNumber;
    private handleZodObject;
    private handleZodArray;
    private handleZodEnum;
    private handleZodNativeEnum;
    private handleZodUnion;
    private handleZodIntersection;
    private handleZodRecord;
    private extractTags;
    private pathToOperationId;
}
