import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory, Actions, Subjects } from '../casl-ability.factory';
import { JWTPayload } from '../../schemas/auth.schemas';

/**
 * Interface for CASL authorization requirements
 */
export interface RequiredRule {
  action: Actions;
  subject: Subjects;
  conditions?: any;
}

/**
 * Metadata key for CASL authorization
 */
export const CASL_KEY = 'casl';

/**
 * CASL Authorization Guard following Single Responsibility Principle
 * Responsible only for enforcing CASL-based authorization rules
 */
@Injectable()
export class CaslAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * Check if user has required permissions based on CASL rules
   * Demonstrates attribute-based access control enforcement
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredRules = this.reflector.get<RequiredRule[]>(
      CASL_KEY,
      context.getHandler(),
    );

    // If no CASL rules are defined, allow access
    if (!requiredRules) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JWTPayload = request.user;

    // If no user is authenticated, deny access
    if (!user) {
      throw new ForbiddenException('Authentication required for authorization');
    }

    const ability = this.caslAbilityFactory.createForUser(user);

    // Check all required rules
    for (const rule of requiredRules) {
      const canPerform = rule.conditions
        ? ability.can(rule.action, rule.subject, rule.conditions)
        : ability.can(rule.action, rule.subject);

      if (!canPerform) {
        throw new ForbiddenException(
          `Insufficient permissions: cannot ${rule.action} ${rule.subject}`
        );
      }
    }

    return true;
  }
}