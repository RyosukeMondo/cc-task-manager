import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Settings, Theme, DisplayDensity } from '@prisma/client';
import { SettingsRepository } from './settings.repository';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/**
 * Settings Service
 *
 * Business logic layer for settings management with auto-create functionality.
 * Provides seamless UX by automatically creating default settings for new users.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get settings for a user, creating default settings if they don't exist
   * @param userId - The user's unique identifier
   * @returns User settings (auto-created if missing)
   */
  async getOrCreateSettings(userId: string): Promise<Settings> {
    // Try to find existing settings
    const existingSettings = await this.settingsRepository.findByUserId(userId);

    // If settings exist, return them
    if (existingSettings) {
      return existingSettings;
    }

    // If settings don't exist, create them with defaults
    const defaults = this.getDefaults();
    return this.settingsRepository.create({
      user: { connect: { id: userId } },
      ...defaults,
    });
  }

  /**
   * Update user settings, creating them with defaults if they don't exist
   * Uses upsert to handle both create and update atomically, preventing race conditions
   * @param userId - The user's unique identifier
   * @param dto - Settings update data
   * @returns Updated settings
   */
  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<Settings> {
    const defaults = this.getDefaults();

    return this.settingsRepository.upsert({
      where: { userId },
      update: dto,
      create: {
        user: { connect: { id: userId } },
        ...defaults,
        ...dto, // Merge dto with defaults, dto takes precedence
      },
    });
  }

  /**
   * Get default settings values
   * Reads from environment configuration or falls back to sensible defaults
   * @returns Default settings object
   */
  getDefaults(): {
    theme: Theme;
    notifications: boolean;
    displayDensity: DisplayDensity;
    language: string;
  } {
    return {
      theme: (this.configService.get<string>('SETTINGS_DEFAULT_THEME') as Theme) || Theme.SYSTEM,
      notifications: this.configService.get<string>('SETTINGS_DEFAULT_NOTIFICATIONS') === 'true' || true,
      displayDensity:
        (this.configService.get<string>('SETTINGS_DEFAULT_DENSITY') as DisplayDensity) ||
        DisplayDensity.COMFORTABLE,
      language: this.configService.get<string>('SETTINGS_DEFAULT_LANGUAGE') || 'en',
    };
  }
}
