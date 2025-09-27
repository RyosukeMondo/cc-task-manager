import { IoAdapter } from '@nestjs/platform-socket.io';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, ServerOptions, Socket } from 'socket.io';
import { validateJWTPayload, JWTPayload } from '../schemas/auth.schemas';
import { validateWebSocketAuth } from './websocket.schemas';

/**
 * Extended Socket interface to include user information
 * Follows Interface Segregation Principle - only add what's needed
 */
export interface AuthenticatedSocket extends Socket {
  user?: JWTPayload;
  sessionId?: string;
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * WebSocket authentication adapter implementing JWT validation
 * 
 * This adapter demonstrates SOLID principles:
 * 1. Single Responsibility Principle - handles only WebSocket authentication
 * 2. Interface Segregation Principle - extends Socket with minimal required data
 * 3. Dependency Inversion Principle - depends on JWT abstractions
 * 4. Open/Closed Principle - extensible for different auth strategies
 */
@Injectable()
export class WebSocketAuthAdapter extends IoAdapter {
  private readonly logger = new Logger(WebSocketAuthAdapter.name);
  
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    super();
  }

  /**
   * Create Socket.IO server with custom authentication middleware
   * Applies Dependency Inversion Principle - depends on JWT service abstraction
   */
  createIOServer(port: number, options?: ServerOptions): Server {
    const corsOrigins = this.configService.get<string>('CORS_ORIGINS', '*').split(',');
    
    const serverOptions: ServerOptions = {
      ...options,
      cors: {
        origin: corsOrigins,
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
    };

    const server: Server = super.createIOServer(port, serverOptions);
    
    // Apply JWT authentication middleware to all connections
    server.use(this.createAuthMiddleware());
    
    // Connection event logging for observability
    server.on('connection', (socket: AuthenticatedSocket) => {
      this.logger.log(`Client connected: ${socket.id} (User: ${socket.user?.username || 'Anonymous'})`);
      
      socket.on('disconnect', (reason) => {
        this.logger.log(`Client disconnected: ${socket.id} (Reason: ${reason})`);
      });
    });

    return server;
  }

  /**
   * Create authentication middleware for Socket.IO connections
   * Implements Single Responsibility Principle - focused only on auth validation
   */
  private createAuthMiddleware() {
    return async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
      try {
        // Extract token from handshake auth or query parameters
        const token = this.extractTokenFromSocket(socket);
        
        if (!token) {
          this.logger.warn(`Connection rejected: No token provided from ${socket.handshake.address}`);
          throw new UnauthorizedException('Authentication token required');
        }

        // Validate token using existing JWT service (Dependency Inversion Principle)
        const payload = await this.validateJWTToken(token);
        
        // Enhance socket with authenticated user information
        socket.user = payload;
        socket.sessionId = payload.sessionId;
        socket.connectedAt = new Date();
        socket.lastActivity = new Date();
        
        // Join user-specific room for targeted messaging
        socket.join(`user:${payload.sub}`);
        
        this.logger.debug(`WebSocket authenticated: ${payload.username} (${payload.sub})`);
        next();
        
      } catch (error) {
        this.logger.error(`WebSocket authentication failed: ${error.message}`, error.stack);
        next(new Error('Authentication failed'));
      }
    };
  }

  /**
   * Extract JWT token from Socket.IO handshake
   * Supports multiple token sources following Open/Closed Principle
   */
  private extractTokenFromSocket(socket: Socket): string | null {
    const { auth, query, headers } = socket.handshake;
    
    // Try auth object first (recommended approach)
    if (auth?.token) {
      try {
        const authData = validateWebSocketAuth(auth);
        return authData.token;
      } catch (error) {
        this.logger.debug('Invalid auth object format, trying other sources');
      }
    }
    
    // Try query parameters
    if (query?.token && typeof query.token === 'string') {
      return query.token;
    }
    
    // Try Authorization header
    if (headers?.authorization) {
      const match = headers.authorization.match(/^Bearer\s+(.+)$/);
      return match ? match[1] : null;
    }
    
    return null;
  }

  /**
   * Validate JWT token using existing authentication infrastructure
   * Demonstrates reuse of existing contract validation (SSOT principle)
   */
  private async validateJWTToken(token: string): Promise<JWTPayload> {
    try {
      // Verify token signature and expiration using NestJS JWT service
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      
      // Use existing Zod validation from auth schemas (SSOT principle)
      const validatedPayload = validateJWTPayload(payload);
      
      // Additional business logic validation
      if (new Date() > new Date(validatedPayload.exp * 1000)) {
        throw new UnauthorizedException('Token has expired');
      }
      
      return validatedPayload;
      
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token format');
      }
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }
      if (error.name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not yet valid');
      }
      
      throw error;
    }
  }

  /**
   * Update socket activity timestamp for connection management
   * Supports connection lifecycle management
   */
  static updateSocketActivity(socket: AuthenticatedSocket): void {
    if (socket.lastActivity) {
      socket.lastActivity = new Date();
    }
  }

  /**
   * Get authenticated user from socket
   * Follows Interface Segregation Principle - provides only needed user data
   */
  static getSocketUser(socket: Socket): JWTPayload | null {
    return (socket as AuthenticatedSocket).user || null;
  }

  /**
   * Check if socket is authenticated
   * Simple utility following Single Responsibility Principle
   */
  static isSocketAuthenticated(socket: Socket): socket is AuthenticatedSocket {
    return !!(socket as AuthenticatedSocket).user;
  }
}