/**
 * Settings Type Re-exports
 *
 * This file imports and re-exports settings types from the shared schemas package.
 * Using shared contract types ensures frontend-backend consistency for settings data.
 *
 * @see packages/schemas/src/settings/settings.schemas.ts for source definitions
 */

export type {
  Settings,
  SettingsUpdate,
  SettingsRequest,
  SettingsResponse,
  UserProfile,
  AppPreferences,
  NotificationSettings,
} from '@cc-task-manager/schemas';

export {
  Theme,
  Language,
  DateFormat,
  TimeFormat,
  DefaultView,
} from '@cc-task-manager/schemas';

export {
  SettingsSchema,
  SettingsUpdateSchema,
  SettingsRequestSchema,
  SettingsResponseSchema,
  UserProfileSchema,
  AppPreferencesSchema,
  NotificationSettingsSchema,
  ThemeSchema,
  LanguageSchema,
  DateFormatSchema,
  TimeFormatSchema,
  DefaultViewSchema,
} from '@cc-task-manager/schemas';

export {
  validateSettings,
  validateSettingsUpdate,
  validateSettingsRequest,
  validateSettingsResponse,
  validateUserProfile,
  validateAppPreferences,
  validateNotificationSettings,
} from '@cc-task-manager/schemas';