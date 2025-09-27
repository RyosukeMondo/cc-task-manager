import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';
import { WebSocketAuthGuard } from './websocket-auth.guard';
import { AuthModule } from '../auth/auth.module';

/**
 * WebSocket module for real-time communication
 * 
 * This module demonstrates SOLID principles:
 * 1. Single Responsibility Principle - focused on WebSocket functionality
 * 2. Dependency Inversion Principle - depends on auth abstractions
 * 3. Open/Closed Principle - extensible for new WebSocket features
 * 4. Interface Segregation Principle - clean separation of concerns
 * 
 * Features:
 * - JWT-authenticated WebSocket connections
 * - Room-based message targeting
 * - Zod schema validation for all events
 * - Type-safe real-time communication
 */
@Module({
  imports: [
    // JWT configuration for WebSocket authentication
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
    
    // Authentication module for user verification
    AuthModule,
  ],
  
  providers: [
    WebSocketGateway,
    WebSocketService,
    WebSocketAuthGuard,
  ],
  
  exports: [
    WebSocketGateway,
    WebSocketService,
  ],
})
export class WebSocketModule {}