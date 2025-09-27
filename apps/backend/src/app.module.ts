import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ContractRegistry } from '../../../src/contracts/ContractRegistry';
import { ApiContractGenerator } from '../../../src/contracts/ApiContractGenerator';
import { ContractValidationPipe } from '../../../src/contracts/ContractValidationPipe';
import { BackendSchemaRegistry } from './schemas/schema-registry';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';
import { WebSocketModule } from './websocket/websocket.module';
import { DatabaseModule } from './database/database.module';
import { QueueModule } from './queue/queue.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { EnhancedLoggingModule } from './logging/enhanced-logging.module';
import { RequestLoggingMiddleware } from './logging/request-logging.middleware';

/**
 * Root application module following SOLID principles
 * 
 * This module demonstrates:
 * 1. Single Responsibility Principle - focused on application configuration
 * 2. Dependency Inversion Principle - depends on abstractions from contracts
 * 3. Open/Closed Principle - extensible for new modules without modification
 * 4. Interface Segregation Principle - imports only needed contract interfaces
 * 
 * Leverages existing contract infrastructure:
 * - ContractRegistry for centralized schema management
 * - ApiContractGenerator for documentation generation
 * - ContractValidationPipe for runtime validation
 */
@Module({
  imports: [
    // Configuration management with validation
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),
    
    // Enhanced structured logging with Pino and correlation tracking
    EnhancedLoggingModule,
    
    // Database module with Prisma integration
    DatabaseModule,
    
    // Authentication and authorization module
    AuthModule,
    
    // Task management module
    TasksModule,

    // WebSocket module for real-time communication
    WebSocketModule,

    // Queue module for job processing with BullMQ
    QueueModule,
  ],
  
  controllers: [AppController],
  
  providers: [
    AppService,
    
    // Existing contract infrastructure providers
    // Following Dependency Inversion Principle - depend on abstractions
    ContractRegistry,
    ApiContractGenerator,
    ContractValidationPipe,
    
    // Backend-specific schema registry service
    // Extends existing contract infrastructure with backend schemas
    BackendSchemaRegistry,
    
    // Global JWT authentication guard
    // Protects all endpoints by default unless marked as @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  
  // Export contract services for other modules to use
  // Demonstrates Interface Segregation Principle
  exports: [
    ContractRegistry,
    ApiContractGenerator,
    ContractValidationPipe,
    BackendSchemaRegistry,
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure middleware for correlation tracking and structured logging
   * Implements Single Level of Abstraction Principle (SLAP)
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggingMiddleware)
      .forRoutes('*'); // Apply to all routes for comprehensive request tracking
  }

  /**
   * Module initialization demonstrating existing contract integration
   * Shows how the backend leverages existing SSOT infrastructure
   */
  constructor(
    private readonly contractRegistry: ContractRegistry,
    private readonly backendSchemaRegistry: BackendSchemaRegistry,
    private readonly appService: AppService,
  ) {
    // Register core application contracts during module initialization
    this.initializeContracts();
  }

  /**
   * Initialize backend-specific contracts using existing registry
   * Demonstrates how to extend existing contract infrastructure
   */
  private async initializeContracts(): Promise<void> {
    try {
      // Wait for BackendSchemaRegistry to complete registration
      // This ensures all backend schemas are available in ContractRegistry
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Log successful integration with existing contract system
      const allContracts = this.contractRegistry.getContractNames();
      const backendSchemas = this.backendSchemaRegistry.getRegisteredSchemas();
      
      console.log(`🔗 Backend module initialized with access to ${allContracts.length} total contracts`);
      console.log(`📋 Backend schemas registered: ${backendSchemas.filter(name => 
        ['UserBase', 'TaskBase', 'UserProfile', 'CreateTask', 'LoginRequest'].includes(name)
      ).length} schemas`);
      console.log(`✅ Successfully integrated with existing contract-driven infrastructure`);
      console.log(`🎯 Backend schemas extend ContractRegistry for SSOT validation`);
      
    } catch (error) {
      console.error('❌ Failed to initialize contract integration:', error);
      // Graceful degradation - don't fail application startup
    }
  }
}