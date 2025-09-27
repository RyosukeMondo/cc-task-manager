import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ContractValidationErrorDetails } from '../../../../../src/contracts/ContractValidationPipe';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  correlationId: string;
  timestamp: string;
  path: string;
  method: string;
  details?: any;
}

/**
 * HTTP Exception Filter
 *
 * Extends existing error handling patterns from src/contracts/ to provide
 * consistent, secure error responses for the backend application.
 *
 * Features:
 * - Correlation ID tracking for request tracing
 * - Security-safe error messages (no sensitive information in production)
 * - Structured error format consistent with ContractValidationPipe
 * - Development vs production error detail handling
 *
 * Follows SOLID principles:
 * - Single Responsibility: Only handles HTTP exceptions
 * - Open/Closed: Extensible for custom error types
 * - Interface Segregation: Focused exception filter interface
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isDevelopment = process.env.NODE_ENV !== 'production';

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Get or generate correlation ID for request tracking
    const correlationId = this.getCorrelationId(request);

    // Build error response extending existing patterns
    const errorResponse = this.buildErrorResponse(
      status,
      exceptionResponse,
      request,
      correlationId
    );

    // Log the error with appropriate level
    this.logError(exception, errorResponse, request);

    // Apply security considerations for production
    const sanitizedResponse = this.sanitizeResponse(errorResponse);

    response
      .status(status)
      .header('X-Correlation-Id', correlationId)
      .json(sanitizedResponse);
  }

  private getCorrelationId(request: Request): string {
    // Check for existing correlation ID from headers or generate new one
    return (request.headers['x-correlation-id'] as string) ||
           (request.headers['x-request-id'] as string) ||
           request['correlationId'] ||
           randomUUID();
  }

  private buildErrorResponse(
    statusCode: number,
    exceptionResponse: string | object,
    request: Request,
    correlationId: string
  ): ErrorResponse {
    // Handle both string and object error responses
    const baseError = typeof exceptionResponse === 'string'
      ? { message: exceptionResponse }
      : exceptionResponse as any;

    // Check if this is a contract validation error from existing infrastructure
    const isContractError = baseError.error === 'ContractValidationError';

    return {
      statusCode,
      error: this.getErrorName(statusCode, baseError),
      message: this.extractMessage(baseError),
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
      details: this.extractDetails(baseError, isContractError)
    };
  }

  private getErrorName(statusCode: number, errorResponse: any): string {
    // Preserve existing contract validation error names
    if (errorResponse.error) {
      return errorResponse.error;
    }

    // Map status codes to error names
    const errorMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
    };

    return errorMap[statusCode] || 'Error';
  }

  private extractMessage(errorResponse: any): string | string[] {
    // Handle various message formats from existing infrastructure
    if (errorResponse.message) {
      return errorResponse.message;
    }
    if (errorResponse.issues) {
      return errorResponse.issues;
    }
    if (Array.isArray(errorResponse)) {
      return errorResponse;
    }
    return 'An error occurred';
  }

  private extractDetails(errorResponse: any, isContractError: boolean): any {
    if (!this.isDevelopment) {
      // In production, only include safe details
      if (isContractError) {
        // Contract errors are safe to expose structure
        return {
          contract: errorResponse.contract,
          location: errorResponse.location
        };
      }
      return undefined;
    }

    // In development, include all details for debugging
    const details: any = {};

    if (isContractError) {
      // Include contract validation details from existing infrastructure
      details.contract = errorResponse.contract;
      details.location = errorResponse.location;
      details.issues = errorResponse.issues;
    }

    // Include validation errors if present
    if (errorResponse.errors) {
      details.validationErrors = errorResponse.errors;
    }

    // Include any additional context
    if (errorResponse.context) {
      details.context = errorResponse.context;
    }

    return Object.keys(details).length > 0 ? details : undefined;
  }

  private sanitizeResponse(response: ErrorResponse): ErrorResponse {
    if (this.isDevelopment) {
      return response;
    }

    // In production, remove sensitive details
    const sanitized = { ...response };

    // Remove detailed error information that could expose internals
    if (sanitized.details) {
      // Keep only safe details like contract info
      const safeDetails: any = {};
      if (sanitized.details.contract) {
        safeDetails.contract = sanitized.details.contract;
      }
      if (sanitized.details.location) {
        safeDetails.location = sanitized.details.location;
      }
      sanitized.details = Object.keys(safeDetails).length > 0 ? safeDetails : undefined;
    }

    // Ensure message doesn't contain sensitive information
    if (typeof sanitized.message === 'string' && sanitized.message.includes('path')) {
      sanitized.message = 'Validation failed';
    }

    return sanitized;
  }

  private logError(
    exception: HttpException,
    errorResponse: ErrorResponse,
    request: Request
  ): void {
    const logContext = {
      correlationId: errorResponse.correlationId,
      statusCode: errorResponse.statusCode,
      path: request.path,
      method: request.method,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    // Add user context if available (from JWT auth)
    if (request['user']) {
      logContext['userId'] = request['user']['id'] || request['user']['sub'];
    }

    // Log based on severity
    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `Internal error: ${errorResponse.message}`,
        exception.stack,
        logContext
      );
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn(
        `Client error: ${errorResponse.message}`,
        logContext
      );
    }
  }
}