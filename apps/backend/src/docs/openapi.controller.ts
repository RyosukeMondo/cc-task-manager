import {
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { OpenApiDocumentationService } from './openapi.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * OpenAPI Documentation Controller
 *
 * Provides endpoints for accessing API documentation,
 * exporting specifications, and generating client code.
 *
 * This controller extends the existing documentation infrastructure
 * by providing convenient access points for developers and tools.
 */
@ApiTags('Documentation')
@Controller('api/docs')
export class OpenApiController {
  constructor(private readonly openApiService: OpenApiDocumentationService) {}

  /**
   * Get OpenAPI specification in JSON format
   * Public endpoint for API consumers and tools
   */
  @Get('openapi.json')
  @Public()
  @Header('Content-Type', 'application/json')
  @ApiOperation({
    summary: 'Get OpenAPI specification',
    description: 'Returns the complete OpenAPI 3.0 specification in JSON format',
  })
  @ApiResponse({
    status: 200,
    description: 'OpenAPI specification',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            openapi: { type: 'string', example: '3.0.0' },
            info: { type: 'object' },
            paths: { type: 'object' },
            components: { type: 'object' },
          },
        },
      },
    },
  })
  async getOpenApiJson(): Promise<any> {
    const spec = this.openApiService.getOpenApiSpec();

    if (!spec) {
      throw new HttpException(
        'OpenAPI specification not available',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    return spec;
  }

  /**
   * Export OpenAPI specification in specified format
   * Supports JSON and YAML formats
   */
  @Get('export')
  @Public()
  @ApiOperation({
    summary: 'Export OpenAPI specification',
    description: 'Export the OpenAPI specification in JSON or YAML format',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'yaml'],
    description: 'Export format (defaults to json)',
  })
  @ApiResponse({
    status: 200,
    description: 'Exported OpenAPI specification',
  })
  async exportOpenApi(
    @Query('format') format: 'json' | 'yaml' = 'json'
  ): Promise<string> {
    try {
      return await this.openApiService.exportOpenApiSpec(format);
    } catch (error) {
      throw new HttpException(
        `Failed to export OpenAPI specification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Generate TypeScript client code
   * Requires authentication for security
   */
  @Get('typescript-client')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Header('Content-Type', 'text/plain')
  @ApiOperation({
    summary: 'Generate TypeScript client',
    description: 'Generate TypeScript client code for consuming the API',
  })
  @ApiResponse({
    status: 200,
    description: 'Generated TypeScript client code',
    content: {
      'text/plain': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  async generateTypeScriptClient(): Promise<string> {
    const clientCode = await this.openApiService.generateTypeScriptClient();

    if (!clientCode) {
      throw new HttpException(
        'Failed to generate TypeScript client',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    return clientCode;
  }

  /**
   * Generate TypeScript types for all contracts
   * Returns a JSON map of contract names to generated types
   */
  @Get('typescript-types')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Generate TypeScript types',
    description: 'Generate TypeScript type definitions for all registered contracts',
  })
  @ApiResponse({
    status: 200,
    description: 'Map of contract names to TypeScript types',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              types: { type: 'string' },
              imports: { type: 'array', items: { type: 'string' } },
              exports: { type: 'array', items: { type: 'string' } },
              metadata: { type: 'object' },
            },
          },
        },
      },
    },
  })
  async generateTypeScriptTypes(): Promise<Record<string, any>> {
    const types = await this.openApiService.generateAllTypeScriptTypes();

    // Convert Map to object for JSON serialization
    const result: Record<string, any> = {};
    types.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }

  /**
   * Refresh API documentation
   * Triggers regeneration of all documentation from current contracts
   */
  @Get('refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Refresh documentation',
    description: 'Regenerate API documentation from current contract definitions',
  })
  @ApiResponse({
    status: 200,
    description: 'Documentation refreshed successfully',
  })
  async refreshDocumentation(): Promise<{ message: string; timestamp: Date }> {
    try {
      await this.openApiService.refreshDocumentation();

      return {
        message: 'API documentation refreshed successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        `Failed to refresh documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get documentation metadata
   * Returns information about the documentation system
   */
  @Get('metadata')
  @Public()
  @ApiOperation({
    summary: 'Get documentation metadata',
    description: 'Returns metadata about the documentation system and registered contracts',
  })
  @ApiResponse({
    status: 200,
    description: 'Documentation metadata',
  })
  getDocumentationMetadata(): any {
    const spec = this.openApiService.getOpenApiSpec();

    if (!spec) {
      return {
        status: 'unavailable',
        message: 'OpenAPI specification not yet generated',
      };
    }

    const pathCount = Object.keys(spec.paths || {}).length;
    const schemaCount = Object.keys(spec.components?.schemas || {}).length;
    const tagCount = spec.tags?.length || 0;

    return {
      status: 'available',
      version: spec.info.version,
      title: spec.info.title,
      statistics: {
        endpoints: pathCount,
        schemas: schemaCount,
        tags: tagCount,
      },
      servers: spec.servers,
      documentation: {
        swaggerUi: '/api/docs',
        openApiJson: '/api/docs/openapi.json',
        export: '/api/docs/export',
        typeScriptClient: '/api/docs/typescript-client',
        typeScriptTypes: '/api/docs/typescript-types',
      },
    };
  }
}