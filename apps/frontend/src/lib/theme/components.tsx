'use client';

import React from 'react';
import { useTheme } from './context';
import { Theme } from './types';

// Basic theme toggle button component
export function ThemeToggle() {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      {isDark ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

// Theme selector dropdown component
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
  ];

  return (
    <div className="relative">
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
        className="appearance-none bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-w-[120px]"
        aria-label="Select theme"
      >
        {themes.map((themeOption) => (
          <option key={themeOption.value} value={themeOption.value}>
            {themeOption.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Accessibility preferences component
export function AccessibilityControls() {
  const {
    preferences,
    setFontSize,
    setReducedMotion,
    setHighContrast,
  } = useTheme();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Accessibility Preferences</h3>

      {/* Font Size Control */}
      <div className="space-y-2">
        <label htmlFor="font-size" className="text-sm font-medium">
          Font Size
        </label>
        <select
          id="font-size"
          value={preferences.fontSize}
          onChange={(e) => setFontSize(e.target.value as typeof preferences.fontSize)}
          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      {/* High Contrast Toggle */}
      <div className="flex items-center justify-between">
        <label htmlFor="high-contrast" className="text-sm font-medium">
          High Contrast
        </label>
        <button
          id="high-contrast"
          type="button"
          role="switch"
          aria-checked={preferences.highContrast}
          onClick={() => setHighContrast(!preferences.highContrast)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
            preferences.highContrast ? 'bg-primary' : 'bg-input'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
              preferences.highContrast ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Reduced Motion Toggle */}
      <div className="flex items-center justify-between">
        <label htmlFor="reduced-motion" className="text-sm font-medium">
          Reduce Motion
        </label>
        <button
          id="reduced-motion"
          type="button"
          role="switch"
          aria-checked={preferences.reducedMotion}
          onClick={() => setReducedMotion(!preferences.reducedMotion)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
            preferences.reducedMotion ? 'bg-primary' : 'bg-input'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
              preferences.reducedMotion ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

// Theme status indicator (useful for debugging)
export function ThemeStatus() {
  const { theme, resolvedTheme, preferences } = useTheme();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-background border border-border rounded-md p-2 text-xs font-mono shadow-lg">
      <div>Theme: {theme}</div>
      <div>Resolved: {resolvedTheme}</div>
      <div>High Contrast: {preferences.highContrast ? 'Yes' : 'No'}</div>
      <div>Reduced Motion: {preferences.reducedMotion ? 'Yes' : 'No'}</div>
      <div>Font Size: {preferences.fontSize}</div>
    </div>
  );
}