import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ContractRegistry } from '../../../../src/contracts/ContractRegistry';

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