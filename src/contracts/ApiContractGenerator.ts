import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';
import { ContractRegistry, ContractRegistration } from './ContractRegistry';

/**
 * OpenAPI component schemas for type definitions
 */
export interface OpenAPIComponents {
  schemas: Record<string, OpenAPISchema>;
}

/**
 * OpenAPI schema definition with Zod-specific mappings
 */
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

/**
 * OpenAPI path operation definition
 */
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

/**
 * OpenAPI parameter definition
 */
export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema: OpenAPISchema;
  example?: any;
}

/**
 * OpenAPI request body definition
 */
export interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, OpenAPIMediaType>;
}

/**
 * OpenAPI response definition
 */
export interface OpenAPIResponse {
  description: string;
  content?: Record<string, OpenAPIMediaType>;
  headers?: Record<string, OpenAPIHeader>;
}

/**
 * OpenAPI media type definition
 */
export interface OpenAPIMediaType {
  schema: OpenAPISchema;
  example?: any;
  examples?: Record<string, OpenAPIExample>;
}

/**
 * OpenAPI header definition
 */
export interface OpenAPIHeader {
  description?: string;
  schema: OpenAPISchema;
}

/**
 * OpenAPI example definition
 */
export interface OpenAPIExample {
  summary?: string;
  description?: string;
  value?: any;
}

/**
 * OpenAPI security requirement
 */
export interface OpenAPISecurityRequirement {
  [name: string]: string[];
}

/**
 * Endpoint metadata for API documentation
 */
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

/**
 * Complete OpenAPI 3.0 specification
 */
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

/**
 * API Contract Generator Service
 * 
 * Transforms Zod schemas from the ContractRegistry into OpenAPI 3.0 specifications.
 * Provides comprehensive API documentation generation with endpoint metadata handling
 * and interactive documentation support.
 * 
 * Key Features:
 * - Zod to OpenAPI schema conversion with full type mapping
 * - Endpoint metadata integration for complete API documentation
 * - Support for complex Zod schemas (unions, intersections, refinements)
 * - OpenAPI 3.0 compliance with Swagger UI compatibility
 * - Automatic schema referencing and component reuse
 * - Comprehensive error handling and validation
 */
@Injectable()
export class ApiContractGenerator {
  private readonly logger = new Logger(ApiContractGenerator.name);
  private readonly schemaRefs = new Map<string, string>();

  constructor(private readonly contractRegistry: ContractRegistry) {}

