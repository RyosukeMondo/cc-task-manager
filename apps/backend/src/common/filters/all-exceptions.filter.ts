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

/**
 * All Exceptions Filter
 *
 * Catch-all filter for handling any unhandled exceptions in the application.
 * This ensures that all errors are properly formatted and logged, even if they
 * don't match specific exception types.
 *
 * This filter extends the existing error handling patterns to provide a safety
 * net for unexpected errors while maintaining the SSOT error response format.
 *
 * Features:
 * - Handles all unhandled exceptions (non-HTTP exceptions)
 * - Provides safe error responses in production
 * - Detailed error information in development
 * - Correlation ID tracking for all errors
 * - Security-safe error messages
 *
 * SOLID Principles:
 * - Single Responsibility: Catch-all for unhandled exceptions
 * - Open/Closed: Can be extended for specific error types
 * - Interface Segregation: Implements minimal exception filter interface
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isDevelopment = process.env.NODE_ENV !== 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // If it's an HTTP exception, let the HTTP filter handle it
    if (exception instanceof HttpException) {
      throw exception;
    }

    const correlationId = this.getCorrelationId(request);
    const errorResponse = this.buildErrorResponse(exception, request, correlationId);

    // Log the unexpected error
    this.logError(exception, errorResponse, request);

    response
      .status(errorResponse.statusCode)
      .header('X-Correlation-Id', correlationId)
      .json(errorResponse);
  }

  private getCorrelationId(request: Request): string {
    return (request.headers['x-correlation-id'] as string) ||
           (request.headers['x-request-id'] as string) ||
           request['correlationId'] ||
           randomUUID();
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request,
    correlationId: string
  ): any {
    const timestamp = new Date().toISOString();
    const path = request.path;
    const method = request.method;

    // Handle different types of errors
    if (this.isNodeError(exception)) {
      return this.handleNodeError(exception as NodeJS.ErrnoException, {
        correlationId,
        timestamp,
        path,
        method,
      });
    }

    if (this.isDatabaseError(exception)) {
      return this.handleDatabaseError(exception, {
        correlationId,
        timestamp,
        path,
        method,
      });
    }

    if (this.isValidationError(exception)) {
      return this.handleValidationError(exception, {
        correlationId,
        timestamp,
        path,
        method,
      });
    }

    // Default error response for unknown errors
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: this.isDevelopment
        ? this.extractErrorMessage(exception)
        : 'An unexpected error occurred',
      correlationId,
      timestamp,
      path,
      method,
      details: this.isDevelopment ? this.extractErrorDetails(exception) : undefined,
    };
  }

  private isNodeError(exception: unknown): boolean {
    return exception instanceof Error && 'code' in exception;
  }

  private isDatabaseError(exception: unknown): boolean {
    // Check for common database error indicators
    if (exception instanceof Error) {
      const message = exception.message.toLowerCase();
      return message.includes('database') ||
             message.includes('connection') ||
             message.includes('query') ||
             message.includes('transaction') ||
             exception.constructor.name.includes('Prisma');
    }
    return false;
  }

  private isValidationError(exception: unknown): boolean {
    if (exception instanceof Error) {
      const message = exception.message.toLowerCase();
      return message.includes('validation') ||
             message.includes('invalid') ||
             message.includes('required');
    }
    return false;
  }

  private handleNodeError(
    error: NodeJS.ErrnoException,
    context: any
  ): any {
    const statusCode = this.mapNodeErrorToStatus(error.code);

    return {
      statusCode,
      error: this.mapNodeErrorToMessage(error.code),
      message: this.isDevelopment ? error.message : 'System error occurred',
      ...context,
      details: this.isDevelopment ? {
        code: error.code,
        syscall: error.syscall,
        path: error.path,
      } : undefined,
    };
  }

  private handleDatabaseError(exception: unknown, context: any): any {
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Database Error',
      message: this.isDevelopment
        ? this.extractErrorMessage(exception)
        : 'Database operation failed',
      ...context,
      details: this.isDevelopment ? {
        type: 'database',
        originalError: this.extractErrorDetails(exception),
      } : undefined,
    };
  }

  private handleValidationError(exception: unknown, context: any): any {
    return {
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      error: 'Validation Error',
      message: this.extractErrorMessage(exception),
      ...context,
      details: this.isDevelopment ? this.extractErrorDetails(exception) : undefined,
    };
  }

  private mapNodeErrorToStatus(code?: string): number {
    const statusMap: Record<string, number> = {
      'ENOENT': HttpStatus.NOT_FOUND,
      'EACCES': HttpStatus.FORBIDDEN,
      'EEXIST': HttpStatus.CONFLICT,
      'EINVAL': HttpStatus.BAD_REQUEST,
      'ETIMEDOUT': HttpStatus.REQUEST_TIMEOUT,
      'ECONNREFUSED': HttpStatus.SERVICE_UNAVAILABLE,
    };

    return statusMap[code || ''] || HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private mapNodeErrorToMessage(code?: string): string {
    const messageMap: Record<string, string> = {
      'ENOENT': 'Resource Not Found',
      'EACCES': 'Access Denied',
      'EEXIST': 'Resource Already Exists',
      'EINVAL': 'Invalid Request',
      'ETIMEDOUT': 'Request Timeout',
      'ECONNREFUSED': 'Service Unavailable',
    };

    return messageMap[code || ''] || 'System Error';
  }

  private extractErrorMessage(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.message;
    }
    if (typeof exception === 'string') {
      return exception;
    }
    if (exception && typeof exception === 'object' && 'message' in exception) {
      return String(exception.message);
    }
    return 'An unexpected error occurred';
  }

  private extractErrorDetails(exception: unknown): any {
    if (!this.isDevelopment) {
      return undefined;
    }

    if (exception instanceof Error) {
      return {
        name: exception.name,
        message: exception.message,
        stack: exception.stack?.split('\n').slice(0, 5), // Limit stack trace
      };
    }

    if (exception && typeof exception === 'object') {
      // Safely extract properties without exposing sensitive data
      const safeProperties = ['name', 'code', 'type', 'statusCode'];
      const details: any = {};

      for (const prop of safeProperties) {
        if (prop in exception) {
          details[prop] = exception[prop as keyof typeof exception];
        }
      }

      return Object.keys(details).length > 0 ? details : exception;
    }

    return { raw: String(exception) };
  }

  private logError(
    exception: unknown,
    errorResponse: any,
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

    // Add user context if available
    if (request['user']) {
      logContext['userId'] = request['user']['id'] || request['user']['sub'];
    }

    // Log the full error with stack trace
    if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        logContext
      );
    } else {
      this.logger.error(
        `Unhandled exception: ${this.extractErrorMessage(exception)}`,
        logContext
      );
    }

    // In development, log additional details
    if (this.isDevelopment) {
      this.logger.debug('Exception details:', exception);
    }
  }
}