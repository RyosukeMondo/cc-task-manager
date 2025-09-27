import { User, ROLES, Role, Permission } from './types';

/**
 * Permission checker interface following Interface Segregation Principle
 */
export interface IPermissionChecker {
  hasPermission(permission: string): boolean;
  hasAnyPermission(permissions: string[]): boolean;
  hasAllPermissions(permissions: string[]): boolean;
  hasRole(role: Role): boolean;
  canAccessResource(resource: string, action: string): boolean;
}

/**
 * Permission checker implementation
 */
export class PermissionChecker implements IPermissionChecker {
  constructor(private user: User | null) {}

  hasPermission(permission: string): boolean {
    if (!this.user) return false;

    // Admin has all permissions
    if (this.user.role === 'admin') return true;

    // Check specific permissions
    return this.user.permissions.includes(permission);
  }

  hasAnyPermission(permissions: string[]): boolean {
    if (!this.user) return false;
    return permissions.some(permission => this.hasPermission(permission));
  }

  hasAllPermissions(permissions: string[]): boolean {
    if (!this.user) return false;
    return permissions.every(permission => this.hasPermission(permission));
  }

  hasRole(role: Role): boolean {
    if (!this.user) return false;
    return this.user.role === role;
  }

  canAccessResource(resource: string, action: string): boolean {
    const permission = `${resource}:${action}`;
    return this.hasPermission(permission);
  }
}

/**
 * Role hierarchy checker
 */
export class RoleHierarchy {
  private static readonly hierarchy: Record<Role, number> = {
    viewer: 1,
    user: 2,
    admin: 3,
  };

  static hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
    return this.hierarchy[userRole] >= this.hierarchy[requiredRole];
  }

  static canElevateToRole(currentRole: Role, targetRole: Role): boolean {
    // Only admin can elevate others to admin
    if (targetRole === 'admin') {
      return currentRole === 'admin';
    }

    // Users and admins can elevate to user
    if (targetRole === 'user') {
      return currentRole === 'admin' || currentRole === 'user';
    }

    // Anyone can elevate to viewer
    return true;
  }
}

/**
 * Permission-based component visibility utilities
 */
export const createPermissionUtils = (user: User | null) => {
  const checker = new PermissionChecker(user);

  return {
    // Basic permission checks
    can: (permission: string) => checker.hasPermission(permission),
    canAny: (permissions: string[]) => checker.hasAnyPermission(permissions),
    canAll: (permissions: string[]) => checker.hasAllPermissions(permissions),

    // Role checks
    isRole: (role: Role) => checker.hasRole(role),
    isAdmin: () => checker.hasRole('admin'),
    isUser: () => checker.hasRole('user'),
    isViewer: () => checker.hasRole('viewer'),

    // Resource-specific checks
    canManageTasks: () => checker.canAccessResource('tasks', 'create') ||
                           checker.canAccessResource('tasks', 'update') ||
                           checker.canAccessResource('tasks', 'delete'),
    canViewTasks: () => checker.canAccessResource('tasks', 'read'),
    canAccessDashboard: () => checker.canAccessResource('dashboard', 'read'),
    canManageUsers: () => checker.hasRole('admin'),

    // UI-specific utilities
    showIfCan: (permission: string, element: React.ReactNode) =>
      checker.hasPermission(permission) ? element : null,

    showIfRole: (role: Role, element: React.ReactNode) =>
      checker.hasRole(role) ? element : null,

    showIfMinRole: (role: Role, element: React.ReactNode) =>
      user ? RoleHierarchy.hasMinimumRole(user.role, role) ? element : null : null,
  };
};