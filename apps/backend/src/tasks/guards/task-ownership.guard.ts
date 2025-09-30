import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TasksService } from '../tasks.service';
import { JWTPayload, UserRole } from '@schemas/auth';
import { CaslAbilityFactory, Actions } from '../../auth/casl-ability.factory';

/**
 * Metadata key for task ownership bypass
 */
export const BYPASS_OWNERSHIP_KEY = 'bypassOwnership';

/**
 * Task Ownership Guard following Single Responsibility Principle
 * Responsible only for enforcing task ownership and permission validation
 * Integrates with existing CASL authorization system
 */
@Injectable()
export class TaskOwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tasksService: TasksService,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * Check if user has permission to access the task
   * Implements fail-fast authorization validation
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if endpoint bypasses ownership check
    const bypassOwnership = this.reflector.getAllAndOverride<boolean>(BYPASS_OWNERSHIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (bypassOwnership) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JWTPayload = request.user;

    // Fail-fast: If no user is authenticated, deny access
    if (!user) {
      throw new ForbiddenException('Authentication required for task access');
    }

    // Get task ID from request parameters
    const taskId = this.extractTaskId(request);

    // If no task ID is present, allow access (for create operations)
    if (!taskId) {
      return true;
    }

    // Fetch task to validate ownership and permissions
    try {
      const task = await this.tasksService.findOne(taskId, user);

      // Check if user has permission based on CASL rules
      const ability = this.caslAbilityFactory.createForUser(user);

      // Admin users can access all tasks
      if (user.role === UserRole.ADMIN) {
        return true;
      }

      // Moderator users can access all tasks with read/update permissions
      if (user.role === UserRole.MODERATOR) {
        return true;
      }

      // For regular users, check specific task ownership and assignment
      // CASL v6 API: can(action, subject) - conditions checked separately
      const canRead = ability.can(Actions.Read, 'Task');
      const canUpdate = ability.can(Actions.Update, 'Task');
      const canDelete = ability.can(Actions.Delete, 'Task');

      // Check specific action based on HTTP method
      const httpMethod = request.method;
      const isAllowed = this.checkMethodPermission(
        httpMethod,
        task,
        user,
        { canRead, canUpdate, canDelete }
      );

      if (!isAllowed) {
        throw new ForbiddenException(
          `Insufficient permissions: cannot access task ${taskId}. ` +
          `Users can only access tasks they created or are assigned to.`
        );
      }

      // Add task to request context for use in controller
      request.task = task;

      return true;

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Task with ID ${taskId} not found`);
      }
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // Re-throw other errors as forbidden to avoid information leakage
      throw new ForbiddenException('Access denied to task resource');
    }
  }

  /**
   * Extract task ID from request parameters
   * Supports both :id and :taskId parameter patterns
   */
  private extractTaskId(request: any): string | undefined {
    return request.params?.id || request.params?.taskId;
  }

  /**
   * Check if HTTP method is allowed based on user permissions
   * Implements method-specific authorization logic
   */
  private checkMethodPermission(
    method: string,
    task: any,
    user: JWTPayload,
    permissions: { canRead: boolean; canUpdate: boolean; canDelete: boolean }
  ): boolean {
    const userId = user.sub;
    const isCreator = task.createdBy === userId;
    const isAssigned = task.assignedTo === userId;

    switch (method.toUpperCase()) {
      case 'GET':
        // Users can read tasks they created or are assigned to
        return isCreator || isAssigned;

      case 'PATCH':
      case 'PUT':
        // Users can update tasks they created or are assigned to
        return isCreator || isAssigned;

      case 'DELETE':
        // Only creators can delete tasks
        return isCreator;

      default:
        // For other methods (POST for bulk operations), check if user has any relationship
        return isCreator || isAssigned;
    }
  }
}

/**
 * Decorator to bypass ownership check for specific endpoints
 * Use for admin-only endpoints or public endpoints
 */
export const BypassOwnership = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    // Use SetMetadata instead of Reflector.set()
    return SetMetadata(BYPASS_OWNERSHIP_KEY, true)(target, propertyKey, descriptor);
  };
};