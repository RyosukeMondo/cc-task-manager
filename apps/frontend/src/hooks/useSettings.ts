'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { apiClient } from '@/lib/api/contract-client';
import {
  validateSettings,
  validateSettingsUpdate,
  type Settings,
  type SettingsUpdate,
} from '@/types/settings';
import { useCallback, useEffect, useRef } from 'react';

// Settings storage key for local persistence
const SETTINGS_STORAGE_KEY = 'user_settings';

// Debounce delay for auto-save (in milliseconds)
const AUTO_SAVE_DELAY = 1000;

// Default settings when API is unavailable or settings don't exist yet
const DEFAULT_SETTINGS: Settings = {
  profile: {
    name: '',
    email: '',
    avatar: '',
    bio: '',
    timezone: 'America/New_York',
    language: 'en',
  },
  preferences: {
    theme: 'system',
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    defaultView: 'dashboard',
  },
  notifications: {
    emailNotifications: true,
    pushNotifications: false,
    taskReminders: true,
    weeklyDigest: false,
    soundEnabled: true,
  },
};

// Query key factory for settings
export const settingsKeys = {
  all: ['settings'] as const,
  user: (userId: string) => ['settings', userId] as const,
};

/**
 * Hook for managing settings with API and local storage persistence
 *
 * Features:
 * - Fetches settings from API
 * - Caches settings in local storage
 * - Provides CRUD operations
 * - Implements optimistic updates
 * - Debounces auto-save
 * - Handles loading and error states
 */
export function useSettings(
  userId: string,
  options?: UseQueryOptions<Settings>
) {
  const queryClient = useQueryClient();
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Fetch settings from API
  const query = useQuery({
    queryKey: settingsKeys.user(userId),
    queryFn: async () => {
      // Try to get from API first
      const settings = await apiClient.getSettings(userId);

      // Validate the response
      const validatedSettings = validateSettings(settings);

      // Cache in local storage
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify(validatedSettings)
        );
      }

      return validatedSettings;
    },
    // Use cached data from local storage while fetching
    placeholderData: () => {
      if (typeof window === 'undefined') return undefined;

      try {
        const cached = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!cached) return undefined;

        const parsed = JSON.parse(cached);
        return validateSettings(parsed);
      } catch {
        // Invalid cached data, ignore
        return undefined;
      }
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    ...options,
  });

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: SettingsUpdate) => {
      // Validate updates before sending
      const validatedUpdates = validateSettingsUpdate(updates);

      // Send to API
      const updatedSettings = await apiClient.updateSettings(userId, validatedUpdates);

      // Validate response
      return validateSettings(updatedSettings);
    },
    onMutate: async (updates: SettingsUpdate) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: settingsKeys.user(userId) });

      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData<Settings>(
        settingsKeys.user(userId)
      );

      // Optimistically update to the new value
      if (previousSettings) {
        const optimisticSettings: Settings = {
          ...previousSettings,
          ...(updates.profile && {
            profile: { ...previousSettings.profile, ...updates.profile },
          }),
          ...(updates.preferences && {
            preferences: { ...previousSettings.preferences, ...updates.preferences },
          }),
          ...(updates.notifications && {
            notifications: { ...previousSettings.notifications, ...updates.notifications },
          }),
        };

        queryClient.setQueryData(settingsKeys.user(userId), optimisticSettings);

        // Update local storage
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            SETTINGS_STORAGE_KEY,
            JSON.stringify(optimisticSettings)
          );
        }
      }

      // Return context with previous settings for rollback
      return { previousSettings };
    },
    onError: (err, updates, context) => {
      // Rollback to previous value on error
      if (context?.previousSettings) {
        queryClient.setQueryData(
          settingsKeys.user(userId),
          context.previousSettings
        );

        // Restore local storage
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            SETTINGS_STORAGE_KEY,
            JSON.stringify(context.previousSettings)
          );
        }
      }
    },
    onSuccess: (updatedSettings) => {
      // Update cache with server response
      queryClient.setQueryData(settingsKeys.user(userId), updatedSettings);

      // Update local storage
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify(updatedSettings)
        );
      }
    },
  });

  // Debounced auto-save function
  const autoSave = useCallback(
    (updates: SettingsUpdate) => {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Set new timeout
      autoSaveTimeoutRef.current = setTimeout(() => {
        updateMutation.mutate(updates);
      }, AUTO_SAVE_DELAY);
    },
    [updateMutation]
  );

  // Immediate save function (no debounce)
  const save = useCallback(
    (updates: SettingsUpdate) => {
      // Clear any pending auto-save
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      updateMutation.mutate(updates);
    },
    [updateMutation]
  );

  // Update profile
  const updateProfile = useCallback(
    (profile: Partial<Settings['profile']>, immediate = false) => {
      const updates: SettingsUpdate = { profile };

      if (immediate) {
        save(updates);
      } else {
        autoSave(updates);
      }
    },
    [save, autoSave]
  );

  // Update preferences
  const updatePreferences = useCallback(
    (preferences: Partial<Settings['preferences']>, immediate = false) => {
      const updates: SettingsUpdate = { preferences };

      if (immediate) {
        save(updates);
      } else {
        autoSave(updates);
      }
    },
    [save, autoSave]
  );

  // Update notifications
  const updateNotifications = useCallback(
    (notifications: Partial<Settings['notifications']>, immediate = false) => {
      const updates: SettingsUpdate = { notifications };

      if (immediate) {
        save(updates);
      } else {
        autoSave(updates);
      }
    },
    [save, autoSave]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Data - Use default settings if API fails and no cached data
    settings: query.data || DEFAULT_SETTINGS,

    // Loading states
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isUpdating: updateMutation.isPending,

    // Error states
    error: query.error || updateMutation.error,
    isError: query.isError || updateMutation.isError,

    // Update functions
    updateProfile,
    updatePreferences,
    updateNotifications,
    save,
    autoSave,

    // Raw mutation for advanced use cases
    updateMutation,

    // Query utilities
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}