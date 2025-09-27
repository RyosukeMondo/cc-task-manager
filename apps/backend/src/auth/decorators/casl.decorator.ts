import { SetMetadata } from '@nestjs/common';
import { Actions, Subjects } from '../casl-ability.factory';
import { CASL_KEY, RequiredRule } from '../guards/casl-auth.guard';

/**
 * CASL decorator for defining authorization requirements on routes
 * Follows Interface Segregation Principle - simple, focused decorator
 */
export const RequireAbility = (...rules: RequiredRule[]) =>
  SetMetadata(CASL_KEY, rules);

/**
 * Helper function to create CASL rules more easily
 */
export const createRule = (
  action: Actions | string,
  subject: Subjects | string,
  conditions?: any,
): RequiredRule => ({
  action: action as Actions,
  subject: subject as Subjects,
  conditions,
});