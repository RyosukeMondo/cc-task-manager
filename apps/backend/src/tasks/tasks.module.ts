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
import { QueueModule } from '../queue/queue.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { CaslAbilityFactory } from '../auth/casl-ability.factory';
import { ScheduleModule } from '@nestjs/schedule';

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
    QueueModule, // Import QueueModule to use QueueService
    WebSocketModule, // Import WebSocketModule for real-time events
    ScheduleModule.forRoot(), // Enable scheduled tasks for performance monitoring
  ],
  controllers: [TaskController],
  providers: [
    TasksService,
    TasksRepository,
    TaskEventsService,
    TaskOwnershipGuard,
    TaskPerformanceMiddleware,
    TaskPerformanceService,
    CaslAbilityFactory,

    // Leverage existing contract validation infrastructure
    // These are registered in the root AppModule and available globally
    ContractRegistry,
    ContractValidationPipe,
    BackendSchemaRegistry,
  ],
  exports: [TasksService, TasksRepository, TaskEventsService, TaskPerformanceService],
})
export class TasksModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply performance middleware to all task routes
    consumer
      .apply(TaskPerformanceMiddleware)
      .forRoutes('tasks');
  }
}