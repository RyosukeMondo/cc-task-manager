import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ContractRegistry } from '@contracts/ContractRegistry';

// Import all auth schemas
import {
  UserBaseSchema,
  UserRegistrationSchema,
  LoginRequestSchema,
  JWTPayloadSchema,
  AuthResponseSchema,
  TokenRefreshSchema,
  PasswordChangeSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  UserSessionSchema,
  PermissionSchema,
  RolePermissionsSchema,
} from './auth.schemas';

// Import all task schemas
import {
  TaskBaseSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskQueryFiltersSchema,
  TaskCommentSchema,
  CreateTaskCommentSchema,
  UpdateTaskCommentSchema,
  TaskAttachmentSchema,
  TaskTimeLogSchema,
  CreateTaskTimeLogSchema,
  TaskStatisticsSchema,
  BulkTaskOperationSchema,
} from './task.schemas';

// Import all user schemas
import {
  UserPreferencesSchema,
  UserAvatarSchema,
  UserProfileSchema,
  UpdateUserProfileSchema,
  UserQueryFiltersSchema,
  AdminCreateUserSchema,
  AdminUpdateUserSchema,
  UserActivityLogSchema,
  UserInvitationSchema,
  CreateUserInvitationSchema,
  AcceptUserInvitationSchema,
  UserStatisticsSchema,
} from './user.schemas';

// Import all database schemas
import { DatabaseSchemas } from './database.schemas';

// Import all analytics schemas
import {
  PerformanceMetricsSchema,
  KPIDataSchema,
  ChartDataSchema,
  TimeSeriesDataSchema,
  DateRangeSchema,
  AnalyticsFilterSchema,
  AnalyticsResponseSchema,
} from '@cc-task-manager/schemas';

// Import all queue schemas
import {
  TaskNotificationJobSchema,
  EmailJobSchema,
  ReportGenerationJobSchema,
  DataExportJobSchema,
  ScheduledTaskJobSchema,
  WebhookDeliveryJobSchema,
  QueueJobSchema,
  JobOptionsSchema,
  QueueMetricsSchema,
} from '../queue/queue.schemas';

/**
 * Backend Schema Registry Service
 * 
 * Registers all backend-specific schemas with the existing ContractRegistry
 * to maintain SSOT (Single Source of Truth) principle for contract validation.
 * 
 * This service extends the existing contract infrastructure without recreating it,
 * following the SOLID principles and leveraging the existing ApiContractGenerator
 * for automatic OpenAPI documentation generation.
 */
@Injectable()
export class BackendSchemaRegistry implements OnModuleInit {
  private readonly logger = new Logger(BackendSchemaRegistry.name);

  constructor(private readonly contractRegistry: ContractRegistry) {}

  /**
   * Initialize and register all backend schemas on module initialization
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Registering backend schemas with ContractRegistry...');

    try {
      await this.registerAuthSchemas();
      await this.registerTaskSchemas();
      await this.registerUserSchemas();
      await this.registerAnalyticsSchemas();
      await this.registerDatabaseSchemas();
      await this.registerQueueSchemas();

      this.logger.log('Successfully registered all backend schemas');
    } catch (error) {
      this.logger.error('Failed to register backend schemas:', error);
      throw error;
    }
  }

  /**
   * Register authentication-related schemas
   */
  private async registerAuthSchemas(): Promise<void> {
    const authSchemas = [
      {
        name: 'UserBase',
        version: '1.0.0',
        schema: UserBaseSchema,
        description: 'Base user schema with common user properties',
      },
      {
        name: 'UserRegistration',
        version: '1.0.0',
        schema: UserRegistrationSchema,
        description: 'User registration request schema',
      },
      {
        name: 'LoginRequest',
        version: '1.0.0',
        schema: LoginRequestSchema,
        description: 'User login request schema',
      },
      {
        name: 'JWTPayload',
        version: '1.0.0',
        schema: JWTPayloadSchema,
        description: 'JWT token payload schema for authentication',
      },
      {
        name: 'AuthResponse',
        version: '1.0.0',
        schema: AuthResponseSchema,
        description: 'Authentication response schema with tokens',
      },
      {
        name: 'TokenRefresh',
        version: '1.0.0',
        schema: TokenRefreshSchema,
        description: 'Token refresh request schema',
      },
      {
        name: 'PasswordChange',
        version: '1.0.0',
        schema: PasswordChangeSchema,
        description: 'Password change request schema',
      },
      {
        name: 'PasswordResetRequest',
        version: '1.0.0',
        schema: PasswordResetRequestSchema,
        description: 'Password reset request schema',
      },
      {
        name: 'PasswordResetConfirm',
        version: '1.0.0',
        schema: PasswordResetConfirmSchema,
        description: 'Password reset confirmation schema',
      },
      {
        name: 'UserSession',
        version: '1.0.0',
        schema: UserSessionSchema,
        description: 'User session management schema',
      },
      {
        name: 'Permission',
        version: '1.0.0',
        schema: PermissionSchema,
        description: 'CASL permission schema for authorization',
      },
      {
        name: 'RolePermissions',
        version: '1.0.0',
        schema: RolePermissionsSchema,
        description: 'Role-based permissions schema',
      },
    ];

    for (const schemaConfig of authSchemas) {
      const success = await this.contractRegistry.registerContract(
        schemaConfig.name,
        schemaConfig.version,
        schemaConfig.schema,
        {
          name: schemaConfig.name,
          version: schemaConfig.version,
          description: schemaConfig.description,
        }
      );

      if (!success) {
        throw new Error(`Failed to register auth schema: ${schemaConfig.name}`);
      }
    }

    this.logger.log(`Registered ${authSchemas.length} authentication schemas`);
  }

