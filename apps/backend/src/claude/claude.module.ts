import { Module } from '@nestjs/common';
import { ClaudeWrapperService } from './claude-wrapper.service';
import { ClaudeCommandService } from './claude-command.service';
import { ClaudeSessionService } from './claude-session.service';
import { ClaudeStreamService } from './claude-stream.service';
import { ClaudeErrorService } from './claude-error.service';
import { ClaudeCacheService } from './claude-cache.service';
import { WebSocketModule } from '../websocket/websocket.module';

/**
 * Claude Code integration module
 *
 * Provides centralized module for all Claude Code related services
 * Following NestJS module pattern and SOLID principles:
 *
 * - Single Responsibility: Module manages Claude Code integration
 * - Open/Closed: Extensible for additional Claude Code services
 * - Dependency Inversion: Providers use dependency injection
 *
 * Implemented services:
 * - ClaudeWrapperService (task 1) - STDIO protocol communication
 * - ClaudeCommandService (task 2) - Command execution and response handling
 * - ClaudeSessionService (task 3) - Session lifecycle management and state tracking
 * - ClaudeStreamService (task 5) - Real-time output streaming and WebSocket integration
 * - ClaudeErrorService (task 6) - Error handling and recovery mechanisms
 * - ClaudeCacheService (task 10) - Performance optimization and caching
 *
 * Completed services:
 * - ClaudeQueueService (task 4) - BullMQ integration for task processing
 * - ClaudeMetricsService (task 7) - Performance monitoring and metrics
 * - ClaudeConfigService (task 8) - Configuration management and environment setup
 */
@Module({
  imports: [WebSocketModule],
  providers: [ClaudeWrapperService, ClaudeCommandService, ClaudeSessionService, ClaudeStreamService, ClaudeErrorService, ClaudeCacheService],
  exports: [ClaudeWrapperService, ClaudeCommandService, ClaudeSessionService, ClaudeStreamService, ClaudeErrorService, ClaudeCacheService],
})
export class ClaudeModule {}