import { Module } from '@nestjs/common';
import { OpenApiDocumentationService } from './openapi.service';
import { OpenApiController } from './openapi.controller';
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
    // Import these from the app module instead of recreating them
    BackendSchemaRegistry,
  ],
  controllers: [OpenApiController],
  exports: [OpenApiDocumentationService],
})
export class OpenApiModule {}