'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  Theme,
  ThemePreferences,
  ThemeContextValue,
  AccessibilityPreference
} from './types';
import {
  getStoredPreferences,
  storePreferences,
  resolveTheme,
  applyThemeClasses,
  createSystemPreferenceListener,
  getSystemReducedMotion,
  getSystemHighContrast,
} from './utils';
import { DEFAULT_PREFERENCES, MEDIA_QUERIES } from './config';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  enableTransitions?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'cc-task-manager-theme-preferences',
  enableTransitions = true,
}: ThemeProviderProps) {
  const [preferences, setPreferences] = useState<ThemePreferences>(() => ({
    ...DEFAULT_PREFERENCES,
    theme: defaultTheme,
  }));

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Initialize preferences from storage and system
  useEffect(() => {
    const stored = getStoredPreferences();

    // Apply system preferences if not explicitly set
    const initialPreferences: ThemePreferences = {
      ...stored,
      reducedMotion: stored.reducedMotion || getSystemReducedMotion(),
      highContrast: stored.highContrast || getSystemHighContrast(),
    };

    setPreferences(initialPreferences);
    setResolvedTheme(resolveTheme(initialPreferences.theme));
    setMounted(true);
  }, []);

  // Apply theme classes when resolved theme or preferences change
  useEffect(() => {
    if (!mounted) return;

    applyThemeClasses(resolvedTheme, preferences);
  }, [mounted, resolvedTheme, preferences]);

  // Listen for system theme changes
  useEffect(() => {
    if (preferences.theme !== 'system') return;

    const cleanup = createSystemPreferenceListener(
      MEDIA_QUERIES.DARK_MODE,
      (matches) => {
        setResolvedTheme(matches ? 'dark' : 'light');
      }
    );

    return cleanup;
  }, [preferences.theme]);

  // Listen for system reduced motion changes
  useEffect(() => {
    const cleanup = createSystemPreferenceListener(
      MEDIA_QUERIES.REDUCED_MOTION,
      (matches) => {
        setPreferences(prev => ({
          ...prev,
          reducedMotion: matches,
        }));
      }
    );

    return cleanup;
  }, []);

  // Listen for system high contrast changes
  useEffect(() => {
    const cleanup = createSystemPreferenceListener(
      MEDIA_QUERIES.HIGH_CONTRAST,
      (matches) => {
        setPreferences(prev => ({
          ...prev,
          highContrast: matches,
        }));
      }
    );

    return cleanup;
  }, []);

  // Store preferences when they change
  useEffect(() => {
    if (!mounted) return;
    storePreferences(preferences);
  }, [mounted, preferences]);

  const setTheme = useCallback((theme: Theme) => {
    setPreferences(prev => ({ ...prev, theme }));
    setResolvedTheme(resolveTheme(theme));
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  const setAccessibility = useCallback((accessibility: AccessibilityPreference) => {
    setPreferences(prev => ({
      ...prev,
      accessibility,
      highContrast: accessibility === 'high-contrast',
      reducedMotion: accessibility === 'reduced-motion',
    }));
  }, []);

  const setFontSize = useCallback((fontSize: ThemePreferences['fontSize']) => {
    setPreferences(prev => ({ ...prev, fontSize }));
  }, []);

  const setReducedMotion = useCallback((reducedMotion: boolean) => {
    setPreferences(prev => ({ ...prev, reducedMotion }));
  }, []);

  const setHighContrast = useCallback((highContrast: boolean) => {
    setPreferences(prev => ({ ...prev, highContrast }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    setResolvedTheme(resolveTheme(DEFAULT_PREFERENCES.theme));
  }, []);

  const value: ThemeContextValue = {
    theme: preferences.theme,
    resolvedTheme,
    preferences,
    setTheme,
    toggleTheme,
    setAccessibility,
    setFontSize,
    setReducedMotion,
    setHighContrast,
    resetToDefaults,
    isDark: resolvedTheme === 'dark',
    isHighContrast: preferences.highContrast,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}