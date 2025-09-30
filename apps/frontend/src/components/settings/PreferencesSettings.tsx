'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AppPreferences } from '@/types/settings';

// Temporary workaround: define enums and schemas inline until import issue is resolved
enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

enum Language {
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

enum DateFormat {
  MM_DD_YYYY = 'MM/DD/YYYY',
  DD_MM_YYYY = 'DD/MM/YYYY',
  YYYY_MM_DD = 'YYYY-MM-DD',
  MMM_DD_YYYY = 'MMM DD, YYYY',
  DD_MMM_YYYY = 'DD MMM YYYY',
}

enum TimeFormat {
  TWELVE_HOUR = '12h',
  TWENTY_FOUR_HOUR = '24h',
}

enum DefaultView {
  DASHBOARD = 'dashboard',
  TASKS = 'tasks',
  CALENDAR = 'calendar',
  SETTINGS = 'settings',
}

const ThemeSchema = z.nativeEnum(Theme);
const LanguageSchema = z.nativeEnum(Language);
const DateFormatSchema = z.nativeEnum(DateFormat);
const TimeFormatSchema = z.nativeEnum(TimeFormat);
const DefaultViewSchema = z.nativeEnum(DefaultView);

const AppPreferencesSchema = z.object({
  theme: ThemeSchema,
  language: LanguageSchema,
  dateFormat: DateFormatSchema,
  timeFormat: TimeFormatSchema,
  defaultView: DefaultViewSchema,
});
import { SelectField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Settings2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme/context';

/**
 * PreferencesSettings component props
 */
interface PreferencesSettingsProps {
  initialPreferences?: AppPreferences;
  onSave?: (preferences: AppPreferences) => void;
  isLoading?: boolean;
  isSaving?: boolean;
  error?: Error | null;
  className?: string;
  autoSave?: boolean;
}

/**
 * PreferencesSettings component for managing application preferences
 *
 * Features:
 * - Theme selection with live preview
 * - Language selection
 * - Date/time format preferences
 * - Default view selection
 * - React Hook Form with Zod validation
 * - Auto-save or manual save options
 * - Integration with theme context for live theme switching
 * - Loading and error states
 * - Accessibility features
 */
export function PreferencesSettings({
  initialPreferences,
  onSave,
  isLoading = false,
  isSaving = false,
  error = null,
  className,
  autoSave = false,
}: PreferencesSettingsProps) {
  const { setTheme } = useTheme();

  const form = useForm<AppPreferences>({
    resolver: zodResolver(AppPreferencesSchema),
    defaultValues: initialPreferences || {
      theme: Theme.SYSTEM,
      language: Language.EN,
      dateFormat: DateFormat.MM_DD_YYYY,
      timeFormat: TimeFormat.TWELVE_HOUR,
      defaultView: DefaultView.DASHBOARD,
    },
  });

  const {
    handleSubmit,
    formState: { errors, isDirty, isValid },
    reset,
    watch,
  } = form;

  // Watch theme changes to apply them live
  const currentTheme = watch('theme');

  // Apply theme changes immediately for live preview
  useEffect(() => {
    if (currentTheme) {
      setTheme(currentTheme as any);
    }
  }, [currentTheme, setTheme]);

  // Reset form when initial preferences change
  useEffect(() => {
    if (initialPreferences) {
      reset(initialPreferences);
    }
  }, [initialPreferences, reset]);

  // Auto-save when form changes (debounced in parent)
  useEffect(() => {
    if (autoSave && isDirty && isValid) {
      const subscription = watch((data) => {
        onSave?.(data as AppPreferences);
      });
      return () => subscription.unsubscribe();
    }
  }, [autoSave, isDirty, isValid, watch, onSave]);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: AppPreferences) => {
    try {
      onSave?.(data);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  /**
   * Check if form has errors
   */
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          <CardTitle>Application Preferences</CardTitle>
        </div>
        <CardDescription>
          Customize your application experience and behavior
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Loading state */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Error alert */}
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error.message || 'Failed to save preferences. Please try again.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Success alert (only shown when not auto-saving) */}
            {!autoSave && !isDirty && !hasErrors && !error && (
              <Alert className="mb-4 border-green-500 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Preferences saved successfully
                </AlertDescription>
              </Alert>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Theme selection */}
              <SelectField
                form={form}
                name="theme"
                label="Theme"
                options={[
                  { value: Theme.LIGHT, label: 'Light' },
                  { value: Theme.DARK, label: 'Dark' },
                  { value: Theme.SYSTEM, label: 'System' },
                ]}
                placeholder="Select theme"
                disabled={isSaving}
                description="Choose your preferred color theme. Changes apply immediately."
              />

              {/* Language selection */}
              <SelectField
                form={form}
                name="language"
                label="Language"
                options={[
                  { value: Language.EN, label: 'English' },
                  { value: Language.ES, label: 'Español' },
                  { value: Language.FR, label: 'Français' },
                  { value: Language.DE, label: 'Deutsch' },
                  { value: Language.IT, label: 'Italiano' },
                  { value: Language.PT, label: 'Português' },
                  { value: Language.JA, label: '日本語' },
                  { value: Language.ZH, label: '中文' },
                  { value: Language.KO, label: '한국어' },
                  { value: Language.RU, label: 'Русский' },
                ]}
                placeholder="Select language"
                disabled={isSaving}
                description="Select your preferred language for the interface"
              />

              {/* Date format selection */}
              <SelectField
                form={form}
                name="dateFormat"
                label="Date Format"
                options={[
                  { value: DateFormat.MM_DD_YYYY, label: 'MM/DD/YYYY (12/31/2023)' },
                  { value: DateFormat.DD_MM_YYYY, label: 'DD/MM/YYYY (31/12/2023)' },
                  { value: DateFormat.YYYY_MM_DD, label: 'YYYY-MM-DD (2023-12-31)' },
                  { value: DateFormat.MMM_DD_YYYY, label: 'MMM DD, YYYY (Dec 31, 2023)' },
                  { value: DateFormat.DD_MMM_YYYY, label: 'DD MMM YYYY (31 Dec 2023)' },
                ]}
                placeholder="Select date format"
                disabled={isSaving}
                description="How dates are displayed throughout the application"
              />

              {/* Time format selection */}
              <SelectField
                form={form}
                name="timeFormat"
                label="Time Format"
                options={[
                  { value: TimeFormat.TWELVE_HOUR, label: '12-hour (1:30 PM)' },
                  { value: TimeFormat.TWENTY_FOUR_HOUR, label: '24-hour (13:30)' },
                ]}
                placeholder="Select time format"
                disabled={isSaving}
                description="How times are displayed throughout the application"
              />

              {/* Default view selection */}
              <SelectField
                form={form}
                name="defaultView"
                label="Default View"
                options={[
                  { value: DefaultView.DASHBOARD, label: 'Dashboard' },
                  { value: DefaultView.TASKS, label: 'Tasks' },
                  { value: DefaultView.CALENDAR, label: 'Calendar' },
                  { value: DefaultView.SETTINGS, label: 'Settings' },
                ]}
                placeholder="Select default view"
                disabled={isSaving}
                description="The page you see when you first open the application"
              />

              {/* Form actions */}
              {!autoSave && (
                <div className="flex items-center justify-end gap-4 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => reset()}
                    disabled={!isDirty || isSaving}
                  >
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isDirty || !isValid || isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              )}

              {/* Auto-save indicator */}
              {autoSave && isSaving && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving changes...</span>
                </div>
              )}
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}