import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Task-Specific Exception Classes
 *
 * Custom exception classes for task operations following requirements 4.1, 4.2,
 * and error handling requirements. Provides clear, actionable error responses
 * for all task failure scenarios.
 *
 * Follows SOLID principles:
 * - SRP: Each exception class has a focused responsibility
 * - ISP: Specific error interfaces for different error types
 * - OCP: Extensible for new error types without modification
 *
 * Features:
 * - Contract-driven error interfaces with consistent structure
 * - Fail-fast error detection with immediate feedback
 * - Security-safe error messages without internal exposure
 * - User-friendly actionable error responses
 * - Correlation ID support for error tracking
 */

export interface TaskErrorDetails {
  taskId?: string;
  field?: string;
  value?: any;
  constraint?: string;
  context?: Record<string, any>;
}

export interface TaskErrorResponse {
  error: string;
  message: string;
  taskId?: string;
  details?: TaskErrorDetails;
  timestamp?: string;
  correlationId?: string;
}

/**
 * Base Task Exception
 *
 * Abstract base class for all task-related exceptions providing
 * common structure and functionality.
 */
export abstract class TaskException extends HttpException {
  protected constructor(
    public readonly errorType: string,
    message: string,
    statusCode: HttpStatus,
    public readonly taskId?: string,
    public readonly details?: TaskErrorDetails
  ) {
    const response: TaskErrorResponse = {
      error: errorType,
      message,
      taskId,
      details,
      timestamp: new Date().toISOString(),
    };

    super(response, statusCode);
  }
}

/**
 * Task Not Found Exception
 *
 * Thrown when a requested task cannot be found in the system.
 * Provides clear feedback without exposing system internals.
 */
export class TaskNotFoundException extends TaskException {
  constructor(taskId: string, additionalContext?: Record<string, any>) {
    super(
      'TaskNotFound',
      `Task with ID ${taskId} not found`,
      HttpStatus.NOT_FOUND,
      taskId,
      {
        taskId,
        context: additionalContext,
      }
    );
  }
}

/**
 * Task Validation Exception
 *
 * Thrown when task data fails validation. Provides specific
 * field-level validation errors for user correction.
 */
export class TaskValidationException extends TaskException {
  constructor(
    validationErrors: string | string[],
    field?: string,
    value?: any,
    taskId?: string
  ) {
    const message = Array.isArray(validationErrors)
      ? validationErrors.join('; ')
      : validationErrors;

    super(
      'TaskValidationError',
      message,
      HttpStatus.BAD_REQUEST,
      taskId,
      {
        field,
        value,
        constraint: 'validation_failed',
        taskId,
      }
    );
  }
}

/**
 * Task Status Transition Exception
 *
 * Thrown when attempting invalid task status transitions.
 * Provides clear guidance on valid transitions.
 */
export class TaskStatusTransitionException extends TaskException {
  constructor(
    taskId: string,
    currentStatus: string,
    requestedStatus: string,
    validTransitions?: string[]
  ) {
    const message = validTransitions
      ? `Cannot transition task from ${currentStatus} to ${requestedStatus}. Valid transitions: ${validTransitions.join(', ')}`
      : `Invalid status transition from ${currentStatus} to ${requestedStatus}`;

    super(
      'TaskStatusTransitionError',
      message,
      HttpStatus.BAD_REQUEST,
      taskId,
      {
        taskId,
        field: 'status',
        value: requestedStatus,
        constraint: 'invalid_transition',
        context: {
          currentStatus,
          requestedStatus,
          validTransitions,
        },
      }
    );
  }
}

/**
 * Task Access Forbidden Exception
 *
 * Thrown when user lacks permission to access or modify a task.
 * Provides security-safe error messages.
 */
export class TaskAccessForbiddenException extends TaskException {
  constructor(
    taskId: string,
    userId: string,
    operation: string,
    reason?: string
  ) {
    const message = reason
      ? `Access denied for ${operation} operation: ${reason}`
      : `You do not have permission to ${operation} this task`;

    super(
      'TaskAccessForbidden',
      message,
      HttpStatus.FORBIDDEN,
      taskId,
      {
        taskId,
        context: {
          operation,
          userId,
          reason,
        },
      }
    );
  }
}

/**
 * Task Conflict Exception
 *
 * Thrown when task operations conflict with current state
 * (e.g., trying to modify a task that's currently executing).
 */
export class TaskConflictException extends TaskException {
  constructor(
    taskId: string,
    operation: string,
    conflictReason: string,
    currentState?: Record<string, any>
  ) {
    super(
      'TaskConflictError',
      `Cannot ${operation}: ${conflictReason}`,
      HttpStatus.CONFLICT,
      taskId,
      {
        taskId,
        constraint: 'operation_conflict',
        context: {
          operation,
          conflictReason,
          currentState,
        },
      }
    );
  }
}

/**
 * Task Processing Exception
 *
 * Thrown when task processing fails during execution.
 * Provides actionable error information.
 */
export class TaskProcessingException extends TaskException {
  constructor(
    taskId: string,
    processingError: string,
    stage?: string,
    recovery?: string[]
  ) {
    const message = stage
      ? `Task processing failed at ${stage}: ${processingError}`
      : `Task processing failed: ${processingError}`;

    super(
      'TaskProcessingError',
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      taskId,
      {
        taskId,
        constraint: 'processing_failed',
        context: {
          stage,
          processingError,
          recoveryOptions: recovery,
        },
      }
    );
  }
}

/**
 * Task Dependency Exception
 *
 * Thrown when task dependencies cannot be resolved or create conflicts.
 */
