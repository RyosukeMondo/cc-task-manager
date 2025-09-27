import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ContractRegistry } from '@contracts/ContractRegistry';
import { ApiContractGenerator } from '@contracts/ApiContractGenerator';
import { ContractValidationPipe } from '@contracts/ContractValidationPipe';
import { AppController } from './app.controller';
import { AppService } from './app.service';

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
    
    // Structured logging with Pino
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV === 'production' 
          ? undefined 
          : {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: true,
                ignore: 'pid,hostname',
              },
            },
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            headers: {
              'user-agent': req.headers['user-agent'],
              'content-type': req.headers['content-type'],
            },
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
  ],
  
  controllers: [AppController],
  
  providers: [
    AppService,
    
    // Existing contract infrastructure providers
    // Following Dependency Inversion Principle - depend on abstractions
    ContractRegistry,
    ApiContractGenerator,
    ContractValidationPipe,
  ],
  
  // Export contract services for other modules to use
  // Demonstrates Interface Segregation Principle
  exports: [
    ContractRegistry,
    ApiContractGenerator,
    ContractValidationPipe,
  ],
})
export class AppModule {
  /**
   * Module initialization demonstrating existing contract integration
   * Shows how the backend leverages existing SSOT infrastructure
   */
  constructor(
    private readonly contractRegistry: ContractRegistry,
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
      // Log successful integration with existing contract system
      const existingContracts = this.contractRegistry.getContractNames();
      console.log(`🔗 Backend module initialized with access to ${existingContracts.length} existing contracts`);
      console.log(`📋 Available contracts: ${existingContracts.join(', ')}`);
      console.log(`✅ Successfully integrated with existing contract-driven infrastructure`);
      
    } catch (error) {
      console.error('❌ Failed to initialize contract integration:', error);
      // Graceful degradation - don't fail application startup
    }
  }
}