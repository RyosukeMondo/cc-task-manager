#!/usr/bin/env tsx

/**
 * OpenAPI Specification Generator Script
 *
 * This script generates a complete OpenAPI 3.0 specification JSON file
 * using the existing contract-driven infrastructure and NestJS decorators.
 *
 * It follows the SOLID principles:
 * - SRP: Focused solely on OpenAPI spec generation
 * - OCP: Extends existing infrastructure without modification
 * - DIP: Depends on existing contract abstractions
 *
 * Usage:
 *   npm run generate:openapi
 *   or
 *   npx tsx apps/backend/scripts/generate-openapi-spec.ts
 */

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { AppModule } from '../src/app.module';
import { OpenApiDocumentationService } from '../src/docs/openapi.service';

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  tags?: Array<{
    name: string;
    description: string;
  }>;
  security?: Array<Record<string, string[]>>;
}

/**
 * Generate complete OpenAPI specification from existing infrastructure
 */
async function generateOpenApiSpec(): Promise<void> {
  console.log('🚀 Starting OpenAPI specification generation...');

  try {
    // Create NestJS application instance
    console.log('📦 Creating NestJS application...');
    const app = await NestFactory.create(AppModule, {
      logger: ['error'], // Minimal logging during generation
    });

    // Configure Swagger document builder
    const config = new DocumentBuilder()
      .setTitle('CC Task Manager Backend API')
      .setDescription(`
        Comprehensive task management API with contract-driven validation and real-time capabilities.

        ## Features
        - **JWT Authentication**: Secure token-based authentication with CASL authorization
        - **Task Management**: Full CRUD operations with filtering, pagination, and bulk operations
        - **Real-time Updates**: WebSocket events for instant task status updates
        - **User Management**: Profile management with role-based access control
        - **Performance Monitoring**: Built-in metrics and performance tracking
        - **Type Safety**: Contract-driven validation using Zod schemas

        ## Authentication
        Most endpoints require JWT Bearer token authentication. Include the token in the Authorization header:
        \`\`\`
        Authorization: Bearer <your-jwt-token>
        \`\`\`

        ## Error Handling
        All errors follow a consistent format with correlation IDs for debugging:
        \`\`\`json
        {
          "statusCode": 400,
          "message": ["Validation error details"],
          "error": "Bad Request",
          "correlationId": "req-123456789"
        }
        \`\`\`

        ## Rate Limiting
        API endpoints are rate-limited:
        - Authentication endpoints: 5 requests per minute
        - Task operations: 100 requests per minute
        - Bulk operations: 10 requests per minute

        ## Performance
        - Task creation: <100ms (95th percentile)
        - Task queries: <200ms (95th percentile)
        - Real-time events: <100ms delivery
      `.trim())
      .setVersion('1.0.0')
      .addTag('Authentication', 'User authentication and session management')
      .addTag('Tasks', 'Task management operations with comprehensive validation')
      .addTag('Users', 'User profile and management with authorization')
      .addTag('Health', 'Service health monitoring and readiness checks')
      .addTag('Queue', 'Background job processing and queue management')
      .addTag('Documentation', 'API documentation and specification endpoints')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token for API authentication',
        },
        'JWT'
      )
      .addServer('http://localhost:3001', 'Development server')
      .addServer('https://api.cc-task-manager.com', 'Production server')
      .build();

    // Generate base document from NestJS decorators
    console.log('📋 Generating base OpenAPI document from NestJS decorators...');
    const document = SwaggerModule.createDocument(app, config);

    // Get enhanced specification from our OpenAPI service
    console.log('🔧 Enhancing specification with contract-driven metadata...');
    const openApiService = app.get(OpenApiDocumentationService);
    const enhancedSpec = openApiService.getOpenApiSpec();

    let finalSpec: OpenAPISpec;

    if (enhancedSpec) {
      // Merge the auto-generated document with our enhanced specification
      finalSpec = {
        ...document,
        openapi: '3.0.0',
        info: {
          ...document.info,
          title: enhancedSpec.info?.title || document.info.title,
          description: enhancedSpec.info?.description || document.info.description,
          version: enhancedSpec.info?.version || document.info.version,
        },
        servers: enhancedSpec.servers || document.servers || [],
        paths: {
          ...document.paths,
          ...enhancedSpec.paths,
        },
        components: {
          schemas: {
            ...document.components?.schemas,
            ...enhancedSpec.components?.schemas,
          },
          securitySchemes: {
            ...document.components?.securitySchemes,
            ...enhancedSpec.components?.securitySchemes,
          },
        },
        tags: enhancedSpec.tags || document.tags || [],
      };
    } else {
      // Fallback to auto-generated document
      finalSpec = {
        ...document,
        openapi: '3.0.0',
      };
    }

    // Add comprehensive examples and additional metadata
    addExamplesAndMetadata(finalSpec);

    // Ensure output directory exists
    const outputPath = join(process.cwd(), 'apps/backend/api-docs/task-api.json');
    const outputDir = dirname(outputPath);

    console.log('📁 Creating output directory...');
    mkdirSync(outputDir, { recursive: true });

    // Write the specification to file
    console.log('💾 Writing OpenAPI specification to file...');
    writeFileSync(
      outputPath,
      JSON.stringify(finalSpec, null, 2),
      'utf8'
    );

    // Generate additional documentation assets
    console.log('📄 Generating additional documentation assets...');
    await generateDocumentationAssets(openApiService, outputDir);

    // Close the application
    await app.close();

    console.log('✅ OpenAPI specification generated successfully!');
    console.log(`📍 Location: ${outputPath}`);
    console.log(`📊 Statistics:`);
    console.log(`   - Endpoints: ${Object.keys(finalSpec.paths).length}`);
    console.log(`   - Schemas: ${Object.keys(finalSpec.components?.schemas || {}).length}`);
    console.log(`   - Tags: ${finalSpec.tags?.length || 0}`);
    console.log(`   - Security schemes: ${Object.keys(finalSpec.components?.securitySchemes || {}).length}`);

  } catch (error) {
    console.error('❌ Failed to generate OpenAPI specification:', error);
    process.exit(1);
  }
}

