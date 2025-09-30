'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type UserProfile } from '@cc-task-manager/schemas';
import { TextField, TextareaField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Temporary workaround: define schema inline until import issue is resolved
const UserProfileSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters')
    .trim(),
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must not exceed 255 characters')
    .trim()
    .toLowerCase(),
  avatar: z.string()
    .url('Avatar must be a valid URL')
    .max(2048, 'Avatar URL must not exceed 2048 characters')
    .optional()
    .nullable(),
  bio: z.string()
    .max(500, 'Bio must not exceed 500 characters')
    .trim()
    .optional()
    .nullable(),
});

/**
 * ProfileSettings component props
 */
interface ProfileSettingsProps {
  initialProfile?: UserProfile;
  onSave?: (profile: UserProfile) => void;
  isLoading?: boolean;
  isSaving?: boolean;
  error?: Error | null;
  className?: string;
  autoSave?: boolean;
}

/**
 * ProfileSettings component for managing user profile information
 *
 * Features:
 * - Profile fields: name, email, avatar URL, bio
 * - React Hook Form with Zod validation
 * - Auto-save or manual save options
 * - Loading and error states
 * - Accessibility features
 * - Clear error messages
 */
export function ProfileSettings({
  initialProfile,
  onSave,
  isLoading = false,
  isSaving = false,
  error = null,
  className,
  autoSave = false,
}: ProfileSettingsProps) {
  const form = useForm<UserProfile>({
    resolver: zodResolver(UserProfileSchema),
    defaultValues: initialProfile || {
      name: '',
      email: '',
      avatar: '',
      bio: '',
    },
  });

  const {
    handleSubmit,
    formState: { errors, isDirty, isValid },
    reset,
    watch,
  } = form;

  // Reset form when initial profile changes
  useEffect(() => {
    if (initialProfile) {
      reset(initialProfile);
    }
  }, [initialProfile, reset]);

  // Auto-save when form changes (debounced in parent)
  useEffect(() => {
    if (autoSave && isDirty && isValid) {
      const subscription = watch((data) => {
        onSave?.(data as UserProfile);
      });
      return () => subscription.unsubscribe();
    }
  }, [autoSave, isDirty, isValid, watch, onSave]);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: UserProfile) => {
    try {
      onSave?.(data);
    } catch (error) {
      console.error('Failed to save profile:', error);
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
          <User className="h-5 w-5" />
          <CardTitle>Profile Settings</CardTitle>
        </div>
        <CardDescription>
          Manage your personal information and profile details
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
                  {error.message || 'Failed to save profile settings. Please try again.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Success alert (only shown when not auto-saving) */}
            {!autoSave && !isDirty && !hasErrors && !error && (
              <Alert className="mb-4 border-green-500 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Profile settings saved successfully
                </AlertDescription>
              </Alert>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Name field */}
              <TextField
                form={form}
                name="name"
                label="Display Name"
                placeholder="Enter your full name"
                required
                disabled={isSaving}
                autoComplete="name"
                description="Your name as it will appear throughout the application"
              />

              {/* Email field */}
              <TextField
                form={form}
                name="email"
                label="Email Address"
                type="email"
                placeholder="your.email@example.com"
                required
                disabled={isSaving}
                autoComplete="email"
                description="Your primary email address for notifications and communication"
              />

              {/* Avatar URL field */}
              <TextField
                form={form}
                name="avatar"
                label="Avatar URL"
                type="url"
                placeholder="https://example.com/avatar.jpg"
                disabled={isSaving}
                autoComplete="photo"
                description="URL to your profile picture (optional)"
              />

              {/* Bio field */}
              <TextareaField
                form={form}
                name="bio"
                label="Biography"
                placeholder="Tell us about yourself..."
                rows={4}
                disabled={isSaving}
                description="A brief description about yourself (up to 500 characters)"
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