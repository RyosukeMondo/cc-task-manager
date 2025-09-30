import { z } from 'zod';

/**
 * Shared Settings Schemas
 * Single Source of Truth for settings-related contracts between frontend and backend
 *
 * This file ensures type safety and validation consistency across the application.
 */

/**
 * Theme enumeration for application appearance
 * - light: Light theme
 * - dark: Dark theme
 * - system: Follow system preference
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
  RU = 'ru',
}

/**
 * Date format options for displaying dates
 */
export enum DateFormat {
  MM_DD_YYYY = 'MM/DD/YYYY',
  DD_MM_YYYY = 'DD/MM/YYYY',
  YYYY_MM_DD = 'YYYY-MM-DD',
  MMM_DD_YYYY = 'MMM DD, YYYY',
  DD_MMM_YYYY = 'DD MMM YYYY',
}

/**
 * Time format options for displaying time
 */
export enum TimeFormat {
  TWELVE_HOUR = '12h',
  TWENTY_FOUR_HOUR = '24h',
}

/**
 * Default view options for initial page load
 */
export enum DefaultView {
  DASHBOARD = 'dashboard',
  TASKS = 'tasks',
  CALENDAR = 'calendar',
  SETTINGS = 'settings',
}

/**
 * Theme schema with validation
 */
export const ThemeSchema = z.nativeEnum(Theme);

/**
 * Language schema with validation
 */
export const LanguageSchema = z.nativeEnum(Language);

/**
 * Date format schema with validation
 */
export const DateFormatSchema = z.nativeEnum(DateFormat);

/**
 * Time format schema with validation
 */
export const TimeFormatSchema = z.nativeEnum(TimeFormat);

/**
 * Default view schema with validation
 */
export const DefaultViewSchema = z.nativeEnum(DefaultView);

/**
 * User profile schema for personal information
 * Contains user's display information and bio
 */
export const UserProfileSchema = z.object({
  /**
   * Display name (full name or preferred name)
   * Between 1 and 100 characters
   */
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters')
    .trim(),

  /**
   * User's email address
   * Must be a valid email format
   */
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must not exceed 255 characters')
    .trim()
    .toLowerCase(),

  /**
   * URL to user's avatar/profile image
   * Must be a valid HTTP/HTTPS URL if provided
   */
  avatar: z.string()
    .url('Avatar must be a valid URL')
    .max(2048, 'Avatar URL must not exceed 2048 characters')
    .optional()
    .nullable(),

  /**
   * User's biography or description
   * Up to 500 characters of personal information
   */
  bio: z.string()
    .max(500, 'Bio must not exceed 500 characters')
    .trim()
    .optional()
    .nullable(),
});

/**
 * Application preferences schema
 * Controls UI behavior and display settings
 */
export const AppPreferencesSchema = z.object({
  /**
   * Theme preference for application appearance
   * Options: light, dark, or system (follows OS setting)
   */
  theme: ThemeSchema.default(Theme.SYSTEM),

  /**
   * Language preference for UI localization
   * ISO 639-1 language code (e.g., 'en', 'es', 'fr')
   */
  language: LanguageSchema.default(Language.EN),

  /**
   * Preferred date format for displaying dates
   * Determines how dates are formatted throughout the application
   */
  dateFormat: DateFormatSchema.default(DateFormat.MM_DD_YYYY),

  /**
   * Preferred time format (12-hour or 24-hour)
   * Determines how times are displayed throughout the application
   */
  timeFormat: TimeFormatSchema.default(TimeFormat.TWELVE_HOUR),

  /**
   * Default view to show on application load
   * Determines which page users see when they first open the app
   */
  defaultView: DefaultViewSchema.default(DefaultView.DASHBOARD),
});

/**
 * Notification settings schema
 * Controls how and when users receive notifications
 */
export const NotificationSettingsSchema = z.object({
  /**
   * Enable or disable email notifications
   * When enabled, users receive notifications via email
   */
  emailNotifications: z.boolean().default(true),

  /**
   * Enable or disable push notifications
   * When enabled, users receive browser/mobile push notifications
   */
  pushNotifications: z.boolean().default(true),

  /**
   * Enable or disable task reminder notifications
   * When enabled, users receive reminders for upcoming tasks
   */
  taskReminders: z.boolean().default(true),

  /**
   * Enable or disable daily digest emails
   * When enabled, users receive a daily summary of activity
   */
  dailyDigest: z.boolean().default(false),
});

/**
 * Complete settings schema
 * Composite of all user settings with metadata
 */
export const SettingsSchema = z.object({
  /**
   * Unique identifier for the settings record
   * UUID format
   */
  id: z.string().uuid('Settings ID must be a valid UUID').optional(),

  /**
   * ID of the user these settings belong to
   * UUID format
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
 * Partial settings schema for updates
 * Allows updating individual setting sections without requiring all fields
 */
export const SettingsUpdateSchema = z.object({
  profile: UserProfileSchema.partial().optional(),
  preferences: AppPreferencesSchema.partial().optional(),
  notifications: NotificationSettingsSchema.partial().optional(),
});

/**
 * Settings request schema for fetching user settings
 */
export const SettingsRequestSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
});

/**
 * Settings response schema for API responses
 */
export const SettingsResponseSchema = SettingsSchema;

/**
 * TypeScript types derived from Zod schemas
 */
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type AppPreferences = z.infer<typeof AppPreferencesSchema>;
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;
export type SettingsRequest = z.infer<typeof SettingsRequestSchema>;
export type SettingsResponse = z.infer<typeof SettingsResponseSchema>;

/**
 * Validation helper functions for runtime type checking
 */
export const validateUserProfile = (data: unknown): UserProfile => {
  return UserProfileSchema.parse(data);
};

export const validateAppPreferences = (data: unknown): AppPreferences => {
  return AppPreferencesSchema.parse(data);
};

export const validateNotificationSettings = (data: unknown): NotificationSettings => {
  return NotificationSettingsSchema.parse(data);
};

export const validateSettings = (data: unknown): Settings => {
  return SettingsSchema.parse(data);
};

export const validateSettingsUpdate = (data: unknown): SettingsUpdate => {
  return SettingsUpdateSchema.parse(data);
};

export const validateSettingsRequest = (data: unknown): SettingsRequest => {
  return SettingsRequestSchema.parse(data);
};

export const validateSettingsResponse = (data: unknown): SettingsResponse => {
  return SettingsResponseSchema.parse(data);
};