  /**
   * Register task management schemas
   */
  private async registerTaskSchemas(): Promise<void> {
    const taskSchemas = [
      {
        name: 'TaskBase',
        version: '1.0.0',
        schema: TaskBaseSchema,
        description: 'Base task schema with common task properties',
      },
      {
        name: 'CreateTask',
        version: '1.0.0',
        schema: CreateTaskSchema,
        description: 'Task creation request schema',
      },
      {
        name: 'UpdateTask',
        version: '1.0.0',
        schema: UpdateTaskSchema,
        description: 'Task update request schema',
      },
      {
        name: 'TaskQueryFilters',
        version: '1.0.0',
        schema: TaskQueryFiltersSchema,
        description: 'Task query filters for searching and filtering',
      },
      {
        name: 'TaskComment',
        version: '1.0.0',
        schema: TaskCommentSchema,
        description: 'Task comment schema for discussions',
      },
      {
        name: 'CreateTaskComment',
        version: '1.0.0',
        schema: CreateTaskCommentSchema,
        description: 'Task comment creation request schema',
      },
      {
        name: 'UpdateTaskComment',
        version: '1.0.0',
        schema: UpdateTaskCommentSchema,
        description: 'Task comment update request schema',
      },
      {
        name: 'TaskAttachment',
        version: '1.0.0',
        schema: TaskAttachmentSchema,
        description: 'Task attachment schema for file uploads',
      },
      {
        name: 'TaskTimeLog',
        version: '1.0.0',
        schema: TaskTimeLogSchema,
        description: 'Task time log schema for time tracking',
      },
      {
        name: 'CreateTaskTimeLog',
        version: '1.0.0',
        schema: CreateTaskTimeLogSchema,
        description: 'Task time log creation request schema',
      },
      {
        name: 'TaskStatistics',
        version: '1.0.0',
        schema: TaskStatisticsSchema,
        description: 'Task statistics schema for reporting',
      },
      {
        name: 'BulkTaskOperation',
        version: '1.0.0',
        schema: BulkTaskOperationSchema,
        description: 'Bulk task operation schema for batch operations',
      },
    ];

    for (const schemaConfig of taskSchemas) {
      const success = await this.contractRegistry.registerContract(
        schemaConfig.name,
        schemaConfig.version,
        schemaConfig.schema,
        {
          name: schemaConfig.name,
          version: schemaConfig.version,
          description: schemaConfig.description,
        }
      );

      if (!success) {
        throw new Error(`Failed to register task schema: ${schemaConfig.name}`);
      }
    }

    this.logger.log(`Registered ${taskSchemas.length} task management schemas`);
  }

