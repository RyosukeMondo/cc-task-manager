import { Theme, ThemePreferences, AccessibilityPreference } from './types';
import { DEFAULT_PREFERENCES, THEME_STORAGE_KEY, MEDIA_QUERIES } from './config';

/**
 * Get system theme preference
 */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';

  return window.matchMedia(MEDIA_QUERIES.DARK_MODE).matches ? 'dark' : 'light';
}

/**
 * Get system reduced motion preference
 */
export function getSystemReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;

  return window.matchMedia(MEDIA_QUERIES.REDUCED_MOTION).matches;
}

/**
 * Get system high contrast preference
 */
export function getSystemHighContrast(): boolean {
  if (typeof window === 'undefined') return false;

  return window.matchMedia(MEDIA_QUERIES.HIGH_CONTRAST).matches;
}

/**
 * Resolve theme based on system preferences
 */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

/**
 * Get preferences from localStorage with fallback to defaults
 */
export function getStoredPreferences(): ThemePreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (!stored) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(stored) as Partial<ThemePreferences>;

    // Merge with defaults to ensure all properties exist
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
    };
  } catch (error) {
    console.warn('Failed to parse theme preferences from localStorage:', error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Store preferences to localStorage
 */
export function storePreferences(preferences: ThemePreferences): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to store theme preferences to localStorage:', error);
  }
}

/**
 * Apply theme classes to document element
 */
export function applyThemeClasses(
  resolvedTheme: 'light' | 'dark',
  preferences: ThemePreferences
): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Remove existing theme classes
  root.classList.remove('light', 'dark', 'high-contrast', 'reduce-motion');

  // Apply base theme
  if (resolvedTheme === 'dark') {
    root.classList.add('dark');
  }

  // Apply accessibility preferences
  if (preferences.highContrast) {
    root.classList.add('high-contrast');
  }

  if (preferences.reducedMotion) {
    root.classList.add('reduce-motion');
  }

  // Apply font size to body
  const body = document.body;
  body.classList.remove('text-sm', 'text-base', 'text-lg');

  switch (preferences.fontSize) {
    case 'small':
      body.classList.add('text-sm');
      break;
    case 'large':
      body.classList.add('text-lg');
      break;
    default:
      body.classList.add('text-base');
      break;
  }
}

/**
 * Create media query listener for system preferences
 */
export function createSystemPreferenceListener(
  query: string,
  callback: (matches: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const mediaQuery = window.matchMedia(query);
  const handler = (e: MediaQueryListEvent) => callback(e.matches);

  // Add listener
  mediaQuery.addEventListener('change', handler);

  // Return cleanup function
  return () => mediaQuery.removeEventListener('change', handler);
}

/**
 * Validate theme preference
 */
export function isValidTheme(value: unknown): value is Theme {
  return typeof value === 'string' && ['light', 'dark', 'system'].includes(value);
}

/**
 * Validate accessibility preference
 */
export function isValidAccessibilityPreference(value: unknown): value is AccessibilityPreference {
  return typeof value === 'string' && ['default', 'high-contrast', 'reduced-motion'].includes(value);
}

/**
 * Get contrast ratio for accessibility compliance
 */
export function getContrastRatio(color1: string, color2: string): number {
  // This is a simplified implementation
  // In a real application, you might want to use a more comprehensive color contrast library
  return 4.5; // Placeholder - should calculate actual contrast ratio
}

/**
 * Check if colors meet WCAG contrast requirements
 */
export function meetsContrastRequirements(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA'
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return level === 'AA' ? ratio >= 4.5 : ratio >= 7;
}