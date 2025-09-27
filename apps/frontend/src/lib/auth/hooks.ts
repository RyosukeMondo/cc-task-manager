import { useCallback, useMemo } from 'react';
import { useAuth } from './context';
import { Role, Permission } from './types';

/**
 * Hook for simplified permission checks
 */
export const usePermissions = () => {
  const { permissions } = useAuth();

  return useMemo(() => ({
    // Basic permission methods
    can: permissions.can,
    canAny: permissions.canAny,
    canAll: permissions.canAll,

    // Role methods
    isRole: permissions.isRole,
    isAdmin: permissions.isAdmin,
    isUser: permissions.isUser,
    isViewer: permissions.isViewer,

    // Resource-specific methods
    canManageTasks: permissions.canManageTasks,
    canViewTasks: permissions.canViewTasks,
    canAccessDashboard: permissions.canAccessDashboard,
    canManageUsers: permissions.canManageUsers,

    // UI utility methods
    showIfCan: permissions.showIfCan,
    showIfRole: permissions.showIfRole,
    showIfMinRole: permissions.showIfMinRole,
  }), [permissions]);
};

/**
 * Hook for current user information
 */
export const useCurrentUser = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  return useMemo(() => ({
    user,
    isAuthenticated,
    isLoading,
    id: user?.id,
    email: user?.email,
    role: user?.role,
    permissions: user?.permissions || [],
  }), [user, isAuthenticated, isLoading]);
};

/**
 * Hook for authentication actions
 */
export const useAuthActions = () => {
  const { login, logout, refreshToken } = useAuth();

  const safeLogin = useCallback(async (credentials: { email: string; password: string }) => {
    try {
      await login(credentials);
      return { success: true, error: null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  }, [login]);

  const safeLogout = useCallback(async () => {
    try {
      await logout();
      return { success: true, error: null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      };
    }
  }, [logout]);

  const safeRefreshToken = useCallback(async () => {
    try {
      await refreshToken();
      return { success: true, error: null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      };
    }
  }, [refreshToken]);

  return useMemo(() => ({
    login: safeLogin,
    logout: safeLogout,
    refreshToken: safeRefreshToken,
  }), [safeLogin, safeLogout, safeRefreshToken]);
};

/**
 * Hook for authentication status
 */
export const useAuthStatus = () => {
  const { isAuthenticated, isLoading, error } = useAuth();

  return useMemo(() => ({
    isAuthenticated,
    isLoading,
    error,
    isReady: !isLoading,
    hasError: !!error,
  }), [isAuthenticated, isLoading, error]);
};

/**
 * Hook for role-based navigation
 */
export const useRoleBasedNavigation = () => {
  const { permissions } = useAuth();

  const getAvailableRoutes = useCallback(() => {
    const routes = [];

    if (permissions.canAccessDashboard()) {
      routes.push({ path: '/dashboard', label: 'Dashboard' });
    }

    if (permissions.canViewTasks()) {
      routes.push({ path: '/tasks', label: 'Tasks' });
    }

    if (permissions.canManageTasks()) {
      routes.push({ path: '/tasks/create', label: 'Create Task' });
    }

    if (permissions.canManageUsers()) {
      routes.push({ path: '/admin/users', label: 'User Management' });
      routes.push({ path: '/admin/settings', label: 'Settings' });
    }

    // Always available to authenticated users
    if (permissions.can('profile:read')) {
      routes.push({ path: '/profile', label: 'Profile' });
    }

    return routes;
  }, [permissions]);

  const canAccessRoute = useCallback((route: string) => {
    switch (route) {
      case '/dashboard':
        return permissions.canAccessDashboard();
      case '/tasks':
        return permissions.canViewTasks();
      case '/tasks/create':
      case '/tasks/edit':
        return permissions.canManageTasks();
      case '/admin/users':
      case '/admin/settings':
        return permissions.canManageUsers();
      case '/profile':
        return permissions.can('profile:read');
      default:
        return false;
    }
  }, [permissions]);

  return useMemo(() => ({
    getAvailableRoutes,
    canAccessRoute,
  }), [getAvailableRoutes, canAccessRoute]);
};

/**
 * Hook for conditional rendering based on authentication
 */
export const useConditionalRender = () => {
  const { permissions } = useAuth();
  const { isAuthenticated } = useAuthStatus();

  const renderIf = useCallback((condition: boolean, component: React.ReactNode) => {
    return condition ? component : null;
  }, []);

  const renderIfAuthenticated = useCallback((component: React.ReactNode) => {
    return renderIf(isAuthenticated, component);
  }, [isAuthenticated, renderIf]);

  const renderIfNotAuthenticated = useCallback((component: React.ReactNode) => {
    return renderIf(!isAuthenticated, component);
  }, [isAuthenticated, renderIf]);

  const renderIfCan = useCallback((permission: string, component: React.ReactNode) => {
    return renderIf(permissions.can(permission), component);
  }, [permissions, renderIf]);

  const renderIfRole = useCallback((role: Role, component: React.ReactNode) => {
    return renderIf(permissions.isRole(role), component);
  }, [permissions, renderIf]);

  const renderIfAdmin = useCallback((component: React.ReactNode) => {
    return renderIf(permissions.isAdmin(), component);
  }, [permissions, renderIf]);

  return useMemo(() => ({
    renderIf,
    renderIfAuthenticated,
    renderIfNotAuthenticated,
    renderIfCan,
    renderIfRole,
    renderIfAdmin,
  }), [
    renderIf,
    renderIfAuthenticated,
    renderIfNotAuthenticated,
    renderIfCan,
    renderIfRole,
    renderIfAdmin,
  ]);
};