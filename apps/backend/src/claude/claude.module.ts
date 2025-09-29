import { Module } from '@nestjs/common';
import { ClaudeWrapperService } from './claude-wrapper.service';
import { ClaudeCommandService } from './claude-command.service';
import { ClaudeSessionService } from './claude-session.service';

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
 *
 * Future services to be added:
 * - ClaudeQueueService (task 4)
 * - ClaudeStreamService (task 5)
 * - ClaudeErrorService (task 6)
 * - ClaudeMetricsService (task 7)
 * - ClaudeConfigService (task 8)
 * - ClaudeCacheService (task 10)
 */
@Module({
  providers: [ClaudeWrapperService, ClaudeCommandService, ClaudeSessionService],
  exports: [ClaudeWrapperService, ClaudeCommandService, ClaudeSessionService],
})
export class ClaudeModule {}