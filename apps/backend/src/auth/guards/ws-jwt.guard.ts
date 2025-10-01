import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * WebSocket JWT Authentication Guard
 * Validates JWT tokens from WebSocket handshake and attaches user to socket
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  /**
   * Validates WebSocket connection and extracts user from JWT
   * Attaches user to socket.data for use in WebSocket handlers
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();

      // Extract token from handshake auth or query params
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        throw new WsException('No auth token');
      }

      // Verify and decode the JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.AUTH_JWT_SECRET,
      });

      // Attach user information to socket data for later use
      client.data.user = payload;

      return true;
    } catch (error) {
      if (error?.name === 'TokenExpiredError') {
        throw new WsException('TOKEN_EXPIRED');
      }
      if (error?.name === 'JsonWebTokenError') {
        throw new WsException('Invalid token');
      }
      throw new WsException('Unauthorized');
    }
  }

  /**
   * Extract JWT token from WebSocket handshake
   * Supports both Authorization header and query parameter
   */
  private extractTokenFromHandshake(client: Socket): string | null {
    // Check Authorization header from handshake
    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check query parameter as fallback
    const token = client.handshake?.query?.token;
    if (token && typeof token === 'string') {
      return token;
    }

    // Check auth object from handshake
    const authToken = client.handshake?.auth?.token;
    if (authToken && typeof authToken === 'string') {
      return authToken;
    }

    return null;
  }
}