/**
 * Add comprehensive examples and metadata to the OpenAPI specification
 */
function addExamplesAndMetadata(spec: OpenAPISpec): void {
  // Add global security requirements
  spec.security = [{ JWT: [] }];

  // Enhance path operations with additional examples
  Object.entries(spec.paths).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, operation]: [string, any]) => {
      if (typeof operation === 'object' && operation !== null) {
        // Add response examples for task endpoints
        if (path.includes('/tasks') && operation.responses) {
          addTaskResponseExamples(operation.responses, method.toUpperCase(), path);
        }

        // Add request body examples
        if (operation.requestBody?.content) {
          addRequestBodyExamples(operation.requestBody.content, method.toUpperCase(), path);
        }

        // Enhance parameter examples
        if (operation.parameters) {
          enhanceParameterExamples(operation.parameters, path);
        }
      }
    });
  });

  // Add comprehensive schema examples
  addSchemaExamples(spec.components?.schemas);
}

/**
 * Add task-specific response examples
 */
function addTaskResponseExamples(responses: Record<string, any>, method: string, path: string): void {
  if (responses['200'] || responses['201']) {
    const successResponse = responses['200'] || responses['201'];

    if (path.includes('/tasks') && !path.includes('/bulk')) {
      // Single task response example
      if (successResponse.content?.['application/json']) {
        successResponse.content['application/json'].example = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Implement user authentication system',
          description: 'Create JWT-based authentication with role-based access control',
          prompt: 'Implement a secure authentication system using JWT tokens with CASL for authorization...',
          status: 'pending',
          priority: 'high',
          progress: null,
          config: {
            timeout: 1800,
            retryAttempts: 3,
            priority: 'high',
          },
          createdBy: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            username: 'developer',
            email: 'dev@example.com',
          },
          project: {
            id: '789e0123-e89b-12d3-a456-426614174111',
            name: 'Authentication Module',
          },
          tags: ['authentication', 'security', 'backend'],
          createdAt: '2024-01-15T09:00:00Z',
          updatedAt: '2024-01-15T09:00:00Z',
          scheduledAt: '2024-01-15T10:00:00Z',
          startedAt: null,
          completedAt: null,
          estimatedDuration: null,
          actualDuration: null,
          errorMessage: null,
          retryCount: 0,
        };
      }
    } else if (path.includes('/tasks') && method === 'GET' && !path.includes('{id}')) {
      // Paginated task list response example
      if (successResponse.content?.['application/json']) {
        successResponse.content['application/json'].example = {
          data: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              title: 'Implement user authentication',
              status: 'pending',
              priority: 'high',
              createdAt: '2024-01-15T09:00:00Z',
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440001',
              title: 'Create task dashboard',
              status: 'running',
              priority: 'medium',
              createdAt: '2024-01-15T08:30:00Z',
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 125,
            totalPages: 7,
            hasNext: true,
            hasPrev: false,
          },
        };
      }
    }
  }
}

