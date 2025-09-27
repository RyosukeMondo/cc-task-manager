import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { JWTPayload } from '../schemas/auth.schemas';

/**
 * WebSocket Authentication Guard
 * 
 * This guard demonstrates SOLID principles:
 * 1. Single Responsibility Principle - focused only on WebSocket authentication
 * 2. Open/Closed Principle - extensible for additional authentication strategies
 * 3. Interface Segregation Principle - implements only CanActivate interface
 * 4. Dependency Inversion Principle - depends on JwtService abstraction
 * 
 * Responsibilities:
 * - Authenticate WebSocket connections using JWT tokens
 * - Extract and validate JWT payloads
 * - Attach user information to socket context
 * - Handle authentication errors gracefully
 */
@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebSocketAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Authenticate WebSocket connection
   * Extracts JWT token from handshake and validates it
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      
      // Extract token from handshake auth or headers
      const token = this.extractTokenFromHandshake(client);
      
      if (!token) {
        this.logger.warn(`No authentication token provided for socket ${client.id}`);
        throw new UnauthorizedException('No authentication token provided');
      }

      // Verify and decode JWT token
      const payload = await this.verifyToken(token);
      
      // Attach user payload to socket data
      client.data.user = payload;
      client.data.authenticated = true;
      
      this.logger.debug(`Socket ${client.id} authenticated for user ${payload.username}`);
      
      return true;
    } catch (error) {
      this.logger.error(`WebSocket authentication failed: ${error.message}`);
      
      // Send error to client before disconnecting
      const client: Socket = context.switchToWs().getClient();
      client.emit('auth-error', {
        error: 'Authentication failed',
        message: error.message,
        timestamp: new Date(),
      });
      
      // Disconnect the client after a short delay
      setTimeout(() => {
        client.disconnect(true);
      }, 100);
      
      return false;
    }
  }

  /**
   * Extract JWT token from WebSocket handshake
   * Supports multiple token sources for flexibility
   */
  private extractTokenFromHandshake(client: Socket): string | null {
    // Try to get token from auth object (most common)
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    // Try to get token from query parameters
    if (client.handshake.query?.token) {
      return Array.isArray(client.handshake.query.token) 
        ? client.handshake.query.token[0] 
        : client.handshake.query.token;
    }

    // Try to get token from Authorization header
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7); // Remove 'Bearer ' prefix
    }

    // Try to get token from custom header
    const tokenHeader = client.handshake.headers?.['x-auth-token'];
    if (tokenHeader) {
      return Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    }

    return null;
  }

  /**
   * Verify JWT token and return decoded payload
   */
  private async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const payload = this.jwtService.verify(token) as JWTPayload;
      
      // Additional validation checks
      if (!payload.sub || !payload.email || !payload.username) {
        throw new UnauthorizedException('Invalid token payload structure');
      }

      // Check if token is expired (additional check beyond JWT verification)
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < currentTime) {
        throw new UnauthorizedException('Token has expired');
      }

      return payload;
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token signature');
      } else if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      } else if (error.name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not active yet');
      } else {
        throw new UnauthorizedException(`Token verification failed: ${error.message}`);
      }
    }
  }

  /**
   * Helper method to check if socket is authenticated
   * Can be used by other guards or interceptors
   */
  static isSocketAuthenticated(socket: Socket): boolean {
    return !!(socket.data?.authenticated && socket.data?.user);
  }

  /**
   * Helper method to get authenticated user from socket
   */
  static getSocketUser(socket: Socket): JWTPayload | null {
    if (this.isSocketAuthenticated(socket)) {
      return socket.data.user;
    }
    return null;
  }
}
