import { z } from 'zod';

/**
 * Theme enum values
 */
export const ThemeEnum = z.enum(['LIGHT', 'DARK', 'SYSTEM']);

/**
 * Display density enum values
 */
export const DisplayDensityEnum = z.enum(['COMFORTABLE', 'COMPACT', 'SPACIOUS']);

/**
 * Update settings schema
 * All fields are optional for partial updates
 */
export const updateSettingsSchema = z.object({
  theme: ThemeEnum.optional(),
  notifications: z.boolean().optional(),
  displayDensity: DisplayDensityEnum.optional(),
  language: z
    .string()
    .length(2, 'Language code must be exactly 2 characters')
    .regex(/^[a-z]{2}$/, 'Language code must be lowercase ISO 639-1 format (e.g., "en", "es")')
    .optional(),
});

/**
 * Settings response schema
 * All fields are required in the response
 */
export const settingsResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  theme: ThemeEnum,
  notifications: z.boolean(),
  displayDensity: DisplayDensityEnum,
  language: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Infer TypeScript types from schemas
 */
export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;
export type Theme = z.infer<typeof ThemeEnum>;
export type DisplayDensity = z.infer<typeof DisplayDensityEnum>;
