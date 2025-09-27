'use client';

import React from 'react';
import { useAuth } from './context';
import { Role } from './types';

/**
 * Component props for role-based rendering
 */
interface RoleBasedProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface PermissionBasedProps extends RoleBasedProps {
  permission: string;
}

interface MultiPermissionProps extends RoleBasedProps {
  permissions: string[];
  requireAll?: boolean;
}

interface RoleRequiredProps extends RoleBasedProps {
  role: Role;
}

interface MinRoleProps extends RoleBasedProps {
  minRole: Role;
}

/**
 * Show content only if user has specific permission
 */
export const CanAccess: React.FC<PermissionBasedProps> = ({
  children,
  permission,
  fallback = null,
}) => {
  const { permissions } = useAuth();

  if (permissions.can(permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Show content only if user has any of the specified permissions
 */
export const CanAccessAny: React.FC<MultiPermissionProps> = ({
  children,
  permissions,
  fallback = null,
}) => {
  const { permissions: userPermissions } = useAuth();

  if (userPermissions.canAny(permissions)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Show content only if user has all specified permissions
 */
export const CanAccessAll: React.FC<MultiPermissionProps> = ({
  children,
  permissions,
  fallback = null,
}) => {
  const { permissions: userPermissions } = useAuth();

  if (userPermissions.canAll(permissions)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Show content only if user has specific role
 */
export const RoleRequired: React.FC<RoleRequiredProps> = ({
  children,
  role,
  fallback = null,
}) => {
  const { permissions } = useAuth();

  if (permissions.isRole(role)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Show content only if user has minimum role level
 */
export const MinRole: React.FC<MinRoleProps> = ({
  children,
  minRole,
  fallback = null,
}) => {
  const { permissions } = useAuth();

  if (permissions.showIfMinRole(minRole, true)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Admin-only component
 */
export const AdminOnly: React.FC<RoleBasedProps> = ({ children, fallback = null }) => {
  const { permissions } = useAuth();

  if (permissions.isAdmin()) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * User or Admin component (excludes viewers)
 */
export const UserOrAdmin: React.FC<RoleBasedProps> = ({ children, fallback = null }) => {
  const { permissions } = useAuth();

  if (permissions.isUser() || permissions.isAdmin()) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Authenticated users only
 */
export const AuthenticatedOnly: React.FC<RoleBasedProps> = ({ children, fallback = null }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Unauthenticated users only (login forms, etc.)
 */
export const UnauthenticatedOnly: React.FC<RoleBasedProps> = ({ children, fallback = null }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Task management specific permissions
 */
export const CanManageTasks: React.FC<RoleBasedProps> = ({ children, fallback = null }) => {
  const { permissions } = useAuth();

  if (permissions.canManageTasks()) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Task viewing permissions
 */
export const CanViewTasks: React.FC<RoleBasedProps> = ({ children, fallback = null }) => {
  const { permissions } = useAuth();

  if (permissions.canViewTasks()) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Dashboard access permissions
 */
export const CanAccessDashboard: React.FC<RoleBasedProps> = ({ children, fallback = null }) => {
  const { permissions } = useAuth();

  if (permissions.canAccessDashboard()) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * User management permissions (admin only)
 */
export const CanManageUsers: React.FC<RoleBasedProps> = ({ children, fallback = null }) => {
  const { permissions } = useAuth();

  if (permissions.canManageUsers()) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Higher-order component for role-based access control
 */
export function withRoleGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredRole: Role,
  FallbackComponent?: React.ComponentType
) {
  return function RoleGuardedComponent(props: P) {
    const { permissions } = useAuth();

    if (permissions.isRole(requiredRole)) {
      return <WrappedComponent {...props} />;
    }

    if (FallbackComponent) {
      return <FallbackComponent />;
    }

    return <div>Access denied. Required role: {requiredRole}</div>;
  };
}

/**
 * Higher-order component for permission-based access control
 */
export function withPermissionGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermission: string,
  FallbackComponent?: React.ComponentType
) {
  return function PermissionGuardedComponent(props: P) {
    const { permissions } = useAuth();

    if (permissions.can(requiredPermission)) {
      return <WrappedComponent {...props} />;
    }

    if (FallbackComponent) {
      return <FallbackComponent />;
    }

    return <div>Access denied. Required permission: {requiredPermission}</div>;
  };
}