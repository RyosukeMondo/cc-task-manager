import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ContractRegistry } from '@contracts/ContractRegistry';

// Import all backend-specific schemas
import {
  UserRegistrationSchema,
  UserLoginSchema,
  JwtPayloadSchema,
  AuthResponseSchema,
  TokenRefreshSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  UserProfileUpdateSchema,
} from './auth.schemas';

import {
  TaskCreateSchema,
  TaskUpdateSchema,
  TaskResponseSchema,
  TaskListQuerySchema,
  TaskListResponseSchema,
  TaskCommentSchema,
  TaskCommentCreateSchema,
  TaskTimeEntrySchema,
  TaskTimeEntryCreateSchema,
} from './task.schemas';

import {
  UserResponseSchema,
  UserCreateSchema,
  UserUpdateSchema,
  UserListQuerySchema,
  UserListResponseSchema,
  PasswordChangeSchema,
  EmailVerificationSchema,
  UserPermissionSchema,
  UserSessionSchema,
  UserActivitySchema,
} from './user.schemas';

import {
  ProjectCreateSchema,
  ProjectUpdateSchema,
  ProjectResponseSchema,
  ProjectListQuerySchema,
  ProjectListResponseSchema,
  ProjectMemberSchema,
  ProjectMemberInviteSchema,
  ProjectMemberUpdateSchema,
  ProjectMilestoneSchema,
  ProjectMilestoneCreateSchema,
  ProjectMilestoneUpdateSchema,
} from './project.schemas';

/**
 * Schema Registry Service
 *
 * Extends existing ContractRegistry with backend-specific schemas
 * Follows SOLID principles:
 * - Single Responsibility: Manages backend schema registration only
 * - Open/Closed: Extensible for new schemas without modification
 * - Dependency Inversion: Depends on ContractRegistry abstraction
 *
 * Leverages existing contract infrastructure as SSOT foundation
 */
@Injectable()
export class SchemaRegistryService implements OnModuleInit {
  private readonly logger = new Logger(SchemaRegistryService.name);

  constructor(private readonly contractRegistry: ContractRegistry) {}

  /**
   * Initialize backend schemas on module startup
   * Registers all backend-specific contracts with existing ContractRegistry
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.registerAllSchemas();
      this.logger.log('✅ Backend schema registration completed successfully');
    } catch (error) {
      this.logger.error('❌ Failed to register backend schemas:', error);
      throw error;
    }
  }

  /**
   * Register all backend schemas with the existing ContractRegistry
   * Extends SSOT contract infrastructure with backend-specific validation
   */
  private async registerAllSchemas(): Promise<void> {
    const registrationPromises = [
      // Authentication schemas
      this.registerAuthSchemas(),

      // Task management schemas
      this.registerTaskSchemas(),

      // User management schemas
      this.registerUserSchemas(),

      // Project management schemas
      this.registerProjectSchemas(),
    ];

    await Promise.all(registrationPromises);
  }

  /**
   * Register authentication-related schemas
   */
  private async registerAuthSchemas(): Promise<void> {
    const authSchemas = [
      { name: 'UserRegistration', version: '1.0.0', schema: UserRegistrationSchema },
      { name: 'UserLogin', version: '1.0.0', schema: UserLoginSchema },
      { name: 'JwtPayload', version: '1.0.0', schema: JwtPayloadSchema },
      { name: 'AuthResponse', version: '1.0.0', schema: AuthResponseSchema },
      { name: 'TokenRefresh', version: '1.0.0', schema: TokenRefreshSchema },
      { name: 'PasswordResetRequest', version: '1.0.0', schema: PasswordResetRequestSchema },
      { name: 'PasswordResetConfirm', version: '1.0.0', schema: PasswordResetConfirmSchema },
      { name: 'UserProfileUpdate', version: '1.0.0', schema: UserProfileUpdateSchema },
    ];

    for (const { name, version, schema } of authSchemas) {
      await this.contractRegistry.registerContract(name, version, schema, {
        name,
        version,
        description: `Authentication schema for ${name}`,
        compatibleVersions: ['1.0.0'],
      });
    }

    this.logger.log(`📋 Registered ${authSchemas.length} authentication schemas`);
  }

