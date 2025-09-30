import { NextRequest, NextResponse } from 'next/server';
import { TokenUtils } from './lib/auth/token-storage';

/**
 * Route configuration for authentication
 */
const AUTH_CONFIG = {
  // Routes that require authentication
  protectedRoutes: ['/', '/dashboard', '/tasks', '/profile', '/admin'],

  // Routes that require specific roles
  roleProtectedRoutes: {
    '/admin': ['admin'],
    '/admin/users': ['admin'],
    '/admin/settings': ['admin'],
  },

  // Routes that require specific permissions
  permissionProtectedRoutes: {
    '/tasks/create': ['tasks:create'],
    '/tasks/edit': ['tasks:update'],
  },

  // Public routes (no authentication required)
  publicRoutes: ['/login', '/register', '/forgot-password', '/unauthorized'],

  // Auth routes (redirect if already authenticated)
  authRoutes: ['/login', '/register'],
};

/**
 * Check if route requires authentication
 */
function isProtectedRoute(pathname: string): boolean {
  return AUTH_CONFIG.protectedRoutes.some(route =>
    pathname.startsWith(route)
  );
}

/**
 * Check if route is public
 */
function isPublicRoute(pathname: string): boolean {
  return AUTH_CONFIG.publicRoutes.some(route =>
    pathname === route || (route !== '/' && pathname.startsWith(route))
  );
}

/**
 * Check if route is an auth route
 */
function isAuthRoute(pathname: string): boolean {
  return AUTH_CONFIG.authRoutes.some(route => pathname.startsWith(route));
}

/**
 * Get required role for route
 */
function getRequiredRole(pathname: string): string[] | null {
  for (const [route, roles] of Object.entries(AUTH_CONFIG.roleProtectedRoutes)) {
    if (pathname.startsWith(route)) {
      return roles;
    }
  }
  return null;
}

/**
 * Get required permissions for route
 */
function getRequiredPermissions(pathname: string): string[] | null {
  for (const [route, permissions] of Object.entries(AUTH_CONFIG.permissionProtectedRoutes)) {
    if (pathname.startsWith(route)) {
      return permissions;
    }
  }
  return null;
}

/**
 * Extract user info from request
 */
function getUserFromRequest(request: NextRequest) {
  try {
    // Try to get token from cookies first
    const tokenCookie = request.cookies.get('auth_token');
    let token = tokenCookie?.value;

    // Fallback to Authorization header
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) return null;

    // Check if token is expired
    if (TokenUtils.isTokenExpired(token)) {
      return null;
    }

    // Extract user info from token
    const user = TokenUtils.extractUserFromToken(token);
    return user;
  } catch (error) {
    console.error('Error extracting user from request:', error);
    return null;
  }
}

/**
 * Check if user has required role
 */
function hasRequiredRole(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole) || userRole === 'admin';
}

/**
 * Check if user has required permissions
 */
function hasRequiredPermissions(userPermissions: string[] | undefined, requiredPermissions: string[]): boolean {
  // If no permissions provided, return false
  if (!userPermissions || !Array.isArray(userPermissions)) return false;

  // Admin has all permissions
  if (userPermissions.includes('*')) return true;

  return requiredPermissions.every(permission =>
    userPermissions.includes(permission)
  );
}

/**
 * Next.js middleware function
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') // Static files
  ) {
    return NextResponse.next();
  }

  const user = getUserFromRequest(request);
  const isAuthenticated = !!user;

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Require authentication for protected routes
  if (isProtectedRoute(pathname)) {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check role requirements
    const requiredRoles = getRequiredRole(pathname);
    if (requiredRoles && !hasRequiredRole(user.role, requiredRoles)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Check permission requirements
    const requiredPermissions = getRequiredPermissions(pathname);
    if (requiredPermissions && !hasRequiredPermissions(user.permissions, requiredPermissions)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Add user info to headers for server components
  const response = NextResponse.next();
  if (user) {
    response.headers.set('x-user-id', user.id);
    response.headers.set('x-user-role', user.role);
    response.headers.set('x-user-permissions', JSON.stringify(user.permissions));
  }

  return response;
}

/**
 * Middleware configuration
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};