export class TaskDependencyException extends TaskException {
  constructor(
    taskId: string,
    dependencyIssue: string,
    dependencyIds?: string[]
  ) {
    super(
      'TaskDependencyError',
      `Task dependency error: ${dependencyIssue}`,
      HttpStatus.BAD_REQUEST,
      taskId,
      {
        taskId,
        constraint: 'dependency_conflict',
        context: {
          dependencyIssue,
          dependencyIds,
        },
      }
    );
  }
}

/**
 * Task Quota Exceeded Exception
 *
 * Thrown when task operations exceed user or system limits.
 */
export class TaskQuotaExceededException extends TaskException {
  constructor(
    quotaType: string,
    currentCount: number,
    maxAllowed: number,
    userId?: string
  ) {
    super(
      'TaskQuotaExceeded',
      `${quotaType} quota exceeded: ${currentCount}/${maxAllowed}`,
      HttpStatus.TOO_MANY_REQUESTS,
      undefined,
      {
        constraint: 'quota_exceeded',
        context: {
          quotaType,
          currentCount,
          maxAllowed,
          userId,
        },
      }
    );
  }
}

/**
 * Task Timeout Exception
 *
 * Thrown when task operations exceed allowed execution time.
 */
export class TaskTimeoutException extends TaskException {
  constructor(
    taskId: string,
    operation: string,
    timeoutDuration: number,
    unit: string = 'milliseconds'
  ) {
    super(
      'TaskTimeout',
      `Task ${operation} timed out after ${timeoutDuration}${unit}`,
      HttpStatus.REQUEST_TIMEOUT,
      taskId,
      {
        taskId,
        constraint: 'operation_timeout',
        context: {
          operation,
          timeoutDuration,
          unit,
        },
      }
    );
  }
}

/**
 * Task Service Unavailable Exception
 *
 * Thrown when task operations cannot be completed due to service issues.
 */
export class TaskServiceUnavailableException extends TaskException {
  constructor(
    serviceName: string,
    operation: string,
    retryAfter?: number
  ) {
    super(
      'TaskServiceUnavailable',
      `${serviceName} service unavailable for ${operation}`,
      HttpStatus.SERVICE_UNAVAILABLE,
      undefined,
      {
        constraint: 'service_unavailable',
        context: {
          serviceName,
          operation,
          retryAfter,
        },
      }
    );
  }
}

/**
 * Exception Factory
 *
 * Factory class for creating appropriate task exceptions based on error type.
 * Provides consistent error creation with fail-fast principles.
 */
export class TaskExceptionFactory {
  static notFound(taskId: string, context?: Record<string, any>): TaskNotFoundException {
    return new TaskNotFoundException(taskId, context);
  }

  static validation(
    errors: string | string[],
    field?: string,
    value?: any,
    taskId?: string
  ): TaskValidationException {
    return new TaskValidationException(errors, field, value, taskId);
  }

  static statusTransition(
    taskId: string,
    current: string,
    requested: string,
    valid?: string[]
  ): TaskStatusTransitionException {
    return new TaskStatusTransitionException(taskId, current, requested, valid);
  }

  static accessForbidden(
    taskId: string,
    userId: string,
    operation: string,
    reason?: string
  ): TaskAccessForbiddenException {
    return new TaskAccessForbiddenException(taskId, userId, operation, reason);
  }

  static conflict(
    taskId: string,
    operation: string,
    reason: string,
    state?: Record<string, any>
  ): TaskConflictException {
    return new TaskConflictException(taskId, operation, reason, state);
  }

  static processing(
    taskId: string,
    error: string,
    stage?: string,
    recovery?: string[]
  ): TaskProcessingException {
    return new TaskProcessingException(taskId, error, stage, recovery);
  }

  static dependency(
    taskId: string,
    issue: string,
    dependencyIds?: string[]
  ): TaskDependencyException {
    return new TaskDependencyException(taskId, issue, dependencyIds);
  }

  static quota(
    type: string,
    current: number,
    max: number,
    userId?: string
  ): TaskQuotaExceededException {
    return new TaskQuotaExceededException(type, current, max, userId);
  }

  static timeout(
    taskId: string,
    operation: string,
    duration: number,
    unit?: string
  ): TaskTimeoutException {
    return new TaskTimeoutException(taskId, operation, duration, unit);
  }

  static serviceUnavailable(
    service: string,
    operation: string,
    retryAfter?: number
  ): TaskServiceUnavailableException {
    return new TaskServiceUnavailableException(service, operation, retryAfter);
  }
}

/**
 * Type Guards
 *
 * Utility functions to identify specific task exception types.
 */
export const TaskExceptionGuards = {
  isTaskException: (error: any): error is TaskException => {
    return error instanceof TaskException;
  },

  isTaskNotFound: (error: any): error is TaskNotFoundException => {
    return error instanceof TaskNotFoundException;
  },

  isTaskValidation: (error: any): error is TaskValidationException => {
    return error instanceof TaskValidationException;
  },

  isTaskAccessForbidden: (error: any): error is TaskAccessForbiddenException => {
    return error instanceof TaskAccessForbiddenException;
  },

  isTaskConflict: (error: any): error is TaskConflictException => {
    return error instanceof TaskConflictException;
  },

  isRetryable: (error: any): boolean => {
    if (!TaskExceptionGuards.isTaskException(error)) {
      return false;
    }

    // Define which exceptions are retryable
    const retryableTypes = [
      'TaskTimeout',
      'TaskServiceUnavailable',
      'TaskProcessingError', // Some processing errors might be retryable
    ];

    return retryableTypes.includes(error.errorType);
  },
};