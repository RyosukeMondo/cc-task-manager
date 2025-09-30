import { Module } from '@nestjs/common';
import { OpenApiDocumentationService } from './openapi.service';
import { OpenApiController } from './openapi.controller';
import { ContractRegistry } from '@contracts/ContractRegistry';
import { ApiContractGenerator } from '@contracts/ApiContractGenerator';
// import { TypeScriptGenerator } from '@contracts/generators/TypeScriptGenerator'; // TODO: Implement this
import { BackendSchemaRegistry } from '../schemas/schema-registry';

/**
 * OpenAPI Documentation Module
 *
 * Provides comprehensive API documentation using the existing
 * contract infrastructure. This module follows the SOLID principles
 * by leveraging existing services without recreating functionality.
 *
 * Features:
 * - Interactive Swagger UI at /api/docs
 * - OpenAPI JSON/YAML export endpoints
 * - TypeScript client generation
 * - Real-time documentation updates
 */
@Module({
  providers: [
    OpenApiDocumentationService,
    ContractRegistry,
    ApiContractGenerator,
    // TypeScriptGenerator, // TODO: Implement this
    BackendSchemaRegistry,
  ],
  controllers: [OpenApiController],
  exports: [OpenApiDocumentationService],
})
export class OpenApiModule {}