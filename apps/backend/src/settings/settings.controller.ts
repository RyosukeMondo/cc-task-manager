import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '../auth';
import { JWTPayload } from '@schemas/auth';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/**
 * Settings Controller
 *
 * Exposes REST API endpoints for user settings management with auto-create functionality.
 * All endpoints are protected with JWT authentication.
 */
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * GET /api/settings
   * Get user settings, auto-creating them with defaults if they don't exist
   * @param user - Current user from JWT payload
   * @returns User settings (200 OK)
   */
  @Get()
  async getSettings(@CurrentUser() user: JWTPayload) {
    return this.settingsService.getOrCreateSettings(user.sub);
  }

  /**
   * PATCH /api/settings
   * Update user settings, creating them with defaults if they don't exist
   * @param user - Current user from JWT payload
   * @param dto - Settings update data
   * @returns Updated settings (200 OK)
   */
  @Patch()
  async updateSettings(
    @CurrentUser() user: JWTPayload,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(user.sub, dto);
  }
}
