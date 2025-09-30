import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ContractRegistry } from '@contracts/ContractRegistry';
import { ApiContractGenerator, EndpointMetadata, OpenAPISpec } from '@contracts/ApiContractGenerator';
import { TypeScriptGenerator, ClientApiMethod } from '@contracts/TypeScriptGenerator';
import { BackendSchemaRegistry } from '../schemas/schema-registry';

/**
 * OpenAPI Documentation Service
 *
 * Leverages the existing ApiContractGenerator infrastructure to provide
 * comprehensive, always-current API documentation for the backend application.
 *
 * This service extends the existing SSOT documentation infrastructure without
 * recreating it, following the Open/Closed Principle by extending capabilities
 * without modifying the core contract system.
 *
 * Key Features:
 * - Automatic endpoint discovery and documentation
 * - Contract-based schema generation using existing infrastructure
 * - TypeScript client generation for API consumers
 * - Real-time documentation updates as contracts change
 * - Interactive Swagger UI configuration
 */
@Injectable()
export class OpenApiDocumentationService implements OnModuleInit {
  private readonly logger = new Logger(OpenApiDocumentationService.name);
  private openApiSpec: OpenAPISpec | null = null;
  private endpointMetadata: EndpointMetadata[] = [];

  constructor(
    private readonly contractRegistry: ContractRegistry,
    private readonly apiGenerator: ApiContractGenerator,
    private readonly typeScriptGenerator: TypeScriptGenerator,
    private readonly schemaRegistry: BackendSchemaRegistry
  ) {}

