/**
 * Settings Module Exports
 * Re-exports all settings-related schemas, types, enums, and validation functions
 */

export {
  // Enums
  Theme,
  Language,
  DateFormat,
  TimeFormat,
  DefaultView,

  // Schemas
  ThemeSchema,
  LanguageSchema,
  UserProfileSchema,
  AppPreferencesSchema,
  NotificationSettingsSchema,
  SettingsSchema,
  SettingsUpdateSchema,

  // Types
  type Settings,
  type SettingsUpdate,
  type UserProfile,
  type AppPreferences,
  type NotificationSettings,

  // Validation functions
  validateSettings,
  validateSettingsUpdate,
  validateUserProfile,
  validateAppPreferences,
  validateNotificationSettings,
} from './settings.schemas';