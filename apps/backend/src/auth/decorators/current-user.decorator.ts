import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JWTPayload } from '../../schemas/auth.schemas';

/**
 * Current User decorator for extracting user information from JWT payload
 * Demonstrates Single Responsibility Principle - focused only on user extraction
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JWTPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);