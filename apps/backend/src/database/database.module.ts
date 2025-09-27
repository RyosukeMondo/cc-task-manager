import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { UserRepository } from './repositories/user.repository';
import { TaskRepository } from './repositories/task.repository';
import { ProjectRepository } from './repositories/project.repository';
import { DatabaseSchemaRegistry } from './database-schema-registry';

// Repository interface tokens for dependency injection
export const USER_REPOSITORY = 'USER_REPOSITORY';
export const TASK_REPOSITORY = 'TASK_REPOSITORY';
export const PROJECT_REPOSITORY = 'PROJECT_REPOSITORY';

/**
 * Database Module providing Prisma integration with repository pattern
 * Following Dependency Inversion Principle with interface-based dependencies
 * 
 * Features:
 * - Type-safe database operations using Prisma ORM
 * - Repository pattern for data access abstraction
 * - Contract-aligned Zod schemas for validation
 * - Global module for easy access across the application
 * - Proper connection lifecycle management
 * - Database transaction support
 * - Health check capabilities
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    // Core Prisma service for database connectivity
    PrismaService,
    
    // Repository implementations
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: TASK_REPOSITORY,
      useClass: TaskRepository,
    },
    {
      provide: PROJECT_REPOSITORY,
      useClass: ProjectRepository,
    },
    
    // Concrete repository classes for direct injection
    UserRepository,
    TaskRepository,
    ProjectRepository,
    
    // Database schema registry for contract integration
    DatabaseSchemaRegistry,
  ],
  exports: [
    // Export Prisma service for direct access when needed
    PrismaService,
    
    // Export repository tokens for interface-based injection
    USER_REPOSITORY,
    TASK_REPOSITORY,
    PROJECT_REPOSITORY,
    
    // Export concrete repository classes
    UserRepository,
    TaskRepository,
    ProjectRepository,
    
    // Export schema registry for contract integration
    DatabaseSchemaRegistry,
  ],
})
export class DatabaseModule {
  /**
   * Static method to create module with custom configuration
   * Allows for easy testing and development customization
   */
  static forRoot(options?: {
    global?: boolean;
    skipMigrations?: boolean;
    logLevel?: 'query' | 'info' | 'warn' | 'error';
  }) {
    return {
      module: DatabaseModule,
      global: options?.global ?? true,
      providers: [
        {
          provide: 'DATABASE_OPTIONS',
          useValue: options || {},
        },
      ],
    };
  }
}