  /**
   * Register task management schemas
   */
  private async registerTaskSchemas(): Promise<void> {
    const taskSchemas = [
      { name: 'TaskCreate', version: '1.0.0', schema: TaskCreateSchema },
      { name: 'TaskUpdate', version: '1.0.0', schema: TaskUpdateSchema },
      { name: 'TaskResponse', version: '1.0.0', schema: TaskResponseSchema },
      { name: 'TaskListQuery', version: '1.0.0', schema: TaskListQuerySchema },
      { name: 'TaskListResponse', version: '1.0.0', schema: TaskListResponseSchema },
      { name: 'TaskComment', version: '1.0.0', schema: TaskCommentSchema },
      { name: 'TaskCommentCreate', version: '1.0.0', schema: TaskCommentCreateSchema },
      { name: 'TaskTimeEntry', version: '1.0.0', schema: TaskTimeEntrySchema },
      { name: 'TaskTimeEntryCreate', version: '1.0.0', schema: TaskTimeEntryCreateSchema },
    ];

    for (const { name, version, schema } of taskSchemas) {
      await this.contractRegistry.registerContract(name, version, schema, {
        name,
        version,
        description: `Task management schema for ${name}`,
        compatibleVersions: ['1.0.0'],
      });
    }

    this.logger.log(`📋 Registered ${taskSchemas.length} task management schemas`);
  }

  /**
   * Register user management schemas
   */
  private async registerUserSchemas(): Promise<void> {
    const userSchemas = [
      { name: 'UserResponse', version: '1.0.0', schema: UserResponseSchema },
      { name: 'UserCreate', version: '1.0.0', schema: UserCreateSchema },
      { name: 'UserUpdate', version: '1.0.0', schema: UserUpdateSchema },
      { name: 'UserListQuery', version: '1.0.0', schema: UserListQuerySchema },
      { name: 'UserListResponse', version: '1.0.0', schema: UserListResponseSchema },
      { name: 'PasswordChange', version: '1.0.0', schema: PasswordChangeSchema },
      { name: 'EmailVerification', version: '1.0.0', schema: EmailVerificationSchema },
      { name: 'UserPermission', version: '1.0.0', schema: UserPermissionSchema },
      { name: 'UserSession', version: '1.0.0', schema: UserSessionSchema },
      { name: 'UserActivity', version: '1.0.0', schema: UserActivitySchema },
    ];

    for (const { name, version, schema } of userSchemas) {
      await this.contractRegistry.registerContract(name, version, schema, {
        name,
        version,
        description: `User management schema for ${name}`,
        compatibleVersions: ['1.0.0'],
      });
    }

    this.logger.log(`📋 Registered ${userSchemas.length} user management schemas`);
  }

  /**
   * Register project management schemas
   */
  private async registerProjectSchemas(): Promise<void> {
    const projectSchemas = [
      { name: 'ProjectCreate', version: '1.0.0', schema: ProjectCreateSchema },
      { name: 'ProjectUpdate', version: '1.0.0', schema: ProjectUpdateSchema },
      { name: 'ProjectResponse', version: '1.0.0', schema: ProjectResponseSchema },
      { name: 'ProjectListQuery', version: '1.0.0', schema: ProjectListQuerySchema },
      { name: 'ProjectListResponse', version: '1.0.0', schema: ProjectListResponseSchema },
      { name: 'ProjectMember', version: '1.0.0', schema: ProjectMemberSchema },
      { name: 'ProjectMemberInvite', version: '1.0.0', schema: ProjectMemberInviteSchema },
      { name: 'ProjectMemberUpdate', version: '1.0.0', schema: ProjectMemberUpdateSchema },
      { name: 'ProjectMilestone', version: '1.0.0', schema: ProjectMilestoneSchema },
      { name: 'ProjectMilestoneCreate', version: '1.0.0', schema: ProjectMilestoneCreateSchema },
      { name: 'ProjectMilestoneUpdate', version: '1.0.0', schema: ProjectMilestoneUpdateSchema },
    ];

    for (const { name, version, schema } of projectSchemas) {
      await this.contractRegistry.registerContract(name, version, schema, {
        name,
        version,
        description: `Project management schema for ${name}`,
        compatibleVersions: ['1.0.0'],
      });
    }

    this.logger.log(`📋 Registered ${projectSchemas.length} project management schemas`);
  }

  /**
   * Get all registered backend contract names
   * Useful for testing and verification
   */
  getRegisteredSchemas(): string[] {
    return this.contractRegistry.getContractNames().filter(name =>
      this.isBackendSchema(name)
    );
  }

  /**
   * Check if a contract name belongs to backend schemas
   */
  private isBackendSchema(contractName: string): boolean {
    const backendSchemaPatterns = [
      /^User/,
      /^Task/,
      /^Project/,
      /^Auth/,
      /^Password/,
      /^Email/,
      /^Jwt/,
      /^Token/,
    ];

    return backendSchemaPatterns.some(pattern => pattern.test(contractName));
  }

  /**
   * Validate data against a registered backend schema
   * Convenience method for backend-specific validation
   */
  async validateData(schemaName: string, data: unknown): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.contractRegistry.validateAgainstContract(schemaName, '1.0.0', data);
  }
}