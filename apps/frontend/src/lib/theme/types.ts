export type Theme = 'light' | 'dark' | 'system';

export type AccessibilityPreference = 'default' | 'high-contrast' | 'reduced-motion';

export interface ThemePreferences {
  theme: Theme;
  accessibility: AccessibilityPreference;
  fontSize: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
  highContrast: boolean;
}

export interface ThemeContextValue {
  // Current theme state
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  preferences: ThemePreferences;

  // Theme actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Preference actions
  setAccessibility: (preference: AccessibilityPreference) => void;
  setFontSize: (size: ThemePreferences['fontSize']) => void;
  setReducedMotion: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;

  // Utility functions
  resetToDefaults: () => void;
  isDark: boolean;
  isHighContrast: boolean;
}

export interface ThemeConfig {
  defaultTheme: Theme;
  defaultPreferences: ThemePreferences;
  storageKey: string;
  enableTransitions: boolean;
  respectSystemPreferences: boolean;
}