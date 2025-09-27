import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ContractRegistry } from '../../../../src/contracts/ContractRegistry';
import {
  UserEntitySchema,
  TaskEntitySchema,
  ProjectEntitySchema,
  UserSessionEntitySchema,
  CreateUserInputSchema,
  UpdateUserInputSchema,
  CreateTaskInputSchema,
  UpdateTaskInputSchema,
  CreateProjectInputSchema,
  UpdateProjectInputSchema,
  UserFilterSchema,
  TaskFilterSchema,
  ProjectFilterSchema,
  PaginationSchema,
  UserSortSchema,
  TaskSortSchema,
  ProjectSortSchema,
} from './entities/database.schemas';

/**
 * Database Schema Registry
 * Integrates database schemas with existing ContractRegistry for SSOT
 * Following Single Responsibility Principle - focused on database schema registration
 * 
 * Purpose:
 * - Register database entity schemas with existing ContractRegistry
 * - Ensure contract-database synchronization
 * - Provide centralized schema management for database operations
 * - Maintain SSOT principle across contract and database layers
 */
@Injectable()
export class DatabaseSchemaRegistry implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSchemaRegistry.name);
  private registeredSchemas: string[] = [];

  constructor(private readonly contractRegistry: ContractRegistry) {}

  /**
   * Register all database schemas with the existing ContractRegistry
   * Executed during module initialization
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Registering database schemas with ContractRegistry');
      
      // Register entity schemas
      await this.registerEntitySchemas();
      
      // Register input/output schemas
      await this.registerInputOutputSchemas();
      
      // Register query schemas
      await this.registerQuerySchemas();
      
      this.logger.log(`Successfully registered ${this.registeredSchemas.length} database schemas`);
      this.logger.debug('Registered schemas:', this.registeredSchemas);
      
    } catch (error) {
      this.logger.error('Failed to register database schemas', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Register entity schemas representing database models
   */
  private async registerEntitySchemas(): Promise<void> {
    this.logger.debug('Registering entity schemas');
    
    // User entity schema
    await this.contractRegistry.registerContract(
      'UserEntity', 
      '1.0.0',
      UserEntitySchema,
      {
        description: 'Database user entity schema aligned with Prisma User model',
      }
    );
    this.registeredSchemas.push('UserEntity');
    
    // Task entity schema
    await this.contractRegistry.registerContract(
      'TaskEntity',
      '1.0.0',
      TaskEntitySchema,
      {
        description: 'Database task entity schema aligned with Prisma Task model',
      }
    );
    this.registeredSchemas.push('TaskEntity');
    
    // Project entity schema
    await this.contractRegistry.registerContract(
      'ProjectEntity',
      '1.0.0',
      ProjectEntitySchema,
      {
        description: 'Database project entity schema aligned with Prisma Project model',
      }
    );
    this.registeredSchemas.push('ProjectEntity');
    
    // User session entity schema
    await this.contractRegistry.registerContract(
      'UserSessionEntity',
      '1.0.0',
      UserSessionEntitySchema,
      {
        description: 'Database user session entity schema aligned with Prisma UserSession model',
      }
    );
    this.registeredSchemas.push('UserSessionEntity');
    
    this.logger.debug('Entity schemas registered successfully');
  }

  /**
   * Register input/output schemas for database operations
   */
  private async registerInputOutputSchemas(): Promise<void> {
    this.logger.debug('Registering input/output schemas');
    
    // User input schemas
    await this.contractRegistry.registerContract(
      'CreateUserInput',
      '1.0.0',
      CreateUserInputSchema,
      {
        description: 'Input schema for creating users in database',
      }
    );
    this.registeredSchemas.push('CreateUserInput');
    
    await this.contractRegistry.registerContract(
      'UpdateUserInput',
      '1.0.0',
      UpdateUserInputSchema,
      {
        description: 'Input schema for updating users in database',
      }
    );
    this.registeredSchemas.push('UpdateUserInput');
    
    // Task input schemas
    await this.contractRegistry.registerContract(
      'CreateTaskInput',
      '1.0.0',
      CreateTaskInputSchema,
      {
        description: 'Input schema for creating tasks in database',
      }
    );
    this.registeredSchemas.push('CreateTaskInput');
    
    await this.contractRegistry.registerContract(
      'UpdateTaskInput',
      '1.0.0',
      UpdateTaskInputSchema,
      {
        description: 'Input schema for updating tasks in database',
      }
    );
    this.registeredSchemas.push('UpdateTaskInput');
    
    // Project input schemas
    await this.contractRegistry.registerContract(
      'CreateProjectInput',
      '1.0.0',
      CreateProjectInputSchema,
      {
        description: 'Input schema for creating projects in database',
      }
    );
    this.registeredSchemas.push('CreateProjectInput');
    
    await this.contractRegistry.registerContract(
      'UpdateProjectInput',
      '1.0.0',
      UpdateProjectInputSchema,
      {
        description: 'Input schema for updating projects in database',
      }
    );
    this.registeredSchemas.push('UpdateProjectInput');
    
    this.logger.debug('Input/output schemas registered successfully');
  }

  /**
   * Register query schemas for database filtering and pagination
   */
  private async registerQuerySchemas(): Promise<void> {
    this.logger.debug('Registering query schemas');
    
    // Filter schemas
    await this.contractRegistry.registerContract(
      'UserFilter',
      '1.0.0',
      UserFilterSchema,
      {
        description: 'Filter schema for user database queries',
      }
    );
    this.registeredSchemas.push('UserFilter');
    
    await this.contractRegistry.registerContract(
      'TaskFilter',
      '1.0.0',
      TaskFilterSchema,
      {
        description: 'Filter schema for task database queries',
      }
    );
    this.registeredSchemas.push('TaskFilter');
    
    await this.contractRegistry.registerContract(
      'ProjectFilter',
      '1.0.0',
      ProjectFilterSchema,
      {
        description: 'Filter schema for project database queries',
      }
    );
    this.registeredSchemas.push('ProjectFilter');
    
    // Sort schemas
    await this.contractRegistry.registerContract(
      'UserSort',
      '1.0.0',
      UserSortSchema,
      {
        description: 'Sort schema for user database queries',
      }
    );
    this.registeredSchemas.push('UserSort');
    
    await this.contractRegistry.registerContract(
      'TaskSort',
      '1.0.0',
      TaskSortSchema,
      {
        description: 'Sort schema for task database queries',
      }
    );
    this.registeredSchemas.push('TaskSort');
    
    await this.contractRegistry.registerContract(
      'ProjectSort',
      '1.0.0',
      ProjectSortSchema,
      {
        description: 'Sort schema for project database queries',
      }
    );
    this.registeredSchemas.push('ProjectSort');
    
    // Pagination schema
    await this.contractRegistry.registerContract(
      'Pagination',
      '1.0.0',
      PaginationSchema,
      {
        description: 'Pagination schema for database queries',
      }
    );
    this.registeredSchemas.push('Pagination');
    
    this.logger.debug('Query schemas registered successfully');
  }

  /**
   * Get list of registered database schemas
   */
  getRegisteredSchemas(): string[] {
    return [...this.registeredSchemas];
  }

  /**
   * Validate that database schemas are properly synchronized with ContractRegistry
   */
  async validateSynchronization(): Promise<{
    isValid: boolean;
    missingSchemas: string[];
    registeredCount: number;
  }> {
    try {
      this.logger.debug('Validating database schema synchronization');
      
      const allContracts = this.contractRegistry.getContractNames();
      const expectedSchemas = this.registeredSchemas;
      const missingSchemas = expectedSchemas.filter(schema => !allContracts.includes(schema));
      
      const isValid = missingSchemas.length === 0;
      
      this.logger.debug('Schema synchronization validation result', {
        isValid,
        registeredCount: expectedSchemas.length,
        missingCount: missingSchemas.length,
        missingSchemas,
      });
      
      return {
        isValid,
        missingSchemas,
        registeredCount: expectedSchemas.length,
      };
    } catch (error) {
      this.logger.error('Failed to validate schema synchronization', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get schema statistics for monitoring
   */
  getSchemaStatistics(): {
    totalRegistered: number;
    entitySchemas: number;
    inputSchemas: number;
    querySchemas: number;
    timestamp: Date;
  } {
    const entitySchemas = this.registeredSchemas.filter(name => 
      name.endsWith('Entity')
    ).length;
    
    const inputSchemas = this.registeredSchemas.filter(name => 
      name.includes('Input') || name.includes('Create') || name.includes('Update')
    ).length;
    
    const querySchemas = this.registeredSchemas.filter(name => 
      name.includes('Filter') || name.includes('Sort') || name.includes('Pagination')
    ).length;
    
    return {
      totalRegistered: this.registeredSchemas.length,
      entitySchemas,
      inputSchemas,
      querySchemas,
      timestamp: new Date(),
    };
  }
}