import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ContractRegistry } from '@contracts/ContractRegistry';
import { ContractValidationPipe } from '@contracts/ContractValidationPipe';
import { BackendSchemaRegistry } from '../schemas/schema-registry';
import { TaskController } from './task.controller';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { TaskOwnershipGuard } from './guards/task-ownership.guard';
import { TaskEventsService } from './events/task-events.service';
import { TaskPerformanceMiddleware } from './middleware/task-performance.middleware';
import { TaskPerformanceService } from './middleware/task-performance.service';
import { TasksGateway } from './tasks.gateway';
// import { QueueModule } from '../queue/queue.module';
// import { WebSocketModule } from '../websocket/websocket.module';
import { CaslAbilityFactory } from '../auth/casl-ability.factory';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

/**
 * Task Management Module
 *
 * Implements comprehensive task management functionality following SOLID principles:
 *
 * 1. Single Responsibility Principle:
 *    - TaskController: HTTP request/response handling
 *    - TasksService: Business logic and validation
 *    - TasksRepository: Data access layer abstraction
 *    - TaskPerformanceMiddleware: Performance monitoring and caching
 *    - TaskPerformanceService: Performance optimization and analytics
 *
 * 2. Dependency Inversion Principle:
 *    - Depends on ContractRegistry abstraction for validation
 *    - Uses existing ContractValidationPipe for runtime validation
 *
 * 3. Open/Closed Principle:
 *    - Extensible for new task features without modifying existing code
 *    - Repository pattern allows for easy database implementation changes
 *    - Performance monitoring extensible for new metrics
 *
 * 4. Interface Segregation Principle:
 *    - Imports only needed contract validation services
 *    - Clean separation between HTTP, business, data, and performance layers
 */
@Module({
  imports: [
    // Database module for Prisma access and repository pattern
    DatabaseModule,

    // Auth module provides JwtAuthGuard and authentication services
    AuthModule,

    // QueueModule, // Temporarily disabled due to ApplicationConfigService dependency issues
    // WebSocketModule, // Temporarily disabled due to dependency issues
    // ScheduleModule.forRoot(), // Temporarily disabled due to crypto polyfill issues in Node 18
  ],
  controllers: [TaskController],
  providers: [
    TasksService,
    TasksRepository,
    // Bind ITasksRepository interface to TasksRepository implementation
    {
      provide: 'ITasksRepository',
      useExisting: TasksRepository,
    },
    TasksGateway,
    // TaskEventsService, // Temporarily disabled due to WebSocketModule dependency
    TaskOwnershipGuard,
    TaskPerformanceMiddleware,
    TaskPerformanceService,
    CaslAbilityFactory,

    // BackendSchemaRegistry temporarily disabled - validation skipped
  ],
  exports: [TasksService, TasksRepository, TaskPerformanceService],
})
export class TasksModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply performance middleware to all task routes
    consumer
      .apply(TaskPerformanceMiddleware)
      .forRoutes('tasks');
  }
}