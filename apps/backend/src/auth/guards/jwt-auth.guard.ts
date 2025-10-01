import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT Authentication Guard following Interface Segregation Principle
 * Responsible only for JWT token validation and user context extraction
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Determine if the current request can be activated
   * Checks for public endpoints and validates JWT tokens
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Check if endpoint is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // For protected endpoints, validate JWT token
    return super.canActivate(context);
  }

  /**
   * Handle request after successful authentication
   * Adds user context to the request object
   * Provides better error messages for different JWT errors
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Handle errors or missing user
    if (err || !user) {
      // Check for token expiration
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('TOKEN_EXPIRED');
      }

      // Check for other JWT errors
      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }

      // Check for missing token
      if (info?.message === 'No auth token') {
        throw new UnauthorizedException('No auth token');
      }

      // Default error
      throw err || new UnauthorizedException('Invalid authentication token');
    }

    // Add user information to request context
    return user;
  }
}