  /**
   * Register user management schemas
   */
  private async registerUserSchemas(): Promise<void> {
    const userSchemas = [
      {
        name: 'UserPreferences',
        version: '1.0.0',
        schema: UserPreferencesSchema,
        description: 'User preferences and settings schema',
      },
      {
        name: 'UserAvatar',
        version: '1.0.0',
        schema: UserAvatarSchema,
        description: 'User avatar file management schema',
      },
      {
        name: 'UserProfile',
        version: '1.0.0',
        schema: UserProfileSchema,
        description: 'Extended user profile schema with preferences',
      },
      {
        name: 'UpdateUserProfile',
        version: '1.0.0',
        schema: UpdateUserProfileSchema,
        description: 'User profile update request schema',
      },
      {
        name: 'UserQueryFilters',
        version: '1.0.0',
        schema: UserQueryFiltersSchema,
        description: 'User query filters for searching and filtering',
      },
      {
        name: 'AdminCreateUser',
        version: '1.0.0',
        schema: AdminCreateUserSchema,
        description: 'Admin user creation request schema',
      },
      {
        name: 'AdminUpdateUser',
        version: '1.0.0',
        schema: AdminUpdateUserSchema,
        description: 'Admin user update request schema',
      },
      {
        name: 'UserActivityLog',
        version: '1.0.0',
        schema: UserActivityLogSchema,
        description: 'User activity audit log schema',
      },
      {
        name: 'UserInvitation',
        version: '1.0.0',
        schema: UserInvitationSchema,
        description: 'User invitation management schema',
      },
      {
        name: 'CreateUserInvitation',
        version: '1.0.0',
        schema: CreateUserInvitationSchema,
        description: 'User invitation creation request schema',
      },
      {
        name: 'AcceptUserInvitation',
        version: '1.0.0',
        schema: AcceptUserInvitationSchema,
        description: 'User invitation acceptance schema',
      },
      {
        name: 'UserStatistics',
        version: '1.0.0',
        schema: UserStatisticsSchema,
        description: 'User statistics schema for admin dashboard',
      },
    ];

    for (const schemaConfig of userSchemas) {
      const success = await this.contractRegistry.registerContract(
        schemaConfig.name,
        schemaConfig.version,
        schemaConfig.schema,
        {
          name: schemaConfig.name,
          version: schemaConfig.version,
          description: schemaConfig.description,
        }
      );

      if (!success) {
        throw new Error(`Failed to register user schema: ${schemaConfig.name}`);
      }
    }

    this.logger.log(`Registered ${userSchemas.length} user management schemas`);
  }

  /**
   * Register analytics schemas for performance metrics and reporting
   */
  private async registerAnalyticsSchemas(): Promise<void> {
    const analyticsSchemas = [
      {
        name: 'PerformanceMetrics',
        version: '1.0.0',
        schema: PerformanceMetricsSchema,
        description: 'Performance metrics schema for task completion analytics',
      },
      {
        name: 'KPIData',
        version: '1.0.0',
        schema: KPIDataSchema,
        description: 'Key performance indicator data schema with trend tracking',
      },
      {
        name: 'ChartData',
        version: '1.0.0',
        schema: ChartDataSchema,
        description: 'Chart data schema for visualization components',
      },
      {
        name: 'TimeSeriesData',
        version: '1.0.0',
        schema: TimeSeriesDataSchema,
        description: 'Time series data point schema for trend analysis',
      },
      {
        name: 'DateRange',
        version: '1.0.0',
        schema: DateRangeSchema,
        description: 'Date range schema for time-based filtering',
      },
      {
        name: 'AnalyticsFilter',
        version: '1.0.0',
        schema: AnalyticsFilterSchema,
        description: 'Analytics filter schema for query parameters',
      },
      {
        name: 'AnalyticsResponse',
        version: '1.0.0',
        schema: AnalyticsResponseSchema,
        description: 'Complete analytics response schema with metrics, charts, and KPIs',
      },
    ];

    for (const schemaConfig of analyticsSchemas) {
      const success = await this.contractRegistry.registerContract(
        schemaConfig.name,
        schemaConfig.version,
        schemaConfig.schema,
        {
          name: schemaConfig.name,
          version: schemaConfig.version,
          description: schemaConfig.description,
        }
      );

      if (!success) {
        throw new Error(`Failed to register analytics schema: ${schemaConfig.name}`);
      }
    }

    this.logger.log(`Registered ${analyticsSchemas.length} analytics schemas`);
  }

