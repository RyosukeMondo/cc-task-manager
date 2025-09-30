/**
 * Settings Type Re-exports
 *
 * This file re-exports settings types from the shared schemas package
 * to ensure frontend-backend consistency for settings data.
 *
 * All type definitions are maintained in @cc-task-manager/schemas
 * following contract-first development principles.
 */

export type {
  Settings,
  UserProfile,
  AppPreferences,
  NotificationSettings,
  Theme,
  Language,
} from '@cc-task-manager/schemas';