  /**
   * Initialize OpenAPI documentation on module startup
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing OpenAPI documentation service...');

    try {
      // Define all backend API endpoints with their contract associations
      this.defineEndpointMetadata();

      // Generate the OpenAPI specification
      await this.generateOpenApiSpecification();

      this.logger.log('OpenAPI documentation service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenAPI documentation:', error);
    }
  }

  /**
   * Define endpoint metadata for all backend API operations
   * Maps endpoints to their corresponding contract schemas
   */
  private defineEndpointMetadata(): void {
    this.endpointMetadata = [
      // Authentication Endpoints
      {
        path: '/api/auth/register',
        method: 'POST',
        summary: 'Register new user',
        description: 'Create a new user account with email and password',
        operationId: 'registerUser',
        tags: ['Authentication'],
        requestBodyContract: { name: 'UserRegistration', version: '1.0.0' },
        responseContract: { name: 'AuthResponse', version: '1.0.0' },
      },
      {
        path: '/api/auth/login',
        method: 'POST',
        summary: 'User login',
        description: 'Authenticate user and receive JWT tokens',
        operationId: 'loginUser',
        tags: ['Authentication'],
        requestBodyContract: { name: 'LoginRequest', version: '1.0.0' },
        responseContract: { name: 'AuthResponse', version: '1.0.0' },
      },
      {
        path: '/api/auth/refresh',
        method: 'POST',
        summary: 'Refresh access token',
        description: 'Exchange refresh token for new access token',
        operationId: 'refreshToken',
        tags: ['Authentication'],
        requestBodyContract: { name: 'TokenRefresh', version: '1.0.0' },
        responseContract: { name: 'AuthResponse', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/auth/logout',
        method: 'POST',
        summary: 'User logout',
        description: 'Invalidate current session and tokens',
        operationId: 'logoutUser',
        tags: ['Authentication'],
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/auth/password/change',
        method: 'POST',
        summary: 'Change password',
        description: 'Change user password while authenticated',
        operationId: 'changePassword',
        tags: ['Authentication'],
        requestBodyContract: { name: 'PasswordChange', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/auth/password/reset/request',
        method: 'POST',
        summary: 'Request password reset',
        description: 'Send password reset email to user',
        operationId: 'requestPasswordReset',
        tags: ['Authentication'],
        requestBodyContract: { name: 'PasswordResetRequest', version: '1.0.0' },
      },
      {
        path: '/api/auth/password/reset/confirm',
        method: 'POST',
        summary: 'Confirm password reset',
        description: 'Reset password using token from email',
        operationId: 'confirmPasswordReset',
        tags: ['Authentication'],
        requestBodyContract: { name: 'PasswordResetConfirm', version: '1.0.0' },
      },

      // Task Management Endpoints
      {
        path: '/api/tasks',
        method: 'GET',
        summary: 'List tasks',
        description: 'Get paginated list of tasks with filtering',
        operationId: 'listTasks',
        tags: ['Tasks'],
        parameterContracts: [
          { name: 'filters', in: 'query', contract: { name: 'TaskQueryFilters', version: '1.0.0' } }
        ],
        responseContract: { name: 'TaskBase', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/tasks',
        method: 'POST',
        summary: 'Create task',
        description: 'Create a new task with contract validation',
        operationId: 'createTask',
        tags: ['Tasks'],
        requestBodyContract: { name: 'CreateTask', version: '1.0.0' },
        responseContract: { name: 'TaskBase', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/tasks/{taskId}',
        method: 'GET',
        summary: 'Get task by ID',
        description: 'Retrieve single task details',
        operationId: 'getTask',
        tags: ['Tasks'],
        parameterContracts: [
          { name: 'taskId', in: 'path', contract: { name: 'TaskBase', version: '1.0.0' } }
        ],
        responseContract: { name: 'TaskBase', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/tasks/{taskId}',
        method: 'PUT',
        summary: 'Update task',
        description: 'Update existing task with validation',
        operationId: 'updateTask',
        tags: ['Tasks'],
        parameterContracts: [
          { name: 'taskId', in: 'path', contract: { name: 'TaskBase', version: '1.0.0' } }
        ],
        requestBodyContract: { name: 'UpdateTask', version: '1.0.0' },
        responseContract: { name: 'TaskBase', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/tasks/{taskId}',
        method: 'DELETE',
        summary: 'Delete task',
        description: 'Delete task with authorization check',
        operationId: 'deleteTask',
        tags: ['Tasks'],
        parameterContracts: [
          { name: 'taskId', in: 'path', contract: { name: 'TaskBase', version: '1.0.0' } }
        ],
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/tasks/bulk',
        method: 'POST',
        summary: 'Bulk task operation',
        description: 'Perform bulk operations on multiple tasks',
        operationId: 'bulkTaskOperation',
        tags: ['Tasks'],
        requestBodyContract: { name: 'BulkTaskOperation', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/tasks/{taskId}/comments',
        method: 'GET',
        summary: 'List task comments',
        description: 'Get all comments for a task',
        operationId: 'listTaskComments',
        tags: ['Tasks'],
        parameterContracts: [
          { name: 'taskId', in: 'path', contract: { name: 'TaskBase', version: '1.0.0' } }
        ],
        responseContract: { name: 'TaskComment', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/tasks/{taskId}/comments',
        method: 'POST',
        summary: 'Add task comment',
        description: 'Add comment to task discussion',
        operationId: 'createTaskComment',
        tags: ['Tasks'],
        parameterContracts: [
          { name: 'taskId', in: 'path', contract: { name: 'TaskBase', version: '1.0.0' } }
        ],
        requestBodyContract: { name: 'CreateTaskComment', version: '1.0.0' },
        responseContract: { name: 'TaskComment', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/tasks/{taskId}/time-logs',
        method: 'POST',
        summary: 'Log time for task',
        description: 'Record time spent on task',
        operationId: 'logTaskTime',
        tags: ['Tasks'],
        parameterContracts: [
          { name: 'taskId', in: 'path', contract: { name: 'TaskBase', version: '1.0.0' } }
        ],
        requestBodyContract: { name: 'CreateTaskTimeLog', version: '1.0.0' },
        responseContract: { name: 'TaskTimeLog', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/tasks/statistics',
        method: 'GET',
        summary: 'Get task statistics',
        description: 'Get aggregated task statistics for reporting',
        operationId: 'getTaskStatistics',
        tags: ['Tasks'],
        responseContract: { name: 'TaskStatistics', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },

      // User Management Endpoints
      {
        path: '/api/users',
        method: 'GET',
        summary: 'List users',
        description: 'Get paginated list of users with CASL authorization',
        operationId: 'listUsers',
        tags: ['Users'],
        parameterContracts: [
          { name: 'filters', in: 'query', contract: { name: 'UserQueryFilters', version: '1.0.0' } }
        ],
        responseContract: { name: 'UserProfile', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/users/profile',
        method: 'GET',
        summary: 'Get current user profile',
        description: 'Get authenticated user profile with preferences',
        operationId: 'getCurrentUserProfile',
        tags: ['Users'],
        responseContract: { name: 'UserProfile', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/users/profile',
        method: 'PUT',
        summary: 'Update user profile',
        description: 'Update current user profile and preferences',
        operationId: 'updateUserProfile',
        tags: ['Users'],
        requestBodyContract: { name: 'UpdateUserProfile', version: '1.0.0' },
        responseContract: { name: 'UserProfile', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/users/{userId}',
        method: 'GET',
        summary: 'Get user by ID',
        description: 'Get specific user details with authorization check',
        operationId: 'getUserById',
        tags: ['Users'],
        parameterContracts: [
          { name: 'userId', in: 'path', contract: { name: 'UserBase', version: '1.0.0' } }
        ],
        responseContract: { name: 'UserProfile', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/users/admin/create',
        method: 'POST',
        summary: 'Admin create user',
        description: 'Create user account as administrator',
        operationId: 'adminCreateUser',
        tags: ['Users'],
        requestBodyContract: { name: 'AdminCreateUser', version: '1.0.0' },
        responseContract: { name: 'UserProfile', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/users/{userId}/admin/update',
        method: 'PUT',
        summary: 'Admin update user',
        description: 'Update user account as administrator',
        operationId: 'adminUpdateUser',
        tags: ['Users'],
        parameterContracts: [
          { name: 'userId', in: 'path', contract: { name: 'UserBase', version: '1.0.0' } }
        ],
        requestBodyContract: { name: 'AdminUpdateUser', version: '1.0.0' },
        responseContract: { name: 'UserProfile', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/users/{userId}/deactivate',
        method: 'POST',
        summary: 'Deactivate user',
        description: 'Deactivate user account with CASL authorization',
        operationId: 'deactivateUser',
        tags: ['Users'],
        parameterContracts: [
          { name: 'userId', in: 'path', contract: { name: 'UserBase', version: '1.0.0' } }
        ],
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/users/invitations',
        method: 'POST',
        summary: 'Send user invitation',
        description: 'Send invitation to join the system',
        operationId: 'sendUserInvitation',
        tags: ['Users'],
        requestBodyContract: { name: 'CreateUserInvitation', version: '1.0.0' },
        responseContract: { name: 'UserInvitation', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/users/invitations/accept',
        method: 'POST',
        summary: 'Accept invitation',
        description: 'Accept user invitation and create account',
        operationId: 'acceptInvitation',
        tags: ['Users'],
        requestBodyContract: { name: 'AcceptUserInvitation', version: '1.0.0' },
        responseContract: { name: 'AuthResponse', version: '1.0.0' },
      },
      {
        path: '/api/users/statistics',
        method: 'GET',
        summary: 'Get user statistics',
        description: 'Get user statistics for admin dashboard',
        operationId: 'getUserStatistics',
        tags: ['Users'],
        responseContract: { name: 'UserStatistics', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },

      // Health & Monitoring Endpoints
      {
        path: '/api/health',
        method: 'GET',
        summary: 'Health check',
        description: 'Basic health check endpoint',
        operationId: 'healthCheck',
        tags: ['Health'],
      },
      {
        path: '/api/health/ready',
        method: 'GET',
        summary: 'Readiness probe',
        description: 'Check if service is ready to accept traffic',
        operationId: 'readinessProbe',
        tags: ['Health'],
      },
      {
        path: '/api/health/live',
        method: 'GET',
        summary: 'Liveness probe',
        description: 'Check if service is alive and running',
        operationId: 'livenessProbe',
        tags: ['Health'],
      },
      {
        path: '/api/health/detailed',
        method: 'GET',
        summary: 'Detailed health status',
        description: 'Get detailed health status of all dependencies',
        operationId: 'detailedHealthStatus',
        tags: ['Health'],
        security: [{ 'access-token': [] }],
      },

      // Queue Management Endpoints
      {
        path: '/api/queue/metrics',
        method: 'GET',
        summary: 'Get queue metrics',
        description: 'Get BullMQ queue metrics and statistics',
        operationId: 'getQueueMetrics',
        tags: ['Queue'],
        responseContract: { name: 'QueueMetrics', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
      {
        path: '/api/queue/jobs',
        method: 'POST',
        summary: 'Create queue job',
        description: 'Add new job to processing queue',
        operationId: 'createQueueJob',
        tags: ['Queue'],
        requestBodyContract: { name: 'QueueJob', version: '1.0.0' },
        security: [{ 'access-token': [] }],
      },
    ];

    this.logger.log(`Defined ${this.endpointMetadata.length} endpoint configurations`);
  }

  /**
   * Generate the complete OpenAPI specification using existing infrastructure
   */
  private async generateOpenApiSpecification(): Promise<void> {
    try {
      // Generate OpenAPI spec using existing ApiContractGenerator
      this.openApiSpec = this.apiGenerator.generateOpenAPISpec(
        this.endpointMetadata,
        {
          title: 'CC Task Manager Backend API',
          version: '1.0.0',
          description: `
            Contract-driven backend API leveraging existing SSOT infrastructure.

            This API provides:
            - JWT-based authentication with CASL authorization
            - Task management with contract-validated operations
            - User management with fine-grained permissions
            - Real-time WebSocket communication
            - BullMQ job processing and queue management
            - Comprehensive health monitoring

            All endpoints are validated using the existing ContractRegistry,
            ensuring type safety and consistency across the entire application.

            ## Authentication
            Most endpoints require JWT Bearer token authentication.
            Include the token in the Authorization header:
            \`Authorization: Bearer <your-jwt-token>\`

            ## Error Handling
            All errors follow the consistent contract-based error response format
            with correlation IDs for debugging and structured error messages.

            ## Rate Limiting
            API endpoints are rate-limited to prevent abuse.
            See individual endpoint documentation for specific limits.
          `.trim(),
          servers: [
            { url: 'http://localhost:3001', description: 'Development server' },
            { url: 'https://api.cc-task-manager.com', description: 'Production server' },
          ],
        }
      );

      if (this.openApiSpec) {
        // Add security schemes
        this.openApiSpec.components = this.openApiSpec.components || { schemas: {} };
        // Add securitySchemes as a property of the spec (not components)
        (this.openApiSpec as any).components.securitySchemes = {
          'access-token': {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT Bearer token for API authentication',
          },
        };

        // Add global tags with descriptions
        this.openApiSpec.tags = [
          {
            name: 'Authentication',
            description: 'User authentication and session management endpoints',
          },
          {
            name: 'Tasks',
            description: 'Task management operations with contract validation',
          },
          {
            name: 'Users',
            description: 'User profile and management with CASL authorization',
          },
          {
            name: 'Health',
            description: 'Service health monitoring and readiness checks',
          },
          {
            name: 'Queue',
            description: 'BullMQ job processing and queue management',
          },
          {
            name: 'WebSocket',
            description: 'Real-time communication via Socket.IO (documented separately)',
          },
        ];

        this.logger.log('OpenAPI specification generated successfully');
      }
    } catch (error) {
      this.logger.error('Failed to generate OpenAPI specification:', error);
      throw error;
    }
  }

  /**
   * Get the generated OpenAPI specification
   */
  getOpenApiSpec(): OpenAPISpec | null {
    return this.openApiSpec;
  }

  /**
   * Generate TypeScript client code for API consumers
   */
  async generateTypeScriptClient(): Promise<string | null> {
    try {
      this.logger.log('Generating TypeScript client code...');

      // Define client API methods based on endpoints
      // Filter out unsupported HTTP methods for TypeScript client generation
      const supportedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
      const clientMethods: ClientApiMethod[] = this.endpointMetadata
        .filter(endpoint => supportedMethods.includes(endpoint.method as any))
        .map(endpoint => ({
          name: endpoint.operationId || this.generateOperationId(endpoint.path, endpoint.method),
          httpMethod: endpoint.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
          path: endpoint.path,
          requestType: endpoint.requestBodyContract ?
            this.sanitizeTypeName(endpoint.requestBodyContract.name) : undefined,
          responseType: endpoint.responseContract ?
            this.sanitizeTypeName(endpoint.responseContract.name) : 'void',
          description: endpoint.summary,
        }));

      // Generate client using existing TypeScriptGenerator
      const clientCode = this.typeScriptGenerator.generateClientApi(
        'CCTaskManagerBackend',
        clientMethods,
        {
          baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
          clientApiGeneration: true,
        }
      );

      this.logger.log('TypeScript client code generated successfully');
      return clientCode;
    } catch (error) {
      this.logger.error('Failed to generate TypeScript client:', error);
      return null;
    }
  }

  /**
   * Generate all TypeScript types for contracts
   */
  async generateAllTypeScriptTypes(): Promise<Map<string, any>> {
    try {
      this.logger.log('Generating TypeScript types for all contracts...');

      const types = this.typeScriptGenerator.generateAllContractTypes({
        exportType: 'named',
        includeComments: true,
        includeImports: true,
        outputFormat: 'interface',
      });

      this.logger.log(`Generated TypeScript types for ${types.size} contracts`);
      return types;
    } catch (error) {
      this.logger.error('Failed to generate TypeScript types:', error);
      return new Map();
    }
  }

  /**
   * Export OpenAPI spec to file
   */
  async exportOpenApiSpec(format: 'json' | 'yaml' = 'json'): Promise<string> {
    if (!this.openApiSpec) {
      await this.generateOpenApiSpecification();
    }

    if (!this.openApiSpec) {
      throw new Error('Failed to generate OpenAPI specification');
    }

    if (format === 'json') {
      return JSON.stringify(this.openApiSpec, null, 2);
    } else {
      // For YAML export, would need to use a YAML library
      // For now, return JSON
      this.logger.warn('YAML export not implemented, returning JSON');
      return JSON.stringify(this.openApiSpec, null, 2);
    }
  }

  /**
   * Helper to generate operation ID from path and method
   */
  private generateOperationId(path: string, method: string): string {
    return method.toLowerCase() + path
      .split('/')
      .filter(segment => segment && !segment.startsWith('{'))
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('');
  }

  /**
   * Helper to sanitize type names
   */
  private sanitizeTypeName(name: string): string {
    return name
      .split(/[-_\s]+/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  /**
   * Refresh documentation when contracts change
   */
  async refreshDocumentation(): Promise<void> {
    this.logger.log('Refreshing API documentation...');

    // Clear any caches
    this.typeScriptGenerator.clearCache();

    // Regenerate endpoint metadata if needed
    this.defineEndpointMetadata();

    // Regenerate OpenAPI spec
    await this.generateOpenApiSpecification();

    this.logger.log('API documentation refreshed successfully');
  }
}