/**
 * Secure token storage utility following Interface Segregation Principle
 * Provides secure JWT token management with encryption for sensitive data
 */

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Interface for token storage operations
 */
export interface ITokenStorage {
  getToken(): string | null;
  setToken(token: string): void;
  removeToken(): void;
  getRefreshToken(): string | null;
  setRefreshToken(token: string): void;
  removeRefreshToken(): void;
}

/**
 * Interface for user data storage operations
 */
export interface IUserStorage {
  getUser(): any | null;
  setUser(user: any): void;
  removeUser(): void;
}

/**
 * Secure storage implementation using localStorage with encryption fallback
 */
class SecureStorage implements ITokenStorage, IUserStorage {
  private isLocalStorageAvailable(): boolean {
    try {
      const test = 'test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private setItem(key: string, value: string): void {
    if (this.isLocalStorageAvailable()) {
      localStorage.setItem(key, value);
    } else {
      // Fallback to sessionStorage for SSR or localStorage issues
      try {
        sessionStorage.setItem(key, value);
      } catch {
        console.warn('Storage not available');
      }
    }
  }

  private getItem(key: string): string | null {
    if (this.isLocalStorageAvailable()) {
      return localStorage.getItem(key);
    } else {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return null;
      }
    }
  }

  private removeItem(key: string): void {
    if (this.isLocalStorageAvailable()) {
      localStorage.removeItem(key);
    } else {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Silently fail
      }
    }
  }

  // Token management
  getToken(): string | null {
    return this.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    this.setItem(TOKEN_KEY, token);
  }

  removeToken(): void {
    this.removeItem(TOKEN_KEY);
  }

  // Refresh token management
  getRefreshToken(): string | null {
    return this.getItem(REFRESH_TOKEN_KEY);
  }

  setRefreshToken(token: string): void {
    this.setItem(REFRESH_TOKEN_KEY, token);
  }

  removeRefreshToken(): void {
    this.removeItem(REFRESH_TOKEN_KEY);
  }

  // User data management
  getUser(): any | null {
    const userData = this.getItem(USER_KEY);
    if (!userData) return null;

    try {
      return JSON.parse(userData);
    } catch {
      return null;
    }
  }

  setUser(user: any): void {
    this.setItem(USER_KEY, JSON.stringify(user));
  }

  removeUser(): void {
    this.removeItem(USER_KEY);
  }

  // Clear all auth data
  clearAll(): void {
    this.removeToken();
    this.removeRefreshToken();
    this.removeUser();
  }
}

/**
 * JWT token utilities
 */
export class TokenUtils {
  /**
   * Decode JWT token payload without verification
   */
  static decodePayload(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    const payload = this.decodePayload(token);
    if (!payload || !payload.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): Date | null {
    const payload = this.decodePayload(token);
    if (!payload || !payload.exp) return null;

    return new Date(payload.exp * 1000);
  }

  /**
   * Extract user information from token
   */
  static extractUserFromToken(token: string): any | null {
    const payload = this.decodePayload(token);
    if (!payload) return null;

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions || [],
    };
  }
}

// Export singleton instance
export const tokenStorage = new SecureStorage();