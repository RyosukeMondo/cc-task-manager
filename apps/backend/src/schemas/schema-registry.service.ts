import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ContractRegistry } from '@contracts/ContractRegistry';

// Import all backend-specific schemas
import {
  UserRegistrationSchema,
  LoginRequestSchema,
  JWTPayloadSchema,
  AuthResponseSchema,
  TokenRefreshSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  PasswordChangeSchema,
  UserSessionSchema,
} from './auth.schemas';

import {
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskBaseSchema,
  TaskQueryFiltersSchema,
  TaskCommentSchema,
  CreateTaskCommentSchema,
  UpdateTaskCommentSchema,
  TaskTimeLogSchema,
  CreateTaskTimeLogSchema,
  TaskStatisticsSchema,
} from './task.schemas';

import {
  UserProfileSchema,
  UpdateUserProfileSchema,
  UserQueryFiltersSchema,
  AdminCreateUserSchema,
  AdminUpdateUserSchema,
  UserActivityLogSchema,
  UserInvitationSchema,
  CreateUserInvitationSchema,
  UserStatisticsSchema,
} from './user.schemas';

import {
  SettingsSchema,
  SettingsUpdateSchema,
  UserProfileSchema as SettingsUserProfileSchema,
  AppPreferencesSchema,
  NotificationSettingsSchema,
} from '@schemas/settings';

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

      // Settings schemas
      this.registerSettingsSchemas(),

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
      { name: 'LoginRequest', version: '1.0.0', schema: LoginRequestSchema },
      { name: 'JWTPayload', version: '1.0.0', schema: JWTPayloadSchema },
      { name: 'AuthResponse', version: '1.0.0', schema: AuthResponseSchema },
      { name: 'TokenRefresh', version: '1.0.0', schema: TokenRefreshSchema },
      { name: 'PasswordResetRequest', version: '1.0.0', schema: PasswordResetRequestSchema },
      { name: 'PasswordResetConfirm', version: '1.0.0', schema: PasswordResetConfirmSchema },
      { name: 'PasswordChange', version: '1.0.0', schema: PasswordChangeSchema },
      { name: 'UserSession', version: '1.0.0', schema: UserSessionSchema },
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
      { name: 'CreateTask', version: '1.0.0', schema: CreateTaskSchema },
      { name: 'UpdateTask', version: '1.0.0', schema: UpdateTaskSchema },
      { name: 'TaskBase', version: '1.0.0', schema: TaskBaseSchema },
      { name: 'TaskQueryFilters', version: '1.0.0', schema: TaskQueryFiltersSchema },
      { name: 'TaskComment', version: '1.0.0', schema: TaskCommentSchema },
      { name: 'CreateTaskComment', version: '1.0.0', schema: CreateTaskCommentSchema },
      { name: 'UpdateTaskComment', version: '1.0.0', schema: UpdateTaskCommentSchema },
      { name: 'TaskTimeLog', version: '1.0.0', schema: TaskTimeLogSchema },
      { name: 'CreateTaskTimeLog', version: '1.0.0', schema: CreateTaskTimeLogSchema },
      { name: 'TaskStatistics', version: '1.0.0', schema: TaskStatisticsSchema },
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
      { name: 'UserProfile', version: '1.0.0', schema: UserProfileSchema },
      { name: 'UpdateUserProfile', version: '1.0.0', schema: UpdateUserProfileSchema },
      { name: 'UserQueryFilters', version: '1.0.0', schema: UserQueryFiltersSchema },
      { name: 'AdminCreateUser', version: '1.0.0', schema: AdminCreateUserSchema },
      { name: 'AdminUpdateUser', version: '1.0.0', schema: AdminUpdateUserSchema },
      { name: 'UserActivityLog', version: '1.0.0', schema: UserActivityLogSchema },
      { name: 'UserInvitation', version: '1.0.0', schema: UserInvitationSchema },
      { name: 'CreateUserInvitation', version: '1.0.0', schema: CreateUserInvitationSchema },
      { name: 'UserStatistics', version: '1.0.0', schema: UserStatisticsSchema },
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
   * Register settings schemas
   */
  private async registerSettingsSchemas(): Promise<void> {
    const settingsSchemas = [
      { name: 'Settings', version: '1.0.0', schema: SettingsSchema },
      { name: 'SettingsUpdate', version: '1.0.0', schema: SettingsUpdateSchema },
      { name: 'SettingsUserProfile', version: '1.0.0', schema: SettingsUserProfileSchema },
      { name: 'AppPreferences', version: '1.0.0', schema: AppPreferencesSchema },
      { name: 'NotificationSettings', version: '1.0.0', schema: NotificationSettingsSchema },
    ];

    for (const { name, version, schema } of settingsSchemas) {
      await this.contractRegistry.registerContract(name, version, schema, {
        name,
        version,
        description: `Settings schema for ${name}`,
        compatibleVersions: ['1.0.0'],
      });
    }

    this.logger.log(`📋 Registered ${settingsSchemas.length} settings schemas`);
  }

  /**
   * Register project management schemas (placeholder - implement when project.schemas.ts exists)
   */
  private async registerProjectSchemas(): Promise<void> {
    // Project schemas not yet implemented
    this.logger.log('📋 Project schemas not yet implemented');
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
      /^Settings/,
      /^AppPreferences/,
      /^NotificationSettings/,
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