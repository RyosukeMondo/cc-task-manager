import { ThemeConfig, ThemePreferences } from './types';

export const THEME_STORAGE_KEY = 'cc-task-manager-theme-preferences';

export const DEFAULT_PREFERENCES: ThemePreferences = {
  theme: 'system',
  accessibility: 'default',
  fontSize: 'medium',
  reducedMotion: false,
  highContrast: false,
};

export const THEME_CONFIG: ThemeConfig = {
  defaultTheme: 'system',
  defaultPreferences: DEFAULT_PREFERENCES,
  storageKey: THEME_STORAGE_KEY,
  enableTransitions: true,
  respectSystemPreferences: true,
};

export const THEME_CLASSES = {
  light: '',
  dark: 'dark',
  highContrast: 'high-contrast',
  reducedMotion: 'reduce-motion',
} as const;

export const FONT_SIZE_CLASSES = {
  small: 'text-sm',
  medium: 'text-base',
  large: 'text-lg',
} as const;

// Media queries for system preferences
export const MEDIA_QUERIES = {
  DARK_MODE: '(prefers-color-scheme: dark)',
  REDUCED_MOTION: '(prefers-reduced-motion: reduce)',
  HIGH_CONTRAST: '(prefers-contrast: high)',
} as const;

// Accessibility constants
export const ACCESSIBILITY_FEATURES = {
  FOCUS_VISIBLE: 'focus-visible',
  FOCUS_WITHIN: 'focus-within',
  MOTION_SAFE: 'motion-safe',
  MOTION_REDUCE: 'motion-reduce',
} as const;