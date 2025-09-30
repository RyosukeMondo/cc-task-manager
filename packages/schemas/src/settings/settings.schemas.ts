import { z } from 'zod';

/**
 * Shared Settings Schemas
 * Single Source of Truth for settings-related contracts between frontend and backend
 *
 * This file ensures type safety and validation consistency across the application.
 */

/**
 * Theme enumeration for application appearance
 * - light: Light theme with bright colors
 * - dark: Dark theme with muted colors
 * - system: Automatically follow system theme preference
 */
export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

/**
 * Language enumeration for application localization
 * ISO 639-1 language codes
 */
export enum Language {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
  DE = 'de',
  IT = 'it',
  PT = 'pt',
  JA = 'ja',
  ZH = 'zh',
  KO = 'ko',
}

/**
 * Date format enumeration for display preferences
 */
export enum DateFormat {
  ISO = 'yyyy-MM-dd',           // 2025-09-30
  US = 'MM/dd/yyyy',            // 09/30/2025
  EU = 'dd/MM/yyyy',            // 30/09/2025
  LONG = 'MMMM d, yyyy',        // September 30, 2025
}

/**
 * Time format enumeration for display preferences
 */
export enum TimeFormat {
  TWELVE_HOUR = '12h',          // 2:30 PM
  TWENTY_FOUR_HOUR = '24h',     // 14:30
}

/**
 * Default view enumeration for initial page display
 */
export enum DefaultView {
  DASHBOARD = 'dashboard',
  TASKS = 'tasks',
  CALENDAR = 'calendar',
  ANALYTICS = 'analytics',
}

/**
 * Theme schema for application appearance settings
 */
export const ThemeSchema = z.nativeEnum(Theme);

/**
 * Language schema for application localization
 */
export const LanguageSchema = z.nativeEnum(Language);

/**
 * User profile schema for personal information
 * Contains user identity and profile data
 */
export const UserProfileSchema = z.object({
  /**
   * User's display name
   * Must be between 1-100 characters
   */
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters'),

  /**
   * User's email address
   * Must be valid email format
   */
  email: z.string()
    .email('Invalid email address'),

  /**
   * URL to user's avatar image
   * Must be valid HTTPS URL if provided
   */
  avatar: z.string()
    .url('Avatar must be a valid URL')
    .regex(/^https:\/\//, 'Avatar URL must use HTTPS')
    .optional()
    .nullable(),

  /**
   * User's biographical information
   * Max 500 characters for display purposes
   */
  bio: z.string()
    .max(500, 'Bio must not exceed 500 characters')
    .optional()
    .nullable(),
});

/**
 * Application preferences schema for UI/UX customization
 * Controls how the application looks and behaves for the user
 */
export const AppPreferencesSchema = z.object({
  /**
   * Theme preference (light, dark, or system)
   * Controls application color scheme
   */
  theme: ThemeSchema.default(Theme.SYSTEM),

  /**
   * Language preference for UI text
   * Controls interface localization
   */
  language: LanguageSchema.default(Language.EN),

  /**
   * Date format preference
   * Controls how dates are displayed throughout the app
   */
  dateFormat: z.nativeEnum(DateFormat).default(DateFormat.ISO),

  /**
   * Time format preference (12h or 24h)
   * Controls how times are displayed throughout the app
   */
  timeFormat: z.nativeEnum(TimeFormat).default(TimeFormat.TWENTY_FOUR_HOUR),

  /**
   * Default view when opening the application
   * Controls which page user sees on login
   */
  defaultView: z.nativeEnum(DefaultView).default(DefaultView.DASHBOARD),
});

/**
 * Notification settings schema for communication preferences
 * Controls how and when the user receives notifications
 */
export const NotificationSettingsSchema = z.object({
  /**
   * Enable/disable email notifications
   * When true, user receives notifications via email
   */
  emailNotifications: z.boolean().default(true),

  /**
   * Enable/disable push notifications
   * When true, user receives browser/mobile push notifications
   */
  pushNotifications: z.boolean().default(true),

  /**
   * Enable/disable task reminder notifications
   * When true, user receives reminders for upcoming tasks
   */
  taskReminders: z.boolean().default(true),

  /**
   * Enable/disable daily digest emails
   * When true, user receives a daily summary email
   */
  dailyDigest: z.boolean().default(false),
});

/**
 * Composite settings schema combining all setting categories
 * Represents the complete user settings entity in the database
 */
export const SettingsSchema = z.object({
  /**
   * Unique identifier for settings record
   */
  id: z.string().uuid('Settings ID must be a valid UUID').optional(),

  /**
   * User ID this settings record belongs to
   * Links settings to a specific user
   */
  userId: z.string().uuid('User ID must be a valid UUID'),

  /**
   * User profile information
   */
  profile: UserProfileSchema,

  /**
   * Application preferences
   */
  preferences: AppPreferencesSchema,

  /**
   * Notification settings
   */
  notifications: NotificationSettingsSchema,

  /**
   * Timestamp when settings were created
   */
  createdAt: z.date().optional(),

  /**
   * Timestamp when settings were last updated
   */
  updatedAt: z.date().optional(),
});

/**
 * Settings update schema for partial updates
 * Allows updating individual setting categories without providing all fields
 */
export const SettingsUpdateSchema = z.object({
  profile: UserProfileSchema.partial().optional(),
  preferences: AppPreferencesSchema.partial().optional(),
  notifications: NotificationSettingsSchema.partial().optional(),
}).refine(
  (data) => data.profile || data.preferences || data.notifications,
  'At least one settings category must be provided for update'
);

/**
 * TypeScript types derived from Zod schemas
 */
export type Settings = z.infer<typeof SettingsSchema>;
export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type AppPreferences = z.infer<typeof AppPreferencesSchema>;
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

/**
 * Validation helper functions for runtime type checking
 */
export const validateSettings = (data: unknown): Settings => {
  return SettingsSchema.parse(data);
};

export const validateSettingsUpdate = (data: unknown): SettingsUpdate => {
  return SettingsUpdateSchema.parse(data);
};

export const validateUserProfile = (data: unknown): UserProfile => {
  return UserProfileSchema.parse(data);
};

export const validateAppPreferences = (data: unknown): AppPreferences => {
  return AppPreferencesSchema.parse(data);
};

export const validateNotificationSettings = (data: unknown): NotificationSettings => {
  return NotificationSettingsSchema.parse(data);
};