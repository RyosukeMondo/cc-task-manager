import { Module } from '@nestjs/common';
import { ClaudeWrapperService } from './claude-wrapper.service';

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
 * Future services to be added:
 * - ClaudeCommandService (task 2)
 * - ClaudeSessionService (task 3)
 * - ClaudeQueueService (task 4)
 * - ClaudeStreamService (task 5)
 * - ClaudeErrorService (task 6)
 * - ClaudeMetricsService (task 7)
 * - ClaudeConfigService (task 8)
 * - ClaudeCacheService (task 10)
 */
@Module({
  providers: [ClaudeWrapperService],
  exports: [ClaudeWrapperService],
})
export class ClaudeModule {}