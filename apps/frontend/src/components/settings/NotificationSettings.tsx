'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type NotificationSettings } from '@/types/settings';

// Temporary workaround: define schema inline until import issue is resolved
const NotificationSettingsSchema = z.object({
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  taskReminders: z.boolean(),
  dailyDigest: z.boolean(),
});
import { SwitchField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Bell, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * NotificationSettings component props
 */
interface NotificationSettingsProps {
  initialNotifications?: NotificationSettings;
  onSave?: (notifications: NotificationSettings) => void;
  isLoading?: boolean;
  isSaving?: boolean;
  error?: Error | null;
  className?: string;
  autoSave?: boolean;
}

/**
 * NotificationSettings component for managing notification preferences
 *
 * Features:
 * - Toggle email notifications
 * - Toggle push notifications
 * - Toggle task reminders
 * - Toggle daily digest
 * - React Hook Form with Zod validation
 * - Auto-save or manual save options
 * - Loading and error states
 * - Accessibility features
 */
export function NotificationSettings({
  initialNotifications,
  onSave,
  isLoading = false,
  isSaving = false,
  error = null,
  className,
  autoSave = false,
}: NotificationSettingsProps) {
  const form = useForm<NotificationSettings>({
    resolver: zodResolver(NotificationSettingsSchema),
    defaultValues: initialNotifications || {
      emailNotifications: true,
      pushNotifications: true,
      taskReminders: true,
      dailyDigest: false,
    },
  });

  const {
    handleSubmit,
    formState: { errors, isDirty, isValid },
    reset,
    watch,
  } = form;

  // Reset form when initial notifications change
  useEffect(() => {
    if (initialNotifications) {
      reset(initialNotifications);
    }
  }, [initialNotifications, reset]);

  // Auto-save when form changes (debounced in parent)
  useEffect(() => {
    if (autoSave && isDirty && isValid) {
      const subscription = watch((data) => {
        onSave?.(data as NotificationSettings);
      });
      return () => subscription.unsubscribe();
    }
  }, [autoSave, isDirty, isValid, watch, onSave]);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: NotificationSettings) => {
    try {
      onSave?.(data);
    } catch (error) {
      console.error('Failed to save notification settings:', error);
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
          <Bell className="h-5 w-5" />
          <CardTitle>Notification Settings</CardTitle>
        </div>
        <CardDescription>
          Configure how and when you receive notifications
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
                  {error.message || 'Failed to save notification settings. Please try again.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Success alert (only shown when not auto-saving) */}
            {!autoSave && !isDirty && !hasErrors && !error && (
              <Alert className="mb-4 border-green-500 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Notification settings saved successfully
                </AlertDescription>
              </Alert>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Email notifications */}
              <SwitchField
                form={form}
                name="emailNotifications"
                label="Email Notifications"
                disabled={isSaving}
                description="Receive notifications via email for important updates and activities"
                onLabel="Enabled"
                offLabel="Disabled"
              />

              {/* Push notifications */}
              <SwitchField
                form={form}
                name="pushNotifications"
                label="Push Notifications"
                disabled={isSaving}
                description="Receive browser or mobile push notifications for real-time updates"
                onLabel="Enabled"
                offLabel="Disabled"
              />

              {/* Task reminders */}
              <SwitchField
                form={form}
                name="taskReminders"
                label="Task Reminders"
                disabled={isSaving}
                description="Get reminders for upcoming tasks and deadlines"
                onLabel="Enabled"
                offLabel="Disabled"
              />

              {/* Daily digest */}
              <SwitchField
                form={form}
                name="dailyDigest"
                label="Daily Digest"
                disabled={isSaving}
                description="Receive a daily summary of your tasks and activities via email"
                onLabel="Enabled"
                offLabel="Disabled"
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