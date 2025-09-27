import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

/**
 * Application root controller demonstrating contract-driven development
 * 
 * Follows SOLID principles:
 * - Single Responsibility: Handle application-level endpoints
 * - Interface Segregation: Minimal, focused interface
 * - Dependency Inversion: Depends on AppService abstraction
 */
@ApiTags('Application')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check endpoint demonstrating contract integration
   */
  @Get()
  @ApiOperation({
    summary: 'Application health check',
    description: 'Returns application status and contract registry information',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is running with contract infrastructure',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        message: { type: 'string' },
        contractsAvailable: { type: 'number' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  getHealth(): {
    status: string;
    message: string;
    contractsAvailable: number;
    timestamp: string;
  } {
    return this.appService.getHealth();
  }

  /**
   * Contract information endpoint demonstrating SSOT principle
   */
  @Get('contracts')
  @ApiOperation({
    summary: 'List available contracts',
    description: 'Returns information about registered contracts in the system',
  })
  @ApiResponse({
    status: 200,
    description: 'List of registered contracts',
    schema: {
      type: 'object',
      properties: {
        contracts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              versions: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  })
  getContracts(): {
    contracts: Array<{ name: string; versions: string[] }>;
    total: number;
  } {
    return this.appService.getContractsInfo();
  }
}