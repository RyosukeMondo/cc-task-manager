'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { AuthState, User, LoginCredentials, AuthResponse } from './types';
import { tokenStorage, TokenUtils } from './token-storage';
import { createPermissionUtils } from './permissions';

/**
 * Authentication actions
 */
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_INIT'; payload: { user: User; token: string } | null };

/**
 * Authentication reducer
 */
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'AUTH_ERROR':
      return {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'AUTH_LOGOUT':
      return {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'AUTH_INIT':
      if (action.payload) {
        return {
          user: action.payload.user,
          token: action.payload.token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        };
      }
      return {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    default:
      return state;
  }
};

/**
 * Authentication context interface
 */
interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  permissions: ReturnType<typeof createPermissionUtils>;
}

/**
 * Authentication context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Initial auth state
 */
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

/**
 * Authentication provider props
 */
interface AuthProviderProps {
  children: React.ReactNode;
  apiBaseUrl?: string;
}

/**
 * Authentication provider component
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
}) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  /**
   * Initialize authentication from stored token
   */
  const initializeAuth = useCallback(() => {
    const token = tokenStorage.getToken();
    const storedUser = tokenStorage.getUser();

    if (token && storedUser && !TokenUtils.isTokenExpired(token)) {
      dispatch({
        type: 'AUTH_INIT',
        payload: { user: storedUser, token },
      });
    } else {
      // Clear invalid token
      tokenStorage.clearAll();
      dispatch({ type: 'AUTH_INIT', payload: null });
    }
  }, []);

  /**
   * Login function
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    dispatch({ type: 'AUTH_START' });

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Login failed');
      }

      const authResponse: AuthResponse = await response.json();

      // Store token and user data
      tokenStorage.setToken(authResponse.token);
      tokenStorage.setUser(authResponse.user);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: authResponse.user,
          token: authResponse.token,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'AUTH_ERROR', payload: message });
      throw error;
    }
  }, [apiBaseUrl]);

  /**
   * Logout function
   */
  const logout = useCallback(async () => {
    try {
      // Call logout endpoint if token exists
      const token = tokenStorage.getToken();
      if (token) {
        await fetch(`${apiBaseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }).catch(() => {
          // Ignore logout endpoint errors
        });
      }
    } finally {
      // Always clear local storage and state
      tokenStorage.clearAll();
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  }, [apiBaseUrl]);

  /**
   * Refresh token function
   */
  const refreshToken = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      logout();
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const authResponse: AuthResponse = await response.json();

      tokenStorage.setToken(authResponse.token);
      tokenStorage.setUser(authResponse.user);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: authResponse.user,
          token: authResponse.token,
        },
      });
    } catch (error) {
      logout();
    }
  }, [apiBaseUrl, logout]);

  /**
   * Auto-refresh token before expiration
   */
  useEffect(() => {
    if (!state.token) return;

    const checkTokenExpiration = () => {
      if (TokenUtils.isTokenExpired(state.token!)) {
        refreshToken();
      }
    };

    // Check every minute
    const interval = setInterval(checkTokenExpiration, 60000);
    return () => clearInterval(interval);
  }, [state.token, refreshToken]);

  /**
   * Initialize auth on mount
   */
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  /**
   * Create permission utilities
   */
  const permissions = createPermissionUtils(state.user);

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken,
    permissions,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use authentication context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};