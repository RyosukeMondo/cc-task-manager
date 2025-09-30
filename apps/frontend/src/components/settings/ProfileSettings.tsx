'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserProfileSchema } from '@cc-task-manager/schemas';
import type { UserProfile } from '../../types/settings';
import { TextField, TextareaField } from '../forms/FormField';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Loader2, Save } from 'lucide-react';

interface ProfileSettingsProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => Promise<void>;
  isLoading?: boolean;
}

export function ProfileSettings({ profile, onSave, isLoading = false }: ProfileSettingsProps) {
  const form = useForm<UserProfile>({
    resolver: zodResolver(UserProfileSchema),
    defaultValues: profile,
  });

  const [isSaving, setIsSaving] = React.useState(false);
  const avatarUrl = form.watch('avatar');
  const userName = form.watch('name');

  const handleSubmit = async (data: UserProfile) => {
    try {
      setIsSaving(true);
      await onSave(data);
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          Update your personal information and profile details
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Avatar Preview */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl || undefined} alt={userName} />
              <AvatarFallback>{getInitials(userName)}</AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">
              Your profile picture will be displayed across the application
            </div>
          </div>

          {/* Name Field */}
          <TextField
            form={form}
            name="name"
            label="Name"
            type="text"
            placeholder="John Doe"
            required
            autoComplete="name"
            description="Your full name as displayed to other users"
            disabled={isLoading || isSaving}
          />

          {/* Email Field */}
          <TextField
            form={form}
            name="email"
            label="Email"
            type="email"
            placeholder="john.doe@example.com"
            required
            autoComplete="email"
            description="Your email address for notifications and account recovery"
            disabled={isLoading || isSaving}
          />

          {/* Avatar URL Field */}
          <TextField
            form={form}
            name="avatar"
            label="Avatar URL"
            type="url"
            placeholder="https://example.com/avatar.jpg"
            autoComplete="photo"
            description="HTTPS URL to your profile picture (optional)"
            disabled={isLoading || isSaving}
          />

          {/* Bio Field */}
          <TextareaField
            form={form}
            name="bio"
            label="Bio"
            placeholder="Tell us about yourself..."
            rows={4}
            description="A short description about yourself (max 500 characters)"
            disabled={isLoading || isSaving}
          />

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              disabled={isLoading || isSaving || !form.formState.isDirty}
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isSaving || !form.formState.isDirty}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}