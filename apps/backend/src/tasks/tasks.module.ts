import { Module } from '@nestjs/common';
import { ContractRegistry } from '../../../../src/contracts/ContractRegistry';
import { ContractValidationPipe } from '../../../../src/contracts/ContractValidationPipe';
import { BackendSchemaRegistry } from '../schemas/schema-registry';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { QueueModule } from '../queue/queue.module';
import { WebSocketModule } from '../websocket/websocket.module';

/**
 * Task Management Module
 * 
 * Implements comprehensive task management functionality following SOLID principles:
 * 
 * 1. Single Responsibility Principle:
 *    - TasksController: HTTP request/response handling
 *    - TasksService: Business logic and validation
 *    - TasksRepository: Data access layer abstraction
 * 
 * 2. Dependency Inversion Principle:
 *    - Depends on ContractRegistry abstraction for validation
 *    - Uses existing ContractValidationPipe for runtime validation
 * 
 * 3. Open/Closed Principle:
 *    - Extensible for new task features without modifying existing code
 *    - Repository pattern allows for easy database implementation changes
 * 
 * 4. Interface Segregation Principle:
 *    - Imports only needed contract validation services
 *    - Clean separation between HTTP, business, and data layers
 */
@Module({
  imports: [
    QueueModule, // Import QueueModule to use QueueService
    WebSocketModule, // Import WebSocketModule for real-time event emission
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    TasksRepository,
    
    // Leverage existing contract validation infrastructure
    // These are registered in the root AppModule and available globally
    ContractRegistry,
    ContractValidationPipe,
    BackendSchemaRegistry,
  ],
  exports: [TasksService, TasksRepository],
})
export class TasksModule {}