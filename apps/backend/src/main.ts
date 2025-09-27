import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ContractRegistry } from '@contracts/ContractRegistry';
import { ApiContractGenerator } from '@contracts/ApiContractGenerator';
import { ContractValidationPipe } from '@contracts/ContractValidationPipe';

/**
 * Bootstrap function for contract-driven backend application
 * 
 * This function demonstrates:
 * 1. Leveraging existing ContractRegistry for SSOT principle
 * 2. Using existing ContractValidationPipe for runtime validation
 * 3. Integrating existing ApiContractGenerator for documentation
 * 4. Following SOLID principles with dependency injection
 * 5. Maintaining clean architecture with separation of concerns
 */
async function bootstrap() {
  // Create NestJS application with buffered logs
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Apply Dependency Inversion Principle - inject logger
  app.useLogger(app.get(Logger));
  
  // Get configuration service for environment-based settings
  const configService = app.get(ConfigService);
  
  // Apply Interface Segregation Principle - separate validation concerns
  // Use existing contract validation infrastructure
  const contractRegistry = app.get(ContractRegistry);
  
  // Set up global validation using existing contract infrastructure
  // This follows Single Responsibility Principle - validation is centralized
  app.useGlobalPipes(
    new ContractValidationPipe(contractRegistry), // Use existing validation pipe
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    })
  );

  // Apply Open/Closed Principle - extend existing documentation without modification
  await setupApiDocumentation(app, contractRegistry);

  // Enable graceful shutdown for clean resource management
  app.enableShutdownHooks();

  // Start the application
  const port = configService.get('PORT', 3001); // Different port from main app
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Contract-driven backend application started on port ${port}`, 'Bootstrap');
  logger.log(`API documentation available at: http://localhost:${port}/api/docs`, 'Bootstrap');
  logger.log(`Using existing contract registry with ${contractRegistry.getContractNames().length} registered contracts`, 'Bootstrap');
}

/**
 * Set up API documentation using existing ApiContractGenerator
 * 
 * Demonstrates:
 * - Leveraging existing SSOT documentation infrastructure
 * - Following Liskov Substitution Principle with compatible interfaces
 * - Maintaining consistency with existing documentation patterns
 */
async function setupApiDocumentation(app: any, contractRegistry: ContractRegistry) {
  try {
    // Use existing ApiContractGenerator for consistent documentation
    const apiGenerator = app.get(ApiContractGenerator);
    
    // Build Swagger configuration extending existing patterns
    const config = new DocumentBuilder()
      .setTitle('CC Task Manager Backend API')
      .setDescription(
        'Contract-driven backend API leveraging existing SSOT infrastructure. ' +
        'This backend extends the existing contract system with specialized endpoints ' +
        'for authentication, task management, user operations, and real-time communication.'
      )
      .setVersion('1.0.0')
      .addTag('Authentication', 'JWT-based authentication with CASL authorization')
      .addTag('Tasks', 'Task management with contract-validated operations')
      .addTag('Users', 'User management with authorization integration')
      .addTag('WebSocket', 'Real-time communication with type-safe events')
      .addTag('Health', 'Health checks and system monitoring')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token for API authentication',
        },
        'access-token',
      )
      .addServer(`http://localhost:${process.env.PORT || 3001}`, 'Development server')
      .build();

    // Generate OpenAPI document using existing infrastructure
    const document = SwaggerModule.createDocument(app, config);
    
    // Enhance with contract schemas from existing registry
    if (apiGenerator && typeof apiGenerator.generateOpenApiDocument === 'function') {
      const contractDocument = await apiGenerator.generateOpenApiDocument(contractRegistry);
      
      // Merge existing contract schemas with backend-specific documentation
      document.components = {
        ...document.components,
        schemas: {
          ...document.components?.schemas,
          ...contractDocument.components?.schemas,
        },
      };
    }

    // Set up Swagger UI with enhanced configuration
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'list',
        filter: true,
        tryItOutEnabled: true,
      },
      customSiteTitle: 'CC Task Manager Backend API - Contract-Driven Documentation',
    });

    console.log(`📚 Backend API documentation configured using existing contract infrastructure`);
    
  } catch (error) {
    console.error('Failed to set up API documentation:', error);
    // Don't fail startup - graceful degradation
  }
}

// Error handling following existing patterns
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the application
bootstrap().catch((error) => {
  console.error('Failed to start backend application:', error);
  process.exit(1);
});