  /**
   * Register database schemas that mirror Prisma models
   */
  private async registerDatabaseSchemas(): Promise<void> {
    const databaseSchemas = [
      // Entity schemas
      {
        name: 'DatabaseUser',
        version: '1.0.0',
        schema: DatabaseSchemas.DatabaseUser,
        description: 'Database user entity schema mirroring Prisma User model',
      },
      {
        name: 'DatabaseTask',
        version: '1.0.0',
        schema: DatabaseSchemas.DatabaseTask,
        description: 'Database task entity schema mirroring Prisma Task model',
      },
      {
        name: 'DatabaseProject',
        version: '1.0.0',
        schema: DatabaseSchemas.DatabaseProject,
        description: 'Database project entity schema mirroring Prisma Project model',
      },
      {
        name: 'DatabaseUserSession',
        version: '1.0.0',
        schema: DatabaseSchemas.DatabaseUserSession,
        description: 'Database user session entity schema mirroring Prisma UserSession model',
      },
      
      // Create schemas
      {
        name: 'CreateDatabaseUser',
        version: '1.0.0',
        schema: DatabaseSchemas.CreateDatabaseUser,
        description: 'Database user creation schema for repository operations',
      },
      {
        name: 'CreateDatabaseTask',
        version: '1.0.0',
        schema: DatabaseSchemas.CreateDatabaseTask,
        description: 'Database task creation schema for repository operations',
      },
      {
        name: 'CreateDatabaseProject',
        version: '1.0.0',
        schema: DatabaseSchemas.CreateDatabaseProject,
        description: 'Database project creation schema for repository operations',
      },
      {
        name: 'CreateDatabaseUserSession',
        version: '1.0.0',
        schema: DatabaseSchemas.CreateDatabaseUserSession,
        description: 'Database user session creation schema for repository operations',
      },
      
      // Update schemas
      {
        name: 'UpdateDatabaseUser',
        version: '1.0.0',
        schema: DatabaseSchemas.UpdateDatabaseUser,
        description: 'Database user update schema for repository operations',
      },
      {
        name: 'UpdateDatabaseTask',
        version: '1.0.0',
        schema: DatabaseSchemas.UpdateDatabaseTask,
        description: 'Database task update schema for repository operations',
      },
      {
        name: 'UpdateDatabaseProject',
        version: '1.0.0',
        schema: DatabaseSchemas.UpdateDatabaseProject,
        description: 'Database project update schema for repository operations',
      },
      {
        name: 'UpdateDatabaseUserSession',
        version: '1.0.0',
        schema: DatabaseSchemas.UpdateDatabaseUserSession,
        description: 'Database user session update schema for repository operations',
      },
      
      // Relationship schemas
      {
        name: 'DatabaseUserWithRelations',
        version: '1.0.0',
        schema: DatabaseSchemas.DatabaseUserWithRelations,
        description: 'Database user with relationships schema for complex queries',
      },
      {
        name: 'DatabaseTaskWithRelations',
        version: '1.0.0',
        schema: DatabaseSchemas.DatabaseTaskWithRelations,
        description: 'Database task with relationships schema for complex queries',
      },
      {
        name: 'DatabaseProjectWithRelations',
        version: '1.0.0',
        schema: DatabaseSchemas.DatabaseProjectWithRelations,
        description: 'Database project with relationships schema for complex queries',
      },
      
      // Query filter schemas
      {
        name: 'DatabaseUserQueryFilters',
        version: '1.0.0',
        schema: DatabaseSchemas.DatabaseUserQueryFilters,
        description: 'Database user query filters for repository search operations',
      },
      {
        name: 'DatabaseTaskQueryFilters',
        version: '1.0.0',
        schema: DatabaseSchemas.DatabaseTaskQueryFilters,
        description: 'Database task query filters for repository search operations',
      },
      {
        name: 'DatabaseProjectQueryFilters',
        version: '1.0.0',
        schema: DatabaseSchemas.DatabaseProjectQueryFilters,
        description: 'Database project query filters for repository search operations',
      },
      
      // Utility schemas
      {
        name: 'DatabasePagination',
        version: '1.0.0',
        schema: DatabaseSchemas.DatabasePagination,
        description: 'Database pagination schema for paginated queries',
      },
      {
        name: 'DatabaseTransactionContext',
        version: '1.0.0',
        schema: DatabaseSchemas.DatabaseTransactionContext,
        description: 'Database transaction context schema for transaction management',
      },
      {
        name: 'DatabaseHealthCheck',
        version: '1.0.0',
        schema: DatabaseSchemas.DatabaseHealthCheck,
        description: 'Database health check schema for monitoring',
      },
      
      // Enum schemas
      {
        name: 'UserRole',
        version: '1.0.0',
        schema: DatabaseSchemas.UserRole,
        description: 'User role enumeration schema',
      },
      {
        name: 'UserStatus',
        version: '1.0.0',
        schema: DatabaseSchemas.UserStatus,
        description: 'User status enumeration schema',
      },
      {
        name: 'TaskStatus',
        version: '1.0.0',
        schema: DatabaseSchemas.TaskStatus,
        description: 'Task status enumeration schema',
      },
      {
        name: 'TaskPriority',
        version: '1.0.0',
        schema: DatabaseSchemas.TaskPriority,
        description: 'Task priority enumeration schema',
      },
    ];

    for (const schemaConfig of databaseSchemas) {
      const success = await this.contractRegistry.registerContract(
        schemaConfig.name,
        schemaConfig.version,
        schemaConfig.schema,
        {
          name: schemaConfig.name,
          version: schemaConfig.version,
          description: schemaConfig.description,
        }
      );

      if (!success) {
        throw new Error(`Failed to register database schema: ${schemaConfig.name}`);
      }
    }

    this.logger.log(`Registered ${databaseSchemas.length} database schemas`);
  }

