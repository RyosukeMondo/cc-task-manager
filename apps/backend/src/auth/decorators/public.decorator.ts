import { SetMetadata } from '@nestjs/common';

/**
 * Public route decorator for marking endpoints that don't require authentication
 * Follows Interface Segregation Principle - simple, focused decorator
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);