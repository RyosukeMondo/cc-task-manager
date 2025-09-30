import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ContractValidationErrorDetails } from '@contracts/ContractValidationPipe';

/**
 * Contract Validation Exception Filter
 *
 * Specialized filter for handling contract validation errors from the existing
 * ContractValidationPipe infrastructure. Provides enhanced error formatting
 * and development-time debugging information.
 *
 * This filter extends the existing contract validation error handling from
 * src/contracts/ to provide backend-specific enhancements while maintaining
 * consistency with the SSOT error response patterns.
 *
 * Features:
 * - Enhanced error messages for contract validation failures
 * - Development-time hints for fixing validation issues
 * - Correlation ID tracking integrated with contract errors
 * - Preserves existing ContractValidationErrorDetails structure
 *
 * SOLID Principles:
 * - Single Responsibility: Specifically handles contract validation errors
 * - Open/Closed: Extends existing error handling without modifying it
 * - Dependency Inversion: Depends on contract error abstractions
 */
@Catch(BadRequestException)
export class ContractValidationFilter implements ExceptionFilter {
  private readonly logger = new Logger(ContractValidationFilter.name);
  private readonly isDevelopment = process.env.NODE_ENV !== 'production';

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const exceptionResponse = exception.getResponse();

    // Check if this is a contract validation error from existing infrastructure
    if (!this.isContractValidationError(exceptionResponse)) {
      // Not a contract error, let other filters handle it
      throw exception;
    }

    const correlationId = this.getCorrelationId(request);
    const contractError = exceptionResponse as ContractValidationErrorDetails;

    // Enhance the error response with backend-specific details
    const enhancedResponse = this.enhanceContractError(
      contractError,
      request,
      correlationId
    );

    // Log the contract validation failure
    this.logContractValidationError(contractError, request, correlationId);

    response
      .status(HttpStatus.BAD_REQUEST)
      .header('X-Correlation-Id', correlationId)
      .header('X-Contract-Name', contractError.contract.name)
      .header('X-Contract-Version', contractError.contract.version)
      .json(enhancedResponse);
  }

  private isContractValidationError(response: any): boolean {
    return response && response.error === 'ContractValidationError';
  }

  private getCorrelationId(request: Request): string {
    return (request.headers['x-correlation-id'] as string) ||
           (request.headers['x-request-id'] as string) ||
           request['correlationId'] ||
           randomUUID();
  }

  private enhanceContractError(
    contractError: ContractValidationErrorDetails,
    request: Request,
    correlationId: string
  ): any {
    const enhanced: any = {
      ...contractError,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
    };

    // Add development-time debugging information
    if (this.isDevelopment) {
      enhanced.debug = {
        hints: this.generateValidationHints(contractError),
        requestBody: this.sanitizeRequestBody(request.body),
        requestQuery: request.query,
        requestParams: request.params,
        contractRegistry: this.getContractRegistryInfo(contractError),
      };
    }

    // Add links to documentation if available
    enhanced.documentation = this.getDocumentationLinks(contractError);

    return enhanced;
  }

  private generateValidationHints(error: ContractValidationErrorDetails): string[] {
    const hints: string[] = [];

    hints.push(`Contract: ${error.contract.name}@${error.contract.version}`);
    hints.push(`Validation location: ${error.location}`);

    if (error.issues && Array.isArray(error.issues)) {
      hints.push('Validation issues:');
      error.issues.forEach(issue => {
        hints.push(`  - ${issue}`);
      });
    }

    hints.push('Debugging tips:');
    hints.push('  1. Check the contract schema definition');
    hints.push('  2. Verify your request payload matches the schema');
    hints.push('  3. Use the Swagger UI at /api/docs to test the endpoint');
    hints.push('  4. Review the contract in the ContractRegistry');

    return hints;
  }

  private sanitizeRequestBody(body: any): any {
    if (!body) return undefined;

    // Remove sensitive fields from request body for logging
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private getContractRegistryInfo(error: ContractValidationErrorDetails): any {
    return {
      contractName: error.contract.name,
      contractVersion: error.contract.version,
      registryEndpoint: '/api/contracts',
      schemaEndpoint: `/api/contracts/${error.contract.name}/${error.contract.version}`,
    };
  }

  private getDocumentationLinks(error: ContractValidationErrorDetails): any {
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;

    return {
      swaggerUI: `${baseUrl}/api/docs`,
      contractSchema: `${baseUrl}/api/contracts/${error.contract.name}/${error.contract.version}`,
      apiDocumentation: `${baseUrl}/api/docs#/${error.contract.name}`,
    };
  }

  private logContractValidationError(
    error: ContractValidationErrorDetails,
    request: Request,
    correlationId: string
  ): void {
    const logContext = {
      correlationId,
      contract: error.contract,
      location: error.location,
      path: request.path,
      method: request.method,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    // Add user context if available
    if (request['user']) {
      logContext['userId'] = request['user']['id'] || request['user']['sub'];
    }

    this.logger.warn(
      `Contract validation failed: ${error.contract.name}@${error.contract.version} at ${error.location}`,
      logContext
    );

    // Log detailed issues in development
    if (this.isDevelopment && error.issues) {
      error.issues.forEach(issue => {
        this.logger.debug(`  Validation issue: ${issue}`);
      });
    }
  }
}