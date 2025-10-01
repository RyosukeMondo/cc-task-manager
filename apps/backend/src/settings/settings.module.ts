import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SettingsService } from './settings.service';
import { SettingsRepository } from './settings.repository';
import { SettingsController } from './settings.controller';

/**
 * Settings Module
 *
 * Provides user settings management functionality with authentication integration.
 *
 * Features:
 * - User preferences and settings storage
 * - Auto-create settings on first access
 * - JWT-based authentication protection
 * - Repository pattern for data access
 *
 * Dependencies:
 * - AuthModule: Provides JwtAuthGuard for endpoint protection
 * - DatabaseModule: Provides PrismaService for data persistence
 */
@Module({
  imports: [
    AuthModule,
    DatabaseModule,
  ],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    SettingsRepository,
  ],
  exports: [
    SettingsService,
    SettingsRepository,
  ],
})
export class SettingsModule {}
