import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';
import { JWTPayload, validateJWTPayload } from '../schemas/auth.schemas';
import { validateWebSocketAuth } from './websocket.schemas';

/**
 * WebSocket Authentication Guard following Interface Segregation Principle
 * Responsible only for validating JWT tokens in WebSocket connections
 */
@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebSocketAuthGuard.name);
  private readonly jwtSecret: string;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'fallback-secret';
  }

  /**
   * Validate WebSocket connection by authenticating JWT token
   * Extracts token from query parameters or authorization header
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const data = context.switchToWs().getData();

      // Extract token from various sources
      const token = this.extractTokenFromClient(client, data);
      
      if (!token) {
        this.logger.warn(`WebSocket connection rejected: No token provided`, {
          clientId: client.id,
          remoteAddress: client.request.connection.remoteAddress,
        });
        throw new WsException('Authentication token required');
      }

      // Validate and decode JWT token
      const payload = await this.validateToken(token);
      
      // Attach user information to socket for later use
      client.data = {
        ...client.data,
        user: payload,
        isAuthenticated: true,
        connectedAt: new Date(),
      };

      this.logger.log(`WebSocket connection authenticated`, {
        userId: payload.sub,
        username: payload.username,
        clientId: client.id,
        sessionId: payload.sessionId,
      });

      return true;
    } catch (error) {
      this.logger.error(`WebSocket authentication failed: ${error.message}`, {
        clientId: context.switchToWs().getClient().id,
        error: error.message,
      });
      
      // Convert to WebSocket exception for proper error handling
      if (error instanceof WsException) {
        throw error;
      }
      throw new WsException('Authentication failed');
    }
  }

  /**
   * Extract JWT token from WebSocket client
   * Supports multiple token sources: query params, auth header, handshake data
   */
  private extractTokenFromClient(client: Socket, data?: any): string | null {
    // Method 1: Extract from query parameters during handshake
    const queryToken = client.handshake.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    // Method 2: Extract from authorization header
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const matches = authHeader.match(/^Bearer\s+(.+)$/);
      if (matches && matches[1]) {
        return matches[1];
      }
    }

    // Method 3: Extract from authentication object in handshake
    const authObject = client.handshake.auth;
    if (authObject && typeof authObject === 'object') {
      try {
        const validatedAuth = validateWebSocketAuth(authObject);
        return validatedAuth.token;
      } catch (error) {
        this.logger.warn(`Invalid auth object in WebSocket handshake: ${error.message}`);
      }
    }

    // Method 4: Extract from event data (for message-level authentication)
    if (data && typeof data === 'object' && data.token) {
      return data.token;
    }

    return null;
  }

  /**
   * Validate JWT token and return payload
   * Reuses existing JWT validation logic from auth service
   */
  private async validateToken(token: string): Promise<JWTPayload> {
    try {
      // Verify token signature and expiration
      const payload = this.jwtService.verify(token, { 
        secret: this.jwtSecret,
        ignoreExpiration: false,
      });

      // Validate payload structure using existing Zod schema
      const validatedPayload = validateJWTPayload(payload);

      // Additional validation: check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (validatedPayload.exp && validatedPayload.exp < now) {
        throw new UnauthorizedException('Token has expired');
      }

      return validatedPayload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      // Handle JWT-specific errors
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token format');
      } else if (error.name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not yet valid');
      }
      
      throw new UnauthorizedException('Token validation failed');
    }
  }

  /**
   * Static method to extract user from authenticated socket
   * Utility for use in gateway methods
   */
  static getUserFromSocket(client: Socket): JWTPayload {
    if (!client.data?.isAuthenticated || !client.data?.user) {
      throw new WsException('Socket not authenticated');
    }
    return client.data.user;
  }

  /**
   * Static method to check if socket is authenticated
   * Utility for conditional logic in gateway methods
   */
  static isSocketAuthenticated(client: Socket): boolean {
    return Boolean(client.data?.isAuthenticated && client.data?.user);
  }
}

/**
 * Decorator to extract authenticated user from WebSocket context
 * Provides convenient access to user data in gateway handlers
 */
export const WsCurrentUser = (property?: keyof JWTPayload) => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const context = args.find(arg => arg && typeof arg === 'object' && arg.client);
      if (context && context.client) {
        const user = WebSocketAuthGuard.getUserFromSocket(context.client);
        
        if (property) {
          args.push(user[property]);
        } else {
          args.push(user);
        }
      }
      
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
};