  /**
   * Generate complete OpenAPI specification from registered contracts and endpoint metadata
   * 
   * @param endpoints Array of endpoint metadata configurations
   * @param options OpenAPI specification options
   * @returns Complete OpenAPI 3.0 specification
   */
  generateOpenAPISpec(
    endpoints: EndpointMetadata[],
    options: {
      title: string;
      version: string;
      description?: string;
      servers?: Array<{ url: string; description?: string }>;
    }
  ): OpenAPISpec {
    try {
      this.logger.log('Generating OpenAPI specification');
      
      // Initialize OpenAPI spec structure
      const spec: OpenAPISpec = {
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

      // Process each endpoint to build paths
      for (const endpoint of endpoints) {
        this.processEndpoint(endpoint, spec);
      }

      this.logger.log(`Generated OpenAPI spec with ${Object.keys(spec.paths).length} paths`);
      return spec;
    } catch (error) {
      this.logger.error('Failed to generate OpenAPI specification:', error);
      throw new Error(`OpenAPI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert a Zod schema to OpenAPI schema format
   * 
   * @param zodSchema Zod schema to convert
   * @param contractName Optional contract name for schema referencing
   * @returns OpenAPI schema definition
   */
  zodToOpenAPISchema(zodSchema: z.ZodSchema, contractName?: string): OpenAPISchema {
    try {
      return this.convertZodToOpenAPI(zodSchema, contractName);
    } catch (error) {
      this.logger.error(`Failed to convert Zod schema to OpenAPI:`, error);
      throw new Error(`Schema conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate OpenAPI specification for a single contract
   * 
   * @param contractName Contract name
   * @param contractVersion Contract version
   * @returns OpenAPI schema definition or null if contract not found
   */
  generateContractSchema(contractName: string, contractVersion: string): OpenAPISchema | null {
    const contract = this.contractRegistry.getContract(contractName, contractVersion);
    if (!contract) {
      this.logger.warn(`Contract not found: ${contractName}@${contractVersion}`);
      return null;
    }

    try {
      return this.zodToOpenAPISchema(contract.schema, contractName);
    } catch (error) {
      this.logger.error(`Failed to generate schema for contract ${contractName}@${contractVersion}:`, error);
      return null;
    }
  }

  /**
   * Process a single endpoint to add to OpenAPI paths
   * 
   * @private
   * @param endpoint Endpoint metadata
   * @param spec OpenAPI specification being built
   */
  private processEndpoint(endpoint: EndpointMetadata, spec: OpenAPISpec): void {
    const { path, method } = endpoint;
    
    if (!spec.paths[path]) {
      spec.paths[path] = {};
    }

    const operation: OpenAPIOperation = {
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

    // Add request body if specified
    if (endpoint.requestBodyContract) {
      const requestBodySchema = this.getContractSchema(
        endpoint.requestBodyContract.name,
        endpoint.requestBodyContract.version,
        spec.components
      );
      
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

    // Add response schema if specified
    if (endpoint.responseContract) {
      const responseSchema = this.getContractSchema(
        endpoint.responseContract.name,
        endpoint.responseContract.version,
        spec.components
      );
      
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

    // Add parameters if specified
    if (endpoint.parameterContracts && endpoint.parameterContracts.length > 0) {
      operation.parameters = endpoint.parameterContracts.map(param => {
        const paramSchema = this.getContractSchema(
          param.contract.name,
          param.contract.version,
          spec.components
        );
        
        return {
          name: param.name,
          in: param.in,
          required: param.in === 'path',
          schema: paramSchema || { type: 'string' },
        };
      });
    }

    // Add security if specified
    if (endpoint.security) {
      operation.security = endpoint.security;
    }

    spec.paths[path][method.toLowerCase()] = operation;
  }

  /**
   * Get contract schema and add to components if not already present
   * 
   * @private
   * @param contractName Contract name
   * @param contractVersion Contract version
   * @param components OpenAPI components object
   * @returns OpenAPI schema or null if not found
   */
  private getContractSchema(
    contractName: string,
    contractVersion: string,
    components: OpenAPIComponents
  ): OpenAPISchema | null {
    const refKey = `${contractName}_${contractVersion}`;
    
    // Check if already added to components
    if (components.schemas[refKey]) {
      return { $ref: `#/components/schemas/${refKey}` };
    }

    // Get contract and convert schema
    const contract = this.contractRegistry.getContract(contractName, contractVersion);
    if (!contract) {
      this.logger.warn(`Contract not found: ${contractName}@${contractVersion}`);
      return null;
    }

    try {
      const openAPISchema = this.zodToOpenAPISchema(contract.schema, contractName);
      components.schemas[refKey] = openAPISchema;
      return { $ref: `#/components/schemas/${refKey}` };
    } catch (error) {
      this.logger.error(`Failed to convert contract schema ${contractName}@${contractVersion}:`, error);
      return null;
    }
  }

  /**
   * Convert Zod schema to OpenAPI schema with comprehensive type mapping
   * 
   * @private
   * @param zodSchema Zod schema to convert
   * @param contractName Optional contract name for referencing
   * @returns OpenAPI schema definition
   */
  private convertZodToOpenAPI(zodSchema: z.ZodSchema, contractName?: string): OpenAPISchema {
    const zodDef = zodSchema._def as any;

    // Handle different Zod types
    switch (zodDef.typeName) {
      case z.ZodFirstPartyTypeKind.ZodString:
        return this.handleZodString(zodDef);
      
      case z.ZodFirstPartyTypeKind.ZodNumber:
        return this.handleZodNumber(zodDef);
      
      case z.ZodFirstPartyTypeKind.ZodBoolean:
        return { type: 'boolean' };
      
      case z.ZodFirstPartyTypeKind.ZodDate:
        return { type: 'string', format: 'date-time' };
      
      case z.ZodFirstPartyTypeKind.ZodObject:
        return this.handleZodObject(zodDef, contractName);
      
      case z.ZodFirstPartyTypeKind.ZodArray:
        return this.handleZodArray(zodDef, contractName);
      
      case z.ZodFirstPartyTypeKind.ZodEnum:
        return this.handleZodEnum(zodDef);
      
      case z.ZodFirstPartyTypeKind.ZodNativeEnum:
        return this.handleZodNativeEnum(zodDef);
      
      case z.ZodFirstPartyTypeKind.ZodUnion:
        return this.handleZodUnion(zodDef, contractName);
      
      case z.ZodFirstPartyTypeKind.ZodIntersection:
        return this.handleZodIntersection(zodDef, contractName);
      
      case z.ZodFirstPartyTypeKind.ZodOptional:
        return this.convertZodToOpenAPI(zodDef.innerType, contractName);
      
      case z.ZodFirstPartyTypeKind.ZodNullable:
        const innerSchema = this.convertZodToOpenAPI(zodDef.innerType, contractName);
        return { ...innerSchema, nullable: true };
      
      case z.ZodFirstPartyTypeKind.ZodDefault:
        const defaultSchema = this.convertZodToOpenAPI(zodDef.innerType, contractName);
        return { ...defaultSchema, default: zodDef.defaultValue() };
      
      case z.ZodFirstPartyTypeKind.ZodLiteral:
        return { type: typeof zodDef.value, enum: [zodDef.value] };
      
      case z.ZodFirstPartyTypeKind.ZodRecord:
        return this.handleZodRecord(zodDef, contractName);
      
      case z.ZodFirstPartyTypeKind.ZodAny:
        return {}; // Allow any type
      
      case z.ZodFirstPartyTypeKind.ZodUnknown:
        return {}; // Allow any type
      
      default:
        this.logger.warn(`Unsupported Zod type: ${zodDef.typeName}`);
        return { type: 'object' }; // Fallback
    }
  }

  /**
   * Handle Zod string schema conversion
   * 
   * @private
   * @param zodDef Zod string definition
   * @returns OpenAPI string schema
   */
  private handleZodString(zodDef: any): OpenAPISchema {
    const schema: OpenAPISchema = { type: 'string' };
    
    // Handle string constraints
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

  /**
   * Handle Zod number schema conversion
   * 
   * @private
   * @param zodDef Zod number definition
   * @returns OpenAPI number schema
   */
  private handleZodNumber(zodDef: any): OpenAPISchema {
    const schema: OpenAPISchema = { type: 'number' };
    
    // Handle number constraints
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

  /**
   * Handle Zod object schema conversion
   * 
   * @private
   * @param zodDef Zod object definition
   * @param contractName Optional contract name
   * @returns OpenAPI object schema
   */
  private handleZodObject(zodDef: any, contractName?: string): OpenAPISchema {
    const properties: Record<string, OpenAPISchema> = {};
    const required: string[] = [];
    
    // Process object properties
    for (const [key, value] of Object.entries(zodDef.shape())) {
      properties[key] = this.convertZodToOpenAPI(value as z.ZodSchema, contractName);
      
      // Check if field is required (not optional)
      if ((value as any)._def.typeName !== z.ZodFirstPartyTypeKind.ZodOptional) {
        required.push(key);
      }
    }
    
    const schema: OpenAPISchema = {
      type: 'object',
      properties,
    };
    
    if (required.length > 0) {
      schema.required = required;
    }
    
    return schema;
  }

  /**
   * Handle Zod array schema conversion
   * 
   * @private
   * @param zodDef Zod array definition
   * @param contractName Optional contract name
   * @returns OpenAPI array schema
   */
  private handleZodArray(zodDef: any, contractName?: string): OpenAPISchema {
    const items = this.convertZodToOpenAPI(zodDef.type, contractName);
    
    const schema: OpenAPISchema = {
      type: 'array',
      items,
    };
    
    // Handle array constraints
    if (zodDef._def?.minLength !== undefined) {
      schema.minLength = zodDef._def.minLength.value;
    }
    if (zodDef._def?.maxLength !== undefined) {
      schema.maxLength = zodDef._def.maxLength.value;
    }
    
    return schema;
  }

  /**
   * Handle Zod enum schema conversion
   * 
   * @private
   * @param zodDef Zod enum definition
   * @returns OpenAPI enum schema
   */
  private handleZodEnum(zodDef: any): OpenAPISchema {
    return {
      type: 'string',
      enum: zodDef.values,
    };
  }

  /**
   * Handle Zod native enum schema conversion
   * 
   * @private
   * @param zodDef Zod native enum definition
   * @returns OpenAPI enum schema
   */
  private handleZodNativeEnum(zodDef: any): OpenAPISchema {
    const enumValues = Object.values(zodDef.values);
    const enumType = typeof enumValues[0];
    
    return {
      type: enumType === 'string' ? 'string' : 'number',
      enum: enumValues,
    };
  }

  /**
   * Handle Zod union schema conversion
   * 
   * @private
   * @param zodDef Zod union definition
   * @param contractName Optional contract name
   * @returns OpenAPI anyOf schema
   */
  private handleZodUnion(zodDef: any, contractName?: string): OpenAPISchema {
    const options = zodDef.options.map((option: z.ZodSchema) => 
      this.convertZodToOpenAPI(option, contractName)
    );
    
    return { anyOf: options };
  }

  /**
   * Handle Zod intersection schema conversion
   * 
   * @private
   * @param zodDef Zod intersection definition
   * @param contractName Optional contract name
   * @returns OpenAPI allOf schema
   */
  private handleZodIntersection(zodDef: any, contractName?: string): OpenAPISchema {
    const left = this.convertZodToOpenAPI(zodDef.left, contractName);
    const right = this.convertZodToOpenAPI(zodDef.right, contractName);
    
    return { allOf: [left, right] };
  }

  /**
   * Handle Zod record schema conversion
   * 
   * @private
   * @param zodDef Zod record definition
   * @param contractName Optional contract name
   * @returns OpenAPI object schema with additionalProperties
   */
  private handleZodRecord(zodDef: any, contractName?: string): OpenAPISchema {
    const valueSchema = zodDef.valueType ? 
      this.convertZodToOpenAPI(zodDef.valueType, contractName) : 
      {};
    
    return {
      type: 'object',
      additionalProperties: valueSchema,
    };
  }

  /**
   * Extract unique tags from endpoint metadata
   * 
   * @private
   * @param endpoints Array of endpoint metadata
   * @returns Array of tag definitions
   */
  private extractTags(endpoints: EndpointMetadata[]): Array<{ name: string; description?: string }> {
    const tagSet = new Set<string>();
    
    endpoints.forEach(endpoint => {
      if (endpoint.tags) {
        endpoint.tags.forEach(tag => tagSet.add(tag));
      }
    });
    
    return Array.from(tagSet).map(tag => ({ name: tag }));
  }

  /**
   * Convert path to operation ID
   * 
   * @private
   * @param path API path
   * @returns Operation ID string
   */
  private pathToOperationId(path: string): string {
    return path
      .split('/')
      .filter(segment => segment && !segment.startsWith('{'))
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('');
  }
}