/**
 * Add request body examples
 */
function addRequestBodyExamples(content: Record<string, any>, method: string, path: string): void {
  if (content['application/json'] && path.includes('/tasks')) {
    if (method === 'POST' && path === '/api/v1/tasks') {
      content['application/json'].example = {
        title: 'Implement user authentication system',
        description: 'Create JWT-based authentication with role-based access control',
        prompt: 'Implement a secure authentication system using JWT tokens with CASL for authorization. Include login, logout, and token refresh endpoints.',
        config: {
          timeout: 1800,
          retryAttempts: 3,
          priority: 'high',
        },
        projectId: '789e0123-e89b-12d3-a456-426614174111',
        tags: ['authentication', 'security', 'backend'],
        scheduledAt: '2024-01-15T10:00:00Z',
      };
    } else if (method === 'PATCH' && path.includes('{id}')) {
      content['application/json'].example = {
        title: 'Updated task title',
        description: 'Updated task description',
        config: {
          timeout: 2400,
          retryAttempts: 5,
        },
        tags: ['authentication', 'security', 'backend', 'updated'],
      };
    }
  }
}

/**
 * Enhance parameter examples
 */
function enhanceParameterExamples(parameters: any[], path: string): void {
  parameters.forEach(param => {
    if (param.name === 'id' && param.in === 'path') {
      param.example = '550e8400-e29b-41d4-a716-446655440000';
    } else if (param.name === 'status' && param.in === 'query') {
      param.example = ['pending', 'running'];
    } else if (param.name === 'priority' && param.in === 'query') {
      param.example = ['high', 'urgent'];
    } else if (param.name === 'search' && param.in === 'query') {
      param.example = 'authentication system';
    }
  });
}

/**
 * Add comprehensive schema examples
 */
function addSchemaExamples(schemas: Record<string, any> | undefined): void {
  if (!schemas) return;

  // Add examples to relevant schemas
  Object.entries(schemas).forEach(([schemaName, schema]) => {
    if (typeof schema === 'object' && schema !== null) {
      if (schemaName.toLowerCase().includes('task')) {
        addTaskSchemaExample(schema, schemaName);
      } else if (schemaName.toLowerCase().includes('user')) {
        addUserSchemaExample(schema, schemaName);
      }
    }
  });
}

function addTaskSchemaExample(schema: any, schemaName: string): void {
  if (!schema.example) {
    if (schemaName.includes('Create')) {
      schema.example = {
        title: 'Implement feature X',
        description: 'Add new functionality for feature X',
        prompt: 'Implement the required feature with proper validation and testing',
        config: { timeout: 1800 },
        tags: ['feature', 'development'],
      };
    } else if (schemaName.includes('Response')) {
      schema.example = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Implement feature X',
        status: 'pending',
        createdAt: '2024-01-15T09:00:00Z',
      };
    }
  }
}

function addUserSchemaExample(schema: any, schemaName: string): void {
  if (!schema.example) {
    schema.example = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      username: 'developer',
      email: 'dev@example.com',
      role: 'user',
    };
  }
}

/**
 * Generate additional documentation assets
 */
async function generateDocumentationAssets(
  openApiService: OpenApiDocumentationService,
  outputDir: string
): Promise<void> {
  try {
    // Generate TypeScript types
    const typesMap = await openApiService.generateAllTypeScriptTypes();
    const typesContent = Array.from(typesMap.entries())
      .map(([name, typeInfo]) => `// ${name}\n${typeInfo.types || ''}`)
      .join('\n\n');

    writeFileSync(
      join(outputDir, 'api-types.ts'),
      typesContent,
      'utf8'
    );

    // Generate TypeScript client
    const clientCode = await openApiService.generateTypeScriptClient();
    if (clientCode) {
      writeFileSync(
        join(outputDir, 'api-client.ts'),
        clientCode,
        'utf8'
      );
    }

    console.log('📄 Generated additional assets:');
    console.log('   - api-types.ts (TypeScript type definitions)');
    console.log('   - api-client.ts (TypeScript API client)');

  } catch (error) {
    console.warn('⚠️  Failed to generate additional assets:', error);
    // Don't fail the main process
  }
}

// Execute the script
if (require.main === module) {
  generateOpenApiSpec().catch(console.error);
}