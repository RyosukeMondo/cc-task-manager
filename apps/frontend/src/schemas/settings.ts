/**
 * Frontend Settings Validation Schemas
 *
 * This file imports and re-exports Zod schemas from the shared contract package
 * (@cc-task-manager/schemas) to ensure validation consistency between frontend and backend.
 *
 * Client-side specific refinements are added only when needed for UI-specific validations
 * that are not relevant to the backend (e.g., real-time field validation).
 */

// Import all schemas from shared contract
export {
  // Schemas
  SettingsSchema,
  SettingsUpdateSchema,
  UserProfileSchema,
  AppPreferencesSchema,
  NotificationSettingsSchema,
  ThemeSchema,
  LanguageSchema,

  // Types
  type Settings,
  type SettingsUpdate,
  type UserProfile,
  type AppPreferences,
  type NotificationSettings,

  // Enums
  Theme,
  Language,
  DateFormat,
  TimeFormat,
  DefaultView,

  // Validation helpers
  validateSettings,
  validateSettingsUpdate,
  validateUserProfile,
  validateAppPreferences,
  validateNotificationSettings,
} from '@cc-task-manager/schemas';