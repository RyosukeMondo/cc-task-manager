import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { WebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';
import { WebSocketAuthGuard } from './websocket-auth.guard';
import { TaskEventsService } from './events/task-events.service';
import { QueueEventsService } from './events/queue-events.service';
import { ClaudeEventsService } from './events/claude-events.service';
import { UserChannelsService } from './channels/user-channels.service';

/**
 * WebSocket Module for real-time communication
 * 
 * This module demonstrates SOLID principles:
 * 1. Single Responsibility Principle - focused on WebSocket functionality
 * 2. Open/Closed Principle - extensible for new WebSocket features
 * 3. Dependency Inversion Principle - depends on abstractions (JwtModule, AuthModule)
 * 4. Interface Segregation Principle - clean separation of WebSocket concerns
 * 
 * Features:
 * - WebSocket gateway with JWT authentication
 * - Real-time event broadcasting and room management
 * - Type-safe event validation using Zod schemas
 * - Integration with existing authentication infrastructure
 * - Business logic coordination through WebSocketService
 * 
 * Integration points:
 * - Leverages existing JWT configuration from AuthModule
 * - Integrates with task management for real-time updates
 * - Supports project-based and user-based room targeting
 * - Provides WebSocket statistics and monitoring capabilities
 */
@Module({
  imports: [
    // Import AuthModule to leverage existing JWT infrastructure
    AuthModule,
    
    // Configure JWT module for WebSocket authentication
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  
  providers: [
    // Core WebSocket providers
    WebSocketGateway,
    WebSocketService,
    WebSocketAuthGuard,
    TaskEventsService,
    QueueEventsService,
    ClaudeEventsService,
    UserChannelsService,
  ],
  
  exports: [
    // Export services for use in other modules
    WebSocketGateway,
    WebSocketService,
    TaskEventsService,
    QueueEventsService,
    ClaudeEventsService,
    UserChannelsService,
  ],
})
export class WebSocketModule {
  /**
   * Static method to create module with custom configuration
   * Allows for easy testing and development customization
   */
  static forRoot(options?: {
    namespace?: string;
    cors?: {
      origin: string | string[];
      credentials?: boolean;
    };
  }) {
    return {
      module: WebSocketModule,
      providers: [
        {
          provide: 'WEBSOCKET_OPTIONS',
          useValue: options || {},
        },
      ],
    };
  }
}