  /**
   * Register queue-related schemas for BullMQ job processing
   */
  private async registerQueueSchemas(): Promise<void> {
    const queueSchemas = [
      {
        name: 'TaskNotificationJob',
        version: '1.0.0',
        schema: TaskNotificationJobSchema,
        description: 'Task notification job schema for queue processing',
      },
      {
        name: 'EmailJob',
        version: '1.0.0',
        schema: EmailJobSchema,
        description: 'Email job schema for queue processing',
      },
      {
        name: 'ReportGenerationJob',
        version: '1.0.0',
        schema: ReportGenerationJobSchema,
        description: 'Report generation job schema for queue processing',
      },
      {
        name: 'DataExportJob',
        version: '1.0.0',
        schema: DataExportJobSchema,
        description: 'Data export job schema for queue processing',
      },
      {
        name: 'ScheduledTaskJob',
        version: '1.0.0',
        schema: ScheduledTaskJobSchema,
        description: 'Scheduled task job schema for queue processing',
      },
      {
        name: 'WebhookDeliveryJob',
        version: '1.0.0',
        schema: WebhookDeliveryJobSchema,
        description: 'Webhook delivery job schema for queue processing',
      },
      {
        name: 'QueueJob',
        version: '1.0.0',
        schema: QueueJobSchema,
        description: 'Union type for all queue job types',
      },
      {
        name: 'JobOptions',
        version: '1.0.0',
        schema: JobOptionsSchema,
        description: 'BullMQ job options configuration schema',
      },
      {
        name: 'QueueMetrics',
        version: '1.0.0',
        schema: QueueMetricsSchema,
        description: 'Queue metrics schema for monitoring and reporting',
      },
    ];

    for (const schemaConfig of queueSchemas) {
      const success = await this.contractRegistry.registerContract(
        schemaConfig.name,
        schemaConfig.version,
        schemaConfig.schema,
        {
          name: schemaConfig.name,
          version: schemaConfig.version,
          description: schemaConfig.description,
        }
      );

      if (!success) {
        throw new Error(`Failed to register queue schema: ${schemaConfig.name}`);
      }
    }

    this.logger.log(`Registered ${queueSchemas.length} queue schemas`);
  }

  /**
   * Get all registered backend schema names
   * 
   * @returns Array of registered schema names
   */
  getRegisteredSchemas(): string[] {
    return this.contractRegistry.getContractNames();
  }

  /**
   * Validate data against a specific backend schema
   * 
   * @param schemaName Schema name to validate against
   * @param data Data to validate
   * @returns Validation result
   */
  validateAgainstSchema(schemaName: string, data: unknown): { success: boolean; error?: string; data?: any } {
    return this.contractRegistry.validateAgainstContract(schemaName, '1.0.0', data);
  }

  /**
   * Get schema by name for dynamic usage
   * 
   * @param schemaName Schema name
   * @returns Contract registration or undefined if not found
   */
  getSchema(schemaName: string) {
    return this.contractRegistry.getLatestContract(schemaName);
  }
}