'use client';

import { useEffect, useState } from 'react';
import { useTheme } from './context';
import { Theme } from './types';
import { getSystemTheme, createSystemPreferenceListener } from './utils';
import { MEDIA_QUERIES } from './config';

/**
 * Hook to get the current system theme preference
 */
export function useSystemTheme(): 'light' | 'dark' {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => getSystemTheme());

  useEffect(() => {
    const cleanup = createSystemPreferenceListener(
      MEDIA_QUERIES.DARK_MODE,
      (matches) => setSystemTheme(matches ? 'dark' : 'light')
    );

    return cleanup;
  }, []);

  return systemTheme;
}

/**
 * Hook to detect if the user prefers reduced motion
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const cleanup = createSystemPreferenceListener(
      MEDIA_QUERIES.REDUCED_MOTION,
      setReducedMotion
    );

    return cleanup;
  }, []);

  return reducedMotion;
}

/**
 * Hook to detect if the user prefers high contrast
 */
export function useHighContrast(): boolean {
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const cleanup = createSystemPreferenceListener(
      MEDIA_QUERIES.HIGH_CONTRAST,
      setHighContrast
    );

    return cleanup;
  }, []);

  return highContrast;
}

/**
 * Hook to get theme-aware CSS classes
 */
export function useThemeClasses() {
  const { resolvedTheme, preferences } = useTheme();

  return {
    theme: resolvedTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    isHighContrast: preferences.highContrast,
    isReducedMotion: preferences.reducedMotion,
    fontSize: preferences.fontSize,

    // Common class combinations
    background: resolvedTheme === 'dark' ? 'bg-gray-900' : 'bg-white',
    text: resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900',
    border: resolvedTheme === 'dark' ? 'border-gray-700' : 'border-gray-200',

    // Accessibility classes
    motion: preferences.reducedMotion ? 'motion-reduce' : 'motion-safe',
    contrast: preferences.highContrast ? 'high-contrast' : '',
  };
}

/**
 * Hook for theme-aware animations
 */
export function useThemeAnimation() {
  const { preferences } = useTheme();

  const shouldAnimate = !preferences.reducedMotion;

  return {
    shouldAnimate,
    duration: shouldAnimate ? 'duration-300' : 'duration-0',
    transition: shouldAnimate ? 'transition-all' : '',

    // Common animation classes
    fadeIn: shouldAnimate ? 'animate-in fade-in' : '',
    slideIn: shouldAnimate ? 'animate-in slide-in-from-left' : '',
    scale: shouldAnimate ? 'animate-in zoom-in' : '',
  };
}

/**
 * Hook to persist and restore theme state
 */
export function useThemePersistence() {
  const { preferences, setTheme, setFontSize, setReducedMotion, setHighContrast } = useTheme();

  const exportPreferences = () => {
    return JSON.stringify(preferences, null, 2);
  };

  const importPreferences = (preferencesJson: string) => {
    try {
      const imported = JSON.parse(preferencesJson);

      if (imported.theme) setTheme(imported.theme);
      if (imported.fontSize) setFontSize(imported.fontSize);
      if (typeof imported.reducedMotion === 'boolean') setReducedMotion(imported.reducedMotion);
      if (typeof imported.highContrast === 'boolean') setHighContrast(imported.highContrast);

      return true;
    } catch (error) {
      console.error('Failed to import theme preferences:', error);
      return false;
    }
  };

  return {
    exportPreferences,
    importPreferences,
    preferences,
  };
}

/**
 * Hook for conditional theme rendering (useful for SSR)
 */
export function useThemeAware<T>(lightValue: T, darkValue: T): T {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Return light value during SSR to prevent hydration mismatch
  if (!mounted) {
    return lightValue;
  }

  return resolvedTheme === 'dark' ? darkValue : lightValue;
}

/**
 * Hook to cycle through available themes
 */
export function useThemeCycle() {
  const { theme, setTheme } = useTheme();

  const themes: Theme[] = ['light', 'dark', 'system'];

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getNextTheme = () => {
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    return themes[nextIndex];
  };

  return {
    cycleTheme,
    getNextTheme,
    currentTheme: theme,
    availableThemes: themes,
  };
}